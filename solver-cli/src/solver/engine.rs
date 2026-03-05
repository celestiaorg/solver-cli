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
    use std::collections::HashMap;
    use std::sync::Arc;

    use solver_config::Config;
    use solver_core::SolverFactories;

    use solver_settlement_impls::centralized::create_settlement;

    tracing::info!("Loading config from {}", config_path.display());

    let config_str = std::fs::read_to_string(config_path)?;
    let config: Config = toml::from_str(&config_str)?;

    tracing::info!("Loaded configuration for solver: {}", config.solver.id);
    tracing::info!(
        "Networks configured: {:?}",
        config.networks.keys().collect::<Vec<_>>()
    );

    let mut storage_factories = HashMap::new();
    for (name, factory) in solver_storage::get_all_implementations() {
        storage_factories.insert(name.to_string(), factory);
    }

    let mut account_factories = HashMap::new();
    for (name, factory) in solver_account::get_all_implementations() {
        account_factories.insert(name.to_string(), factory);
    }

    let mut delivery_factories = HashMap::new();
    for (name, factory) in solver_delivery::get_all_implementations() {
        delivery_factories.insert(name.to_string(), factory);
    }

    let mut discovery_factories = HashMap::new();
    for (name, factory) in solver_discovery::get_all_implementations() {
        discovery_factories.insert(name.to_string(), factory);
    }

    let mut order_factories = HashMap::new();
    for (name, factory) in solver_order::get_all_order_implementations() {
        order_factories.insert(name.to_string(), factory);
    }

    let mut pricing_factories = HashMap::new();
    for (name, factory) in solver_pricing::get_all_implementations() {
        pricing_factories.insert(name.to_string(), factory);
    }

    let mut settlement_factories: HashMap<String, solver_settlement_impls::SettlementFactory> =
        HashMap::new();
    for (name, factory) in solver_settlement_impls::get_all_implementations() {
        settlement_factories.insert(name.to_string(), factory);
    }
    settlement_factories.insert(
        "centralized".to_string(),
        create_settlement as solver_settlement_impls::SettlementFactory,
    );

    let mut strategy_factories = HashMap::new();
    for (name, factory) in solver_order::get_all_strategy_implementations() {
        strategy_factories.insert(name.to_string(), factory);
    }

    let factories = SolverFactories {
        storage_factories,
        account_factories,
        delivery_factories,
        discovery_factories,
        order_factories,
        pricing_factories,
        settlement_factories,
        strategy_factories,
    };

    let dynamic_config = Arc::new(tokio::sync::RwLock::new(config.clone()));
    let solver = solver_core::SolverBuilder::new(dynamic_config, config.clone())
        .build(factories)
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
        let api_task = solver_service::server::start_server(api_config, api_solver);

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
