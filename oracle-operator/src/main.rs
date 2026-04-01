use anyhow::{Context, Result};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::signal;
use tracing::info;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

mod config;
mod operator;
mod signer;
mod state;

use config::OracleConfig;
use operator::OracleOperator;

fn setup_logging(log_dir: &PathBuf) -> Result<tracing_appender::non_blocking::WorkerGuard> {
    // Ensure log directory exists
    std::fs::create_dir_all(log_dir)
        .with_context(|| format!("Failed to create log directory: {:?}", log_dir))?;

    // File appender with daily rotation
    let file_appender = tracing_appender::rolling::daily(log_dir, "oracle.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    // Build subscriber with both stdout and file output
    let env_filter = tracing_subscriber::EnvFilter::from_default_env()
        .add_directive("oracle_operator=info".parse().unwrap());

    // Console layer (human-readable)
    let console_layer = tracing_subscriber::fmt::layer()
        .with_target(true)
        .with_thread_ids(false);

    // File layer (JSON for structured logging)
    let file_layer = tracing_subscriber::fmt::layer()
        .with_writer(non_blocking)
        .with_ansi(false)
        .json();

    tracing_subscriber::registry()
        .with(env_filter)
        .with(console_layer)
        .with(file_layer)
        .init();

    Ok(guard)
}

#[tokio::main]
async fn main() -> Result<()> {
    // Setup logging to ./logs/oracle
    let log_dir = PathBuf::from("./logs/oracle");
    let _guard = setup_logging(&log_dir)?;

    info!("Starting Oracle Operator Service");
    info!("Logs written to {:?}", log_dir);

    // Load config (slim TOML that references state.json for chain data)
    let config_path =
        std::env::var("ORACLE_CONFIG").unwrap_or_else(|_| ".config/oracle.toml".to_string());
    let config_path = PathBuf::from(&config_path);

    let config = OracleConfig::load(&config_path).context("Failed to load oracle config")?;

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
    info!(
        "State persisted to {:?}",
        state_dir.join("oracle-state.json")
    );

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
