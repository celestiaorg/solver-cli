use anyhow::Result;
use clap::Subcommand;
use std::collections::HashMap;
use std::env;
use std::path::PathBuf;

use crate::chain::ChainClient;
use crate::state::{ChainConfig, ContractAddresses, StateManager, TokenInfo};
use crate::utils::*;
use crate::OutputFormat;

#[derive(Subcommand)]
pub enum ChainCommand {
    /// Add a chain with existing contract deployments
    Add {
        /// Chain name (e.g., "arbitrum", "optimism")
        #[arg(long)]
        name: String,

        /// RPC URL
        #[arg(long)]
        rpc: String,

        /// Chain ID (fetched from RPC if not provided)
        #[arg(long)]
        chain_id: Option<u64>,

        /// InputSettlerEscrow contract address
        #[arg(long)]
        input_settler: String,

        /// OutputSettlerSimple contract address
        #[arg(long)]
        output_settler: String,

        /// CentralizedOracle contract address
        #[arg(long)]
        oracle: String,

        /// Token addresses in format SYMBOL=address or SYMBOL=address:decimals (can specify multiple)
        #[arg(long, value_parser = parse_token_arg)]
        token: Vec<ParsedToken>,

        /// Default token decimals (used when not specified per-token)
        #[arg(long, default_value = "6")]
        decimals: u8,

        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,
    },

    /// Remove a chain from configuration
    Remove {
        /// Chain name or chain ID
        #[arg(long)]
        chain: String,

        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,
    },

    /// List configured chains
    List {
        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,
    },
}

/// Parsed token with symbol, address, and optional decimals
#[derive(Debug, Clone)]
pub struct ParsedToken {
    pub symbol: String,
    pub address: String,
    pub decimals: Option<u8>,
}

/// Parse token argument in format SYMBOL=address or SYMBOL=address:decimals
fn parse_token_arg(s: &str) -> Result<ParsedToken, String> {
    let parts: Vec<&str> = s.splitn(2, '=').collect();
    if parts.len() != 2 {
        return Err(format!(
            "Invalid token format '{}'. Expected SYMBOL=address or SYMBOL=address:decimals",
            s
        ));
    }

    let symbol = parts[0].to_uppercase();
    let addr_parts: Vec<&str> = parts[1].splitn(2, ':').collect();

    let address = addr_parts[0].to_string();
    let decimals = if addr_parts.len() > 1 {
        Some(addr_parts[1].parse::<u8>().map_err(|_| {
            format!(
                "Invalid decimals '{}'. Expected a number 0-255",
                addr_parts[1]
            )
        })?)
    } else {
        None
    };

    Ok(ParsedToken {
        symbol,
        address,
        decimals,
    })
}

impl ChainCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        match self {
            ChainCommand::Add {
                name,
                rpc,
                chain_id,
                input_settler,
                output_settler,
                oracle,
                token,
                decimals,
                dir,
            } => {
                Self::add(
                    name,
                    rpc,
                    chain_id,
                    input_settler,
                    output_settler,
                    oracle,
                    token,
                    decimals,
                    dir,
                    output,
                )
                .await
            }
            ChainCommand::Remove { chain, dir } => Self::remove(chain, dir, output).await,
            ChainCommand::List { dir } => Self::list(dir, output).await,
        }
    }

    async fn add(
        name: String,
        rpc: String,
        chain_id: Option<u64>,
        input_settler: String,
        output_settler: String,
        oracle: String,
        tokens: Vec<ParsedToken>,
        default_decimals: u8,
        dir: Option<PathBuf>,
        output: OutputFormat,
    ) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Adding Chain");

        // Load state
        let mut state = state_mgr.load_or_error().await?;

        // Get chain ID from RPC if not provided
        let chain_id = if let Some(id) = chain_id {
            id
        } else {
            print_info(&format!("Fetching chain ID from {}...", rpc));
            let client = ChainClient::new(&name, &rpc).await?;
            client.chain_id
        };

        print_kv("Chain name", &name);
        print_kv("Chain ID", chain_id);
        print_kv("RPC", &rpc);

        // Check if chain already exists
        if state.chains.contains_key(&chain_id) {
            let existing = state.chains.get(&chain_id).unwrap();
            print_warning(&format!(
                "Chain ID {} already exists as '{}'. Updating...",
                chain_id, existing.name
            ));
        }

        // Build contracts struct
        let contracts = ContractAddresses {
            input_settler_escrow: Some(input_settler.clone()),
            output_settler_simple: Some(output_settler.clone()),
            oracle: Some(oracle.clone()),
            permit2: None, // TODO: Add permit2 parameter to chain add command
        };

        print_address("InputSettlerEscrow", &input_settler);
        print_address("OutputSettlerSimple", &output_settler);
        print_address("CentralizedOracle", &oracle);

        // Build tokens map
        let mut token_map: HashMap<String, TokenInfo> = HashMap::new();
        for parsed in tokens {
            let decimals = parsed.decimals.unwrap_or(default_decimals);
            print_address(
                &format!("Token ({}, {} decimals)", parsed.symbol, decimals),
                &parsed.address,
            );
            token_map.insert(
                parsed.symbol.clone(),
                TokenInfo {
                    address: parsed.address,
                    symbol: parsed.symbol,
                    decimals,
                    token_type: "erc20".to_string(),
                },
            );
        }

        // Create chain config
        let chain_config = ChainConfig {
            name: name.clone(),
            chain_id,
            rpc,
            contracts,
            tokens: token_map,
            deployer: None,
        };

        // Add to state
        state.chains.insert(chain_id, chain_config);

        // Save state
        state_mgr.save(&state).await?;

        print_summary_start();
        print_kv("Chain added", &name);
        print_kv("Chain ID", chain_id);
        print_kv("Total chains", state.chains.len());
        print_summary_end();

        print_success("Chain added successfully!");
        print_info("Run 'solver-cli configure' to regenerate solver and oracle configs.");

        if out.is_json() {
            out.json(&serde_json::json!({
                "status": "added",
                "chain_name": name,
                "chain_id": chain_id,
            }))?;
        }

        Ok(())
    }

    async fn remove(chain: String, dir: Option<PathBuf>, output: OutputFormat) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Removing Chain");

        // Load state
        let mut state = state_mgr.load_or_error().await?;

        // Find chain by ID or name
        let chain_id = if let Ok(id) = chain.parse::<u64>() {
            if !state.chains.contains_key(&id) {
                anyhow::bail!("Chain ID {} not found", id);
            }
            id
        } else {
            state
                .get_chain_by_name(&chain)
                .map(|c| c.chain_id)
                .ok_or_else(|| anyhow::anyhow!("Chain '{}' not found", chain))?
        };

        let chain_name = state
            .chains
            .get(&chain_id)
            .map(|c| c.name.clone())
            .unwrap_or_default();

        // Remove from state
        state.chains.remove(&chain_id);

        // Save state
        state_mgr.save(&state).await?;

        print_summary_start();
        print_kv("Chain removed", &chain_name);
        print_kv("Chain ID", chain_id);
        print_kv("Remaining chains", state.chains.len());
        print_summary_end();

        print_success("Chain removed successfully!");
        print_info("Run 'solver-cli configure' to regenerate solver and oracle configs.");

        if out.is_json() {
            out.json(&serde_json::json!({
                "status": "removed",
                "chain_name": chain_name,
                "chain_id": chain_id,
            }))?;
        }

        Ok(())
    }

    async fn list(dir: Option<PathBuf>, output: OutputFormat) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Configured Chains");

        // Load state
        let state = state_mgr.load_or_error().await?;

        if state.chains.is_empty() {
            print_info("No chains configured. Run 'solver-cli deploy' or 'solver-cli chain add'.");
            return Ok(());
        }

        // Sort by chain ID
        let mut chain_ids: Vec<u64> = state.chains.keys().copied().collect();
        chain_ids.sort();

        let mut table = Table::new(vec!["Chain ID", "Name", "RPC", "Contracts"]);

        for chain_id in &chain_ids {
            let chain = state.chains.get(chain_id).unwrap();
            let contracts_status = if chain.contracts.is_complete() {
                "complete"
            } else {
                "incomplete"
            };

            table.add_row(vec![
                &chain_id.to_string(),
                &chain.name,
                &chain.rpc,
                contracts_status,
            ]);
        }

        table.print();

        // Show details for each chain
        for chain_id in &chain_ids {
            let chain = state.chains.get(chain_id).unwrap();
            print_header(&format!("{} (Chain ID: {})", chain.name, chain.chain_id));

            if let Some(addr) = &chain.contracts.input_settler_escrow {
                print_address("InputSettlerEscrow", addr);
            }
            if let Some(addr) = &chain.contracts.output_settler_simple {
                print_address("OutputSettlerSimple", addr);
            }
            if let Some(addr) = &chain.contracts.oracle {
                print_address("CentralizedOracle", addr);
            }
            for (symbol, token) in &chain.tokens {
                print_address(&format!("Token ({})", symbol), &token.address);
            }
        }

        if out.is_json() {
            out.json(&state.chains)?;
        }

        Ok(())
    }
}
