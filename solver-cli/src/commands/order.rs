use anyhow::Result;
use clap::Subcommand;
use serde::{Deserialize, Serialize};
use std::env;
use std::path::PathBuf;
use tokio::time::{sleep, Duration};

use crate::state::{StateManager};
use crate::utils::*;
use crate::OutputFormat;

#[derive(Subcommand)]
pub enum OrderCommand {
    /// Submit order via aggregator API
    Submit {
        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,

        /// Amount to transfer (in raw units)
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

        /// Aggregator URL
        #[arg(long, default_value = "http://localhost:4000")]
        aggregator_url: String,

        /// Wait for fulfillment
        #[arg(long, short)]
        wait: bool,

        /// Timeout in seconds when waiting
        #[arg(long, default_value = "300")]
        timeout: u64,
    },
}

#[derive(Debug, Serialize, Deserialize)]
struct QuoteRequest {
    user: String,
    intent: Intent,
    #[serde(rename = "supportedTypes")]
    supported_types: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Intent {
    #[serde(rename = "intentType")]
    intent_type: String,
    inputs: Vec<IntentInput>,
    outputs: Vec<IntentOutput>,
    #[serde(rename = "swapType")]
    swap_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct IntentInput {
    user: String,
    asset: String,
    amount: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct IntentOutput {
    receiver: String,
    asset: String,
    amount: String,
}

#[derive(Debug, Deserialize)]
struct QuoteResponse {
    quotes: Vec<Quote>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Quote {
    #[serde(rename = "quoteId")]
    quote_id: String,
    order: serde_json::Value,
    #[serde(flatten)]
    extra: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct OrderSubmission {
    #[serde(rename = "quoteResponse")]
    quote_response: serde_json::Value,
    signature: String,
}

impl OrderCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        match self {
            OrderCommand::Submit {
                dir,
                amount,
                asset,
                from,
                to,
                aggregator_url,
                wait,
                timeout,
            } => {
                Self::submit(dir, amount, asset, from, to, aggregator_url, wait, timeout, output)
                    .await
            }
        }
    }

    async fn submit(
        dir: Option<PathBuf>,
        amount: String,
        asset: String,
        from: Option<String>,
        to: Option<String>,
        aggregator_url: String,
        wait: bool,
        timeout: u64,
        output: OutputFormat,
    ) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);
        let state = state_mgr.load_or_error().await?;

        out.header("Submitting Order via Aggregator");

        // Resolve chains
        let (source_chain, dest_chain) = Self::resolve_chains(&state, from, to)?;

        print_kv("From", &format!("{} ({})", source_chain.name, source_chain.chain_id));
        print_kv("To", &format!("{} ({})", dest_chain.name, dest_chain.chain_id));
        print_kv("Amount", &amount);
        print_kv("Asset", &asset);

        // Get user private key
        load_dotenv(&project_dir)?;
        let env_config = EnvConfig::from_env()?;
        let user_pk = env_config
            .user_pk
            .clone()
            .ok_or_else(|| anyhow::anyhow!("USER_PK not set"))?;

        // Get token addresses
        let source_token = source_chain
            .tokens
            .get(&asset)
            .ok_or_else(|| anyhow::anyhow!("Token {} not found on source chain", asset))?;
        let dest_token = dest_chain
            .tokens
            .get(&asset)
            .ok_or_else(|| anyhow::anyhow!("Token {} not found on dest chain", asset))?;

        print_success("✓ Configuration loaded");

        // Step 1: Request quote from aggregator
        print_info("Requesting quote from aggregator...");
        let quote = Self::request_quote(
            &aggregator_url,
            &user_pk,
            source_chain.chain_id,
            dest_chain.chain_id,
            &source_token.address,
            &dest_token.address,
            &amount,
        )
        .await?;

        print_success(&format!("✓ Quote received: {}", quote.quote_id));

        // Step 2: Sign the order
        print_info("Signing order...");
        let order_for_signing = &quote.order;
        let signature = Self::sign_order(order_for_signing, &user_pk)?;
        print_success(&format!("✓ Order signed: {}", signature));

        // Step 3: Submit to aggregator
        print_info("Submitting order to aggregator...");
        let full_quote = serde_json::to_value(&quote)?;
        let order_id = Self::submit_order(&aggregator_url, &quote.quote_id, full_quote, &signature).await?;
        print_success(&format!("✓ Order submitted: {}", order_id));

        // Step 4: Monitor if requested
        if wait {
            print_info(&format!("Monitoring order status (timeout: {}s)...", timeout));
            Self::monitor_order(&aggregator_url, &order_id, timeout).await?;
        }

        if out.is_json() {
            out.json(&serde_json::json!({
                "quote_id": quote.quote_id,
                "order_id": order_id,
                "status": "submitted"
            }))?;
        }

        Ok(())
    }

    fn resolve_chains(
        state: &crate::state::SolverState,
        from: Option<String>,
        to: Option<String>,
    ) -> Result<(&crate::state::ChainConfig, &crate::state::ChainConfig)> {
        // Get chain IDs in sorted order
        let chain_ids: Vec<u64> = state.chain_ids();

        let source_id = if let Some(from_ref) = from {
            // Parse as ID or name
            from_ref.parse::<u64>().ok().or_else(|| {
                state
                    .chains
                    .values()
                    .find(|c| c.name == from_ref)
                    .map(|c| c.chain_id)
            })
        } else {
            chain_ids.first().copied()
        }
        .ok_or_else(|| anyhow::anyhow!("Could not resolve source chain"))?;

        let dest_id = if let Some(to_ref) = to {
            to_ref.parse::<u64>().ok().or_else(|| {
                state
                    .chains
                    .values()
                    .find(|c| c.name == to_ref)
                    .map(|c| c.chain_id)
            })
        } else {
            chain_ids.get(1).copied()
        }
        .ok_or_else(|| anyhow::anyhow!("Could not resolve destination chain"))?;

        let source_chain = state
            .get_chain(source_id)
            .ok_or_else(|| anyhow::anyhow!("Source chain not found"))?;
        let dest_chain = state
            .get_chain(dest_id)
            .ok_or_else(|| anyhow::anyhow!("Destination chain not found"))?;

        Ok((source_chain, dest_chain))
    }

    async fn request_quote(
        aggregator_url: &str,
        user_pk: &str,
        source_chain_id: u64,
        dest_chain_id: u64,
        source_token: &str,
        dest_token: &str,
        amount: &str,
    ) -> Result<Quote> {
        // Convert addresses to ERC-7930 format
        let user_addr = crate::chain::ChainClient::address_from_pk(user_pk)?;
        let user_hex = Self::to_erc7930(source_chain_id, &format!("{:?}", user_addr));
        let source_token_hex = Self::to_erc7930(source_chain_id, source_token);
        let dest_receiver_hex = Self::to_erc7930(dest_chain_id, &format!("{:?}", user_addr));
        let dest_token_hex = Self::to_erc7930(dest_chain_id, dest_token);

        let request = QuoteRequest {
            user: user_hex.clone(),
            intent: Intent {
                intent_type: "oif-swap".to_string(),
                inputs: vec![IntentInput {
                    user: user_hex.clone(),
                    asset: source_token_hex,
                    amount: amount.to_string(),
                }],
                outputs: vec![IntentOutput {
                    receiver: dest_receiver_hex,
                    asset: dest_token_hex,
                    amount: amount.to_string(),
                }],
                swap_type: "exact-input".to_string(),
            },
            supported_types: vec!["oif-escrow-v0".to_string()],
        };

        let client = reqwest::Client::new();
        let response = client
            .post(format!("{}/api/v1/quotes", aggregator_url))
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            anyhow::bail!("Failed to get quote: {}", error_text);
        }

        let quote_response: QuoteResponse = response.json().await?;

        quote_response
            .quotes
            .into_iter()
            .next()
            .ok_or_else(|| anyhow::anyhow!("No quotes returned"))
    }

    fn to_erc7930(chain_id: u64, address: &str) -> String {
        use alloy::primitives::hex;

        // ERC-7930 format:
        // Version(2) | ChainType(2) | ChainRefLen(1) | ChainRef | AddrLen(1) | Address
        let addr = address.trim_start_matches("0x");

        // Encode chain ID as minimal big-endian
        let chain_bytes = if chain_id == 0 {
            vec![0]
        } else {
            let bytes_needed = (64 - chain_id.leading_zeros() + 7) / 8;
            chain_id.to_be_bytes()[8 - bytes_needed as usize..].to_vec()
        };

        let mut result = Vec::new();
        result.extend_from_slice(&[0x00, 0x01]); // version = 1
        result.extend_from_slice(&[0x00, 0x00]); // chain_type = EIP-155
        result.push(chain_bytes.len() as u8);    // chain_ref length
        result.extend_from_slice(&chain_bytes);  // chain reference
        result.push(20);                          // address length
        result.extend_from_slice(&hex::decode(addr).unwrap()); // address

        format!("0x{}", hex::encode(&result))
    }

    fn sign_order(order: &serde_json::Value, user_pk: &str) -> Result<String> {
        use alloy::primitives::hex;
        use alloy::signers::SignerSync;
        use alloy::signers::local::PrivateKeySigner;

        // Parse private key
        let pk_bytes = hex::decode(user_pk.trim_start_matches("0x"))?;
        if pk_bytes.len() != 32 {
            anyhow::bail!("Invalid private key length");
        }
        let mut pk_array = [0u8; 32];
        pk_array.copy_from_slice(&pk_bytes);
        let signer = PrivateKeySigner::from_bytes(&pk_array.into())?;

        // Compute EIP-712 hash of the order
        let order_json = serde_json::to_vec(order)?;
        let hash = alloy::primitives::keccak256(&order_json);

        // Sign the hash
        let signature = signer.sign_hash_sync(&hash)?;

        Ok(format!("0x{}", hex::encode(signature.as_bytes())))
    }

    async fn submit_order(
        aggregator_url: &str,
        _quote_id: &str,
        order: serde_json::Value,
        signature: &str,
    ) -> Result<String> {
        let submission = OrderSubmission {
            quote_response: order,
            signature: signature.to_string(),
        };

        let client = reqwest::Client::new();
        let response = client
            .post(format!("{}/api/v1/orders", aggregator_url))
            .json(&submission)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            anyhow::bail!("Failed to submit order: {}", error_text);
        }

        let result: serde_json::Value = response.json().await?;

        Ok(result["orderId"]
            .as_str()
            .unwrap_or("unknown")
            .to_string())
    }

    async fn monitor_order(aggregator_url: &str, order_id: &str, timeout: u64) -> Result<()> {
        let client = reqwest::Client::new();
        let start = std::time::Instant::now();
        let mut iteration = 0;

        loop {
            if start.elapsed().as_secs() >= timeout {
                print_warning("Timeout reached");
                break;
            }

            iteration += 1;
            let response = client
                .get(format!("{}/api/v1/orders/{}", aggregator_url, order_id))
                .send()
                .await?;

            if response.status().is_success() {
                let status: serde_json::Value = response.json().await?;
                println!("[{}/{}] Order status: {}", iteration, timeout / 2,
                    serde_json::to_string_pretty(&status)?);

                // Check if completed or failed
                if let Some(status_str) = status.get("status").and_then(|s| s.as_str()) {
                    if status_str == "completed" {
                        print_success("✓ Order completed!");
                        break;
                    } else if status_str == "failed" {
                        print_error("✗ Order failed");
                        break;
                    }
                }
            }

            sleep(Duration::from_secs(2)).await;
        }

        Ok(())
    }
}
