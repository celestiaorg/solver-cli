//! Centralized oracle settlement implementation.
//!
//! This module provides a settlement implementation using a centralized oracle
//! for attestations. The oracle operator runs as a SEPARATE service with its own key.
//!
//! ## Architecture
//!
//! The solver and oracle operator are independent entities with different keys:
//! - **Solver**: Fills orders on destination chain, polls oracle, claims on source chain
//! - **Oracle Operator**: Watches both chains, signs attestations, submits to oracle contracts
//!
//! This separation ensures the solver cannot attest to its own fills (trust model requirement).
//!
//! ## Flow
//!
//! 1. **Solver** fills order on destination chain → OutputFilled event
//! 2. **Oracle Operator** detects OutputFilled on the destination (fill) chain
//! 3. **Oracle Operator** extracts fill details and computes FillDescription payload hash
//! 4. **Oracle Operator** signs attestation over fill context:
//!    sign(keccak256(remoteChainId=destination, remoteOracle=destinationOracle, application=settler, payloadHash))
//! 5. **Oracle Operator** submits attestation to `CentralizedOracle` on the origin/source chain (escrow chain)
//! 6. Source-chain oracle stores the attestation
//! 7. **Solver** polls `oracle.isProven()` on the source chain (with remote chain/oracle fields pointing to destination)
//! 8. **Solver** claims via `InputSettlerEscrow.finalise()` on the source chain once oracle confirms

use alloy_primitives::{hex, Address as AlloyAddress, FixedBytes, U256};
use alloy_provider::{DynProvider, Provider};
use alloy_sol_types::{sol, SolCall};
use async_trait::async_trait;
use sha3::{Digest, Keccak256};
use solver_settlement::{
	utils::parse_oracle_config, OracleConfig, SettlementError, SettlementFactory,
	SettlementInterface, SettlementRegistry,
};
use solver_types::{
	create_http_provider, standards::eip7683::Eip7683OrderData, with_0x_prefix, Address,
	ConfigSchema, Field, FieldType, FillProof, NetworksConfig, Order, ProviderError, Schema,
	Transaction, TransactionHash, TransactionReceipt, TransactionType,
};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, info, warn};

// Solidity interface for CentralizedOracle
sol! {
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

/// Helper to compute keccak256 hash of bytes
fn keccak256_bytes(data: &[u8]) -> [u8; 32] {
	let mut hasher = Keccak256::new();
	hasher.update(data);
	let result = hasher.finalize();
	let mut hash = [0u8; 32];
	hash.copy_from_slice(&result);
	hash
}

/// Convert order ID string to bytes32
fn order_id_to_bytes32(order_id: &str) -> [u8; 32] {
	if let Some(hex_str) = order_id.strip_prefix("0x") {
		let mut bytes = [0u8; 32];
		if let Ok(decoded) = hex::decode(hex_str) {
			let len = decoded.len().min(32);
			bytes[32 - len..].copy_from_slice(&decoded[..len]);
		}
		bytes
	} else {
		let raw = order_id.as_bytes();
		let mut bytes = [0u8; 32];
		let len = raw.len().min(32);
		bytes[32 - len..].copy_from_slice(&raw[..len]);
		bytes
	}
}

/// Encode FillDescription according to MandateOutputEncodingLib
///
/// Layout:
/// - solver (32 bytes)
/// - orderId (32 bytes)
/// - timestamp (4 bytes, big-endian)
/// - token (32 bytes)
/// - amount (32 bytes, big-endian)
/// - recipient (32 bytes)
/// - call length (2 bytes, big-endian) + call data
/// - context length (2 bytes, big-endian) + context data
#[allow(clippy::too_many_arguments)]
fn encode_fill_description(
	solver: [u8; 32],
	order_id: [u8; 32],
	timestamp: u32,
	token: [u8; 32],
	amount: U256,
	recipient: [u8; 32],
	call_data: &[u8],
	context: &[u8],
) -> Result<Vec<u8>, SettlementError> {
	if call_data.len() > u16::MAX as usize {
		return Err(SettlementError::ValidationFailed(
			"Call data too large".into(),
		));
	}
	if context.len() > u16::MAX as usize {
		return Err(SettlementError::ValidationFailed(
			"Context data too large".into(),
		));
	}

	let mut payload =
		Vec::with_capacity(32 + 32 + 4 + 32 + 32 + 32 + 2 + call_data.len() + 2 + context.len());

	// Solver identifier (32 bytes)
	payload.extend_from_slice(&solver);

	// Order ID (32 bytes)
	payload.extend_from_slice(&order_id);

	// Timestamp (4 bytes) - uint32 big endian
	payload.extend_from_slice(&timestamp.to_be_bytes());

	// Token (32 bytes)
	payload.extend_from_slice(&token);

	// Amount (32 bytes) - big endian
	let amount_bytes = amount.to_be_bytes::<32>();
	payload.extend_from_slice(&amount_bytes);

	// Recipient (32 bytes)
	payload.extend_from_slice(&recipient);

	// Call length (2 bytes) and call data
	payload.extend_from_slice(&(call_data.len() as u16).to_be_bytes());
	payload.extend_from_slice(call_data);

	// Context length (2 bytes) and context
	payload.extend_from_slice(&(context.len() as u16).to_be_bytes());
	payload.extend_from_slice(context);

	Ok(payload)
}

/// Extract fill details from OutputFilled event logs
fn extract_fill_details_from_logs(
	logs: &[solver_types::Log],
	order_id: &[u8; 32],
) -> Result<(Vec<u8>, u32), SettlementError> {
	// OutputFilled event signature
	let output_filled_signature = keccak256_bytes(
		b"OutputFilled(bytes32,bytes32,uint32,(bytes32,bytes32,uint256,bytes32,uint256,bytes32,bytes,bytes),uint256)",
	);

	for log in logs {
		if log.topics.len() >= 2 && log.topics[0].0 == output_filled_signature {
			// Topic[1] is indexed orderId
			if log.topics[1].0 == *order_id {
				// Data contains: solver (bytes32), timestamp (uint32 padded to 32), MandateOutput, finalAmount
				if log.data.len() >= 64 {
					let solver = log.data[0..32].to_vec();
					let timestamp_bytes = &log.data[32..64];
					// Timestamp is uint32, stored in the last 4 bytes of the 32-byte slot
					let timestamp = u32::from_be_bytes([
						timestamp_bytes[28],
						timestamp_bytes[29],
						timestamp_bytes[30],
						timestamp_bytes[31],
					]);

					return Ok((solver, timestamp));
				}
			}
		}
	}

	Err(SettlementError::ValidationFailed(
		"No OutputFilled event found in logs".into(),
	))
}

/// Centralized oracle settlement implementation.
pub struct CentralizedSettlement {
	/// RPC providers for each supported network.
	providers: HashMap<u64, DynProvider>,
	/// Oracle configuration including addresses and routes.
	oracle_config: OracleConfig,
}

impl CentralizedSettlement {
	/// Creates a new CentralizedSettlement instance.
	pub async fn new(
		networks: &NetworksConfig,
		oracle_config: OracleConfig,
	) -> Result<Self, SettlementError> {
		info!("CentralizedSettlement initialized (oracle operator runs separately)");

		// Create RPC providers for each network that has oracles configured
		let mut providers = HashMap::new();

		let mut all_network_ids: Vec<u64> = oracle_config
			.input_oracles
			.keys()
			.chain(oracle_config.output_oracles.keys())
			.copied()
			.collect();
		all_network_ids.sort_unstable();
		all_network_ids.dedup();

		for network_id in all_network_ids {
			let provider = create_http_provider(network_id, networks).map_err(|e| match e {
				ProviderError::NetworkConfig(msg) => SettlementError::ValidationFailed(msg),
				ProviderError::Connection(msg) => SettlementError::ValidationFailed(msg),
				ProviderError::InvalidUrl(msg) => SettlementError::ValidationFailed(msg),
			})?;

			providers.insert(network_id, provider);
		}

		Ok(Self {
			providers,
			oracle_config,
		})
	}

	/// Compute the FillDescription payload hash for an order output.
	fn compute_payload_hash(
		&self,
		order: &Order,
		solver_bytes: &[u8; 32],
		timestamp: u32,
	) -> Result<[u8; 32], SettlementError> {
		// Parse order data to get output details
		let parsed_order = order.parse_order_data().map_err(|e| {
			SettlementError::ValidationFailed(format!("Failed to parse order data: {}", e))
		})?;

		let outputs = parsed_order.parse_requested_outputs();
		let first_output = outputs
			.first()
			.ok_or_else(|| SettlementError::ValidationFailed("No outputs found".into()))?;

		// Convert output fields to bytes32
		let token = {
			let mut bytes32 = [0u8; 32];
			if let Ok(addr) = first_output.asset.ethereum_address() {
				bytes32[12..32].copy_from_slice(addr.as_slice());
			}
			bytes32
		};

		let recipient = {
			let mut bytes32 = [0u8; 32];
			if let Ok(addr) = first_output.receiver.ethereum_address() {
				bytes32[12..32].copy_from_slice(addr.as_slice());
			}
			bytes32
		};

		let call_data = first_output
			.calldata
			.as_ref()
			.and_then(|s| hex::decode(s.trim_start_matches("0x")).ok())
			.unwrap_or_default();

		// Context is typically empty for simple orders
		let context: Vec<u8> = vec![];

		let order_id = order_id_to_bytes32(&order.id);

		let payload = encode_fill_description(
			*solver_bytes,
			order_id,
			timestamp,
			token,
			first_output.amount,
			recipient,
			&call_data,
			&context,
		)?;

		Ok(keccak256_bytes(&payload))
	}

	/// Check if an attestation is proven on the oracle.
	async fn check_is_proven(
		&self,
		oracle_address: &Address,
		chain_id: u64,
		remote_chain_id: u64,
		remote_oracle: [u8; 32],
		application: [u8; 32],
		data_hash: [u8; 32],
	) -> Result<bool, SettlementError> {
		let provider = self.providers.get(&chain_id).ok_or_else(|| {
			SettlementError::ValidationFailed(format!("No provider for chain {}", chain_id))
		})?;

		// Build isProven call
		let call_data = ICentralizedOracle::isProvenCall {
			remoteChainId: U256::from(remote_chain_id),
			remoteOracle: FixedBytes::from(remote_oracle),
			application: FixedBytes::from(application),
			dataHash: FixedBytes::from(data_hash),
		}
		.abi_encode();

		let oracle_alloy_addr = AlloyAddress::from_slice(&oracle_address.0);

		let result = provider
			.call(
				alloy_rpc_types::TransactionRequest::default()
					.to(oracle_alloy_addr)
					.input(call_data.into()),
			)
			.await
			.map_err(|e| {
				SettlementError::ValidationFailed(format!("isProven call failed: {}", e))
			})?;

		// Decode result (bool)
		let is_proven = if result.len() >= 32 {
			result[31] != 0
		} else {
			false
		};

		Ok(is_proven)
	}
}

/// Configuration schema for CentralizedSettlement.
pub struct CentralizedSettlementSchema;

impl CentralizedSettlementSchema {
	pub fn validate_config(config: &toml::Value) -> Result<(), solver_types::ValidationError> {
		let instance = Self;
		instance.validate(config)
	}
}

impl ConfigSchema for CentralizedSettlementSchema {
	fn validate(&self, config: &toml::Value) -> Result<(), solver_types::ValidationError> {
		let schema = Schema::new(
			// Required fields
			vec![
				Field::new(
					"oracles",
					FieldType::Table(Schema::new(
						vec![
							Field::new("input", FieldType::Table(Schema::new(vec![], vec![]))),
							Field::new("output", FieldType::Table(Schema::new(vec![], vec![]))),
						],
						vec![],
					)),
				),
				Field::new("routes", FieldType::Table(Schema::new(vec![], vec![]))),
			],
			// Optional fields
			vec![
				Field::new("oracle_selection_strategy", FieldType::String),
				Field::new(
					"default_gas_limit",
					FieldType::Integer {
						min: Some(21000),
						max: Some(1_000_000),
					},
				),
			],
		);

		schema.validate(config)
	}
}

#[async_trait]
impl SettlementInterface for CentralizedSettlement {
	fn oracle_config(&self) -> &OracleConfig {
		&self.oracle_config
	}

	fn config_schema(&self) -> Box<dyn ConfigSchema> {
		Box::new(CentralizedSettlementSchema)
	}

	/// Gets attestation data for a filled order.
	async fn get_attestation(
		&self,
		order: &Order,
		tx_hash: &TransactionHash,
	) -> Result<FillProof, SettlementError> {
		let origin_chain_id = order
			.input_chains
			.first()
			.map(|c| c.chain_id)
			.ok_or_else(|| SettlementError::ValidationFailed("No input chains".into()))?;

		let destination_chain_id = order
			.output_chains
			.first()
			.map(|c| c.chain_id)
			.ok_or_else(|| SettlementError::ValidationFailed("No output chains".into()))?;

		let provider = self.providers.get(&destination_chain_id).ok_or_else(|| {
			SettlementError::ValidationFailed(format!(
				"No provider for chain {}",
				destination_chain_id
			))
		})?;

		// Get oracle address
		let oracle_addresses = self.get_input_oracles(origin_chain_id);
		if oracle_addresses.is_empty() {
			return Err(SettlementError::ValidationFailed(format!(
				"No input oracle for chain {}",
				origin_chain_id
			)));
		}
		let oracle_address = oracle_addresses[0].clone();

		// Get transaction receipt
		let hash = FixedBytes::<32>::from_slice(&tx_hash.0);
		let receipt = provider
			.get_transaction_receipt(hash)
			.await
			.map_err(|e| {
				SettlementError::ValidationFailed(format!("Failed to get receipt: {}", e))
			})?
			.ok_or_else(|| SettlementError::ValidationFailed("Transaction not found".into()))?;

		if !receipt.status() {
			return Err(SettlementError::ValidationFailed(
				"Transaction failed".into(),
			));
		}

		let tx_block = receipt.block_number.unwrap_or(0);

		// Get block timestamp
		let block = provider
			.get_block_by_number(alloy_rpc_types::BlockNumberOrTag::Number(tx_block))
			.await
			.map_err(|e| SettlementError::ValidationFailed(format!("Failed to get block: {}", e)))?
			.ok_or_else(|| SettlementError::ValidationFailed("Block not found".into()))?;

		let block_timestamp = block.header.timestamp;

		// Extract solver and timestamp from OutputFilled event logs to compute payload hash
		// This ensures we use the SAME values as generate_post_fill_transaction
		let order_id = order_id_to_bytes32(&order.id);
		let logs: Vec<solver_types::Log> = receipt
			.inner
			.logs()
			.iter()
			.map(|log| solver_types::Log {
				address: solver_types::Address(log.address().0 .0.to_vec()),
				topics: log
					.topics()
					.iter()
					.map(|t| solver_types::H256(t.0))
					.collect(),
				data: log.data().data.to_vec(),
			})
			.collect();

		let (solver_bytes, event_timestamp) = extract_fill_details_from_logs(&logs, &order_id)?;

		let mut solver_array = [0u8; 32];
		solver_array.copy_from_slice(&solver_bytes);

		// Compute payload hash using the same values we'll use in PostFill
		let payload_hash = self.compute_payload_hash(order, &solver_array, event_timestamp)?;

		// Store payload_hash, solver, and timestamp in attestation_data for can_claim to use
		// Format: [payload_hash (32)] [solver (32)] [timestamp (4)]
		let mut attestation_data = Vec::with_capacity(68);
		attestation_data.extend_from_slice(&payload_hash);
		attestation_data.extend_from_slice(&solver_array);
		attestation_data.extend_from_slice(&event_timestamp.to_be_bytes());

		debug!(
			"get_attestation: payload_hash=0x{}, solver=0x{}, timestamp={}",
			hex::encode(&payload_hash),
			hex::encode(&solver_array),
			event_timestamp
		);

		Ok(FillProof {
			tx_hash: tx_hash.clone(),
			block_number: tx_block,
			oracle_address: with_0x_prefix(&hex::encode(&oracle_address.0)),
			attestation_data: Some(attestation_data),
			filled_timestamp: block_timestamp,
		})
	}

	/// Checks if the order is ready to be claimed by verifying the attestation is on-chain.
	async fn can_claim(&self, order: &Order, fill_proof: &FillProof) -> bool {
		let origin_chain_id = match order.input_chains.first() {
			Some(chain) => chain.chain_id,
			None => return false,
		};

		let destination_chain_id = match order.output_chains.first() {
			Some(chain) => chain.chain_id,
			None => return false,
		};

		// Get oracle address on source chain (where we check isProven)
		let oracle_addresses = self.get_input_oracles(origin_chain_id);
		if oracle_addresses.is_empty() {
			return false;
		}
		let oracle_address = &oracle_addresses[0];

		// Parse order data as Eip7683OrderData to get the MandateOutput with oracle/settler fields
		let order_data: Eip7683OrderData = match serde_json::from_value(order.data.clone()) {
			Ok(o) => o,
			Err(e) => {
				warn!("Failed to parse order data as Eip7683OrderData: {}", e);
				return false;
			},
		};
		let first_output = match order_data.outputs.first() {
			Some(o) => o,
			None => {
				warn!("No outputs in order");
				return false;
			},
		};

		// The remote oracle and settler are from the MandateOutput
		// This matches what InputSettlerEscrow uses when checking isProven
		let remote_oracle = first_output.oracle;
		let output_settler = first_output.settler;

		// Extract payload_hash from attestation_data (stored by get_attestation)
		// Format: [payload_hash (32)] [solver (32)] [timestamp (4)]
		let payload_hash = match &fill_proof.attestation_data {
			Some(data) if data.len() >= 32 => {
				let mut hash = [0u8; 32];
				hash.copy_from_slice(&data[0..32]);
				hash
			},
			_ => {
				warn!("No attestation_data in fill_proof, cannot check isProven");
				return false;
			},
		};

		debug!(
			"Checking isProven: chain={}, remote_chain={}, remote_oracle=0x{}, settler=0x{}, hash=0x{}",
			origin_chain_id,
			destination_chain_id,
			hex::encode(remote_oracle),
			hex::encode(output_settler),
			hex::encode(payload_hash)
		);

		// Check if proven
		match self
			.check_is_proven(
				oracle_address,
				origin_chain_id,
				destination_chain_id,
				remote_oracle,
				output_settler,
				payload_hash,
			)
			.await
		{
			Ok(proven) => proven,
			Err(e) => {
				warn!("Failed to check isProven: {}", e);
				false
			},
		}
	}

	/// Generates a transaction to submit the attestation after fill confirmation.
	///
	/// IMPORTANT: Attestations are submitted by the separate oracle operator service,
	/// not by the solver. The solver only fills orders and claims funds after
	/// the oracle operator has signed and submitted attestations.
	async fn generate_post_fill_transaction(
		&self,
		order: &Order,
		fill_receipt: &TransactionReceipt,
	) -> Result<Option<Transaction>, SettlementError> {
		// Extract fill details from logs for attestation_data
		let order_id = order_id_to_bytes32(&order.id);
		let logs = &fill_receipt.logs;

		let (solver_bytes, timestamp) = extract_fill_details_from_logs(logs, &order_id)?;

		let mut solver_array = [0u8; 32];
		solver_array.copy_from_slice(&solver_bytes);

		// Compute payload hash (needed for can_claim to verify attestation later)
		let payload_hash = self.compute_payload_hash(order, &solver_array, timestamp)?;

		info!(
			"Fill confirmed for order {}, waiting for oracle operator attestation (payload_hash=0x{})",
			order.id,
			hex::encode(payload_hash)
		);

		// No transaction needed - oracle operator will submit attestation
		Ok(None)
	}

	/// No pre-claim transaction needed - attestation is already submitted in post-fill.
	async fn generate_pre_claim_transaction(
		&self,
		_order: &Order,
		_fill_proof: &FillProof,
	) -> Result<Option<Transaction>, SettlementError> {
		Ok(None)
	}

	/// Handle confirmed transactions.
	async fn handle_transaction_confirmed(
		&self,
		_order: &Order,
		_tx_type: TransactionType,
		_receipt: &TransactionReceipt,
	) -> Result<(), SettlementError> {
		Ok(())
	}
}

/// Factory function to create a CentralizedSettlement from configuration.
pub fn create_settlement(
	config: &toml::Value,
	networks: &NetworksConfig,
	_storage: Arc<solver_storage::StorageService>,
) -> Result<Box<dyn SettlementInterface>, SettlementError> {
	// Validate configuration first
	CentralizedSettlementSchema::validate_config(config)
		.map_err(|e| SettlementError::ValidationFailed(format!("Invalid configuration: {}", e)))?;

	// Parse oracle configuration
	let oracle_config = parse_oracle_config(config)?;

	// Create settlement service
	let settlement = tokio::task::block_in_place(|| {
		tokio::runtime::Handle::current()
			.block_on(async { CentralizedSettlement::new(networks, oracle_config).await })
	})?;

	Ok(Box::new(settlement))
}

/// Registry for the centralized settlement implementation.
pub struct Registry;

impl solver_types::ImplementationRegistry for Registry {
	const NAME: &'static str = "centralized";
	type Factory = SettlementFactory;

	fn factory() -> Self::Factory {
		create_settlement
	}
}

impl SettlementRegistry for Registry {}
