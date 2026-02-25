use anyhow::Result;
use clap::Parser;
use rebalancer::run_from_config;
use std::path::PathBuf;
use tracing::Level;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[derive(Parser)]
#[command(name = "rebalancer")]
#[command(version = "0.1.0")]
#[command(about = "Cross-chain inventory rebalancer service")]
struct Cli {
    /// Path to rebalancer config TOML
    #[arg(
        long,
        default_value = ".config/rebalancer.toml",
        env = "REBALANCER_CONFIG"
    )]
    config: PathBuf,

    /// Run one poll cycle and exit
    #[arg(long, default_value_t = false)]
    once: bool,

    /// Log level (error, warn, info, debug, trace)
    #[arg(
        long,
        global = true,
        default_value = "info",
        env = "REBALANCER_LOG_LEVEL"
    )]
    log_level: String,
}

fn setup_logging(level: &str) {
    let level = level.parse::<Level>().unwrap_or(Level::INFO);

    let filter = EnvFilter::builder()
        .with_default_directive(level.into())
        .from_env_lossy();

    tracing_subscriber::registry()
        .with(fmt::layer().with_target(true).with_thread_ids(false))
        .with(filter)
        .init();
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    setup_logging(&cli.log_level);
    run_from_config(&cli.config, cli.once).await
}
