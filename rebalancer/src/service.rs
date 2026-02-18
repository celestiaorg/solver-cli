use alloy::primitives::{TxHash, U256};
use anyhow::{Context, Result};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::time::{sleep, Duration};
use tracing::{debug, info, warn};

use crate::balance::ChainBalanceClient;
use crate::config::{AssetConfig, RebalancerConfig};
use crate::hyperlane::{HyperlaneTransferRequest, HyperlaneWarpClient, SourceTxStatus};
use crate::planner::{
    build_asset_plan, format_raw_u128, format_token_amount, PlannerContext, TransferPlan,
};
use crate::state::StateManager;

pub struct RebalancerService {
    config: RebalancerConfig,
    clients: HashMap<u64, ChainBalanceClient>,
    hyperlane: Option<HyperlaneWarpClient>,
    state: StateManager,
    cycle: u64,
}

impl RebalancerService {
    pub async fn new(config: RebalancerConfig, project_root: &Path) -> Result<Self> {
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

        let state = StateManager::new(project_root)?;

        Ok(Self {
            config,
            clients,
            hyperlane,
            state,
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
            "Execution config: cooldown={}s settle_buffer_bps={} min_transfer_usd={} max_transfer_usd={} max_slippage_bps={} max_parallel_transfers={}",
            self.config.execution.cooldown_seconds_per_route,
            self.config.execution.settle_buffer_bps,
            self.config.execution.min_transfer_usd,
            self.config.execution.max_transfer_usd,
            self.config.execution.max_slippage_bps,
            self.config.max_parallel_transfers
        );
        info!(
            "Hyperlane config: timeout={}s",
            self.config.hyperlane.default_timeout_seconds
        );
        info!("State file: {}", self.state.state_path().display());

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
        let now_unix_seconds = now_unix_seconds()?;
        info!("Starting rebalance cycle {}", self.cycle);

        self.reconcile_inflight(now_unix_seconds).await?;

        let assets = self.config.assets.clone();
        for asset in &assets {
            if let Err(err) = self.process_asset(asset, now_unix_seconds).await {
                warn!(
                    "Cycle {}: asset {} processing failed: {}",
                    self.cycle, asset.symbol, err
                );
            }
        }

        self.state.set_last_cycle(now_unix_seconds);
        self.state.save_if_dirty()?;
        Ok(())
    }

    async fn process_asset(&mut self, asset: &AssetConfig, now_unix_seconds: u64) -> Result<()> {
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

        for (chain_id, balance) in &observed_balances {
            self.state
                .set_last_observed_balance(&asset.symbol, *chain_id, *balance);
        }

        let reserved_outgoing_by_chain = self.state.reserved_outgoing_by_chain(&asset.symbol);
        let previously_active_deficits = self.state.active_deficit_chains(&asset.symbol);
        let route_last_execution_by_pair = self.state.route_last_execution_for_asset(&asset.symbol);

        let plan = build_asset_plan(
            asset,
            &observed_balances,
            PlannerContext {
                now_unix_seconds,
                cooldown_seconds_per_route: self.config.execution.cooldown_seconds_per_route,
                settle_buffer_weight: self.config.execution.settle_buffer_bps as f64 / 10_000.0,
                reserved_outgoing_by_chain: &reserved_outgoing_by_chain,
                previously_active_deficits: &previously_active_deficits,
                route_last_execution_by_pair: &route_last_execution_by_pair,
            },
        )?;

        let pending_inflight = self.state.inflight_pending_count();
        let available_slots = self
            .config
            .max_parallel_transfers
            .saturating_sub(pending_inflight);
        let mut emitted_transfers = plan.transfers.clone();
        let blocked_by_parallel = if emitted_transfers.len() > available_slots {
            emitted_transfers.split_off(available_slots)
        } else {
            Vec::new()
        };

        self.log_plan(
            &plan,
            &reserved_outgoing_by_chain,
            &previously_active_deficits,
            pending_inflight,
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
            self.execute_transfers(asset, &emitted_transfers, now_unix_seconds)
                .await?;
        }

        self.state.set_active_deficit_chains(
            &asset.symbol,
            &BTreeSet::from_iter(plan.active_deficit_chain_ids.iter().copied()),
        );

        Ok(())
    }

    async fn execute_transfers(
        &mut self,
        asset: &AssetConfig,
        transfers: &[TransferPlan],
        now_unix_seconds: u64,
    ) -> Result<()> {
        let hyperlane = self
            .hyperlane
            .as_ref()
            .context("Hyperlane client is not initialized")?;

        for transfer in transfers {
            if self.state.has_pending_route(
                &asset.symbol,
                transfer.source_chain_id,
                transfer.destination_chain_id,
            ) {
                info!(
                    "Asset {}: idempotency guard skipped route {} -> {} (pending transfer exists)",
                    asset.symbol, transfer.source_chain_id, transfer.destination_chain_id
                );
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

            let transfer_id = self.state.create_planned_transfer(
                &asset.symbol,
                transfer.source_chain_id,
                transfer.destination_chain_id,
                U256::from(transfer.amount_raw),
                now_unix_seconds,
            );
            self.state.save_if_dirty()?;

            let quote = match hyperlane.quote_transfer(&request).await {
                Ok(quote) => quote,
                Err(err) => {
                    let reason = format!("quote failed: {}", err);
                    warn!(
                        "Asset {} transfer {}: {}",
                        asset.symbol, transfer_id, reason
                    );
                    self.state
                        .mark_failed(&transfer_id, reason, now_unix_seconds)?;
                    self.state.save_if_dirty()?;
                    continue;
                }
            };

            info!(
                "Asset {} transfer {}: quote {} -> {} amount={} {} native_fee={} router_token={}",
                asset.symbol,
                transfer_id,
                source_chain.name,
                destination_chain.name,
                format_raw_u128(transfer.amount_raw, asset.decimals),
                asset.symbol,
                quote.native_fee,
                quote.router_token
            );
            for (idx, entry) in quote.entries.iter().enumerate() {
                debug!(
                    "Asset {} transfer {}: quote[{}] token={} amount={}",
                    asset.symbol, transfer_id, idx, entry.token, entry.amount
                );
            }

            match hyperlane.submit_transfer(&request, quote.native_fee).await {
                Ok(submitted) => {
                    let message_id = submitted.message_id.map(|value| value.to_string());
                    self.state.mark_submitted(
                        &transfer_id,
                        &submitted.source_tx_hash.to_string(),
                        message_id.as_deref(),
                        now_unix_seconds,
                    )?;
                    self.state.set_route_last_execution(
                        &asset.symbol,
                        transfer.source_chain_id,
                        transfer.destination_chain_id,
                        now_unix_seconds,
                    );
                    self.state.save_if_dirty()?;

                    info!(
                        "Asset {} transfer {} submitted: route {} -> {} tx_hash={} message_id={}",
                        asset.symbol,
                        transfer_id,
                        source_chain.name,
                        destination_chain.name,
                        submitted.source_tx_hash,
                        message_id.unwrap_or_else(|| "n/a".to_string())
                    );
                }
                Err(err) => {
                    let reason = format!("transfer submission failed: {}", err);
                    warn!(
                        "Asset {} transfer {}: {}",
                        asset.symbol, transfer_id, reason
                    );
                    self.state
                        .mark_failed(&transfer_id, reason, now_unix_seconds)?;
                    self.state.save_if_dirty()?;
                }
            }
        }

        Ok(())
    }

    async fn reconcile_inflight(&mut self, now_unix_seconds: u64) -> Result<()> {
        for planned in self.state.pending_planned_transfers() {
            if now_unix_seconds.saturating_sub(planned.created_at_unix_seconds) > 60 {
                warn!(
                    "Transfer {} remained in planned state for >60s; marking failed",
                    planned.id
                );
                self.state.mark_failed(
                    &planned.id,
                    "planned transfer was not submitted in time",
                    now_unix_seconds,
                )?;
                self.state.save_if_dirty()?;
            }
        }

        let submitted = self.state.pending_submitted_transfers();
        if submitted.is_empty() {
            return Ok(());
        }

        if self.config.dry_run {
            return Ok(());
        }

        let hyperlane = self
            .hyperlane
            .as_ref()
            .context("Hyperlane client is not initialized")?;
        let timeout_seconds = self.config.hyperlane.default_timeout_seconds;

        for transfer in submitted {
            let source_tx_hash = match transfer.source_tx_hash.as_deref() {
                Some(value) => value,
                None => {
                    self.state.mark_failed(
                        &transfer.id,
                        "submitted transfer is missing source_tx_hash",
                        now_unix_seconds,
                    )?;
                    self.state.save_if_dirty()?;
                    continue;
                }
            };

            let parsed_tx_hash = match source_tx_hash.parse::<TxHash>() {
                Ok(tx_hash) => tx_hash,
                Err(err) => {
                    self.state.mark_failed(
                        &transfer.id,
                        format!("invalid source tx hash '{}': {}", source_tx_hash, err),
                        now_unix_seconds,
                    )?;
                    self.state.save_if_dirty()?;
                    continue;
                }
            };

            let status = match hyperlane
                .source_tx_status(transfer.source_chain_id, parsed_tx_hash)
                .await
            {
                Ok(status) => status,
                Err(err) => {
                    warn!(
                        "Could not refresh transfer {} status (chain={} tx={}): {}",
                        transfer.id, transfer.source_chain_id, source_tx_hash, err
                    );
                    continue;
                }
            };

            match status {
                SourceTxStatus::Success => {
                    self.state
                        .mark_delivered(&transfer.id, None, now_unix_seconds)?;
                    self.state.save_if_dirty()?;
                    info!(
                        "Transfer {} marked delivered (source tx confirmed): chain={} tx={}",
                        transfer.id, transfer.source_chain_id, source_tx_hash
                    );
                }
                SourceTxStatus::Reverted => {
                    self.state.mark_failed(
                        &transfer.id,
                        format!("source transaction reverted: {}", source_tx_hash),
                        now_unix_seconds,
                    )?;
                    self.state.save_if_dirty()?;
                    warn!(
                        "Transfer {} marked failed: source tx reverted (chain={} tx={})",
                        transfer.id, transfer.source_chain_id, source_tx_hash
                    );
                }
                SourceTxStatus::Pending => {
                    let expires_at = transfer
                        .created_at_unix_seconds
                        .saturating_add(timeout_seconds);
                    if now_unix_seconds >= expires_at {
                        self.state.mark_timed_out(&transfer.id, now_unix_seconds)?;
                        self.state.save_if_dirty()?;
                        warn!(
                            "Transfer {} timed out waiting for source tx receipt: chain={} tx={} timeout={}s",
                            transfer.id,
                            transfer.source_chain_id,
                            source_tx_hash,
                            timeout_seconds
                        );
                    }
                }
            }
        }

        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    fn log_plan(
        &self,
        plan: &crate::planner::AssetPlan,
        reserved_outgoing_by_chain: &BTreeMap<u64, U256>,
        previously_active_deficits: &BTreeSet<u64>,
        pending_inflight: usize,
        available_slots: usize,
        emitted_transfers: &[crate::planner::TransferPlan],
        blocked_by_parallel: &[crate::planner::TransferPlan],
    ) {
        info!(
            "Asset {} snapshot: observed_total={} {} effective_total={} {} pending_inflight={} available_slots={}",
            plan.symbol,
            format_token_amount(plan.observed_total_balance, plan.decimals),
            plan.symbol,
            format_token_amount(plan.effective_total_balance, plan.decimals),
            plan.symbol,
            pending_inflight,
            available_slots
        );

        if !reserved_outgoing_by_chain.is_empty() {
            for (chain_id, reserved) in reserved_outgoing_by_chain {
                let chain = self
                    .config
                    .chain_by_id(*chain_id)
                    .expect("validated chain_id must exist");
                debug!(
                    "  reserved_outgoing chain={} ({}) amount={} {}",
                    chain.name,
                    chain.chain_id,
                    format_token_amount(*reserved, plan.decimals),
                    plan.symbol
                );
            }
        }

        if !previously_active_deficits.is_empty() {
            debug!(
                "  previously_active_deficits: {:?}",
                previously_active_deficits
            );
        }

        for state in &plan.chain_states {
            let chain = self
                .config
                .chain_by_id(state.chain_id)
                .expect("validated chain_id must exist");
            info!(
                "  chain={} ({}) account={} observed={} {} reserved={} {} effective={} {} weight={:.4} target={:.4} min={:.4} clear<{:.4} active={} (was={})",
                chain.name,
                chain.chain_id,
                chain.account,
                format_token_amount(state.observed_balance, plan.decimals),
                plan.symbol,
                format_token_amount(state.reserved_outgoing, plan.decimals),
                plan.symbol,
                format_token_amount(state.effective_balance, plan.decimals),
                plan.symbol,
                state.current_weight,
                state.target_weight,
                state.min_weight,
                state.clear_threshold_weight,
                state.is_active,
                state.was_active
            );
            debug!(
                "  chain={} target_balance_raw={:.4} deficit_raw={:.4} surplus_raw={:.4}",
                chain.chain_id, state.target_balance_raw, state.deficit_raw, state.surplus_raw
            );
        }

        if !plan.newly_activated_chain_ids.is_empty() {
            info!(
                "Asset {}: newly activated deficit chains {:?}",
                plan.symbol, plan.newly_activated_chain_ids
            );
        }
        if !plan.cleared_chain_ids.is_empty() {
            info!(
                "Asset {}: cleared deficit chains {:?}",
                plan.symbol, plan.cleared_chain_ids
            );
        }

        if !plan.triggered {
            info!("Asset {}: rebalance skipped ({})", plan.symbol, plan.reason);
            return;
        }

        info!(
            "Asset {}: rebalance triggered by active deficit chains {:?} ({})",
            plan.symbol, plan.active_deficit_chain_ids, plan.reason
        );

        if !plan.cooldown_blocked_transfers.is_empty() {
            for blocked in &plan.cooldown_blocked_transfers {
                let src = self
                    .config
                    .chain_by_id(blocked.transfer.source_chain_id)
                    .expect("validated chain_id must exist");
                let dst = self
                    .config
                    .chain_by_id(blocked.transfer.destination_chain_id)
                    .expect("validated chain_id must exist");
                info!(
                    "  cooldown block: {} -> {} amount={} {} last={} available_at={}",
                    src.name,
                    dst.name,
                    format_raw_u128(blocked.transfer.amount_raw, plan.decimals),
                    plan.symbol,
                    blocked.last_execution_unix_seconds,
                    blocked.available_at_unix_seconds
                );
            }
        }

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

fn now_unix_seconds() -> Result<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("System time is before UNIX_EPOCH")?
        .as_secs())
}
