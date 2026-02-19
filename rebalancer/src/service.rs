use alloy::primitives::U256;
use anyhow::{Context, Result};
use std::collections::{BTreeMap, HashMap};
use tokio::time::{sleep, Duration};
use tracing::{debug, info, warn};

use crate::balance::ChainBalanceClient;
use crate::config::{AssetConfig, RebalancerConfig};
use crate::hyperlane::{HyperlaneTransferRequest, HyperlaneWarpClient};
use crate::planner::{build_asset_plan, format_raw_u128, format_token_amount, TransferPlan};

pub struct RebalancerService {
    config: RebalancerConfig,
    clients: HashMap<u64, ChainBalanceClient>,
    hyperlane: Option<HyperlaneWarpClient>,
    cycle: u64,
}

impl RebalancerService {
    pub async fn new(config: RebalancerConfig) -> Result<Self> {
        let mut clients = HashMap::new();
        for chain in &config.chains {
            let client = ChainBalanceClient::new(chain)
                .with_context(|| format!("Failed to create client for chain {}", chain.name))?;
            clients.insert(chain.chain_id, client);
        }

        let hyperlane = if config.dry_run {
            None
        } else {
            Some(HyperlaneWarpClient::new(
                config.hyperlane.clone(),
                &config.chains,
            )?)
        };

        Ok(Self {
            config,
            clients,
            hyperlane,
            cycle: 0,
        })
    }

    pub async fn run(&mut self) -> Result<()> {
        info!(
            "Starting rebalancer service: {} chains, {} assets, poll={}s, dry_run={}",
            self.config.chains.len(),
            self.config.assets.len(),
            self.config.poll_interval_seconds,
            self.config.dry_run
        );
        info!(
            "Execution config: min_transfer_bps={} max_transfer_bps={} max_parallel_transfers={}",
            self.config.execution.min_transfer_bps,
            self.config.execution.max_transfer_bps,
            self.config.max_parallel_transfers
        );
        info!(
            "Hyperlane config: timeout={}s",
            self.config.hyperlane.default_timeout_seconds
        );

        if self.config.dry_run {
            info!("dry_run=true: planning-only mode (no Hyperlane transactions)");
        } else {
            info!("dry_run=false: Hyperlane transfer execution is enabled");
        }

        loop {
            self.run_once().await?;
            sleep(Duration::from_secs(self.config.poll_interval_seconds)).await;
        }
    }

    pub async fn run_once(&mut self) -> Result<()> {
        self.cycle += 1;
        info!("Starting rebalance cycle {}", self.cycle);

        let assets = self.config.assets.clone();
        for asset in &assets {
            if let Err(err) = self.process_asset(asset).await {
                warn!(
                    "Cycle {}: asset {} processing failed: {}",
                    self.cycle, asset.symbol, err
                );
            }
        }

        Ok(())
    }

    async fn process_asset(&mut self, asset: &AssetConfig) -> Result<()> {
        let mut chain_ids: Vec<u64> = asset.weights.keys().copied().collect();
        chain_ids.sort_unstable();

        let mut observed_balances = BTreeMap::<u64, U256>::new();
        let mut errors = Vec::new();

        for chain_id in chain_ids {
            let chain = self.config.chain_by_id(chain_id).with_context(|| {
                format!("Unknown chain {} for asset {}", chain_id, asset.symbol)
            })?;

            let token_address = *asset.tokens.get(&chain_id).with_context(|| {
                format!(
                    "Missing token address for asset {} on chain {}",
                    asset.symbol, chain_id
                )
            })?;

            let client = self.clients.get(&chain_id).with_context(|| {
                format!(
                    "Missing RPC client for chain {} ({})",
                    chain.name, chain.chain_id
                )
            })?;

            match client
                .token_balance(token_address, chain.account_address)
                .await
            {
                Ok(balance) => {
                    debug!(
                        "Asset {} observed balance: chain={} ({}) account={} token={} balance={} {} (raw={})",
                        asset.symbol,
                        chain.name,
                        chain.chain_id,
                        chain.account_address,
                        token_address,
                        format_token_amount(balance, asset.decimals),
                        asset.symbol,
                        balance
                    );
                    observed_balances.insert(chain_id, balance);
                }
                Err(err) => {
                    errors.push(format!(
                        "chain={} ({}) token={} account={} err={}",
                        chain.name, chain.chain_id, token_address, chain.account_address, err
                    ));
                }
            }
        }

        if !errors.is_empty() {
            warn!(
                "Skipping planning for asset {} this cycle due to partial RPC failures",
                asset.symbol
            );
            for err in errors {
                warn!("Balance poll failure: {}", err);
            }
            return Ok(());
        }

        let plan = build_asset_plan(asset, &observed_balances)?;

        let (min_transfer_raw, max_transfer_raw) = transfer_size_bounds_raw(
            plan.total_balance,
            self.config.execution.min_transfer_bps,
            self.config.execution.max_transfer_bps,
        );

        let mut size_adjusted_transfers = Vec::new();
        let mut blocked_by_min_size = Vec::new();
        let mut capped_by_max_size = Vec::new();
        for transfer in &plan.transfers {
            if transfer.amount_raw < min_transfer_raw {
                blocked_by_min_size.push(transfer.clone());
                continue;
            }

            let mut adjusted = transfer.clone();
            if adjusted.amount_raw > max_transfer_raw {
                adjusted.amount_raw = max_transfer_raw;
                capped_by_max_size.push((transfer.clone(), adjusted.clone()));
            }

            if adjusted.amount_raw == 0 {
                continue;
            }

            size_adjusted_transfers.push(adjusted);
        }

        if !plan.active_deficit_chain_ids.is_empty() {
            info!(
                "Asset {}: transfer-size bounds from total_balance={} {} => min={} {} ({} bps), max={} {} ({} bps)",
                asset.symbol,
                format_token_amount(plan.total_balance, asset.decimals),
                asset.symbol,
                format_raw_u128(min_transfer_raw, asset.decimals),
                asset.symbol,
                self.config.execution.min_transfer_bps,
                format_raw_u128(max_transfer_raw, asset.decimals),
                asset.symbol,
                self.config.execution.max_transfer_bps
            );
        }

        for transfer in &blocked_by_min_size {
            let source_chain = self
                .config
                .chain_by_id(transfer.source_chain_id)
                .expect("validated chain_id must exist");
            let destination_chain = self
                .config
                .chain_by_id(transfer.destination_chain_id)
                .expect("validated chain_id must exist");
            info!(
                "  min-size block: {} -> {} amount={} {} minimum={} {}",
                source_chain.name,
                destination_chain.name,
                format_raw_u128(transfer.amount_raw, asset.decimals),
                asset.symbol,
                format_raw_u128(min_transfer_raw, asset.decimals),
                asset.symbol
            );
        }

        for (original, capped) in &capped_by_max_size {
            let source_chain = self
                .config
                .chain_by_id(original.source_chain_id)
                .expect("validated chain_id must exist");
            let destination_chain = self
                .config
                .chain_by_id(original.destination_chain_id)
                .expect("validated chain_id must exist");
            info!(
                "  max-size cap: {} -> {} amount={} {} capped_to={} {}",
                source_chain.name,
                destination_chain.name,
                format_raw_u128(original.amount_raw, asset.decimals),
                asset.symbol,
                format_raw_u128(capped.amount_raw, asset.decimals),
                asset.symbol
            );
        }

        let available_slots = self.config.max_parallel_transfers;
        let (emitted_transfers, blocked_by_parallel) =
            split_by_parallel_limit(size_adjusted_transfers, available_slots);

        self.log_plan(
            &plan,
            available_slots,
            &emitted_transfers,
            &blocked_by_parallel,
        );

        if self.config.dry_run {
            if !emitted_transfers.is_empty() {
                info!(
                    "Asset {}: dry-run mode; skipped {} transfer submission(s)",
                    asset.symbol,
                    emitted_transfers.len()
                );
            }
        } else if !emitted_transfers.is_empty() {
            self.execute_transfers(asset, &emitted_transfers).await?;
        }

        Ok(())
    }

    async fn execute_transfers(
        &mut self,
        asset: &AssetConfig,
        transfers: &[TransferPlan],
    ) -> Result<()> {
        let hyperlane = self
            .hyperlane
            .as_ref()
            .context("Hyperlane client is not initialized")?;

        let mut source_chain_submission_allowed = HashMap::<u64, bool>::new();

        for transfer in transfers {
            let source_allowed = if let Some(allowed) =
                source_chain_submission_allowed.get(&transfer.source_chain_id)
            {
                *allowed
            } else {
                let allowed = self
                    .source_chain_ready_for_submission(transfer.source_chain_id)
                    .await;
                source_chain_submission_allowed.insert(transfer.source_chain_id, allowed);
                allowed
            };

            if !source_allowed {
                continue;
            }

            let source_chain = self
                .config
                .chain_by_id(transfer.source_chain_id)
                .with_context(|| format!("Unknown source chain {}", transfer.source_chain_id))?;
            let destination_chain = self
                .config
                .chain_by_id(transfer.destination_chain_id)
                .with_context(|| {
                    format!(
                        "Unknown destination chain {}",
                        transfer.destination_chain_id
                    )
                })?;
            let source_router =
                *asset
                    .tokens
                    .get(&transfer.source_chain_id)
                    .with_context(|| {
                        format!(
                            "Missing source router/token for asset {} chain {}",
                            asset.symbol, transfer.source_chain_id
                        )
                    })?;

            let request = HyperlaneTransferRequest {
                source_chain_id: transfer.source_chain_id,
                destination_chain_id: transfer.destination_chain_id,
                source_router,
                destination_recipient: destination_chain.account_address,
                amount: U256::from(transfer.amount_raw),
            };

            let quote = match hyperlane.quote_transfer(&request).await {
                Ok(quote) => quote,
                Err(err) => {
                    warn!(
                        "Asset {} route {} -> {} quote failed: {}",
                        asset.symbol, source_chain.name, destination_chain.name, err
                    );
                    continue;
                }
            };

            info!(
                "Asset {} quote: {} -> {} amount={} {} native_fee={} router_token={}",
                asset.symbol,
                source_chain.name,
                destination_chain.name,
                format_raw_u128(transfer.amount_raw, asset.decimals),
                asset.symbol,
                quote.native_fee,
                quote.router_token
            );
            for (idx, entry) in quote.entries.iter().enumerate() {
                debug!(
                    "Asset {} quote {} -> {}[{}] token={} amount={}",
                    asset.symbol,
                    source_chain.name,
                    destination_chain.name,
                    idx,
                    entry.token,
                    entry.amount
                );
            }

            match hyperlane.submit_transfer(&request, quote.native_fee).await {
                Ok(submitted) => {
                    let message_id = submitted
                        .message_id
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| "n/a".to_string());

                    info!(
                        "Asset {} transfer submitted: route {} -> {} tx_hash={} message_id={}",
                        asset.symbol,
                        source_chain.name,
                        destination_chain.name,
                        submitted.source_tx_hash,
                        message_id
                    );
                }
                Err(err) => {
                    warn!(
                        "Asset {} route {} -> {} transfer submission failed: {}",
                        asset.symbol, source_chain.name, destination_chain.name, err
                    );
                }
            }
        }

        Ok(())
    }

    async fn source_chain_ready_for_submission(&self, source_chain_id: u64) -> bool {
        let Some(chain) = self.config.chain_by_id(source_chain_id) else {
            warn!(
                "Skipping submissions from source chain {}: missing chain config",
                source_chain_id
            );
            return false;
        };

        let Some(client) = self.clients.get(&source_chain_id) else {
            warn!(
                "Skipping submissions from source chain {} ({}): missing RPC client",
                chain.name, chain.chain_id
            );
            return false;
        };

        let latest_nonce = match client.transaction_count_latest(chain.account_address).await {
            Ok(value) => value,
            Err(err) => {
                warn!(
                    "Skipping submissions from source chain {} ({}): latest nonce lookup failed for {}: {}",
                    chain.name, chain.chain_id, chain.account_address, err
                );
                return false;
            }
        };

        let pending_nonce = match client
            .transaction_count_pending(chain.account_address)
            .await
        {
            Ok(value) => value,
            Err(err) => {
                warn!(
                    "Skipping submissions from source chain {} ({}): pending nonce lookup failed for {}: {}",
                    chain.name, chain.chain_id, chain.account_address, err
                );
                return false;
            }
        };

        if !source_nonce_guard_allows_submission(latest_nonce, pending_nonce) {
            info!(
                "Nonce guard blocked submissions from source chain {} ({}): latest_nonce={} pending_nonce={}",
                chain.name, chain.chain_id, latest_nonce, pending_nonce
            );
            return false;
        }

        true
    }

    fn log_plan(
        &self,
        plan: &crate::planner::AssetPlan,
        available_slots: usize,
        emitted_transfers: &[crate::planner::TransferPlan],
        blocked_by_parallel: &[crate::planner::TransferPlan],
    ) {
        info!(
            "Asset {} snapshot: total_balance={} {} available_slots={}",
            plan.symbol,
            format_token_amount(plan.total_balance, plan.decimals),
            plan.symbol,
            available_slots
        );

        if plan.active_deficit_chain_ids.is_empty() {
            info!(
                "Asset {}: rebalance skipped (no chain below min_weight)",
                plan.symbol
            );
            return;
        }

        info!(
            "Asset {}: rebalance triggered by deficit chains {:?}",
            plan.symbol, plan.active_deficit_chain_ids
        );

        if emitted_transfers.is_empty() && blocked_by_parallel.is_empty() {
            info!(
                "Asset {}: no transfer candidates after controls",
                plan.symbol
            );
            return;
        }

        for transfer in emitted_transfers {
            let src = self
                .config
                .chain_by_id(transfer.source_chain_id)
                .expect("validated chain_id must exist");
            let dst = self
                .config
                .chain_by_id(transfer.destination_chain_id)
                .expect("validated chain_id must exist");
            info!(
                "  plan: {} -> {} amount={} {} (raw={})",
                src.name,
                dst.name,
                format_raw_u128(transfer.amount_raw, plan.decimals),
                plan.symbol,
                transfer.amount_raw
            );
        }

        if !blocked_by_parallel.is_empty() {
            for transfer in blocked_by_parallel {
                let src = self
                    .config
                    .chain_by_id(transfer.source_chain_id)
                    .expect("validated chain_id must exist");
                let dst = self
                    .config
                    .chain_by_id(transfer.destination_chain_id)
                    .expect("validated chain_id must exist");
                info!(
                    "  max_parallel block: {} -> {} amount={} {}",
                    src.name,
                    dst.name,
                    format_raw_u128(transfer.amount_raw, plan.decimals),
                    plan.symbol
                );
            }
        }

        info!(
            "Asset {}: {} transfer candidate(s) emitted and {} blocked by max_parallel",
            plan.symbol,
            emitted_transfers.len(),
            blocked_by_parallel.len()
        );
    }
}

fn transfer_size_bounds_raw(
    total_balance: U256,
    min_transfer_bps: u16,
    max_transfer_bps: u16,
) -> (u128, u128) {
    let min_raw = ceil_bps_of_total(total_balance, min_transfer_bps);
    let max_raw = floor_bps_of_total(total_balance, max_transfer_bps);
    (
        u256_to_u128_saturating(min_raw),
        u256_to_u128_saturating(max_raw),
    )
}

fn floor_bps_of_total(total: U256, bps: u16) -> U256 {
    if bps == 0 {
        return U256::ZERO;
    }
    (total * U256::from(bps)) / U256::from(10_000u64)
}

fn ceil_bps_of_total(total: U256, bps: u16) -> U256 {
    if bps == 0 {
        return U256::ZERO;
    }
    let numerator = (total * U256::from(bps)) + U256::from(9_999u64);
    numerator / U256::from(10_000u64)
}

fn u256_to_u128_saturating(value: U256) -> u128 {
    if value > U256::from(u128::MAX) {
        u128::MAX
    } else {
        value.to::<u128>()
    }
}

fn source_nonce_guard_allows_submission(latest_nonce: u64, pending_nonce: u64) -> bool {
    pending_nonce <= latest_nonce
}

fn split_by_parallel_limit(
    mut transfers: Vec<TransferPlan>,
    available_slots: usize,
) -> (Vec<TransferPlan>, Vec<TransferPlan>) {
    if transfers.len() > available_slots {
        let blocked = transfers.split_off(available_slots);
        (transfers, blocked)
    } else {
        (transfers, Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nonce_guard_blocks_when_pending_nonce_is_ahead() {
        assert!(!source_nonce_guard_allows_submission(10, 11));
    }

    #[test]
    fn nonce_guard_allows_when_nonces_match() {
        assert!(source_nonce_guard_allows_submission(10, 10));
    }

    #[test]
    fn split_by_parallel_limit_blocks_tail_transfers() {
        let transfers = vec![
            TransferPlan {
                source_chain_id: 1,
                destination_chain_id: 2,
                amount_raw: 10,
            },
            TransferPlan {
                source_chain_id: 1,
                destination_chain_id: 3,
                amount_raw: 20,
            },
            TransferPlan {
                source_chain_id: 1,
                destination_chain_id: 4,
                amount_raw: 30,
            },
        ];

        let (emitted, blocked) = split_by_parallel_limit(transfers, 2);

        assert_eq!(emitted.len(), 2);
        assert_eq!(blocked.len(), 1);
        assert_eq!(blocked[0].destination_chain_id, 4);
    }
}
