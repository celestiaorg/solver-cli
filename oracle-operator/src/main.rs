use anyhow::{Context, Result};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::signal;
use tracing::info;

mod config;
mod operator;
mod state;

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
    let config_path = PathBuf::from(&config_path);

    let config =
        OracleConfig::load(&config_path).context("Failed to load oracle config")?;

    info!("Loaded config for {} chains", config.chains.len());
    info!("Operator address: {}", config.operator_address);

    // State is stored alongside the config file
    let state_dir = config_path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));

    // Create operator
    let operator = Arc::new(OracleOperator::new(config, &state_dir).await?);

    info!("Oracle Operator initialized, watching for fills...");
    info!("State persisted to {:?}", state_dir.join("oracle-state.json"));

    // Run with graceful shutdown
    let operator_clone = operator.clone();
    tokio::select! {
        result = operator_clone.run() => {
            if let Err(e) = result {
                tracing::error!("Operator error: {}", e);
            }
        }
        _ = shutdown_signal() => {
            info!("Shutdown signal received, saving state...");
        }
    }

    // Save state on shutdown
    operator.save_state().await?;
    info!("State saved, shutting down.");

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
