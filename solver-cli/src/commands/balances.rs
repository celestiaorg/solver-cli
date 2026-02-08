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
pub struct BalancesCommand {
    /// Project directory
    #[arg(long)]
    pub dir: Option<PathBuf>,

    /// Token symbol to check
    #[arg(long, default_value = "USDC")]
    pub token: String,

    /// Specific chain (name or ID). If not specified, shows all chains.
    #[arg(long)]
    pub chain: Option<String>,
}

impl BalancesCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = self.dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Token Balances");

        // Load state and env
        let state = state_mgr.load_or_error().await?;
        load_dotenv(&project_dir)?;
        let env_config = EnvConfig::from_env()?;

        // Derive addresses
        let user_pk = env_config
            .user_pk
            .clone()
            .ok_or_else(|| anyhow::anyhow!("USER_PK not set"))?;

        let user_address = ChainClient::address_from_pk(&user_pk)?;
        let solver_pk = env_config.get_solver_pk()?;
        let solver_address = ChainClient::address_from_pk(&solver_pk)?;

        // Determine which chains to verify
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
                let chain = state
                    .get_chain_by_name(chain_arg)
                    .ok_or_else(|| anyhow::anyhow!("Chain '{}' not found", chain_arg))?;
                vec![chain.chain_id]
            }
        } else {
            let mut ids = state.chain_ids();
            ids.sort();
            ids
        };

        if chain_ids.is_empty() {
            anyhow::bail!("No chains configured. Run 'solver-cli deploy' first.");
        }

        // Collect balances for summary table
        let mut table_rows: Vec<(String, String, String, String)> = Vec::new();

        // Verify each chain
        for chain_id in &chain_ids {
            let chain = state.chains.get(chain_id).unwrap();

            // Get token info
            let token_info = chain.tokens.get(&self.token).ok_or_else(|| {
                anyhow::anyhow!("Token {} not found on chain {}", self.token, chain.name)
            })?;

            // Connect to chain
            let client = ChainClient::new(&chain.name, &chain.rpc).await?;
            let token_addr: Address = token_info.address.parse()?;

            print_header(&format!("{} (Chain ID: {})", chain.name, chain.chain_id));

            // Query balances
            let user_balance = client.get_token_balance(token_addr, user_address).await?;
            let solver_balance = client.get_token_balance(token_addr, solver_address).await?;

            print_address("User address", &format!("{:?}", user_address));
            print_balance(
                "User balance",
                &format_token_amount(user_balance, token_info.decimals),
                &self.token,
            );
            print_address("Solver address", &format!("{:?}", solver_address));
            print_balance(
                "Solver balance",
                &format_token_amount(solver_balance, token_info.decimals),
                &self.token,
            );
            print_address("Token address", &token_info.address);

            // Store for summary table
            table_rows.push((
                chain.name.clone(),
                "User".to_string(),
                format!(
                    "{} {}",
                    format_token_amount(user_balance, token_info.decimals),
                    self.token
                ),
                format!("{:?}", user_address),
            ));
            table_rows.push((
                chain.name.clone(),
                "Solver".to_string(),
                format!(
                    "{} {}",
                    format_token_amount(solver_balance, token_info.decimals),
                    self.token
                ),
                format!("{:?}", solver_address),
            ));
        }

        // Print summary table
        print_summary_start();

        let mut table = Table::new(vec!["Chain", "Account", "Balance"]);
        for (chain, account, balance, _) in &table_rows {
            table.add_row(vec![chain, account, balance]);
        }
        table.print();

        print_summary_end();

        print_success("Verification complete");

        if out.is_json() {
            let mut chains_json = serde_json::Map::new();
            for chain_id in &chain_ids {
                let chain = state.chains.get(chain_id).unwrap();
                let token_info = chain.tokens.get(&self.token).unwrap();
                let client = ChainClient::new(&chain.name, &chain.rpc).await?;
                let token_addr: Address = token_info.address.parse()?;

                let user_balance = client.get_token_balance(token_addr, user_address).await?;
                let solver_balance = client.get_token_balance(token_addr, solver_address).await?;

                chains_json.insert(
                    chain.name.clone(),
                    serde_json::json!({
                        "chain_id": chain.chain_id,
                        "user": {
                            "address": format!("{:?}", user_address),
                            "balance": user_balance.to_string(),
                        },
                        "solver": {
                            "address": format!("{:?}", solver_address),
                            "balance": solver_balance.to_string(),
                        },
                        "token": token_info.address,
                    }),
                );
            }
            out.json(&serde_json::Value::Object(chains_json))?;
        }

        Ok(())
    }
}
