use alloy::primitives::{Address, U256};
use anyhow::Result;
use clap::Subcommand;
use std::env;
use std::path::PathBuf;
use std::str::FromStr;

use crate::chain::{format_token_amount, ChainClient};
use crate::state::{StateManager, TokenInfo};
use crate::utils::*;
use crate::OutputFormat;

#[derive(Subcommand)]
pub enum TokenCommand {
    /// Add a token to a chain
    Add {
        /// Chain name or ID
        #[arg(long)]
        chain: String,

        /// Token symbol (e.g., USDC, USDT, DAI)
        #[arg(long)]
        symbol: String,

        /// Token contract address
        #[arg(long)]
        address: String,

        /// Token decimals
        #[arg(long, default_value = "18")]
        decimals: u8,

        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,
    },

    /// Remove a token from a chain
    Remove {
        /// Chain name or ID
        #[arg(long)]
        chain: String,

        /// Token symbol
        #[arg(long)]
        symbol: String,

        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,
    },

    /// List tokens across all chains
    List {
        /// Filter by chain (name or ID)
        #[arg(long)]
        chain: Option<String>,

        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,
    },

    /// Mint USDC on the origin chain (anvil1). Only works with mintable ERC20 contracts.
    /// For anvil2, tokens must be bridged via the Hyperlane warp route.
    Mint {
        /// Chain name or ID
        #[arg(long)]
        chain: String,

        /// Token symbol
        #[arg(long)]
        symbol: String,

        /// Recipient address (or "user" / "solver" to use from env)
        #[arg(long)]
        to: String,

        /// Amount in raw units (e.g., 1000000 for 1 USDC)
        #[arg(long)]
        amount: String,

        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,
    },
}

impl TokenCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        match self {
            TokenCommand::Add {
                chain,
                symbol,
                address,
                decimals,
                dir,
            } => Self::add(chain, symbol, address, decimals, dir, output).await,
            TokenCommand::Remove { chain, symbol, dir } => {
                Self::remove(chain, symbol, dir, output).await
            }
            TokenCommand::List { chain, dir } => Self::list(chain, dir, output).await,
            TokenCommand::Mint {
                chain,
                symbol,
                to,
                amount,
                dir,
            } => Self::mint(chain, symbol, to, amount, dir, output).await,
        }
    }

    async fn add(
        chain_ref: String,
        symbol: String,
        address: String,
        decimals: u8,
        dir: Option<PathBuf>,
        output: OutputFormat,
    ) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Adding Token");

        // Load state
        let mut state = state_mgr.load_or_error().await?;

        // Find chain
        let chain_id = Self::resolve_chain_id(&state, &chain_ref)?;
        let symbol_upper = symbol.to_uppercase();

        // Get chain name for messages (before mutable borrow)
        let chain_name = state
            .chains
            .get(&chain_id)
            .map(|c| c.name.clone())
            .ok_or_else(|| anyhow::anyhow!("Chain {} not found", chain_ref))?;

        {
            let chain = state
                .chains
                .get_mut(&chain_id)
                .ok_or_else(|| anyhow::anyhow!("Chain {} not found", chain_ref))?;

            // Check if token already exists
            if chain.tokens.contains_key(&symbol_upper) {
                print_warning(&format!(
                    "Token {} already exists on {}. Updating...",
                    symbol_upper, chain.name
                ));
            }

            print_kv("Chain", &format!("{} ({})", chain.name, chain.chain_id));
            print_kv("Symbol", &symbol_upper);
            print_address("Address", &address);
            print_kv("Decimals", decimals);

            // Add token
            chain.tokens.insert(
                symbol_upper.clone(),
                TokenInfo {
                    address: address.clone(),
                    symbol: symbol_upper.clone(),
                    decimals,
                    token_type: "erc20".to_string(),
                },
            );
        }

        // Save state
        state_mgr.save(&state).await?;

        print_success(&format!("Token {} added to {}", symbol_upper, chain_name));
        print_info("Run 'solver-cli configure' to regenerate solver config.");

        if out.is_json() {
            out.json(&serde_json::json!({
                "status": "added",
                "chain_id": chain_id,
                "symbol": symbol_upper,
                "address": address,
                "decimals": decimals,
            }))?;
        }

        Ok(())
    }

    async fn remove(
        chain_ref: String,
        symbol: String,
        dir: Option<PathBuf>,
        output: OutputFormat,
    ) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Removing Token");

        // Load state
        let mut state = state_mgr.load_or_error().await?;

        // Find chain
        let chain_id = Self::resolve_chain_id(&state, &chain_ref)?;
        let chain = state
            .chains
            .get_mut(&chain_id)
            .ok_or_else(|| anyhow::anyhow!("Chain {} not found", chain_ref))?;

        let symbol_upper = symbol.to_uppercase();
        let chain_name = chain.name.clone();

        // Remove token
        if chain.tokens.remove(&symbol_upper).is_none() {
            anyhow::bail!("Token {} not found on chain {}", symbol_upper, chain_name);
        }

        // Save state
        state_mgr.save(&state).await?;

        print_success(&format!(
            "Token {} removed from {}",
            symbol_upper, chain_name
        ));
        print_info("Run 'solver-cli configure' to regenerate solver config.");

        if out.is_json() {
            out.json(&serde_json::json!({
                "status": "removed",
                "chain_id": chain_id,
                "symbol": symbol_upper,
            }))?;
        }

        Ok(())
    }

    async fn list(
        chain_filter: Option<String>,
        dir: Option<PathBuf>,
        output: OutputFormat,
    ) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Tokens");

        // Load state
        let state = state_mgr.load_or_error().await?;

        if state.chains.is_empty() {
            print_info("No chains configured.");
            return Ok(());
        }

        // Determine which chains to show
        let chain_ids: Vec<u64> = if let Some(ref chain_ref) = chain_filter {
            vec![Self::resolve_chain_id(&state, chain_ref)?]
        } else {
            let mut ids: Vec<u64> = state.chains.keys().copied().collect();
            ids.sort();
            ids
        };

        let mut table = Table::new(vec!["Chain", "Symbol", "Address", "Decimals"]);
        let mut total_tokens = 0;

        for chain_id in &chain_ids {
            let chain = state.chains.get(chain_id).unwrap();

            if chain.tokens.is_empty() {
                continue;
            }

            // Sort tokens by symbol
            let mut symbols: Vec<&String> = chain.tokens.keys().collect();
            symbols.sort();

            for symbol in symbols {
                let token = chain.tokens.get(symbol).unwrap();
                table.add_row(vec![
                    &chain.name,
                    &token.symbol,
                    &token.address,
                    &token.decimals.to_string(),
                ]);
                total_tokens += 1;
            }
        }

        if total_tokens == 0 {
            print_info("No tokens configured.");
        } else {
            table.print();
            print_kv("Total tokens", total_tokens);
        }

        if out.is_json() {
            let mut tokens_json = serde_json::Map::new();
            for chain_id in &chain_ids {
                let chain = state.chains.get(chain_id).unwrap();
                tokens_json.insert(chain.name.clone(), serde_json::to_value(&chain.tokens)?);
            }
            out.json(&serde_json::Value::Object(tokens_json))?;
        }

        Ok(())
    }

    async fn mint(
        chain_ref: String,
        symbol: String,
        to: String,
        amount: String,
        dir: Option<PathBuf>,
        output: OutputFormat,
    ) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Minting Tokens");

        // Load state and env
        let state = state_mgr.load_or_error().await?;
        load_dotenv(&project_dir)?;
        let env_config = EnvConfig::from_env()?;

        // Find chain
        let chain_id = Self::resolve_chain_id(&state, &chain_ref)?;
        let chain = state
            .chains
            .get(&chain_id)
            .ok_or_else(|| anyhow::anyhow!("Chain {} not found", chain_ref))?;

        // Find token
        let symbol_upper = symbol.to_uppercase();
        let token = chain
            .tokens
            .get(&symbol_upper)
            .ok_or_else(|| anyhow::anyhow!("Token {} not found on {}", symbol_upper, chain.name))?;

        // Resolve recipient address
        let recipient: Address = if to.eq_ignore_ascii_case("user") {
            let user_pk = env_config
                .user_pk
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("USER_PK not set in .env"))?;
            ChainClient::address_from_pk(user_pk)?
        } else if to.eq_ignore_ascii_case("solver") {
            let solver_pk = env_config.get_solver_pk()?;
            ChainClient::address_from_pk(&solver_pk)?
        } else {
            Address::from_str(&to).map_err(|_| anyhow::anyhow!("Invalid address: {}", to))?
        };

        // Parse amount
        let amount_raw: U256 = amount
            .parse()
            .map_err(|_| anyhow::anyhow!("Invalid amount: {}", amount))?;

        // Get private key for this chain (to call mint)
        let minter_pk = env_config
            .get_chain(&chain.name)
            .map(|c| c.private_key.clone())
            .or_else(|| env_config.get_any_pk())
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "No private key found for {}. Set {}_PK in .env",
                    chain.name,
                    chain.name.to_uppercase()
                )
            })?;

        print_kv("Chain", &chain.name);
        print_kv("Token", &symbol_upper);
        print_address("Recipient", &format!("{:?}", recipient));
        print_kv(
            "Amount",
            format!(
                "{} ({} raw)",
                format_token_amount(amount_raw, token.decimals),
                amount
            ),
        );

        // Call mint on the token contract
        print_info("Calling mint()...");

        Self::call_mint(
            &chain.rpc,
            &minter_pk,
            &token.address,
            recipient,
            amount_raw,
        )
        .await?;

        print_success(&format!(
            "Minted {} {} to {:?}",
            format_token_amount(amount_raw, token.decimals),
            symbol_upper,
            recipient
        ));

        if out.is_json() {
            out.json(&serde_json::json!({
                "chain": chain.name,
                "token": symbol_upper,
                "recipient": format!("{:?}", recipient),
                "amount": amount,
            }))?;
        }

        Ok(())
    }

    async fn call_mint(
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
            anyhow::bail!(
                "Mint failed. This only works on the origin chain (anvil1) with mintable ERC20.\n\
                 For anvil2, bridge tokens via the Hyperlane warp route.\nError: {}",
                stderr
            );
        }

        Ok(())
    }

    /// Resolve chain by name or ID
    fn resolve_chain_id(state: &crate::state::SolverState, chain_ref: &str) -> Result<u64> {
        // Try parsing as chain ID first
        if let Ok(id) = chain_ref.parse::<u64>() {
            if state.chains.contains_key(&id) {
                return Ok(id);
            }
            anyhow::bail!("Chain ID {} not found", id);
        }

        // Try finding by name
        state
            .get_chain_by_name(chain_ref)
            .map(|c| c.chain_id)
            .ok_or_else(|| anyhow::anyhow!("Chain '{}' not found", chain_ref))
    }
}
