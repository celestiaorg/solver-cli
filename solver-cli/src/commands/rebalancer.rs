use anyhow::Result;
use clap::Subcommand;
use serde::Serialize;
use std::path::PathBuf;

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

    /// Show rebalancer configuration/status summary
    State {
        /// Project directory (defaults to current directory)
        #[arg(long)]
        dir: Option<PathBuf>,

        /// Optional asset filter (e.g. USDC)
        #[arg(long)]
        asset: Option<String>,

        /// Path to rebalancer TOML config file
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
        let out = OutputFormatter::new(output);
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
        let config_path = if config.is_absolute() {
            config
        } else {
            project_dir.join(config)
        };

        let summary = build_summary(&config_path, asset.as_deref());

        if out.is_json() {
            out.json(&summary)?;
            return Ok(());
        }

        out.header("Rebalancer State");
        print_kv("Mode", "stateless");
        print_kv("Config file", config_path.display());

        if let Some(filter) = &summary.asset_filter {
            print_kv("Asset filter", filter);
        }

        if let Some(err) = &summary.config_error {
            print_warning(&format!("Could not load config: {}", err));
            return Ok(());
        }

        print_kv("Chains", summary.chain_count);
        print_kv("Assets", summary.asset_count);
        print_kv("Min transfer bps", summary.min_transfer_bps);
        print_kv("Max transfer bps", summary.max_transfer_bps);
        print_kv("Max parallel transfers", summary.max_parallel_transfers);
        print_divider();
        print_info("No local state file is used; control logic is derived from live chain data each cycle.");

        Ok(())
    }
}

#[derive(Debug, Serialize)]
struct RebalancerStateSummary {
    mode: &'static str,
    config_path: String,
    asset_filter: Option<String>,
    chain_count: usize,
    asset_count: usize,
    min_transfer_bps: u16,
    max_transfer_bps: u16,
    max_parallel_transfers: usize,
    config_error: Option<String>,
}

fn build_summary(
    config_path: &std::path::Path,
    asset_filter: Option<&str>,
) -> RebalancerStateSummary {
    match ::rebalancer::config::RebalancerConfig::load(config_path) {
        Ok(config) => {
            let normalized_filter = asset_filter.map(normalize_asset);
            let asset_count = match normalized_filter.as_deref() {
                Some(filter) => config
                    .assets
                    .iter()
                    .filter(|asset| normalize_asset(&asset.symbol) == filter)
                    .count(),
                None => config.assets.len(),
            };

            RebalancerStateSummary {
                mode: "stateless",
                config_path: config_path.display().to_string(),
                asset_filter: normalized_filter,
                chain_count: config.chains.len(),
                asset_count,
                min_transfer_bps: config.execution.min_transfer_bps,
                max_transfer_bps: config.execution.max_transfer_bps,
                max_parallel_transfers: config.max_parallel_transfers,
                config_error: None,
            }
        }
        Err(err) => RebalancerStateSummary {
            mode: "stateless",
            config_path: config_path.display().to_string(),
            asset_filter: asset_filter.map(normalize_asset),
            chain_count: 0,
            asset_count: 0,
            min_transfer_bps: 0,
            max_transfer_bps: 0,
            max_parallel_transfers: 0,
            config_error: Some(err.to_string()),
        },
    }
}

fn normalize_asset(symbol: &str) -> String {
    symbol.trim().to_ascii_uppercase()
}
