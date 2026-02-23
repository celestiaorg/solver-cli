use alloy::primitives::{Address, FixedBytes, U256};
use alloy::sol;
use alloy::sol_types::SolValue;
use anyhow::Result;
use chrono::Utc;
use clap::Subcommand;
use std::env;
use std::path::PathBuf;
use std::str::FromStr;
use tokio::time::{sleep, Duration};
use tracing::info;

use crate::chain::{format_token_amount, ChainClient};
use crate::state::{ChainConfig, IntentRecord, IntentStatus, SolverState, StateManager};
use crate::utils::*;
use crate::OutputFormat;

// Define the StandardOrder and MandateOutput structs for ABI encoding
sol! {
    struct MandateOutput {
        bytes32 oracle;
        bytes32 settler;
        uint256 chainId;
        bytes32 token;
        uint256 amount;
        bytes32 recipient;
        bytes callbackData;
        bytes context;
    }

    struct StandardOrder {
        address user;
        uint256 nonce;
        uint256 originChainId;
        uint32 expires;
        uint32 fillDeadline;
        address inputOracle;
        uint256[2][] inputs;
        MandateOutput[] outputs;
    }
}

#[derive(Subcommand)]
pub enum IntentCommand {
    /// Submit a new intent
    Submit {
        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,

        /// Amount to transfer (in raw units, e.g., "1000000" = 1 token with 6 decimals)
        #[arg(long)]
        amount: String,

        /// Token symbol
        #[arg(long, default_value = "USDC")]
        asset: String,

        /// Source chain (name or ID)
        #[arg(long)]
        from: Option<String>,

        /// Destination chain (name or ID)
        #[arg(long)]
        to: Option<String>,

        /// Wait for fulfillment
        #[arg(long, short)]
        wait: bool,

        /// Timeout in seconds when waiting
        #[arg(long, default_value = "300")]
        timeout: u64,

        /// Intent expiry in seconds (default: 30 minutes)
        #[arg(long, default_value = "1800")]
        expiry: u64,
    },

    /// Refund an expired intent (reclaim escrowed tokens)
    Refund {
        /// Transaction hash of the original intent submission
        #[arg(long)]
        tx_hash: String,

        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,

        /// Source chain where intent was submitted
        #[arg(long)]
        chain: Option<String>,
    },

    /// Check intent status
    Status {
        /// Intent ID
        #[arg(long)]
        id: String,

        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,
    },

    /// List all intents
    List {
        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,

        /// Show only intents with this status
        #[arg(long)]
        status: Option<String>,
    },
}

struct IntentSubmitParams {
    dir: Option<PathBuf>,
    amount: String,
    asset: String,
    from: Option<String>,
    to: Option<String>,
    wait: bool,
    timeout: u64,
    expiry: u64,
}

impl IntentCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        match self {
            IntentCommand::Submit {
                dir,
                amount,
                asset,
                from,
                to,
                wait,
                timeout,
                expiry,
            } => {
                Self::submit(
                    IntentSubmitParams { dir, amount, asset, from, to, wait, timeout, expiry },
                    output,
                )
                .await
            }
            IntentCommand::Refund {
                tx_hash,
                dir,
                chain,
            } => Self::refund(tx_hash, dir, chain, output).await,
            IntentCommand::Status { id, dir } => Self::status(id, dir, output).await,
            IntentCommand::List { dir, status } => Self::list(dir, status, output).await,
        }
    }

    /// Resolve a chain by name or ID
    fn resolve_chain<'a>(state: &'a SolverState, chain_ref: &str) -> Option<&'a ChainConfig> {
        // Try parsing as chain ID first
        if let Ok(id) = chain_ref.parse::<u64>() {
            state.get_chain(id)
        } else {
            // Try finding by name
            state.get_chain_by_name(chain_ref)
        }
    }

    async fn submit(params: IntentSubmitParams, output: OutputFormat) -> Result<()> {
        let IntentSubmitParams { dir, amount, asset, from, to, wait, timeout, expiry } = params;
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Submitting Intent");

        // Load state and env
        let mut state = state_mgr.load_or_error().await?;
        load_dotenv(&project_dir)?;
        let env_config = EnvConfig::from_env()?;

        let user_pk = env_config
            .user_pk
            .clone()
            .ok_or_else(|| anyhow::anyhow!("USER_PK not set"))?;

        let chain_ids = state.chain_ids();
        if chain_ids.len() < 2 {
            anyhow::bail!(
                "At least 2 chains required for cross-chain intents. Found: {}",
                chain_ids.len()
            );
        }

        // Determine source and destination chains
        // Clone the chain configs to avoid borrow checker issues
        let (source, dest) = match (from.as_ref(), to.as_ref()) {
            (Some(from_str), Some(to_str)) => {
                let src = Self::resolve_chain(&state, from_str)
                    .ok_or_else(|| anyhow::anyhow!("Source chain '{}' not found", from_str))?
                    .clone();
                let dst = Self::resolve_chain(&state, to_str)
                    .ok_or_else(|| anyhow::anyhow!("Destination chain '{}' not found", to_str))?
                    .clone();
                (src, dst)
            }
            (Some(from_str), None) => {
                let src = Self::resolve_chain(&state, from_str)
                    .ok_or_else(|| anyhow::anyhow!("Source chain '{}' not found", from_str))?
                    .clone();
                // Pick first different chain as destination
                let dst = chain_ids
                    .iter()
                    .find(|&&id| id != src.chain_id)
                    .and_then(|&id| state.get_chain(id))
                    .ok_or_else(|| anyhow::anyhow!("No destination chain available"))?
                    .clone();
                (src, dst)
            }
            (None, Some(to_str)) => {
                let dst = Self::resolve_chain(&state, to_str)
                    .ok_or_else(|| anyhow::anyhow!("Destination chain '{}' not found", to_str))?
                    .clone();
                // Pick first different chain as source
                let src = chain_ids
                    .iter()
                    .find(|&&id| id != dst.chain_id)
                    .and_then(|&id| state.get_chain(id))
                    .ok_or_else(|| anyhow::anyhow!("No source chain available"))?
                    .clone();
                (src, dst)
            }
            (None, None) => {
                // Default: use first two chains sorted by ID
                let mut sorted_ids = chain_ids.clone();
                sorted_ids.sort();
                let src = state.get_chain(sorted_ids[0]).unwrap().clone();
                let dst = state.get_chain(sorted_ids[1]).unwrap().clone();
                (src, dst)
            }
        };

        if source.chain_id == dest.chain_id {
            anyhow::bail!("Source and destination chains must be different");
        }

        print_kv("Source", format!("{} ({})", source.name, source.chain_id));
        print_kv("Destination", format!("{} ({})", dest.name, dest.chain_id));

        // Get token info
        let source_token = source
            .tokens
            .get(&asset)
            .ok_or_else(|| anyhow::anyhow!("Token {} not found on source chain", asset))?;

        let dest_token = dest
            .tokens
            .get(&asset)
            .ok_or_else(|| anyhow::anyhow!("Token {} not found on dest chain", asset))?;

        // Parse amount (raw units, like fund command)
        let amount_raw: U256 = amount
            .parse()
            .map_err(|_| anyhow::anyhow!("Invalid amount"))?;
        print_kv("Amount (raw units)", format!("{} {}", amount, asset));
        print_kv(
            "Human readable",
            format_token_amount(amount_raw, source_token.decimals),
        );

        // Derive addresses
        let user_address = ChainClient::address_from_pk(&user_pk)?;

        print_address("User", &format!("{:?}", user_address));

        // Get contract addresses
        let escrow_address: Address = source
            .contracts
            .input_settler_escrow
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Escrow contract not deployed on source"))?
            .parse()?;

        let source_oracle: Address = source
            .contracts
            .oracle
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Oracle contract not deployed on source"))?
            .parse()?;

        let dest_oracle: Address = dest
            .contracts
            .oracle
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Oracle contract not deployed on destination"))?
            .parse()?;

        let dest_settler: Address = dest
            .contracts
            .output_settler_simple
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Output settler not deployed on destination"))?
            .parse()?;

        let source_token_address: Address = source_token.address.parse()?;
        let dest_token_address: Address = dest_token.address.parse()?;

        print_address("Escrow", &format!("{:?}", escrow_address));
        print_address("Source Oracle", &format!("{:?}", source_oracle));
        print_address("Dest Settler", &format!("{:?}", dest_settler));

        // Step 1: Check user has sufficient tokens
        print_header("Checking User Balance");

        let user_balance =
            Self::get_token_balance(&source.rpc, &source_token.address, user_address).await?;

        print_balance(
            "User balance",
            &format_token_amount(user_balance, source_token.decimals),
            &asset,
        );

        if user_balance < amount_raw {
            anyhow::bail!(
                "Insufficient {} balance. Have: {}, need: {}.\n\
                For test tokens, run: solver-cli token mint --chain {} --symbol {} --to {:?} --amount {}",
                asset,
                format_token_amount(user_balance, source_token.decimals),
                format_token_amount(amount_raw, source_token.decimals),
                source.name,
                asset,
                user_address,
                amount
            );
        }

        // Step 2: Approve escrow to spend tokens
        print_header("Approving Token Spend");

        let approve_tx = Self::approve_tokens(
            &source.rpc,
            &user_pk,
            &source_token.address,
            escrow_address,
            amount_raw,
        )
        .await?;

        print_success(&format!("Approval tx: {}", approve_tx));

        // Step 3: Build and submit the intent
        print_header("Submitting Intent On-Chain");

        // Build the StandardOrder
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let nonce = now; // Use timestamp as nonce
        let expires = (now + expiry) as u32; // Configurable expiry (default 30 min)
        let fill_deadline = (now + expiry - 60) as u32; // 1 minute before expiry

        print_kv("Nonce", nonce);
        print_kv("Expires", expires);
        print_kv("Fill Deadline", fill_deadline);

        // Helper to convert address to bytes32
        let addr_to_bytes32 = |addr: Address| -> FixedBytes<32> {
            let mut bytes = [0u8; 32];
            bytes[12..].copy_from_slice(addr.as_slice());
            FixedBytes::from(bytes)
        };

        // Build the order
        let order = StandardOrder {
            user: user_address,
            nonce: U256::from(nonce),
            originChainId: U256::from(source.chain_id),
            expires,
            fillDeadline: fill_deadline,
            inputOracle: source_oracle,
            inputs: vec![[
                U256::from_be_slice(source_token_address.as_slice()),
                amount_raw,
            ]],
            outputs: vec![MandateOutput {
                oracle: addr_to_bytes32(dest_oracle),
                settler: addr_to_bytes32(dest_settler),
                chainId: U256::from(dest.chain_id),
                token: addr_to_bytes32(dest_token_address),
                amount: amount_raw, // 1:1 for same token
                recipient: addr_to_bytes32(user_address),
                callbackData: vec![].into(),
                // Context is used by contract for order types (limit, dutch, etc.)
                // Empty = simple limit order
                context: vec![].into(),
            }],
        };

        // Encode the order and call open()
        let tx_hash = Self::submit_order(&source.rpc, &user_pk, escrow_address, &order).await?;

        print_success(&format!("Intent submitted! TX: {}", tx_hash));

        // Generate intent ID from tx hash
        let intent_id = format!("intent-{}", &tx_hash[2..10]);

        // Record intent in state
        let intent_record = IntentRecord {
            id: intent_id.clone(),
            tx_hash: tx_hash.clone(),
            source_chain_id: source.chain_id,
            dest_chain_id: dest.chain_id,
            token: asset.clone(),
            amount: amount_raw.to_string(),
            user: format!("{:?}", user_address),
            status: IntentStatus::Pending,
            created_at: Utc::now(),
            fulfillment_tx: None,
            settlement_tx: None,
        };

        state.intents.push(intent_record);
        state_mgr.save(&state).await?;

        print_summary_start();
        print_kv("Intent ID", &intent_id);
        print_kv("TX Hash", &tx_hash);
        print_kv("Amount", format!("{} {}", amount, asset));
        print_kv("Status", "pending");
        print_summary_end();

        // Wait for fulfillment if requested
        if wait {
            print_info(&format!(
                "Waiting for fulfillment (timeout: {}s)...",
                timeout
            ));

            // Poll destination chain for user balance increase
            let initial_dest_balance =
                Self::get_token_balance(&dest.rpc, &dest_token.address, user_address)
                    .await
                    .unwrap_or(U256::ZERO);

            let fulfilled = Self::wait_for_balance_increase(
                &dest.rpc,
                &dest_token.address,
                user_address,
                initial_dest_balance,
                timeout,
            )
            .await?;

            if fulfilled {
                print_success("Intent fulfilled!");

                // Update state
                let mut state = state_mgr.load_or_error().await?;
                if let Some(intent) = state.intents.iter_mut().find(|i| i.id == intent_id) {
                    intent.status = IntentStatus::Fulfilled;
                }
                state_mgr.save(&state).await?;

                // Print final balances
                print_header("Final Balances");

                let user_source_balance =
                    Self::get_token_balance(&source.rpc, &source_token.address, user_address)
                        .await
                        .unwrap_or(U256::ZERO);

                let user_dest_balance =
                    Self::get_token_balance(&dest.rpc, &dest_token.address, user_address)
                        .await
                        .unwrap_or(U256::ZERO);

                print_balance(
                    &format!("User on {} ({})", source.name, asset),
                    &format_token_amount(user_source_balance, source_token.decimals),
                    &asset,
                );
                print_balance(
                    &format!("User on {} ({})", dest.name, asset),
                    &format_token_amount(user_dest_balance, dest_token.decimals),
                    &asset,
                );
            } else {
                print_warning("Timeout waiting for fulfillment. The solver may still process it.");
            }
        }

        if out.is_json() {
            out.json(&serde_json::json!({
                "intent_id": intent_id,
                "tx_hash": tx_hash,
                "status": "pending",
                "amount": amount,
                "asset": asset,
                "source_chain": source.name,
                "dest_chain": dest.name,
            }))?;
        }

        Ok(())
    }

    async fn get_token_balance(rpc_url: &str, token_address: &str, owner: Address) -> Result<U256> {
        use std::process::Stdio;
        use tokio::process::Command;

        let output = Command::new("cast")
            .arg("call")
            .arg(token_address)
            .arg("balanceOf(address)(uint256)")
            .arg(format!("{:?}", owner))
            .arg("--rpc-url")
            .arg(rpc_url)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Failed to get balance: {}", stderr);
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        // cast returns format like "20000000 [2e7]" - extract just the first number
        let balance_str = stdout.split_whitespace().next().unwrap_or("0");

        // Parse the balance (cast returns decimal)
        let balance = U256::from_str(balance_str)
            .or_else(|_| U256::from_str_radix(balance_str.trim_start_matches("0x"), 16))
            .unwrap_or(U256::ZERO);

        Ok(balance)
    }

    async fn approve_tokens(
        rpc_url: &str,
        private_key: &str,
        token_address: &str,
        spender: Address,
        amount: U256,
    ) -> Result<String> {
        use std::process::Stdio;
        use tokio::process::Command;

        let pk = private_key.strip_prefix("0x").unwrap_or(private_key);

        let output = Command::new("cast")
            .arg("send")
            .arg(token_address)
            .arg("approve(address,uint256)")
            .arg(format!("{:?}", spender))
            .arg(amount.to_string())
            .arg("--private-key")
            .arg(pk)
            .arg("--rpc-url")
            .arg(rpc_url)
            .arg("--json")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Approve failed: {}", stderr);
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let json: serde_json::Value = serde_json::from_str(&stdout)?;
        let tx_hash = json["transactionHash"]
            .as_str()
            .unwrap_or("unknown")
            .to_string();

        Ok(tx_hash)
    }

    async fn submit_order(
        rpc_url: &str,
        private_key: &str,
        escrow: Address,
        order: &StandardOrder,
    ) -> Result<String> {
        use std::process::Stdio;
        use tokio::process::Command;

        let pk = private_key.strip_prefix("0x").unwrap_or(private_key);

        // ABI encode the order
        let encoded_order = order.abi_encode();

        // Function selector for open(StandardOrder)
        // open((address,uint256,uint256,uint32,uint32,address,uint256[2][],(bytes32,bytes32,uint256,bytes32,uint256,bytes32,bytes,bytes)[]))
        let selector = alloy::primitives::keccak256(
            b"open((address,uint256,uint256,uint32,uint32,address,uint256[2][],(bytes32,bytes32,uint256,bytes32,uint256,bytes32,bytes,bytes)[]))"
        );

        let mut calldata = selector[..4].to_vec();
        calldata.extend_from_slice(&encoded_order);

        let calldata_hex = format!("0x{}", hex::encode(&calldata));

        info!("Submitting order with calldata: {} bytes", calldata.len());

        let output = Command::new("cast")
            .arg("send")
            .arg(format!("{:?}", escrow))
            .arg(&calldata_hex)
            .arg("--private-key")
            .arg(pk)
            .arg("--rpc-url")
            .arg(rpc_url)
            .arg("--json")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Open failed: {}", stderr);
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let json: serde_json::Value = serde_json::from_str(&stdout)?;
        let tx_hash = json["transactionHash"]
            .as_str()
            .unwrap_or("unknown")
            .to_string();

        Ok(tx_hash)
    }

    async fn wait_for_balance_increase(
        rpc_url: &str,
        token_address: &str,
        owner: Address,
        initial_balance: U256,
        timeout_secs: u64,
    ) -> Result<bool> {
        let start = std::time::Instant::now();
        let timeout = Duration::from_secs(timeout_secs);
        let poll_interval = Duration::from_secs(3);

        loop {
            if start.elapsed() > timeout {
                return Ok(false);
            }

            let current_balance = Self::get_token_balance(rpc_url, token_address, owner)
                .await
                .unwrap_or(initial_balance);

            if current_balance > initial_balance {
                return Ok(true);
            }

            print_info(&format!(
                "Waiting... ({}/{}s)",
                start.elapsed().as_secs(),
                timeout_secs
            ));
            sleep(poll_interval).await;
        }
    }

    async fn status(id: String, dir: Option<PathBuf>, output: OutputFormat) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Intent Status");

        let state = state_mgr.load_or_error().await?;

        let intent = state
            .intents
            .iter()
            .find(|i| i.id == id)
            .ok_or_else(|| anyhow::anyhow!("Intent not found: {}", id))?;

        print_kv("Intent ID", &intent.id);
        print_kv("Status", &intent.status);
        print_kv("TX Hash", &intent.tx_hash);
        print_kv("Token", &intent.token);
        print_kv("Amount", &intent.amount);
        print_kv("User", &intent.user);
        print_kv("Source Chain", intent.source_chain_id);
        print_kv("Dest Chain", intent.dest_chain_id);
        print_kv("Created", intent.created_at.to_rfc3339());

        if let Some(tx) = &intent.fulfillment_tx {
            print_kv("Fulfillment TX", tx);
        }
        if let Some(tx) = &intent.settlement_tx {
            print_kv("Settlement TX", tx);
        }

        if out.is_json() {
            out.json(intent)?;
        }

        Ok(())
    }

    async fn list(
        dir: Option<PathBuf>,
        status_filter: Option<String>,
        output: OutputFormat,
    ) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Intents");

        let state = state_mgr.load_or_error().await?;

        let intents: Vec<_> = state
            .intents
            .iter()
            .filter(|i| {
                if let Some(ref status) = status_filter {
                    i.status.to_string() == *status
                } else {
                    true
                }
            })
            .collect();

        if intents.is_empty() {
            print_info("No intents found");
            return Ok(());
        }

        let mut table = Table::new(vec!["ID", "Status", "Token", "Amount", "Created"]);

        for intent in &intents {
            table.add_row(vec![
                &intent.id,
                &intent.status.to_string(),
                &intent.token,
                &intent.amount,
                &intent.created_at.format("%Y-%m-%d %H:%M").to_string(),
            ]);
        }

        table.print();

        if out.is_json() {
            out.json(&intents)?;
        }

        Ok(())
    }

    async fn refund(
        tx_hash: String,
        dir: Option<PathBuf>,
        chain: Option<String>,
        output: OutputFormat,
    ) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Refunding Expired Intent");

        // Load state and env
        let state = state_mgr.load_or_error().await?;
        load_dotenv(&project_dir)?;
        let env_config = EnvConfig::from_env()?;

        let _user_pk = env_config
            .user_pk
            .clone()
            .ok_or_else(|| anyhow::anyhow!("USER_PK not set"))?;

        // Determine which chain to use
        let source_chain = if let Some(chain_ref) = chain {
            Self::resolve_chain(&state, &chain_ref)
                .ok_or_else(|| anyhow::anyhow!("Chain '{}' not found", chain_ref))?
                .clone()
        } else {
            // Try to find from stored intent
            let intent = state.intents.iter().find(|i| i.tx_hash == tx_hash);
            if let Some(i) = intent {
                state
                    .get_chain(i.source_chain_id)
                    .ok_or_else(|| anyhow::anyhow!("Source chain {} not found", i.source_chain_id))?
                    .clone()
            } else {
                // Default to first chain
                let chain_ids = state.chain_ids();
                if chain_ids.is_empty() {
                    anyhow::bail!("No chains configured");
                }
                state.get_chain(chain_ids[0]).unwrap().clone()
            }
        };

        print_kv(
            "Chain",
            format!("{} ({})", source_chain.name, source_chain.chain_id),
        );
        print_kv("TX Hash", &tx_hash);

        let escrow_address = source_chain
            .contracts
            .input_settler_escrow
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No escrow contract on chain"))?;

        print_address("Escrow", escrow_address);

        // Call refund on the escrow contract
        // The refund function requires the original order data, which we'd need to reconstruct
        // For simplicity, we'll just provide instructions since reconstructing the order is complex

        print_warning("To refund an expired intent, you need the original order data.");
        print_info(
            "The escrow contract's refund() function requires the full StandardOrder struct.",
        );
        print_info("");
        print_info("If the intent was created by this CLI, check the intent in state:");
        print_info(&format!(
            "  solver-cli intent status --id intent-{}",
            &tx_hash[2..10]
        ));
        print_info("");
        print_info("Manual refund via cast (if you have the encoded order):");
        print_info(&format!(
            "  cast send {} 'refund((address,uint256,uint256,uint32,uint32,address,uint256[2][],(bytes32,bytes32,uint256,bytes32,uint256,bytes32,bytes,bytes)[]))' <encoded_order> --rpc-url {} --private-key <USER_PK>",
            escrow_address,
            source_chain.rpc
        ));

        if out.is_json() {
            out.json(&serde_json::json!({
                "tx_hash": tx_hash,
                "chain": source_chain.name,
                "escrow": escrow_address,
                "note": "Manual refund required with original order data"
            }))?;
        }

        Ok(())
    }
}
