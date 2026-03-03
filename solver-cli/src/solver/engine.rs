//! In-process solver runner: load config from TOML and run the solver engine.
//! Used by `solver start` (foreground) and `solver run` (subprocess).

use anyhow::Result;
use std::path::Path;

pub async fn run_solver_from_config(config_path: &Path) -> Result<()> {
    #[cfg(feature = "solver-runtime")]
    {
        run_solver_from_config_impl(config_path).await
    }

    #[cfg(not(feature = "solver-runtime"))]
    {
        let _ = config_path;
        anyhow::bail!(
            "In-process solver is not built. Build with: cargo build --release --features solver-runtime"
        );
    }
}

#[cfg(feature = "solver-runtime")]
async fn run_solver_from_config_impl(config_path: &Path) -> Result<()> {
    use std::sync::Arc;

    use centralized_settlement::build_solver_with_centralized;
    use solver_config::Config;

    tracing::info!("Loading config from {}", config_path.display());

    let config_str = std::fs::read_to_string(config_path)?;
    let config: Config = toml::from_str(&config_str)?;

    tracing::info!("Loaded configuration for solver: {}", config.solver.id);
    tracing::info!(
        "Networks configured: {:?}",
        config.networks.keys().collect::<Vec<_>>()
    );

    let solver = build_solver_with_centralized(&config)
        .await
        .map_err(|e| anyhow::anyhow!("{}", e))?;
    let solver = Arc::new(solver);

    tracing::info!("Solver engine built successfully");

    let api_enabled = config.api.as_ref().is_some_and(|api| api.enabled);

    if api_enabled {
        let api_config = config.api.as_ref().unwrap().clone();
        let api_solver = Arc::clone(&solver);

        tracing::info!(
            "Starting solver with API server on {}:{}",
            api_config.host,
            api_config.port
        );

        let solver_task = solver.run();
        let api_task = crate::server::start_server(api_config, api_solver);

        tokio::select! {
            result = solver_task => {
                tracing::info!("Solver finished");
                result.map_err(|e| anyhow::anyhow!("{}", e))?;
            }
            result = api_task => {
                tracing::info!("API server finished");
                result.map_err(|e| anyhow::anyhow!("{}", e))?;
            }
        }
    } else {
        tracing::info!("Starting solver (no API server)");
        solver.run().await.map_err(|e| anyhow::anyhow!("{}", e))?;
    }

    tracing::info!("Solver stopped");
    Ok(())
}
