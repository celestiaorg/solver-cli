//! Delivery wrapper that populates EIP-1559 fee fields via `eth_feeHistory`
//! before delegating to the upstream AlloyDelivery.
//!
//! Upstream leaves `max_priority_fee_per_gas` / `max_fee_per_gas` unset on all
//! outgoing `Transaction`s, so alloy's wallet filler falls back to
//! `eth_maxPriorityFeePerGas`. Many public RPCs (notably Sepolia via
//! publicnode) return ~0.001 gwei from that endpoint, so fills end up sitting
//! in the mempool indefinitely. We can't override the RPC hint, so instead
//! we estimate fees ourselves from `eth_feeHistory` and stamp them on the
//! transaction; the inner delivery then skips its own fee logic because
//! alloy sees a fully-configured 1559 request.

#![cfg(feature = "solver-runtime")]

use std::collections::HashMap;
use std::sync::Arc;

use alloy_provider::{DynProvider, Provider, ProviderBuilder};
use alloy_rpc_types::BlockNumberOrTag;
use async_trait::async_trait;
use solver_delivery::{
    DeliveryError, DeliveryFactory, DeliveryInterface, TransactionTrackingWithConfig,
};
use solver_types::{
    Address, ConfigSchema, NetworksConfig, Transaction, TransactionHash, TransactionReceipt,
};

const FEE_HISTORY_BLOCKS: u64 = 20;
const TIP_PERCENTILE: f64 = 50.0;
const BASE_FEE_MULTIPLIER: u128 = 2;
// Safety net for chains whose feeHistory rewards are all zero; 1 gwei is
// roughly the inclusion floor on current public testnets and mainnet.
const MIN_PRIORITY_FEE_WEI: u128 = 1_000_000_000;

/// Decorates an inner `DeliveryInterface` with EIP-1559 fee estimation.
pub struct FeeHistoryDelivery {
    inner: Box<dyn DeliveryInterface>,
    providers: HashMap<u64, DynProvider>,
}

impl FeeHistoryDelivery {
    async fn estimate(&self, chain_id: u64) -> Option<(u128, u128)> {
        let provider = self.providers.get(&chain_id)?;
        match provider
            .get_fee_history(
                FEE_HISTORY_BLOCKS,
                BlockNumberOrTag::Latest,
                &[TIP_PERCENTILE],
            )
            .await
        {
            Ok(history) => {
                let next_base_fee = history.latest_block_base_fee().unwrap_or(0);
                let mut tips: Vec<u128> = history
                    .reward
                    .unwrap_or_default()
                    .iter()
                    .filter_map(|row| row.first().copied())
                    .collect();
                tips.sort_unstable();
                let median = tips.get(tips.len() / 2).copied().unwrap_or(0);
                let tip = median.max(MIN_PRIORITY_FEE_WEI);
                let max_fee = next_base_fee
                    .saturating_mul(BASE_FEE_MULTIPLIER)
                    .saturating_add(tip);
                Some((tip, max_fee))
            }
            Err(e) => {
                tracing::warn!(
                    "eth_feeHistory failed on chain {}: {}; falling back to eth_gasPrice",
                    chain_id,
                    e
                );
                let gas_price = provider.get_gas_price().await.ok()?;
                let tip = MIN_PRIORITY_FEE_WEI;
                let max_fee = gas_price
                    .saturating_mul(BASE_FEE_MULTIPLIER)
                    .saturating_add(tip);
                Some((tip, max_fee))
            }
        }
    }
}

#[async_trait]
impl DeliveryInterface for FeeHistoryDelivery {
    fn config_schema(&self) -> Box<dyn ConfigSchema> {
        self.inner.config_schema()
    }

    async fn submit(
        &self,
        mut tx: Transaction,
        tracking: Option<TransactionTrackingWithConfig>,
    ) -> Result<TransactionHash, DeliveryError> {
        if tx.max_priority_fee_per_gas.is_none() || tx.max_fee_per_gas.is_none() {
            if let Some((tip, max_fee)) = self.estimate(tx.chain_id).await {
                if tx.max_priority_fee_per_gas.is_none() {
                    tx.max_priority_fee_per_gas = Some(tip);
                }
                if tx.max_fee_per_gas.is_none() {
                    tx.max_fee_per_gas = Some(max_fee);
                }
            }
        }
        self.inner.submit(tx, tracking).await
    }

    async fn get_receipt(
        &self,
        hash: &TransactionHash,
        chain_id: u64,
    ) -> Result<TransactionReceipt, DeliveryError> {
        self.inner.get_receipt(hash, chain_id).await
    }

    async fn get_gas_price(&self, chain_id: u64) -> Result<String, DeliveryError> {
        self.inner.get_gas_price(chain_id).await
    }

    async fn get_balance(
        &self,
        address: &str,
        token: Option<&str>,
        chain_id: u64,
    ) -> Result<String, DeliveryError> {
        self.inner.get_balance(address, token, chain_id).await
    }

    async fn get_allowance(
        &self,
        owner: &str,
        spender: &str,
        token_address: &str,
        chain_id: u64,
    ) -> Result<String, DeliveryError> {
        self.inner
            .get_allowance(owner, spender, token_address, chain_id)
            .await
    }

    async fn get_nonce(&self, address: &str, chain_id: u64) -> Result<u64, DeliveryError> {
        self.inner.get_nonce(address, chain_id).await
    }

    async fn get_block_number(&self, chain_id: u64) -> Result<u64, DeliveryError> {
        self.inner.get_block_number(chain_id).await
    }

    async fn estimate_gas(&self, tx: Transaction) -> Result<u64, DeliveryError> {
        self.inner.estimate_gas(tx).await
    }

    async fn eth_call(&self, tx: Transaction) -> Result<alloy_primitives::Bytes, DeliveryError> {
        self.inner.eth_call(tx).await
    }
}

/// Factory that wraps the upstream `evm_alloy` delivery with feeHistory-based
/// EIP-1559 estimation. Shape-compatible with `solver_delivery::DeliveryFactory`,
/// so the config section `[delivery.implementations.evm_alloy]` is reused
/// unchanged.
pub fn create_fee_history_delivery(
    config: &serde_json::Value,
    networks: &NetworksConfig,
    default_signer: &solver_account::AccountSigner,
    network_signers: &HashMap<u64, solver_account::AccountSigner>,
) -> Result<Box<dyn DeliveryInterface>, DeliveryError> {
    let inner = solver_delivery::implementations::evm::alloy::create_http_delivery(
        config,
        networks,
        default_signer,
        network_signers,
    )?;

    let network_ids: Vec<u64> = config
        .get("network_ids")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_i64().map(|i| i as u64))
                .collect()
        })
        .unwrap_or_default();

    let mut providers = HashMap::new();
    for id in network_ids {
        let Some(network) = networks.get(&id) else {
            continue;
        };
        let Some(http_url) = network.get_http_url() else {
            continue;
        };
        let Ok(url) = http_url.parse() else {
            tracing::warn!(
                "fee-history wrapper: skipping chain {} (invalid RPC URL: {})",
                id,
                http_url
            );
            continue;
        };
        let provider = ProviderBuilder::new().connect_http(url).erased();
        providers.insert(id, provider);
    }

    // Touch Address/Arc so feature-gated imports stay live even when the trait
    // adds/removes parameters upstream; cheaper than conditional-compiling them.
    let _phantom: Option<(Address, Arc<()>)> = None;

    Ok(Box::new(FeeHistoryDelivery { inner, providers }))
}

/// Export with the exact DeliveryFactory function-pointer type so it slots into
/// the solver-core factories map without a cast.
pub const FEE_HISTORY_DELIVERY: DeliveryFactory = create_fee_history_delivery;
