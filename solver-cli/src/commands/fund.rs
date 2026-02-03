use alloy::primitives::{Address, U256};
use anyhow::Result;
use clap::Args;
use std::env;
use std::path::PathBuf;

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

    /// Only fund source chain
    #[arg(long)]
    pub source_only: bool,

    /// Only fund destination chain
    #[arg(long)]
    pub dest_only: bool,
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

        let source = state
            .chains
            .source
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Source chain not configured"))?;

        let dest = state
            .chains
            .destination
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Destination chain not configured"))?;

        // Get the solver private key - use SEPOLIA_PK since EVOLVE_PK is the well-known
        // Anvil key that gets drained by bots on public testnets
        let solver_key = std::env::var("SOLVER_PRIVATE_KEY")
            .or_else(|_| std::env::var("SEPOLIA_PK"))
            .unwrap_or_else(|_| env_config.sepolia_pk.clone());
        let solver_address = ChainClient::address_from_pk(&solver_key)?;

        // Fund source chain solver
        if !self.dest_only {
            print_header(&format!("Funding solver on {}", source.name));
            let token_info = source
                .tokens
                .get(&self.token)
                .ok_or_else(|| anyhow::anyhow!("Token {} not found on source", self.token))?;

            print_address("Solver", &format!("{:?}", solver_address));
            print_address("Token", &token_info.address);

            Self::mint_tokens(
                &source.rpc,
                &env_config.evolve_pk,
                &token_info.address,
                solver_address,
                amount,
            )
            .await?;

            print_success(&format!(
                "Minted {} {} to solver on {}",
                self.amount, self.token, source.name
            ));
        }

        // Fund destination chain solver
        // Solver uses the same key (SEPOLIA_PK) for both chains
        if !self.source_only {
            print_header(&format!("Funding solver on {}", dest.name));

            let token_info = dest
                .tokens
                .get(&self.token)
                .ok_or_else(|| anyhow::anyhow!("Token {} not found on dest", self.token))?;

            print_address("Solver", &format!("{:?}", solver_address));
            print_address("Token", &token_info.address);

            // Use SEPOLIA_PK to pay for gas, but mint TO the solver address
            Self::mint_tokens(
                &dest.rpc,
                &env_config.sepolia_pk,
                &token_info.address,
                solver_address,
                amount,
            )
            .await?;

            print_success(&format!(
                "Minted {} {} to solver on {}",
                self.amount, self.token, dest.name
            ));
        }

        print_summary_start();
        print_kv("Token", &self.token);
        print_kv("Amount per chain", &self.amount);
        print_summary_end();

        print_success("Solver funding complete!");

        if out.is_json() {
            out.json(&serde_json::json!({
                "funded": true,
                "amount": self.amount,
                "token": self.token,
            }))?;
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
