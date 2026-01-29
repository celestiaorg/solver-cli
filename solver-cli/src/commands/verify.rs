use alloy::primitives::Address;
use anyhow::Result;
use clap::Args;
use std::env;
use std::path::PathBuf;

use crate::chain::{format_token_amount, ChainClient};
use crate::state::StateManager;
use crate::utils::*;
use crate::OutputFormat;

#[derive(Args)]
pub struct VerifyCommand {
    /// Project directory
    #[arg(long)]
    pub dir: Option<PathBuf>,

    /// Token symbol to verify
    #[arg(long, default_value = "USDC")]
    pub token: String,
}

impl VerifyCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = self.dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Balance Verification");

        // Load state and env
        let state = state_mgr.load_or_error().await?;
        load_dotenv(&project_dir)?;
        let env_config = EnvConfig::from_env()?;

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

        // Derive addresses
        let user_pk = env_config
            .user_pk
            .ok_or_else(|| anyhow::anyhow!("USER_PK not set"))?;

        let user_address = ChainClient::address_from_pk(&user_pk)?;
        // Solver uses SEPOLIA_PK on BOTH chains (not EVOLVE_PK which is the well-known Anvil key)
        let solver_address = ChainClient::address_from_pk(&env_config.sepolia_pk)?;

        // Get token info
        let source_token = source
            .tokens
            .get(&self.token)
            .ok_or_else(|| anyhow::anyhow!("Token {} not found on source chain", self.token))?;

        let dest_token = dest
            .tokens
            .get(&self.token)
            .ok_or_else(|| anyhow::anyhow!("Token {} not found on dest chain", self.token))?;

        // Connect to chains
        let source_client = ChainClient::new(&source.name, &source.rpc).await?;
        let dest_client = ChainClient::new(&dest.name, &dest.rpc).await?;

        let source_token_addr: Address = source_token.address.parse()?;
        let dest_token_addr: Address = dest_token.address.parse()?;

        // Query balances
        print_header(&format!("Source Chain: {}", source.name));

        let user_source_balance = source_client
            .get_token_balance(source_token_addr, user_address)
            .await?;
        let solver_source_balance = source_client
            .get_token_balance(source_token_addr, solver_address)
            .await?;

        print_address("User address", &format!("{:?}", user_address));
        print_balance(
            "User balance",
            &format_token_amount(user_source_balance, source_token.decimals),
            &self.token,
        );
        print_address("Solver address", &format!("{:?}", solver_address));
        print_balance(
            "Solver balance",
            &format_token_amount(solver_source_balance, source_token.decimals),
            &self.token,
        );
        print_address("Token address", &source_token.address);

        print_header(&format!("Destination Chain: {}", dest.name));

        let user_dest_balance = dest_client
            .get_token_balance(dest_token_addr, user_address)
            .await?;
        let solver_dest_balance = dest_client
            .get_token_balance(dest_token_addr, solver_address)
            .await?;

        print_address("User address", &format!("{:?}", user_address));
        print_balance(
            "User balance",
            &format_token_amount(user_dest_balance, dest_token.decimals),
            &self.token,
        );
        print_address("Solver address", &format!("{:?}", solver_address));
        print_balance(
            "Solver balance",
            &format_token_amount(solver_dest_balance, dest_token.decimals),
            &self.token,
        );
        print_address("Token address", &dest_token.address);

        // Verify escrow state (if applicable)
        // TODO: Check escrow contract balances

        print_summary_start();

        let mut table = Table::new(vec!["Chain", "Account", "Balance"]);
        table.add_row(vec![
            &source.name,
            "User",
            &format!(
                "{} {}",
                format_token_amount(user_source_balance, source_token.decimals),
                self.token
            ),
        ]);
        table.add_row(vec![
            &source.name,
            "Solver",
            &format!(
                "{} {}",
                format_token_amount(solver_source_balance, source_token.decimals),
                self.token
            ),
        ]);
        table.add_row(vec![
            &dest.name,
            "User",
            &format!(
                "{} {}",
                format_token_amount(user_dest_balance, dest_token.decimals),
                self.token
            ),
        ]);
        table.add_row(vec![
            &dest.name,
            "Solver",
            &format!(
                "{} {}",
                format_token_amount(solver_dest_balance, dest_token.decimals),
                self.token
            ),
        ]);

        table.print();
        print_summary_end();

        print_success("Verification complete");

        if out.is_json() {
            out.json(&serde_json::json!({
                "source": {
                    "chain": source.name,
                    "user": {
                        "address": format!("{:?}", user_address),
                        "balance": user_source_balance.to_string(),
                    },
                    "solver": {
                        "address": format!("{:?}", solver_address),
                        "balance": solver_source_balance.to_string(),
                    },
                    "token": source_token.address,
                },
                "destination": {
                    "chain": dest.name,
                    "user": {
                        "address": format!("{:?}", user_address),
                        "balance": user_dest_balance.to_string(),
                    },
                    "solver": {
                        "address": format!("{:?}", solver_address),
                        "balance": solver_dest_balance.to_string(),
                    },
                    "token": dest_token.address,
                },
            }))?;
        }

        Ok(())
    }
}
