use anyhow::{Context, Result};
use clap::Args;
use std::env;
use std::path::PathBuf;

use crate::state::StateManager;
use crate::utils::*;
use crate::OutputFormat;

/// Canonical Permit2 address (same on all chains where it's deployed)
const PERMIT2_ADDRESS: &str = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/// Public Ethereum mainnet RPC used to fetch Permit2 bytecode when not locally present
const DEFAULT_MAINNET_RPC: &str = "https://eth.llamarpc.com";

#[derive(Args)]
pub struct DeployPermit2Command {
    /// Project directory
    #[arg(long)]
    pub dir: Option<PathBuf>,

    /// Chains to deploy to (comma-separated). Defaults to all configured chains.
    #[arg(long)]
    pub chains: Option<String>,

    /// Mainnet RPC URL to fetch Permit2 bytecode from when the chain doesn't have it
    #[arg(long, default_value = DEFAULT_MAINNET_RPC)]
    pub mainnet_rpc: String,
}

impl DeployPermit2Command {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        use alloy::primitives::{address, Bytes};
        use alloy::providers::{Provider, ProviderBuilder};

        let out = OutputFormatter::new(output);
        let project_dir = self.dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Deploying Permit2");

        let mut state = state_mgr.load_or_error().await?;
        load_dotenv(&project_dir)?;
        let env_config = EnvConfig::from_env()?;

        let permit2_addr = address!("000000000022D473030F116dDEE9F6B43aC78BA3");

        // Determine which chains to target
        let chain_names: Vec<String> = if let Some(arg) = &self.chains {
            arg.split(',').map(|s| s.trim().to_string()).collect()
        } else {
            env_config.chain_names()
        };

        if chain_names.is_empty() {
            anyhow::bail!("No chains configured. Use --chains or set chain env vars.");
        }

        // Lazily fetch bytecode from mainnet — only if needed
        let mut mainnet_bytecode: Option<Bytes> = None;

        for name in &chain_names {
            let chain = env_config.load_chain(name).ok_or_else(|| {
                anyhow::anyhow!(
                    "Chain '{}' not found. Make sure {}_RPC and {}_PK are set.",
                    name,
                    name.to_uppercase(),
                    name.to_uppercase()
                )
            })?;

            let url: reqwest::Url = chain.rpc_url.parse().context("Invalid RPC URL")?;
            let provider = ProviderBuilder::new().connect_http(url);

            let chain_id = provider
                .get_chain_id()
                .await
                .context("Failed to get chain ID")?;

            print_info(&format!("Chain {} (id={})", name, chain_id));

            // Check if Permit2 already has code at the canonical address
            let existing_code = provider
                .get_code_at(permit2_addr)
                .await
                .context("Failed to get code at Permit2 address")?;

            if !existing_code.is_empty() {
                print_kv(
                    "  Permit2",
                    format!("{} (already deployed)", PERMIT2_ADDRESS),
                );
            } else {
                // Need to inject bytecode — fetch from mainnet if we don't have it yet
                if mainnet_bytecode.is_none() {
                    print_info(&format!(
                        "  Fetching Permit2 bytecode from {}...",
                        self.mainnet_rpc
                    ));
                    let mainnet_url: reqwest::Url = self
                        .mainnet_rpc
                        .parse()
                        .context("Invalid mainnet RPC URL")?;
                    let mainnet_provider = ProviderBuilder::new().connect_http(mainnet_url);
                    let code = mainnet_provider
                        .get_code_at(permit2_addr)
                        .await
                        .context("Failed to fetch Permit2 bytecode from mainnet")?;
                    if code.is_empty() {
                        anyhow::bail!(
                            "Permit2 has no code on mainnet RPC {}. \
                             Try a different --mainnet-rpc.",
                            self.mainnet_rpc
                        );
                    }
                    mainnet_bytecode = Some(code);
                }

                let bytecode = mainnet_bytecode.as_ref().unwrap();

                // Inject via anvil_setCode (works on Anvil/Hardhat nodes)
                provider
                    .raw_request::<_, ()>(
                        "anvil_setCode".into(),
                        (permit2_addr, bytecode),
                    )
                    .await
                    .context(
                        "anvil_setCode failed — is this an Anvil node? \
                         For live networks Permit2 should already be deployed at the canonical address.",
                    )?;

                print_kv(
                    "  Permit2",
                    format!("{} (bytecode injected)", PERMIT2_ADDRESS),
                );
            }

            // Store address in state for this chain
            if let Some(chain_config) = state.chains.get_mut(&chain_id) {
                chain_config.contracts.permit2 = Some(PERMIT2_ADDRESS.to_string());
            } else {
                print_warning(&format!(
                    "  Chain {} (id={}) not found in state — run 'solver-cli deploy' first",
                    name, chain_id
                ));
            }
        }

        state_mgr.save(&state).await?;
        print_success("Permit2 addresses saved to state");

        print_summary_start();
        print_kv("Permit2", PERMIT2_ADDRESS);
        print_summary_end();

        if out.is_json() {
            out.json(&serde_json::json!({ "permit2": PERMIT2_ADDRESS }))?;
        }

        Ok(())
    }
}
