use alloy::primitives::U256;
use anyhow::{Context, Result};
use std::collections::{BTreeMap, HashMap};
use tokio::time::{sleep, Duration};
use tracing::{debug, info, warn};

use crate::balance::ChainBalanceClient;
use crate::config::{AssetConfig, RebalancerConfig};
use crate::planner::{build_asset_plan, format_raw_u128, format_token_amount};

pub struct RebalancerService {
    config: RebalancerConfig,
    clients: HashMap<u64, ChainBalanceClient>,
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

        Ok(Self {
            config,
            clients,
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
            "Execution config: cooldown={}s min_transfer_usd={} max_transfer_usd={} max_slippage_bps={} max_parallel_transfers={}",
            self.config.execution.cooldown_seconds_per_route,
            self.config.execution.min_transfer_usd,
            self.config.execution.max_transfer_usd,
            self.config.execution.max_slippage_bps,
            self.config.max_parallel_transfers
        );
        info!(
            "Bridge provider: {} (timeout={}s)",
            self.config.bridge.provider, self.config.bridge.hyperlane_warp.default_timeout_seconds
        );

        if !self.config.dry_run {
            warn!(
                "Config dry_run=false, but Phase 1 only supports plan logging (no bridge submissions yet)"
            );
        }

        loop {
            self.run_once().await?;
            sleep(Duration::from_secs(self.config.poll_interval_seconds)).await;
        }
    }

    pub async fn run_once(&mut self) -> Result<()> {
        self.cycle += 1;
        info!("Starting rebalance cycle {}", self.cycle);

        for asset in &self.config.assets {
            if let Err(err) = self.process_asset(asset).await {
                warn!(
                    "Cycle {}: asset {} processing failed: {}",
                    self.cycle, asset.symbol, err
                );
            }
        }

        Ok(())
    }

    async fn process_asset(&self, asset: &AssetConfig) -> Result<()> {
        let mut chain_ids: Vec<u64> = asset.weights.keys().copied().collect();
        chain_ids.sort_unstable();

        let mut balances = BTreeMap::<u64, U256>::new();
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
                    balances.insert(chain_id, balance);
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

        let plan = build_asset_plan(asset, &balances)?;
        self.log_plan(&plan);
        Ok(())
    }

    fn log_plan(&self, plan: &crate::planner::AssetPlan) {
        info!(
            "Asset {} snapshot: total={} {}",
            plan.symbol,
            format_token_amount(plan.total_balance, plan.decimals),
            plan.symbol
        );

        for state in &plan.chain_states {
            let chain = self
                .config
                .chain_by_id(state.chain_id)
                .expect("validated chain_id must exist");
            info!(
                "  chain={} ({}) account={} balance={} {} current_weight={:.4} target={:.4} min={:.4}",
                chain.name,
                chain.chain_id,
                chain.account,
                format_token_amount(state.balance, plan.decimals),
                plan.symbol,
                state.current_weight,
                state.target_weight,
                state.min_weight
            );
            debug!(
                "  chain={} target_balance_raw={:.4} deficit_raw={:.4} surplus_raw={:.4}",
                chain.chain_id, state.target_balance_raw, state.deficit_raw, state.surplus_raw
            );
        }

        if !plan.triggered {
            info!("Asset {}: rebalance skipped ({})", plan.symbol, plan.reason);
            return;
        }

        info!(
            "Asset {}: rebalance triggered by chains {:?} ({})",
            plan.symbol, plan.trigger_chain_ids, plan.reason
        );

        if plan.transfers.is_empty() {
            info!(
                "Asset {}: no transfer candidates after deficit/surplus matching",
                plan.symbol
            );
            return;
        }

        for transfer in &plan.transfers {
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

        info!(
            "Asset {}: Phase 1 dry-run only, {} planned transfers were not executed",
            plan.symbol,
            plan.transfers.len()
        );
    }
}
