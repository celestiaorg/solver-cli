use crate::config::{ChainConfig, OracleConfig};
use crate::state::StateManager;
use alloy::network::EthereumWallet;
use alloy::providers::{Provider, ProviderBuilder};
use alloy_primitives::{Address as AlloyAddress, Bytes, FixedBytes, U256};
use alloy_signer::Signer;
use alloy_signer_local::PrivateKeySigner;
use alloy_sol_types::{sol, SolCall, SolEvent};
use anyhow::{Context, Result};
use sha3::{Digest, Keccak256};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;
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

fn choose_origin_chain(
    discovered_origin_chain: Option<u64>,
    fill_chain_id: u64,
    configured_chain_ids: &[u64],
) -> Result<u64> {
    if let Some(origin_chain_id) = discovered_origin_chain {
        return Ok(origin_chain_id);
    }

    // Fallback for 2-chain setup: use the other chain.
    if configured_chain_ids.len() == 2 {
        return configured_chain_ids
            .iter()
            .copied()
            .find(|&chain_id| chain_id != fill_chain_id)
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "No fallback origin chain found for fill_chain={} in configured_chains={:?}",
                    fill_chain_id,
                    configured_chain_ids
                )
            });
    }

    Err(anyhow::anyhow!(
        "Could not find origin chain for fill_chain={} in configured_chains={:?}",
        fill_chain_id,
        configured_chain_ids
    ))
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
    fill_chain_id: u64, // Chain where this fill happened (destination)
}

fn decode_output_filled(
    source_chain_id: u64,
    log: &alloy::rpc::types::Log,
) -> Result<FillEvent> {
    // Topics: [signature, orderId]
    if log.topics().len() < 2 {
        return Err(anyhow::anyhow!(
            "Malformed OutputFilled log on chain {}: expected at least 2 topics, got {}",
            source_chain_id,
            log.topics().len()
        ));
    }

    let order_id: [u8; 32] = log.topics()[1].0;

    // Convert alloy RPC log to alloy primitives log for decoding.
    let prim_log = alloy_primitives::Log {
        address: AlloyAddress::from_slice(log.address().as_ref()),
        data: alloy_primitives::LogData::new(
            log.topics().iter().map(|t| FixedBytes::from(t.0)).collect(),
            log.data().data.clone(),
        )
        .ok_or_else(|| {
            anyhow::anyhow!(
                "Malformed log payload for order {} on chain {}",
                hex::encode(order_id),
                source_chain_id
            )
        })?,
    };

    let decoded = IOutputSettlerSimple::OutputFilled::decode_log(&prim_log, true).map_err(|e| {
        anyhow::anyhow!(
            "Failed to decode OutputFilled for order {} on chain {}: {}",
            hex::encode(order_id),
            source_chain_id,
            e
        )
    })?;

    let output = &decoded.output;
    let application_id = output.settler.0;

    Ok(FillEvent {
        order_id,
        application_id,
        timestamp: decoded.timestamp,
        solver: decoded.solver.0,
        token: output.token.0,
        amount: output.amount,
        recipient: output.recipient.0,
        call_data: output.callbackData.to_vec(),
        context: output.context.to_vec(),
        fill_chain_id: source_chain_id,
    })
}

pub struct OracleOperator {
    config: OracleConfig,
    operator_signer: PrivateKeySigner,
    providers: HashMap<u64, Arc<WalletHttpProvider>>,
    state: Arc<Mutex<StateManager>>,
}

impl OracleOperator {
    pub async fn new(config: OracleConfig, state_dir: &Path) -> Result<Self> {
        // Parse operator signer
        let operator_signer: PrivateKeySigner = config
            .operator_private_key
            .parse()
            .context("Invalid operator private key")?;

        info!("Operator address: {:?}", operator_signer.address());

        // Load persistent state
        let state_manager = StateManager::new(state_dir)?;

        // Log resumption info
        for chain in &config.chains {
            if let Some(&last_block) = state_manager
                .state()
                .last_processed_block
                .get(&chain.chain_id)
            {
                info!(
                    "Chain {}: resuming from block {}",
                    chain.chain_id,
                    last_block + 1
                );
            }
        }

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
            state: Arc::new(Mutex::new(state_manager)),
        })
    }

    pub async fn run(&self) -> Result<()> {
        let poll_interval = Duration::from_secs(self.config.poll_interval_seconds);
        let save_interval = 10; // Save state every N polls (~30s with 3s poll)
        let mut poll_count = 0u64;

        loop {
            if let Err(e) = self.poll_and_process().await {
                error!("Error polling chains: {}", e);
            }

            // Periodically save state to disk
            poll_count += 1;
            if poll_count % save_interval == 0 {
                let mut state = self.state.lock().await;
                if let Err(e) = state.save_if_dirty() {
                    error!("Failed to save state: {}", e);
                }
            }

            sleep(poll_interval).await;
        }
    }

    /// Save state to disk (called on shutdown)
    pub async fn save_state(&self) -> Result<()> {
        let mut state = self.state.lock().await;
        state.save()?;
        Ok(())
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

        // Get start block from persistent state
        let start_block = {
            let state = self.state.lock().await;
            state.get_start_block(chain_id, chain_config.start_block, current_block)
        };

        // Don't query if we're already at the current block
        if start_block > current_block {
            return Ok(());
        }

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

        let mut all_succeeded = true;
        for log in logs {
            if let Err(e) = self.process_fill_event(chain_id, &log).await {
                warn!("Error processing fill event: {}", e);
                all_succeeded = false;
            }
        }

        // Only advance block cursor if all events were processed successfully.
        // Otherwise we retry the same range next poll (failed attestations can be retried).
        if all_succeeded {
            let mut state = self.state.lock().await;
            state.set_last_block(chain_id, current_block);
        }

        Ok(())
    }

    async fn process_fill_event(
        &self,
        source_chain_id: u64,
        log: &alloy::rpc::types::Log,
    ) -> Result<()> {
        // Parse OutputFilled event topics: [signature, orderId]
        if log.topics().len() < 2 {
            return Err(anyhow::anyhow!(
                "Malformed OutputFilled log on chain {}: expected at least 2 topics, got {}",
                source_chain_id,
                log.topics().len()
            ));
        }

        let order_id: [u8; 32] = log.topics()[1].0;

        // Check if already processed (using persistent state)
        {
            let state = self.state.lock().await;
            if state.is_processed(&order_id) {
                debug!(
                    "Already processed fill for order {:?}",
                    hex::encode(order_id)
                );
                return Ok(());
            }
        }

        let fill = match decode_output_filled(source_chain_id, log) {
            Ok(fill) => fill,
            Err(e) => {
                warn!(
                    "Retryable decode failure: order={} fill_chain={} error={}",
                    hex::encode(order_id),
                    source_chain_id,
                    e
                );
                return Err(e);
            }
        };

        // Submit attestation to origin chain (where funds are escrowed)
        if let Err(e) = self.submit_attestation(&fill).await {
            warn!(
                "Retryable attestation failure: order={} fill_chain={} error={}",
                hex::encode(fill.order_id),
                source_chain_id,
                e
            );
            return Err(e).with_context(|| {
                format!(
                    "Attestation submission failed for order={} fill_chain={}",
                    hex::encode(fill.order_id),
                    source_chain_id
                )
            });
        }

        // Mark as processed (persistently)
        {
            let mut state = self.state.lock().await;
            state.mark_processed(&order_id);
        }

        info!(
            "Successfully attested and marked processed: order={} fill_chain={} amount={}",
            hex::encode(fill.order_id),
            source_chain_id,
            fill.amount
        );

        Ok(())
    }

    /// Find the origin chain by querying escrow contracts for the order status
    async fn find_origin_chain(&self, order_id: &[u8; 32], fill_chain_id: u64) -> Option<u64> {
        // Query each chain (except the fill chain) to find where the order originated
        for chain_config in &self.config.chains {
            if chain_config.chain_id == fill_chain_id {
                continue; // Skip the fill chain
            }

            if let Some(provider) = self.providers.get(&chain_config.chain_id) {
                // Query orderStatus(orderId) on the input settler
                // orderStatus returns an enum: 0=None, 1=Deposited, 2=Claimed, 3=Refunded
                let input_settler: AlloyAddress = match chain_config
                    .input_settler_address
                    .as_ref()
                    .and_then(|a| a.parse().ok())
                {
                    Some(addr) => addr,
                    None => continue,
                };

                // Encode the call: orderStatus(bytes32)
                let call_data = {
                    let mut data = vec![0u8; 36];
                    // Function selector for orderStatus(bytes32) = 0x2dff692d
                    data[0..4].copy_from_slice(&[0x2d, 0xff, 0x69, 0x2d]);
                    data[4..36].copy_from_slice(order_id);
                    Bytes::from(data)
                };

                let tx = alloy::rpc::types::TransactionRequest::default()
                    .to(input_settler)
                    .input(call_data.into());

                match provider.call(&tx).await {
                    Ok(result) => {
                        // Result is a uint8 enum value
                        if result.len() >= 32 {
                            let status = result[31]; // Last byte of 32-byte response
                                                     // 1 = Deposited (order exists and is pending)
                                                     // 2 = Claimed (order was filled)
                                                     // Either means this is the origin chain
                            if status == 1 || status == 2 {
                                debug!(
                                    "Found order {} on chain {} with status {}",
                                    hex::encode(order_id),
                                    chain_config.chain_id,
                                    status
                                );
                                return Some(chain_config.chain_id);
                            }
                        }
                    }
                    Err(e) => {
                        debug!(
                            "Failed to query order status on chain {}: {}",
                            chain_config.chain_id, e
                        );
                    }
                }
            }
        }
        None
    }

    async fn submit_attestation(&self, fill: &FillEvent) -> Result<()> {
        // The fill happened on fill.fill_chain_id (the destination where OutputFilled was emitted)
        // We need to find the origin chain where funds are escrowed
        let fill_chain_id = fill.fill_chain_id;

        // Find the origin chain by querying escrows
        let configured_chain_ids: Vec<u64> =
            self.config.chains.iter().map(|c| c.chain_id).collect();
        let discovered_origin_chain = self.find_origin_chain(&fill.order_id, fill_chain_id).await;
        let origin_chain_id = choose_origin_chain(
            discovered_origin_chain,
            fill_chain_id,
            &configured_chain_ids,
        )
        .with_context(|| {
            format!(
                "order={} fill_chain={}",
                hex::encode(fill.order_id),
                fill_chain_id
            )
        })?;

        info!(
            "Relaying attestation: fill on chain {} -> origin chain {}",
            fill_chain_id, origin_chain_id
        );

        // Find the escrow chain config
        let escrow_chain_config = self
            .config
            .chains
            .iter()
            .find(|c| c.chain_id == origin_chain_id)
            .ok_or_else(|| {
                anyhow::anyhow!("Origin chain {} not found in config", origin_chain_id)
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

        debug!(
            "Signed attestation payload for order {} (fill on chain {}, submitting to escrow chain {})",
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
        let tx_hash = receipt.transaction_hash;
        let status = receipt.status();

        if !status {
            return Err(anyhow::anyhow!(
                "Attestation tx failed: order={} fill_chain={} origin_chain={} tx_hash={:?} status={}",
                hex::encode(fill.order_id),
                fill_chain_id,
                origin_chain_id,
                tx_hash,
                status
            ));
        }

        info!(
            "Submitted attestation tx: order={} fill_chain={} origin_chain={} tx_hash={:?} status={}",
            hex::encode(fill.order_id),
            fill_chain_id,
            origin_chain_id,
            tx_hash,
            status
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy_primitives::{Address, B256};

    #[test]
    fn choose_origin_chain_errors_for_n_chain_when_not_found() {
        let err = choose_origin_chain(None, 1, &[1, 2, 3]).expect_err("expected retryable error");
        assert!(err.to_string().contains("Could not find origin chain"));
    }

    #[test]
    fn choose_origin_chain_falls_back_for_two_chain_setup() {
        let origin_chain = choose_origin_chain(None, 11155111, &[11155111, 1234]).unwrap();
        assert_eq!(origin_chain, 1234);
    }

    #[test]
    fn decode_output_filled_returns_error_for_malformed_event() {
        let log = alloy::rpc::types::Log {
            inner: alloy_primitives::Log {
                address: Address::ZERO,
                data: alloy_primitives::LogData::new_unchecked(
                    vec![B256::ZERO, B256::from([1u8; 32])],
                    Bytes::from(vec![0x01, 0x02]),
                ),
            },
            ..Default::default()
        };

        let err = decode_output_filled(1, &log).expect_err("expected decode error");
        assert!(err.to_string().contains("Failed to decode OutputFilled"));
    }
}
