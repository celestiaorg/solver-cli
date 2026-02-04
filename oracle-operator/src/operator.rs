use crate::config::{ChainConfig, OracleConfig};
use alloy::network::EthereumWallet;
use alloy::providers::{Provider, ProviderBuilder};
use alloy_primitives::{Address as AlloyAddress, Bytes, FixedBytes, U256};
use alloy_signer::Signer;
use alloy_signer_local::PrivateKeySigner;
use alloy_sol_types::{sol, SolCall, SolEvent};
use anyhow::{Context, Result};
use sha3::{Digest, Keccak256};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tracing::{debug, error, info, warn};

/// Concrete HTTP provider type from ProviderBuilder::new().with_recommended_fillers().wallet(...).on_http(...).
/// Stored so we can hold multiple providers in a HashMap without dyn Provider (which
/// would require BoxTransport; our provider uses Http<Client>).
/// with_recommended_fillers() adds ChainId, Gas, BlobGas, Nonce, and Wallet fillers.
type WalletHttpProvider = alloy::providers::fillers::FillProvider<
    alloy::providers::fillers::JoinFill<
        alloy::providers::fillers::JoinFill<
            alloy::providers::Identity,
            alloy::providers::fillers::JoinFill<
                alloy::providers::fillers::GasFiller,
                alloy::providers::fillers::JoinFill<
                    alloy::providers::fillers::BlobGasFiller,
                    alloy::providers::fillers::JoinFill<
                        alloy::providers::fillers::NonceFiller,
                        alloy::providers::fillers::ChainIdFiller,
                    >,
                >,
            >,
        >,
        alloy::providers::fillers::WalletFiller<alloy::network::EthereumWallet>,
    >,
    alloy::providers::RootProvider<alloy::transports::http::Http<reqwest::Client>>,
    alloy::transports::http::Http<reqwest::Client>,
    alloy::network::Ethereum,
>;

// Solidity interfaces
sol! {
    interface IOutputSettlerSimple {
        event OutputFilled(
            bytes32 indexed orderId,
            bytes32 solver,
            uint32 timestamp,
            MandateOutput output,
            uint256 finalAmount
        );

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
    }

    interface ICentralizedOracle {
        function submitAttestation(
            bytes calldata signature,
            uint256 remoteChainId,
            bytes32 remoteOracle,
            bytes32 application,
            bytes32 dataHash
        ) external;

        function isProven(
            uint256 remoteChainId,
            bytes32 remoteOracle,
            bytes32 application,
            bytes32 dataHash
        ) external view returns (bool);
    }
}

/// Helper to compute keccak256 hash
fn keccak256_bytes(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut hash = [0u8; 32];
    hash.copy_from_slice(&result);
    hash
}

/// Encode FillDescription according to MandateOutputEncodingLib
#[allow(clippy::too_many_arguments)]
fn encode_fill_description(
    solver: &[u8; 32],
    order_id: &[u8; 32],
    timestamp: u32,
    token: &[u8; 32],
    amount: U256,
    recipient: &[u8; 32],
    call_data: &[u8],
    context: &[u8],
) -> Result<Vec<u8>> {
    let mut payload = Vec::new();

    // solver (32 bytes)
    payload.extend_from_slice(solver);

    // orderId (32 bytes)
    payload.extend_from_slice(order_id);

    // timestamp (4 bytes, big-endian)
    payload.extend_from_slice(&timestamp.to_be_bytes());

    // token (32 bytes)
    payload.extend_from_slice(token);

    // amount (32 bytes, big-endian)
    let amount_bytes = amount.to_be_bytes::<32>();
    payload.extend_from_slice(&amount_bytes);

    // recipient (32 bytes)
    payload.extend_from_slice(recipient);

    // callData length (2 bytes) + data
    let call_len = call_data.len() as u16;
    payload.extend_from_slice(&call_len.to_be_bytes());
    payload.extend_from_slice(call_data);

    // context length (2 bytes) + data
    let context_len = context.len() as u16;
    payload.extend_from_slice(&context_len.to_be_bytes());
    payload.extend_from_slice(context);

    Ok(payload)
}

#[derive(Debug, Clone)]
struct FillEvent {
    order_id: [u8; 32],
    application_id: [u8; 32],
    timestamp: u32,
    solver: [u8; 32],
    token: [u8; 32],
    amount: U256,
    recipient: [u8; 32],
    call_data: Vec<u8>,
    context: Vec<u8>,
    source_chain_id: u64, // Chain where this fill happened
}

pub struct OracleOperator {
    config: OracleConfig,
    operator_signer: PrivateKeySigner,
    providers: HashMap<u64, Arc<WalletHttpProvider>>,
    processed_fills: Arc<tokio::sync::Mutex<HashSet<[u8; 32]>>>,
}

impl OracleOperator {
    pub async fn new(config: OracleConfig) -> Result<Self> {
        // Parse operator signer
        let operator_signer: PrivateKeySigner = config
            .operator_private_key
            .parse()
            .context("Invalid operator private key")?;

        info!("Operator address: {:?}", operator_signer.address());

        // Create providers for each chain
        let mut providers: HashMap<u64, Arc<WalletHttpProvider>> = HashMap::new();

        // Create wallet with operator signer
        let wallet = EthereumWallet::from(operator_signer.clone());

        for chain_config in &config.chains {
            let provider = ProviderBuilder::new()
                .with_recommended_fillers()
                .wallet(wallet.clone())
                .on_http(chain_config.rpc_url.parse()?);

            providers.insert(chain_config.chain_id, Arc::from(provider));
            info!(
                "Connected to chain {}: {}",
                chain_config.chain_id, chain_config.rpc_url
            );
        }

        Ok(Self {
            config,
            operator_signer,
            providers,
            processed_fills: Arc::new(tokio::sync::Mutex::new(HashSet::new())),
        })
    }

    pub async fn run(self) -> Result<()> {
        let poll_interval = Duration::from_secs(self.config.poll_interval_seconds);

        loop {
            if let Err(e) = self.poll_and_process().await {
                error!("Error polling chains: {}", e);
            }

            sleep(poll_interval).await;
        }
    }

    async fn poll_and_process(&self) -> Result<()> {
        // Poll each chain for new fills
        for chain_config in &self.config.chains {
            if let Err(e) = self
                .process_chain(chain_config.chain_id, chain_config)
                .await
            {
                warn!("Error processing chain {}: {}", chain_config.chain_id, e);
            }
        }

        Ok(())
    }

    async fn process_chain(&self, chain_id: u64, chain_config: &ChainConfig) -> Result<()> {
        let provider = self
            .providers
            .get(&chain_id)
            .ok_or_else(|| anyhow::anyhow!("No provider for chain {}", chain_id))?;

        // Get current block
        let current_block = provider.get_block_number().await?;

        // Start from configured block or recent blocks
        let start_block = chain_config
            .start_block
            .unwrap_or(current_block.saturating_sub(100));

        debug!(
            "Polling chain {} blocks {} to {}",
            chain_id, start_block, current_block
        );

        // Get logs for OutputFilled events
        let output_settler: AlloyAddress = chain_config.output_settler_address.parse()?;

        let filter = alloy::rpc::types::Filter::new()
            .address(output_settler)
            .from_block(start_block)
            .to_block(current_block)
            .event_signature(FixedBytes::from(keccak256_bytes(
                b"OutputFilled(bytes32,bytes32,uint32,(bytes32,bytes32,uint256,bytes32,uint256,bytes32,bytes,bytes),uint256)"
            )));

        let logs = provider.get_logs(&filter).await?;

        debug!(
            "Found {} OutputFilled events on chain {}",
            logs.len(),
            chain_id
        );

        for log in logs {
            if let Err(e) = self.process_fill_event(chain_id, &log).await {
                warn!("Error processing fill event: {}", e);
            }
        }

        Ok(())
    }

    async fn process_fill_event(
        &self,
        source_chain_id: u64,
        log: &alloy::rpc::types::Log,
    ) -> Result<()> {
        // Parse OutputFilled event
        // Topics: [signature, orderId]
        if log.topics().len() < 2 {
            return Ok(());
        }

        let order_id: [u8; 32] = log.topics()[1].0;

        // Check if already processed
        {
            let processed = self.processed_fills.lock().await;
            if processed.contains(&order_id) {
                debug!(
                    "Already processed fill for order {:?}",
                    hex::encode(order_id)
                );
                return Ok(());
            }
        }

        // Convert alloy RPC log to alloy primitives log for decoding
        let prim_log = alloy_primitives::Log {
            address: AlloyAddress::from_slice(log.address().as_ref()),
            data: alloy_primitives::LogData::new(
                log.topics().iter().map(|t| FixedBytes::from(t.0)).collect(),
                log.data().data.clone(),
            )
            .unwrap(),
        };

        // Try to decode the event using alloy
        let decoded = match IOutputSettlerSimple::OutputFilled::decode_log(&prim_log, true) {
            Ok(d) => d,
            Err(e) => {
                warn!("Failed to decode OutputFilled event: {}", e);
                return Ok(());
            }
        };

        let timestamp = decoded.timestamp;
        let output = &decoded.output;

        // Extract fields from MandateOutput (correct order), converting FixedBytes to [u8; 32]
        let _oracle = output.oracle.0;
        let settler = output.settler.0;
        let _chain_id = output.chainId.to::<u64>();
        let token = output.token.0;
        let amount = output.amount;
        let recipient = output.recipient.0;
        let call_data = output.callbackData.to_vec();
        let context = output.context.to_vec();

        // The solver is in the top-level event, not in MandateOutput
        let solver = decoded.solver.0;

        // Use settler as application_id (this is what the oracle contract uses)
        let application_id = settler;

        let fill = FillEvent {
            order_id,
            application_id,
            timestamp,
            solver,
            token,
            amount,
            recipient,
            call_data,
            context,
            source_chain_id,
        };

        info!(
            "Found fill on chain {}: order={}, timestamp={}, amount={}",
            source_chain_id,
            hex::encode(order_id),
            timestamp,
            amount
        );

        // Process attestation for destination chain
        self.submit_attestation(&fill).await?;

        // Mark as processed
        {
            let mut processed = self.processed_fills.lock().await;
            processed.insert(order_id);
        }

        Ok(())
    }

    async fn submit_attestation(&self, fill: &FillEvent) -> Result<()> {
        // The fill happened on fill.source_chain_id (the destination where OutputFilled was emitted)
        // We need to attest on the OTHER chain (the source where funds are escrowed)
        let fill_chain_id = fill.source_chain_id;

        // Find the escrow chain (the other chain that isn't the fill chain)
        let escrow_chain_config = self
            .config
            .chains
            .iter()
            .find(|c| c.chain_id != fill_chain_id)
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "No other chain found for escrow (fill was on {})",
                    fill_chain_id
                )
            })?;

        let fill_chain_config = self
            .config
            .chains
            .iter()
            .find(|c| c.chain_id == fill_chain_id)
            .ok_or_else(|| anyhow::anyhow!("No config for fill chain {}", fill_chain_id))?;

        // Encode FillDescription
        let payload = encode_fill_description(
            &fill.solver,
            &fill.order_id,
            fill.timestamp,
            &fill.token,
            fill.amount,
            &fill.recipient,
            &fill.call_data,
            &fill.context,
        )?;

        let payload_hash = keccak256_bytes(&payload);

        // Compute attestation message
        // message = keccak256(abi.encodePacked(remoteChainId, remoteOracle, application, dataHash))
        // remoteChainId = the fill chain (where the OutputFilled event happened)
        // remoteOracle = the oracle address on the fill chain
        let remote_oracle: [u8; 32] = {
            let addr: AlloyAddress = fill_chain_config.oracle_address.parse()?;
            let mut bytes = [0u8; 32];
            bytes[12..].copy_from_slice(addr.as_slice());
            bytes
        };

        let mut message = Vec::new();
        // Encode fill_chain_id as uint256 (32 bytes, big-endian)
        let chain_id_bytes = U256::from(fill_chain_id).to_be_bytes::<32>();
        message.extend_from_slice(&chain_id_bytes);
        message.extend_from_slice(&remote_oracle);
        message.extend_from_slice(&fill.application_id);
        message.extend_from_slice(&payload_hash);

        let message_hash = keccak256_bytes(&message);

        // Sign with EIP-191 prefix (sign_message automatically applies it)
        let signature = self.operator_signer.sign_message(&message_hash).await?;
        let signature_bytes = signature.as_bytes();

        info!(
            "✍️  Signed attestation for order {} (fill on chain {}, submitting to escrow chain {})",
            hex::encode(fill.order_id),
            fill_chain_id,
            escrow_chain_config.chain_id
        );

        // Submit to CentralizedOracle on escrow chain (where funds are locked)
        let provider = self
            .providers
            .get(&escrow_chain_config.chain_id)
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "No provider for escrow chain {}",
                    escrow_chain_config.chain_id
                )
            })?;

        let oracle_address: AlloyAddress = escrow_chain_config.oracle_address.parse()?;

        let call = ICentralizedOracle::submitAttestationCall {
            signature: Bytes::from(signature_bytes.to_vec()),
            remoteChainId: U256::from(fill_chain_id),
            remoteOracle: FixedBytes::from(remote_oracle),
            application: FixedBytes::from(fill.application_id),
            dataHash: FixedBytes::from(payload_hash),
        };

        // Build transaction (wallet will automatically sign)
        let tx = alloy::rpc::types::TransactionRequest::default()
            .to(oracle_address)
            .input(call.abi_encode().into())
            .gas_limit(500_000);

        // Send transaction (wallet handles signing)
        let pending = provider.send_transaction(tx).await?;
        let receipt = pending.get_receipt().await?;

        info!(
            "Submitted attestation tx: {:?} (status: {:?})",
            receipt.transaction_hash,
            receipt.status()
        );

        Ok(())
    }
}
