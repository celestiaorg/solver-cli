use alloy::primitives::U256;
use anyhow::{Context, Result};
use clap::Subcommand;
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::utils::{print_divider, print_info, print_kv, print_warning, OutputFormatter};
use crate::OutputFormat;

#[derive(Subcommand)]
pub enum RebalancerCommand {
    /// Start the rebalancer service
    Start {
        /// Path to rebalancer TOML config file
        #[arg(long, default_value = "config/rebalancer.toml")]
        config: PathBuf,

        /// Run one cycle and exit
        #[arg(long, default_value_t = false)]
        once: bool,
    },

    /// Show persisted rebalancer state summary
    State {
        /// Project directory (defaults to current directory)
        #[arg(long)]
        dir: Option<PathBuf>,

        /// Optional asset filter (e.g. USDC)
        #[arg(long)]
        asset: Option<String>,

        /// Path to rebalancer TOML config file (used for cooldown and chain metadata)
        #[arg(long, default_value = "config/rebalancer.toml")]
        config: PathBuf,
    },
}

impl RebalancerCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        match self {
            RebalancerCommand::Start { config, once } => Self::start(config, once, output).await,
            RebalancerCommand::State { dir, asset, config } => {
                Self::state(dir, asset, config, output).await
            }
        }
    }

    async fn start(config: PathBuf, once: bool, output: OutputFormat) -> Result<()> {
        let out = crate::utils::OutputFormatter::new(output);
        out.header("Starting Rebalancer");
        print_kv("Config", config.display());
        print_kv("Mode", if once { "single-cycle" } else { "continuous" });
        print_divider();

        if !config.exists() {
            anyhow::bail!(
                "Rebalancer config not found at {}. Create config/rebalancer.toml first.",
                config.display()
            );
        }

        print_info("Running rebalancer service...");

        ::rebalancer::run_from_config(&config, once).await?;
        Ok(())
    }

    async fn state(
        dir: Option<PathBuf>,
        asset: Option<String>,
        config: PathBuf,
        output: OutputFormat,
    ) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| std::env::current_dir().unwrap());
        let state_path = project_dir.join(".rebalancer/state.json");
        if !state_path.exists() {
            anyhow::bail!(
                "Rebalancer state not found at {}. Run 'solver-cli rebalancer start --once' first.",
                state_path.display()
            );
        }

        let state_raw = tokio::fs::read_to_string(&state_path)
            .await
            .with_context(|| format!("Failed to read state file {}", state_path.display()))?;
        let state: ::rebalancer::state::RebalancerState = serde_json::from_str(&state_raw)
            .with_context(|| format!("Failed to parse state file {}", state_path.display()))?;

        let normalized_asset = asset.as_deref().map(normalize_asset);
        let config_path = if config.is_absolute() {
            config
        } else {
            project_dir.join(config)
        };
        let config_info = load_config_metadata(&config_path);
        let now = now_unix_seconds()?;

        let summary = build_summary(&state, &config_info, normalized_asset.as_deref(), now);

        if out.is_json() {
            out.json(&summary)?;
            return Ok(());
        }

        out.header("Rebalancer State");
        print_kv("State file", state_path.display());
        print_kv("Version", state.version);
        print_kv(
            "Last cycle",
            state
                .last_cycle_at_unix_seconds
                .map(|value| value.to_string())
                .unwrap_or_else(|| "n/a".to_string()),
        );
        if let Some(cooldown_seconds) = config_info.cooldown_seconds {
            print_kv("Cooldown seconds", cooldown_seconds);
        } else {
            print_kv("Cooldown seconds", "n/a");
        }
        print_kv("Pending inflight transfers", summary.pending_inflight_count);
        print_divider();

        if let Some(filter) = normalized_asset.as_deref() {
            print_kv("Asset filter", filter);
        }
        if let Some(err) = &config_info.load_error {
            print_warning(&format!(
                "Could not load {}: {}",
                config_path.display(),
                err
            ));
        }

        if summary.active_deficits.is_empty() {
            print_info("No active deficit chains");
        } else {
            print_info("Active deficit chains:");
            for entry in &summary.active_deficits {
                let labels: Vec<String> = entry
                    .chain_ids
                    .iter()
                    .map(|chain_id| chain_label(*chain_id, &config_info.chain_names))
                    .collect();
                println!("  {}: {}", entry.asset_symbol, labels.join(", "));
            }
        }

        if summary.reserved_pending.is_empty() {
            print_info("No reserved pending outgoing amounts");
        } else {
            print_info("Reserved pending outgoing amounts:");
            for entry in &summary.reserved_pending {
                println!(
                    "  {} {} -> {}",
                    entry.asset_symbol,
                    chain_label(entry.source_chain_id, &config_info.chain_names),
                    entry.amount_display
                );
            }
        }

        if summary.cooldown_routes.is_empty() {
            print_info("No route cooldown entries");
        } else {
            print_info("Route cooldown timers:");
            for route in &summary.cooldown_routes {
                let remaining = route
                    .seconds_remaining
                    .map(|value| format!("{}s remaining", value))
                    .unwrap_or_else(|| "ready".to_string());
                println!(
                    "  {} {} -> {}: {} (last={})",
                    route.asset_symbol,
                    chain_label(route.source_chain_id, &config_info.chain_names),
                    chain_label(route.destination_chain_id, &config_info.chain_names),
                    remaining,
                    route.last_execution_unix_seconds
                );
            }
        }

        Ok(())
    }
}

#[derive(Debug)]
struct ConfigMetadata {
    cooldown_seconds: Option<u64>,
    chain_names: BTreeMap<u64, String>,
    asset_decimals: BTreeMap<String, u8>,
    load_error: Option<String>,
}

#[derive(Debug, Serialize)]
struct StateSummary {
    state_version: u32,
    last_cycle_at_unix_seconds: Option<u64>,
    cooldown_seconds_per_route: Option<u64>,
    pending_inflight_count: usize,
    active_deficits: Vec<ActiveDeficitEntry>,
    reserved_pending: Vec<ReservedPendingEntry>,
    cooldown_routes: Vec<CooldownRouteEntry>,
}

#[derive(Debug, Serialize)]
struct ActiveDeficitEntry {
    asset_symbol: String,
    chain_ids: Vec<u64>,
}

#[derive(Debug, Serialize)]
struct ReservedPendingEntry {
    asset_symbol: String,
    source_chain_id: u64,
    amount_raw: String,
    amount_display: String,
}

#[derive(Debug, Serialize)]
struct CooldownRouteEntry {
    asset_symbol: String,
    source_chain_id: u64,
    destination_chain_id: u64,
    last_execution_unix_seconds: u64,
    available_at_unix_seconds: Option<u64>,
    seconds_remaining: Option<u64>,
}

fn load_config_metadata(path: &std::path::Path) -> ConfigMetadata {
    match ::rebalancer::config::RebalancerConfig::load(path) {
        Ok(config) => {
            let chain_names = config
                .chains
                .into_iter()
                .map(|chain| (chain.chain_id, chain.name))
                .collect();
            let asset_decimals = config
                .assets
                .into_iter()
                .map(|asset| (normalize_asset(&asset.symbol), asset.decimals))
                .collect();
            ConfigMetadata {
                cooldown_seconds: Some(config.execution.cooldown_seconds_per_route),
                chain_names,
                asset_decimals,
                load_error: None,
            }
        }
        Err(err) => ConfigMetadata {
            cooldown_seconds: None,
            chain_names: BTreeMap::new(),
            asset_decimals: BTreeMap::new(),
            load_error: Some(err.to_string()),
        },
    }
}

fn build_summary(
    state: &::rebalancer::state::RebalancerState,
    config: &ConfigMetadata,
    asset_filter: Option<&str>,
    now_unix_seconds: u64,
) -> StateSummary {
    let mut active_deficits = Vec::new();
    for (asset_symbol, chain_ids) in &state.active_deficit_chains {
        let normalized_asset = normalize_asset(asset_symbol);
        if asset_filter.is_some_and(|filter| filter != normalized_asset) {
            continue;
        }
        let mut sorted_chain_ids = chain_ids.clone();
        sorted_chain_ids.sort_unstable();
        active_deficits.push(ActiveDeficitEntry {
            asset_symbol: normalized_asset,
            chain_ids: sorted_chain_ids,
        });
    }
    active_deficits.sort_by(|a, b| a.asset_symbol.cmp(&b.asset_symbol));

    let mut reserved_by_asset_chain: BTreeMap<(String, u64), U256> = BTreeMap::new();
    let mut pending_inflight_count = 0usize;
    for transfer in &state.inflight_transfers {
        if !transfer.status.is_pending() {
            continue;
        }
        let normalized_asset = normalize_asset(&transfer.asset_symbol);
        if asset_filter.is_some_and(|filter| filter != normalized_asset) {
            continue;
        }

        pending_inflight_count += 1;
        if let Ok(amount) = transfer.amount_raw.parse::<U256>() {
            let key = (normalized_asset, transfer.source_chain_id);
            let entry = reserved_by_asset_chain.entry(key).or_insert(U256::ZERO);
            *entry += amount;
        }
    }

    let mut reserved_pending = Vec::new();
    for ((asset_symbol, source_chain_id), amount) in reserved_by_asset_chain {
        let amount_raw = amount.to_string();
        let amount_display = format_amount_display(
            &asset_symbol,
            amount,
            config.asset_decimals.get(&asset_symbol).copied(),
        );
        reserved_pending.push(ReservedPendingEntry {
            asset_symbol,
            source_chain_id,
            amount_raw,
            amount_display,
        });
    }

    let mut cooldown_routes = Vec::new();
    for (asset_symbol, by_source) in &state.route_last_execution_unix {
        let normalized_asset = normalize_asset(asset_symbol);
        if asset_filter.is_some_and(|filter| filter != normalized_asset) {
            continue;
        }
        for (source_chain_id, by_destination) in by_source {
            for (destination_chain_id, last_execution_unix_seconds) in by_destination {
                let available_at = config
                    .cooldown_seconds
                    .map(|seconds| last_execution_unix_seconds.saturating_add(seconds));
                let seconds_remaining = available_at.and_then(|value| {
                    if now_unix_seconds >= value {
                        None
                    } else {
                        Some(value - now_unix_seconds)
                    }
                });

                cooldown_routes.push(CooldownRouteEntry {
                    asset_symbol: normalized_asset.clone(),
                    source_chain_id: *source_chain_id,
                    destination_chain_id: *destination_chain_id,
                    last_execution_unix_seconds: *last_execution_unix_seconds,
                    available_at_unix_seconds: available_at,
                    seconds_remaining,
                });
            }
        }
    }
    cooldown_routes.sort_by(|a, b| {
        a.asset_symbol
            .cmp(&b.asset_symbol)
            .then_with(|| a.source_chain_id.cmp(&b.source_chain_id))
            .then_with(|| a.destination_chain_id.cmp(&b.destination_chain_id))
    });

    StateSummary {
        state_version: state.version,
        last_cycle_at_unix_seconds: state.last_cycle_at_unix_seconds,
        cooldown_seconds_per_route: config.cooldown_seconds,
        pending_inflight_count,
        active_deficits,
        reserved_pending,
        cooldown_routes,
    }
}

fn format_amount_display(asset_symbol: &str, raw: U256, decimals: Option<u8>) -> String {
    match decimals {
        Some(decimals) => format!(
            "{} {} (raw={})",
            ::rebalancer::planner::format_token_amount(raw, decimals),
            asset_symbol,
            raw
        ),
        None => format!("{} raw", raw),
    }
}

fn chain_label(chain_id: u64, chain_names: &BTreeMap<u64, String>) -> String {
    match chain_names.get(&chain_id) {
        Some(name) => format!("{} ({})", name, chain_id),
        None => chain_id.to_string(),
    }
}

fn normalize_asset(symbol: &str) -> String {
    symbol.trim().to_ascii_uppercase()
}

fn now_unix_seconds() -> Result<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("System time is before UNIX_EPOCH")?
        .as_secs())
}
