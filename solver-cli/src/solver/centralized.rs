use alloy_primitives::{hex, Address as AlloyAddress, FixedBytes, U256};
use alloy_provider::{DynProvider, Provider};
use alloy_sol_types::{sol, SolCall};
use async_trait::async_trait;
use sha3::{Digest, Keccak256};
use solver_settlement::{
	utils::parse_oracle_config, OracleConfig, SettlementError, SettlementInterface,
};
use solver_types::{
	create_http_provider, standards::eip7683::Eip7683OrderData, with_0x_prefix, Address,
	ConfigSchema, Field, FieldType, FillProof, NetworksConfig, Order, ProviderError, Schema,
	Transaction, TransactionHash, TransactionReceipt, TransactionType,
};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, info, warn};

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

fn keccak256_bytes(data: &[u8]) -> [u8; 32] {
	let mut hasher = Keccak256::new();
	hasher.update(data);
	let result = hasher.finalize();
	let mut hash = [0u8; 32];
	hash.copy_from_slice(&result);
	hash
}

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
		return Err(SettlementError::ValidationFailed("Call data too large".into()));
	}
	if context.len() > u16::MAX as usize {
		return Err(SettlementError::ValidationFailed("Context data too large".into()));
	}

	let mut payload =
		Vec::with_capacity(32 + 32 + 4 + 32 + 32 + 32 + 2 + call_data.len() + 2 + context.len());

	payload.extend_from_slice(&solver);
	payload.extend_from_slice(&order_id);
	payload.extend_from_slice(&timestamp.to_be_bytes());
	payload.extend_from_slice(&token);
	payload.extend_from_slice(&amount.to_be_bytes::<32>());
	payload.extend_from_slice(&recipient);
	payload.extend_from_slice(&(call_data.len() as u16).to_be_bytes());
	payload.extend_from_slice(call_data);
	payload.extend_from_slice(&(context.len() as u16).to_be_bytes());
	payload.extend_from_slice(context);

	Ok(payload)
}

fn extract_fill_details_from_logs(
	logs: &[solver_types::Log],
	order_id: &[u8; 32],
) -> Result<(Vec<u8>, u32), SettlementError> {
	let output_filled_signature = keccak256_bytes(
		b"OutputFilled(bytes32,bytes32,uint32,(bytes32,bytes32,uint256,bytes32,uint256,bytes32,bytes,bytes),uint256)",
	);

	for log in logs {
		if log.topics.len() >= 2 && log.topics[0].0 == output_filled_signature {
			if log.topics[1].0 == *order_id {
				if log.data.len() >= 64 {
					let solver = log.data[0..32].to_vec();
					let timestamp_bytes = &log.data[32..64];
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

	Err(SettlementError::ValidationFailed("No OutputFilled event found in logs".into()))
}

pub struct CentralizedSettlement {
	providers: HashMap<u64, DynProvider>,
	oracle_config: OracleConfig,
}

impl CentralizedSettlement {
	pub async fn new(
		networks: &NetworksConfig,
		oracle_config: OracleConfig,
	) -> Result<Self, SettlementError> {
		info!("CentralizedSettlement initialized (oracle operator runs separately)");

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

		Ok(Self { providers, oracle_config })
	}

	fn compute_payload_hash(
		&self,
		order: &Order,
		solver_bytes: &[u8; 32],
		timestamp: u32,
	) -> Result<[u8; 32], SettlementError> {
		let parsed_order = order.parse_order_data().map_err(|e| {
			SettlementError::ValidationFailed(format!("Failed to parse order data: {}", e))
		})?;

		let outputs = parsed_order.parse_requested_outputs();
		let first_output = outputs
			.first()
			.ok_or_else(|| SettlementError::ValidationFailed("No outputs found".into()))?;

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

		let order_id = order_id_to_bytes32(&order.id);

		let payload = encode_fill_description(
			*solver_bytes,
			order_id,
			timestamp,
			token,
			first_output.amount,
			recipient,
			&call_data,
			&[],
		)?;

		Ok(keccak256_bytes(&payload))
	}

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

		Ok(if result.len() >= 32 { result[31] != 0 } else { false })
	}
}

pub struct CentralizedSettlementSchema;

impl CentralizedSettlementSchema {
	pub fn validate_config(config: &toml::Value) -> Result<(), solver_types::ValidationError> {
		CentralizedSettlementSchema.validate(config)
	}
}

impl ConfigSchema for CentralizedSettlementSchema {
	fn validate(&self, config: &toml::Value) -> Result<(), solver_types::ValidationError> {
		let schema = Schema::new(
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
			vec![
				Field::new("oracle_selection_strategy", FieldType::String),
				Field::new(
					"default_gas_limit",
					FieldType::Integer { min: Some(21000), max: Some(1_000_000) },
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

		let oracle_addresses = self.get_input_oracles(origin_chain_id);
		if oracle_addresses.is_empty() {
			return Err(SettlementError::ValidationFailed(format!(
				"No input oracle for chain {}",
				origin_chain_id
			)));
		}
		let oracle_address = oracle_addresses[0].clone();

		let hash = FixedBytes::<32>::from_slice(&tx_hash.0);
		let receipt = provider
			.get_transaction_receipt(hash)
			.await
			.map_err(|e| {
				SettlementError::ValidationFailed(format!("Failed to get receipt: {}", e))
			})?
			.ok_or_else(|| SettlementError::ValidationFailed("Transaction not found".into()))?;

		if !receipt.status() {
			return Err(SettlementError::ValidationFailed("Transaction failed".into()));
		}

		let tx_block = receipt.block_number.unwrap_or(0);

		let block = provider
			.get_block_by_number(alloy_rpc_types::BlockNumberOrTag::Number(tx_block))
			.await
			.map_err(|e| {
				SettlementError::ValidationFailed(format!("Failed to get block: {}", e))
			})?
			.ok_or_else(|| SettlementError::ValidationFailed("Block not found".into()))?;

		let block_timestamp = block.header.timestamp;

		let order_id = order_id_to_bytes32(&order.id);
		let logs: Vec<solver_types::Log> = receipt
			.inner
			.logs()
			.iter()
			.map(|log| solver_types::Log {
				address: solver_types::Address(log.address().0 .0.to_vec()),
				topics: log.topics().iter().map(|t| solver_types::H256(t.0)).collect(),
				data: log.data().data.to_vec(),
			})
			.collect();

		let (solver_bytes, event_timestamp) = extract_fill_details_from_logs(&logs, &order_id)?;

		let mut solver_array = [0u8; 32];
		solver_array.copy_from_slice(&solver_bytes);

		let payload_hash = self.compute_payload_hash(order, &solver_array, event_timestamp)?;

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

	async fn can_claim(&self, order: &Order, fill_proof: &FillProof) -> bool {
		let origin_chain_id = match order.input_chains.first() {
			Some(chain) => chain.chain_id,
			None => return false,
		};

		let destination_chain_id = match order.output_chains.first() {
			Some(chain) => chain.chain_id,
			None => return false,
		};

		let oracle_addresses = self.get_input_oracles(origin_chain_id);
		if oracle_addresses.is_empty() {
			return false;
		}
		let oracle_address = &oracle_addresses[0];

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

		let remote_oracle = first_output.oracle;
		let output_settler = first_output.settler;

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

	async fn generate_post_fill_transaction(
		&self,
		order: &Order,
		fill_receipt: &TransactionReceipt,
	) -> Result<Option<Transaction>, SettlementError> {
		let order_id = order_id_to_bytes32(&order.id);
		let (solver_bytes, timestamp) =
			extract_fill_details_from_logs(&fill_receipt.logs, &order_id)?;

		let mut solver_array = [0u8; 32];
		solver_array.copy_from_slice(&solver_bytes);

		let payload_hash = self.compute_payload_hash(order, &solver_array, timestamp)?;

		info!(
			"Fill confirmed for order {}, waiting for oracle operator attestation (payload_hash=0x{})",
			order.id,
			hex::encode(payload_hash)
		);

		Ok(None)
	}

	async fn generate_pre_claim_transaction(
		&self,
		_order: &Order,
		_fill_proof: &FillProof,
	) -> Result<Option<Transaction>, SettlementError> {
		Ok(None)
	}

	async fn handle_transaction_confirmed(
		&self,
		_order: &Order,
		_tx_type: TransactionType,
		_receipt: &TransactionReceipt,
	) -> Result<(), SettlementError> {
		Ok(())
	}
}

pub fn create_settlement(
	config: &toml::Value,
	networks: &NetworksConfig,
	_storage: Arc<solver_storage::StorageService>,
) -> Result<Box<dyn SettlementInterface>, SettlementError> {
	CentralizedSettlementSchema::validate_config(config)
		.map_err(|e| SettlementError::ValidationFailed(format!("Invalid configuration: {}", e)))?;

	let oracle_config = parse_oracle_config(config)?;

	let settlement = tokio::task::block_in_place(|| {
		tokio::runtime::Handle::current()
			.block_on(async { CentralizedSettlement::new(networks, oracle_config).await })
	})?;

	Ok(Box::new(settlement))
}

