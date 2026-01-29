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

use crate::chain::{format_token_amount, parse_token_amount, ChainClient};
use crate::state::{IntentRecord, IntentStatus, StateManager};
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

        /// Direction: "forward" (evolve->sepolia) or "back" (sepolia->evolve)
        #[arg(long, short, default_value = "forward")]
        direction: String,

        /// Wait for fulfillment
        #[arg(long, short)]
        wait: bool,

        /// Timeout in seconds when waiting
        #[arg(long, default_value = "300")]
        timeout: u64,
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

impl IntentCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        match self {
            IntentCommand::Submit {
                dir,
                amount,
                asset,
                direction,
                wait,
                timeout,
            } => Self::submit(dir, amount, asset, direction, wait, timeout, output).await,
            IntentCommand::Status { id, dir } => Self::status(id, dir, output).await,
            IntentCommand::List { dir, status } => Self::list(dir, status, output).await,
        }
    }

    async fn submit(
        dir: Option<PathBuf>,
        amount: String,
        asset: String,
        direction: String,
        wait: bool,
        timeout: u64,
        output: OutputFormat,
    ) -> Result<()> {
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
            .ok_or_else(|| anyhow::anyhow!("USER_PK not set"))?;

        // Determine source/dest based on direction
        let is_forward = direction.to_lowercase() != "back";
        let (source, dest, source_pk, dest_rpc) = if is_forward {
            (
                state.chains.source.as_ref(),
                state.chains.destination.as_ref(),
                &env_config.evolve_pk,
                &env_config.sepolia_rpc,
            )
        } else {
            (
                state.chains.destination.as_ref(),
                state.chains.source.as_ref(),
                &env_config.sepolia_pk,
                &env_config.evolve_rpc,
            )
        };

        let source = source.ok_or_else(|| anyhow::anyhow!("Source chain not configured"))?;
        let dest = dest.ok_or_else(|| anyhow::anyhow!("Destination chain not configured"))?;

        print_kv("Direction", if is_forward { "forward" } else { "back" });
        print_kv("Source", &source.name);
        print_kv("Destination", &dest.name);

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
        let amount_raw: U256 = amount.parse().map_err(|_| anyhow::anyhow!("Invalid amount"))?;
        print_kv("Amount (raw units)", &format!("{} {}", amount, asset));
        print_kv("Human readable", &format_token_amount(amount_raw, source_token.decimals));

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

        // Step 1: Ensure user has tokens (mint if needed using deployer key)
        print_header("Checking User Balance");

        let user_balance = Self::get_token_balance(
            &source.rpc,
            &source_token.address,
            user_address,
        ).await?;

        print_balance(
            "User balance",
            &format_token_amount(user_balance, source_token.decimals),
            &asset,
        );

        if user_balance < amount_raw {
            print_warning("Insufficient balance. Minting tokens to user...");

            // Mint tokens to user using deployer key
            Self::mint_tokens(
                &source.rpc,
                source_pk,
                &source_token.address,
                user_address,
                amount_raw,
            ).await?;

            print_success("Tokens minted to user");
        }

        // Step 2: Approve escrow to spend tokens
        print_header("Approving Token Spend");

        let approve_tx = Self::approve_tokens(
            &source.rpc,
            &user_pk,
            &source_token.address,
            escrow_address,
            amount_raw,
        ).await?;

        print_success(&format!("Approval tx: {}", approve_tx));

        // Step 3: Build and submit the intent
        print_header("Submitting Intent On-Chain");

        // Build the StandardOrder
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let nonce = now; // Use timestamp as nonce
        let expires = (now + 300) as u32; // 5 minutes from now
        let fill_deadline = (now + 240) as u32; // 4 minutes from now

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
            inputs: vec![[U256::from_be_slice(source_token_address.as_slice()), amount_raw]],
            outputs: vec![MandateOutput {
                oracle: addr_to_bytes32(dest_oracle),
                settler: addr_to_bytes32(dest_settler),
                chainId: U256::from(dest.chain_id),
                token: addr_to_bytes32(dest_token_address),
                amount: amount_raw, // 1:1 for same token
                recipient: addr_to_bytes32(user_address),
                callbackData: vec![].into(),
                context: vec![].into(),
            }],
        };

        // Encode the order and call open()
        let tx_hash = Self::submit_order(
            &source.rpc,
            &user_pk,
            escrow_address,
            &order,
        ).await?;

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
        print_kv("Amount", &format!("{} {}", amount, asset));
        print_kv("Status", "pending");
        print_summary_end();

        // Wait for fulfillment if requested
        if wait {
            print_info(&format!("Waiting for fulfillment (timeout: {}s)...", timeout));

            // Poll destination chain for user balance increase
            let initial_dest_balance = Self::get_token_balance(
                dest_rpc,
                &dest_token.address,
                user_address,
            ).await.unwrap_or(U256::ZERO);

            let fulfilled = Self::wait_for_balance_increase(
                dest_rpc,
                &dest_token.address,
                user_address,
                initial_dest_balance,
                timeout,
            ).await?;

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

                let user_source_balance = Self::get_token_balance(
                    &source.rpc,
                    &source_token.address,
                    user_address,
                ).await.unwrap_or(U256::ZERO);

                let user_dest_balance = Self::get_token_balance(
                    dest_rpc,
                    &dest_token.address,
                    user_address,
                ).await.unwrap_or(U256::ZERO);

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
            }))?;
        }

        Ok(())
    }

    async fn get_token_balance(
        rpc_url: &str,
        token_address: &str,
        owner: Address,
    ) -> Result<U256> {
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
        let balance_str = stdout.trim();

        // Parse the balance (cast returns decimal)
        let balance = U256::from_str(balance_str)
            .or_else(|_| U256::from_str_radix(balance_str.trim_start_matches("0x"), 16))
            .unwrap_or(U256::ZERO);

        Ok(balance)
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
}
