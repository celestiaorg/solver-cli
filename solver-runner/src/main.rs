//! Minimal solver runner that loads config from TOML and runs the solver.
//!
//! This bypasses the seed preset system and allows running the solver
//! with arbitrary network configurations for E2E testing.
//!
//! Usage:
//!   solver-runner --config path/to/config.toml
//!
//! Environment variables:
//!   SOLVER_PRIVATE_KEY - Private key for the solver account
//!   RUST_LOG - Log level (default: info)

use clap::Parser;
use solver_config::Config;
use solver_service::{build_solver_from_config, server};
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Parser, Debug)]
#[command(name = "solver-runner")]
#[command(about = "Run OIF solver from a TOML config file")]
struct Args {
    /// Path to the TOML config file
    #[arg(short, long)]
    config: PathBuf,

    /// Log level (trace, debug, info, warn, error)
    #[arg(short, long, default_value = "info")]
    log_level: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    // Initialize tracing
    use tracing_subscriber::{fmt, EnvFilter};

    let default_directive = args.log_level.to_string();
    let env_filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(default_directive));

    fmt()
        .with_env_filter(env_filter)
        .with_thread_ids(true)
        .with_target(true)
        .init();

    tracing::info!("Loading config from {}", args.config.display());

    // Load config from TOML file
    let config_str = std::fs::read_to_string(&args.config)?;
    let config: Config = toml::from_str(&config_str)?;

    tracing::info!("Loaded configuration for solver: {}", config.solver.id);
    tracing::info!("Networks configured: {:?}", config.networks.keys().collect::<Vec<_>>());

    // Build solver engine
    let solver = build_solver_from_config(config.clone()).await?;
    let solver = Arc::new(solver);

    tracing::info!("Solver engine built successfully");

    // Check if API server should be started
    let api_enabled = config.api.as_ref().is_some_and(|api| api.enabled);

    if api_enabled {
        let api_config = config.api.as_ref().unwrap().clone();
        let api_solver = Arc::clone(&solver);

        tracing::info!("Starting solver with API server on {}:{}", api_config.host, api_config.port);

        // Start both the solver and the API server concurrently
        let solver_task = solver.run();
        let api_task = server::start_server(api_config, api_solver);

        tokio::select! {
            result = solver_task => {
                tracing::info!("Solver finished");
                result?;
            }
            result = api_task => {
                tracing::info!("API server finished");
                result?;
            }
        }
    } else {
        tracing::info!("Starting solver (no API server)");
        solver.run().await?;
    }

    tracing::info!("Solver stopped");
    Ok(())
}
