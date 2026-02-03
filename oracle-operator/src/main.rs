use anyhow::{Context, Result};
use std::path::PathBuf;
use tracing::info;

mod config;
mod operator;

use config::OracleConfig;
use operator::OracleOperator;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("oracle_operator=info".parse().unwrap()),
        )
        .init();

    info!("🔮 Starting Oracle Operator Service");

    // Load config
    let config_path =
        std::env::var("ORACLE_CONFIG").unwrap_or_else(|_| "config/oracle.toml".to_string());

    let config =
        OracleConfig::load(&PathBuf::from(config_path)).context("Failed to load oracle config")?;

    info!("Loaded config for {} chains", config.chains.len());
    info!("Operator address: {}", config.operator_address);

    // Create and run operator
    let operator = OracleOperator::new(config).await?;

    info!("Oracle Operator initialized, watching for fills...");

    operator.run().await?;

    Ok(())
}
