use alloy::primitives::{Address, U256};
use anyhow::{bail, Context, Result};
use std::collections::{BTreeMap, HashMap, HashSet};
use tokio::time::{sleep, Duration};
use tracing::{debug, info, warn};

use crate::client::ChainClient;
use crate::config::{AssetConfig, AssetTokenConfig, AssetType, RebalancerConfig};
use crate::planner::{format_raw_u128, format_token_amount, AssetPlan, TransferPlan};

pub struct RebalancerService {
    config: RebalancerConfig,
    clients: HashMap<u64, ChainClient>,
    asset_totals: HashMap<String, U256>,
    cycle: u64,
}

impl RebalancerService {
    pub async fn new(config: RebalancerConfig) -> Result<Self> {
        let mut clients = HashMap::new();
        for chain in &config.chains {
            let client = ChainClient::new(chain)
                .await
                .with_context(|| format!("Failed to create client for chain {}", chain.name))?;
            clients.insert(chain.chain_id, client);
        }

        let mut service = Self {
            config,
            clients,
            asset_totals: HashMap::new(),
            cycle: 0,
        };

        service.initialize_asset_totals().await?;

        Ok(service)
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
        for asset in &self.config.assets {
            self.log_asset_chain_setup(asset);
            if let Some(total_balance) = self.asset_totals.get(&asset.symbol) {
                info!(
                    "Asset {} startup total_balance={} {}",
                    asset.symbol,
                    format_token_amount(*total_balance, asset.decimals),
                    asset.symbol
                );
            }
        }

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
        let (observed_balances, errors) = self.poll_observed_balances(asset).await?;

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

        let observed_total = sum_balances(&observed_balances);
        let total_balance = *self.asset_totals.get(&asset.symbol).with_context(|| {
            format!(
                "Missing startup total_balance for asset {}. Restart service to recompute totals",
                asset.symbol
            )
        })?;
        let plan = AssetPlan::new(asset, &observed_balances, total_balance)?;

        let (min_transfer_raw, max_transfer_raw) = transfer_size_bounds_raw(
            total_balance,
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
                "Asset {}: transfer-size bounds from total_balance={} {} (observed_total={} {}) => min={} {} ({} bps), max={} {} ({} bps)",
                asset.symbol,
                format_token_amount(total_balance, asset.decimals),
                asset.symbol,
                format_token_amount(observed_total, asset.decimals),
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
            observed_total,
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

    async fn initialize_asset_totals(&mut self) -> Result<()> {
        for asset in &self.config.assets {
            let total_balance = self
                .bootstrap_total_balance_for_asset(asset)
                .await
                .with_context(|| {
                    format!(
                        "Failed to compute startup total_balance for asset {}",
                        asset.symbol
                    )
                })?;
            self.asset_totals
                .insert(asset.symbol.clone(), total_balance);
        }
        Ok(())
    }

    async fn bootstrap_total_balance_for_asset(&self, asset: &AssetConfig) -> Result<U256> {
        let (observed_balances, errors) = self.poll_observed_balances(asset).await?;
        if !errors.is_empty() {
            let mut details = errors.join("; ");
            if details.is_empty() {
                details = "unknown error".to_string();
            }
            bail!(
                "startup snapshot incomplete for asset {}: {}",
                asset.symbol,
                details
            );
        }
        startup_total_from_snapshot(asset, &observed_balances)
    }

    async fn poll_observed_balances(
        &self,
        asset: &AssetConfig,
    ) -> Result<(BTreeMap<u64, U256>, Vec<String>)> {
        let mut chain_ids: Vec<u64> = asset.weights.keys().copied().collect();
        chain_ids.sort_unstable();

        let mut observed_balances = BTreeMap::<u64, U256>::new();
        let mut errors = Vec::new();

        for chain_id in chain_ids {
            let chain = self.config.chain_by_id(chain_id).with_context(|| {
                format!("Unknown chain {} for asset {}", chain_id, asset.symbol)
            })?;
            let client = self.clients.get(&chain_id).with_context(|| {
                format!(
                    "Missing RPC client for chain {} ({})",
                    chain.name, chain.chain_id
                )
            })?;
            let token_config = match token_config_for_chain(asset, chain_id) {
                Ok(config) => config,
                Err(err) => {
                    errors.push(format!(
                        "chain={} ({}) err={}",
                        chain.name, chain.chain_id, err
                    ));
                    continue;
                }
            };
            let balance_query = match balance_query_for_chain(asset, chain_id) {
                Ok(query) => query,
                Err(err) => {
                    errors.push(format!(
                        "chain={} ({}) err={}",
                        chain.name, chain.chain_id, err
                    ));
                    continue;
                }
            };

            match balance_query {
                BalanceQuery::Erc20(token_address) => match client
                    .token_balance(token_address, chain.account_address)
                    .await
                {
                    Ok(balance) => {
                        debug!(
                            "Asset {} observed balance: chain={} ({}) type=erc20 account={} token={} collateral_token={} balance={} {} (raw={})",
                            asset.symbol,
                            chain.name,
                            chain.chain_id,
                            chain.account_address,
                            token_address,
                            token_config.collateral_token,
                            format_token_amount(balance, asset.decimals),
                            asset.symbol,
                            balance
                        );
                        observed_balances.insert(chain_id, balance);
                    }
                    Err(err) => {
                        errors.push(format!(
                            "chain={} ({}) type=erc20 token={} collateral_token={} account={} err={}",
                            chain.name,
                            chain.chain_id,
                            token_address,
                            token_config.collateral_token,
                            chain.account_address,
                            err
                        ));
                    }
                },
                BalanceQuery::Native => match client.native_balance(chain.account_address).await {
                    Ok(balance) => {
                        debug!(
                            "Asset {} observed balance: chain={} ({}) type=native account={} collateral_token={} balance={} {} (raw={})",
                            asset.symbol,
                            chain.name,
                            chain.chain_id,
                            chain.account_address,
                            token_config.collateral_token,
                            format_token_amount(balance, asset.decimals),
                            asset.symbol,
                            balance
                        );
                        observed_balances.insert(chain_id, balance);
                    }
                    Err(err) => {
                        errors.push(format!(
                            "chain={} ({}) type=native collateral_token={} account={} err={}",
                            chain.name,
                            chain.chain_id,
                            token_config.collateral_token,
                            chain.account_address,
                            err
                        ));
                    }
                },
            }
        }

        Ok((observed_balances, errors))
    }

    async fn execute_transfers(
        &mut self,
        asset: &AssetConfig,
        transfers: &[TransferPlan],
    ) -> Result<()> {
        let blocked_source_chains = self.blocked_source_chains_for_cycle(transfers).await;

        for transfer in transfers {
            if blocked_source_chains.contains(&transfer.source_chain_id) {
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
            let source_token_config = token_config_for_chain(asset, transfer.source_chain_id)
                .with_context(|| {
                    format!(
                        "Missing source token config for asset {} chain {}",
                        asset.symbol, transfer.source_chain_id
                    )
                })?;
            let source_collateral_token =
                collateral_token_for_chain(asset, transfer.source_chain_id).with_context(|| {
                    format!(
                        "Missing source collateral_token for asset {} chain {}",
                        asset.symbol, transfer.source_chain_id
                    )
                })?;
            let source_client = self
                .clients
                .get(&transfer.source_chain_id)
                .with_context(|| {
                    format!(
                        "Missing RPC client for source chain {} ({})",
                        source_chain.name, source_chain.chain_id
                    )
                })?;
            let transfer_amount = U256::from(transfer.amount_raw);

            let quote = match source_client
                .quote_transfer_remote(
                    source_collateral_token,
                    destination_chain.domain_id,
                    destination_chain.account_address,
                    transfer_amount,
                )
                .await
            {
                Ok(quote) => quote,
                Err(err) => {
                    warn!(
                        "Asset {} route {} -> {} quote failed:\n{:#}",
                        asset.symbol, source_chain.name, destination_chain.name, err
                    );
                    continue;
                }
            };

            info!(
                "Asset {} quote: {} -> {} domain={} source_type={} amount={} {} native_fee={} collateral_token={}",
                asset.symbol,
                source_chain.name,
                destination_chain.name,
                destination_chain.domain_id,
                asset_type_label(source_token_config.asset_type),
                format_raw_u128(transfer.amount_raw, asset.decimals),
                asset.symbol,
                quote.native_fee,
                source_collateral_token
            );
            for (idx, entry) in quote.entries.iter().enumerate() {
                debug!(
                    "Asset {} quote {} -> {}[{}] domain={} token={} amount={}",
                    asset.symbol,
                    source_chain.name,
                    destination_chain.name,
                    idx,
                    destination_chain.domain_id,
                    entry.token,
                    entry.amount
                );
            }

            match source_client
                .submit_transfer_remote(
                    source_collateral_token,
                    destination_chain.domain_id,
                    destination_chain.account_address,
                    transfer_amount,
                    quote.native_fee,
                )
                .await
            {
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
                        "Asset {} route {} -> {} transfer submission failed:\n{:#}",
                        asset.symbol, source_chain.name, destination_chain.name, err
                    );
                }
            }
        }

        Ok(())
    }

    async fn blocked_source_chains_for_cycle(&self, transfers: &[TransferPlan]) -> HashSet<u64> {
        let mut source_chain_ids: Vec<u64> = transfers.iter().map(|t| t.source_chain_id).collect();
        source_chain_ids.sort_unstable();
        source_chain_ids.dedup();

        let mut blocked = HashSet::new();
        for source_chain_id in source_chain_ids {
            if !self
                .source_chain_ready_for_submission(source_chain_id)
                .await
            {
                blocked.insert(source_chain_id);
            }
        }

        blocked
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

    fn log_asset_chain_setup(&self, asset: &AssetConfig) {
        let mut chain_ids: Vec<u64> = asset.tokens.keys().copied().collect();
        chain_ids.sort_unstable();

        for chain_id in chain_ids {
            let Some(chain) = self.config.chain_by_id(chain_id) else {
                continue;
            };
            let Some(token_config) = asset.tokens.get(&chain_id) else {
                continue;
            };

            match token_config.asset_type {
                AssetType::Erc20 => info!(
                    "Asset {} config: chain={} ({}) type=erc20 address={} collateral_token={}",
                    asset.symbol,
                    chain.name,
                    chain.chain_id,
                    token_config
                        .address
                        .expect("erc20 token config must include address"),
                    token_config.collateral_token
                ),
                AssetType::Native => info!(
                    "Asset {} config: chain={} ({}) type=native collateral_token={}",
                    asset.symbol, chain.name, chain.chain_id, token_config.collateral_token
                ),
            }
        }
    }

    fn log_plan(
        &self,
        plan: &crate::planner::AssetPlan,
        observed_total: U256,
        available_slots: usize,
        emitted_transfers: &[crate::planner::TransferPlan],
        blocked_by_parallel: &[crate::planner::TransferPlan],
    ) {
        info!(
            "Asset {} snapshot: total_balance={} {} observed_total={} {} available_slots={}",
            plan.symbol,
            format_token_amount(plan.total_balance, plan.decimals),
            plan.symbol,
            format_token_amount(observed_total, plan.decimals),
            plan.symbol,
            available_slots
        );
        match classify_inventory_drift(plan.total_balance, observed_total) {
            InventoryDrift::InFlight(amount) => {
                info!(
                    "Asset {} inventory drift: estimated_in_flight={} {} (startup total higher than observed)",
                    plan.symbol,
                    format_token_amount(amount, plan.decimals),
                    plan.symbol
                );
            }
            InventoryDrift::ObservedExceedsStartup(amount) => {
                info!(
                    "Asset {} inventory drift: observed_exceeds_startup_by={} {} (consider restart/resync if intentional)",
                    plan.symbol,
                    format_token_amount(amount, plan.decimals),
                    plan.symbol
                );
            }
            InventoryDrift::Balanced => {}
        }

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

        for transfer in emitted_transfers {
            self.log_transfer(plan, transfer, "plan");
        }

        for transfer in blocked_by_parallel {
            self.log_transfer(plan, transfer, "max_parallel block");
        }

        info!(
            "Asset {}: planner_candidates={} emitted={} blocked_by_parallel={} available_slots={}",
            plan.symbol,
            plan.transfers.len(),
            emitted_transfers.len(),
            blocked_by_parallel.len(),
            available_slots
        );
    }

    fn log_transfer(
        &self,
        plan: &crate::planner::AssetPlan,
        transfer: &crate::planner::TransferPlan,
        prefix: &str,
    ) {
        let src = self
            .config
            .chain_by_id(transfer.source_chain_id)
            .expect("validated chain_id must exist");
        let dst = self
            .config
            .chain_by_id(transfer.destination_chain_id)
            .expect("validated chain_id must exist");

        info!(
            "  {}: {} -> {} amount={} {} (raw={})",
            prefix,
            src.name,
            dst.name,
            format_raw_u128(transfer.amount_raw, plan.decimals),
            plan.symbol,
            transfer.amount_raw
        );
    }
}

fn startup_total_from_snapshot(
    asset: &AssetConfig,
    observed_balances: &BTreeMap<u64, U256>,
) -> Result<U256> {
    for chain_id in asset.weights.keys() {
        if !observed_balances.contains_key(chain_id) {
            bail!(
                "startup snapshot missing observed balance for asset {} chain {}",
                asset.symbol,
                chain_id
            );
        }
    }
    Ok(sum_balances(observed_balances))
}

fn sum_balances(observed_balances: &BTreeMap<u64, U256>) -> U256 {
    observed_balances
        .values()
        .copied()
        .fold(U256::ZERO, |acc, balance| acc + balance)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum InventoryDrift {
    InFlight(U256),
    ObservedExceedsStartup(U256),
    Balanced,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BalanceQuery {
    Erc20(Address),
    Native,
}

fn classify_inventory_drift(total_balance: U256, observed_total: U256) -> InventoryDrift {
    if observed_total < total_balance {
        InventoryDrift::InFlight(total_balance - observed_total)
    } else if observed_total > total_balance {
        InventoryDrift::ObservedExceedsStartup(observed_total - total_balance)
    } else {
        InventoryDrift::Balanced
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

fn asset_type_label(asset_type: AssetType) -> &'static str {
    match asset_type {
        AssetType::Erc20 => "erc20",
        AssetType::Native => "native",
    }
}

fn token_config_for_chain(asset: &AssetConfig, chain_id: u64) -> Result<&AssetTokenConfig> {
    asset.tokens.get(&chain_id).ok_or_else(|| {
        anyhow::anyhow!(
            "Missing token config for asset {} on chain {}",
            asset.symbol,
            chain_id
        )
    })
}

fn collateral_token_for_chain(asset: &AssetConfig, chain_id: u64) -> Result<Address> {
    Ok(token_config_for_chain(asset, chain_id)?.collateral_token)
}

fn balance_query_for_chain(asset: &AssetConfig, chain_id: u64) -> Result<BalanceQuery> {
    let token_config = token_config_for_chain(asset, chain_id)?;
    match token_config.asset_type {
        AssetType::Erc20 => {
            let address = token_config.address.ok_or_else(|| {
                anyhow::anyhow!(
                    "Missing ERC20 address for asset {} on chain {}",
                    asset.symbol,
                    chain_id
                )
            })?;
            Ok(BalanceQuery::Erc20(address))
        }
        AssetType::Native => Ok(BalanceQuery::Native),
    }
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
    use crate::config::{AssetConfig, AssetTokenConfig, AssetType};
    use std::collections::HashMap;

    fn sample_asset() -> AssetConfig {
        AssetConfig {
            symbol: "USDC".to_string(),
            decimals: 6,
            tokens: HashMap::from([
                (
                    1u64,
                    AssetTokenConfig {
                        asset_type: AssetType::Erc20,
                        address: Some(
                            "0x0000000000000000000000000000000000000001"
                                .parse()
                                .unwrap(),
                        ),
                        collateral_token: "0x0000000000000000000000000000000000000011"
                            .parse()
                            .unwrap(),
                    },
                ),
                (
                    2u64,
                    AssetTokenConfig {
                        asset_type: AssetType::Erc20,
                        address: Some(
                            "0x0000000000000000000000000000000000000002"
                                .parse()
                                .unwrap(),
                        ),
                        collateral_token: "0x0000000000000000000000000000000000000022"
                            .parse()
                            .unwrap(),
                    },
                ),
            ]),
            weights: HashMap::from([(1u64, 0.5), (2u64, 0.5)]),
            min_weights: HashMap::from([(1u64, 0.4), (2u64, 0.4)]),
        }
    }

    fn sample_native_asset() -> AssetConfig {
        AssetConfig {
            symbol: "ETH".to_string(),
            decimals: 18,
            tokens: HashMap::from([
                (
                    1u64,
                    AssetTokenConfig {
                        asset_type: AssetType::Native,
                        address: None,
                        collateral_token: "0x0000000000000000000000000000000000000011"
                            .parse()
                            .unwrap(),
                    },
                ),
                (
                    2u64,
                    AssetTokenConfig {
                        asset_type: AssetType::Native,
                        address: None,
                        collateral_token: "0x0000000000000000000000000000000000000022"
                            .parse()
                            .unwrap(),
                    },
                ),
            ]),
            weights: HashMap::from([(1u64, 0.5), (2u64, 0.5)]),
            min_weights: HashMap::from([(1u64, 0.4), (2u64, 0.4)]),
        }
    }

    #[test]
    fn nonce_guard_blocks_when_pending_nonce_is_ahead() {
        assert!(!source_nonce_guard_allows_submission(10, 11));
    }

    #[test]
    fn nonce_guard_allows_when_nonces_match() {
        assert!(source_nonce_guard_allows_submission(10, 10));
    }

    #[test]
    fn balance_query_selects_erc20_for_erc20_assets() {
        let asset = sample_asset();
        let query = balance_query_for_chain(&asset, 1u64).unwrap();
        assert_eq!(
            query,
            BalanceQuery::Erc20(
                "0x0000000000000000000000000000000000000001"
                    .parse()
                    .unwrap()
            )
        );
    }

    #[test]
    fn balance_query_selects_native_for_native_assets() {
        let asset = sample_native_asset();
        let query = balance_query_for_chain(&asset, 1u64).unwrap();
        assert_eq!(query, BalanceQuery::Native);
    }

    #[test]
    fn collateral_token_lookup_uses_collateral_token_field() {
        let asset = sample_asset();
        let collateral = collateral_token_for_chain(&asset, 1u64).unwrap();
        assert_eq!(
            collateral,
            "0x0000000000000000000000000000000000000011"
                .parse::<Address>()
                .unwrap()
        );
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

    #[test]
    fn startup_total_fails_when_snapshot_is_missing_chain_balance() {
        let asset = sample_asset();
        let observed_balances = BTreeMap::from([(1u64, U256::from(10u64))]);

        let result = startup_total_from_snapshot(&asset, &observed_balances);

        assert!(result.is_err());
    }

    #[test]
    fn startup_total_uses_sum_of_observed_balances() {
        let asset = sample_asset();
        let observed_balances =
            BTreeMap::from([(1u64, U256::from(10u64)), (2u64, U256::from(20u64))]);

        let total = startup_total_from_snapshot(&asset, &observed_balances).unwrap();

        assert_eq!(total, U256::from(30u64));
    }

    #[test]
    fn classify_inventory_drift_marks_in_flight_when_observed_is_lower() {
        let drift = classify_inventory_drift(U256::from(20u64), U256::from(17u64));
        assert_eq!(drift, InventoryDrift::InFlight(U256::from(3u64)));
    }

    #[test]
    fn classify_inventory_drift_marks_excess_when_observed_is_higher() {
        let drift = classify_inventory_drift(U256::from(20u64), U256::from(23u64));
        assert_eq!(
            drift,
            InventoryDrift::ObservedExceedsStartup(U256::from(3u64))
        );
    }

    #[test]
    fn classify_inventory_drift_balanced_when_totals_match() {
        let drift = classify_inventory_drift(U256::from(20u64), U256::from(20u64));
        assert_eq!(drift, InventoryDrift::Balanced);
    }
}
