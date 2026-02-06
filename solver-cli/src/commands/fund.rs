use alloy::primitives::{Address, U256};
use anyhow::Result;
use clap::Args;
use std::env;
use std::path::PathBuf;
use std::str::FromStr;

use crate::chain::ChainClient;
use crate::state::StateManager;
use crate::utils::*;
use crate::OutputFormat;

#[derive(Args)]
pub struct FundCommand {
    /// Project directory
    #[arg(long)]
    pub dir: Option<PathBuf>,

    /// Amount to fund (in base units, e.g., 10000000 for 10 tokens with 6 decimals)
    #[arg(long, default_value = "10000000")]
    pub amount: String,

    /// Token symbol
    #[arg(long, default_value = "USDC")]
    pub token: String,

    /// Specific chain to fund (name or ID). If not specified, funds all chains.
    #[arg(long)]
    pub chain: Option<String>,

    /// Skip native token funding
    #[arg(long)]
    pub skip_native: bool,
}

impl FundCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = self.dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Funding Solver");

        // Load state and env
        let state = state_mgr.load_or_error().await?;
        load_dotenv(&project_dir)?;
        let env_config = EnvConfig::from_env()?;

        let amount: U256 = self.amount.parse()?;

        // Get the solver private key
        let solver_key = env_config.get_solver_pk()?;
        let solver_address = ChainClient::address_from_pk(&solver_key)?;

        // Determine which chains to fund
        let chain_ids: Vec<u64> = if let Some(ref chain_arg) = self.chain {
            // Try to parse as chain ID first
            if let Ok(id) = chain_arg.parse::<u64>() {
                if state.chains.contains_key(&id) {
                    vec![id]
                } else {
                    anyhow::bail!("Chain ID {} not found in state", id);
                }
            } else {
                // Try to find by name
                let chain = state.get_chain_by_name(chain_arg).ok_or_else(|| {
                    anyhow::anyhow!("Chain '{}' not found", chain_arg)
                })?;
                vec![chain.chain_id]
            }
        } else {
            state.chain_ids()
        };

        if chain_ids.is_empty() {
            anyhow::bail!("No chains configured. Run 'solver-cli deploy' first.");
        }

        print_kv("Chains to fund", chain_ids.len());
        print_address("Solver", &format!("{:?}", solver_address));

        // Fund each chain
        for chain_id in &chain_ids {
            let chain = state.chains.get(chain_id).unwrap();
            print_header(&format!("Funding solver on {} (Chain ID: {})", chain.name, chain.chain_id));

            // Get the private key for this chain (to pay gas for minting)
            let chain_env = env_config.get_chain(&chain.name);
            let funder_pk = chain_env.map(|c| c.private_key.clone())
                .or_else(|| env_config.get_any_pk())
                .ok_or_else(|| anyhow::anyhow!("No private key found for chain {}", chain.name))?;

            // 1. Check and fund native tokens (for gas)
            if !self.skip_native {
                let native_balance = Self::get_native_balance(&chain.rpc, solver_address).await?;
                let min_native_balance = U256::from(100_000_000_000_000_000u64); // 0.1 ETH

                print_kv("Native balance", format!("{} wei", native_balance));

                if native_balance < min_native_balance {
                    // Check if this is a local chain (can auto-fund)
                    let is_local = chain.name.to_lowercase().contains("local")
                        || chain.name.to_lowercase().contains("evolve")
                        || chain.name.to_lowercase().contains("anvil");

                    if is_local {
                        print_warning("Low native token balance. Auto-funding with 1.0 native tokens...");
                        let native_amount = U256::from(1_000_000_000_000_000_000u64); // 1.0 ETH
                        Self::send_native_tokens(
                            &chain.rpc,
                            &funder_pk,
                            solver_address,
                            native_amount,
                        )
                        .await?;
                        print_success("Funded solver with 1.0 native tokens (for gas)");
                    } else {
                        print_warning(&format!(
                            "CRITICAL: Solver has insufficient native tokens on {} for gas!",
                            chain.name
                        ));
                        print_warning(&format!(
                            "Current: {} wei | Required: ~0.1 ETH minimum",
                            native_balance
                        ));
                        print_info(&format!(
                            "Please fund solver address {:?} on {} with native tokens.",
                            solver_address, chain.name
                        ));

                        if chain.name.to_lowercase().contains("sepolia") {
                            print_info("Get Sepolia ETH from faucets:");
                            print_info("  - https://www.alchemy.com/faucets/ethereum-sepolia");
                            print_info("  - https://sepoliafaucet.com/");
                        }

                        anyhow::bail!(
                            "Solver needs at least 0.1 native tokens on {} to operate. Please fund and retry.",
                            chain.name
                        );
                    }
                } else {
                    print_success("Solver has sufficient native tokens");
                }
            }

            // 2. Fund ERC20 tokens
            let token_info = chain
                .tokens
                .get(&self.token)
                .ok_or_else(|| anyhow::anyhow!("Token {} not found on {}", self.token, chain.name))?;

            print_address("Token", &token_info.address);

            Self::mint_tokens(
                &chain.rpc,
                &funder_pk,
                &token_info.address,
                solver_address,
                amount,
            )
            .await?;

            print_success(&format!(
                "Minted {} {} to solver on {}",
                self.amount, self.token, chain.name
            ));
        }

        print_summary_start();
        print_kv("Token", &self.token);
        print_kv("Amount per chain", &self.amount);
        print_kv("Chains funded", chain_ids.len());
        print_summary_end();

        print_success("Solver funding complete!");

        if out.is_json() {
            out.json(&serde_json::json!({
                "funded": true,
                "amount": self.amount,
                "token": self.token,
                "chains": chain_ids,
            }))?;
        }

        Ok(())
    }

    async fn get_native_balance(rpc_url: &str, address: Address) -> Result<U256> {
        use std::process::Stdio;
        use tokio::process::Command;

        let output = Command::new("cast")
            .arg("balance")
            .arg(format!("{:?}", address))
            .arg("--rpc-url")
            .arg(rpc_url)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Failed to get native balance: {}", stderr);
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        // cast may return format like "1000000 [1e6]" - extract just the first number
        let balance_str = stdout
            .trim()
            .split_whitespace()
            .next()
            .unwrap_or("0");

        let balance = U256::from_str(balance_str)
            .or_else(|_| U256::from_str_radix(balance_str.trim_start_matches("0x"), 16))
            .unwrap_or(U256::ZERO);

        Ok(balance)
    }

    async fn send_native_tokens(
        rpc_url: &str,
        private_key: &str,
        recipient: Address,
        amount: U256,
    ) -> Result<()> {
        use std::process::Stdio;
        use tokio::process::Command;

        let pk = private_key.strip_prefix("0x").unwrap_or(private_key);

        let output = Command::new("cast")
            .arg("send")
            .arg(format!("{:?}", recipient))
            .arg("--value")
            .arg(amount.to_string())
            .arg("--private-key")
            .arg(pk)
            .arg("--rpc-url")
            .arg(rpc_url)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Failed to send native tokens: {}", stderr);
        }

        Ok(())
    }

    async fn mint_tokens(
        rpc_url: &str,
        private_key: &str,
        token_address: &str,
        recipient: Address,
        amount: U256,
    ) -> Result<()> {
        use std::process::Stdio;
        use tokio::process::Command;

        let pk = private_key.strip_prefix("0x").unwrap_or(private_key);

        let output = Command::new("cast")
            .arg("send")
            .arg(token_address)
            .arg("mint(address,uint256)")
            .arg(format!("{:?}", recipient))
            .arg(amount.to_string())
            .arg("--private-key")
            .arg(pk)
            .arg("--rpc-url")
            .arg(rpc_url)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Mint failed: {}", stderr);
        }

        Ok(())
    }
}
