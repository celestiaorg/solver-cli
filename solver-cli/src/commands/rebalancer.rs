use anyhow::Result;
use clap::Subcommand;
use std::path::PathBuf;

use crate::utils::{print_divider, print_info, print_kv};
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
}

impl RebalancerCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        match self {
            RebalancerCommand::Start { config, once } => Self::start(config, once, output).await,
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
}
