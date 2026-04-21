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
    // Replace the upstream evm_alloy factory with our wrapper that stamps
    // EIP-1559 fees from eth_feeHistory before submission. Config section
    // [delivery.implementations.evm_alloy] is reused unchanged.
    delivery_factories.insert(
        "evm_alloy".to_string(),
        super::delivery::FEE_HISTORY_DELIVERY,
    );

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
        let mut api_config = config.api.as_ref().unwrap().clone();
        let api_solver = Arc::clone(&solver);

        // The external port that clients (aggregator) connect to
        let external_host = api_config.host.clone();
        let external_port = api_config.port;

        // Run the upstream solver API on an internal port. A lightweight proxy
        // on the external port strips fields the aggregator doesn't understand
        // (e.g. `settlementName` added in newer solver versions).
        let internal_port = external_port + 1000;
        api_config.port = internal_port;

        tracing::info!(
            "Starting solver API on internal port {} with proxy on {}:{}",
            internal_port,
            external_host,
            external_port
        );

        let solver_task = solver.run();
        let api_task = solver_service::server::start_server(api_config, api_solver);
        let proxy_task = start_compat_proxy(
            external_host,
            external_port,
            format!("http://127.0.0.1:{internal_port}"),
        );

        tokio::select! {
            result = solver_task => {
                tracing::info!("Solver finished");
                result.map_err(|e| anyhow::anyhow!("{}", e))?;
            }
            result = api_task => {
                tracing::info!("API server finished");
                result.map_err(|e| anyhow::anyhow!("{}", e))?;
            }
            result = proxy_task => {
                tracing::info!("Proxy finished");
                result?;
            }
        }
    } else {
        tracing::info!("Starting solver (no API server)");
        solver.run().await.map_err(|e| anyhow::anyhow!("{}", e))?;
    }

    tracing::info!("Solver stopped");
    Ok(())
}

/// Compatibility proxy that forwards requests to the internal solver API and
/// strips fields from quote responses that the aggregator doesn't understand.
#[cfg(feature = "solver-runtime")]
async fn start_compat_proxy(host: String, port: u16, upstream: String) -> Result<()> {
    use axum::{
        body::Body,
        extract::State,
        http::{HeaderMap, Method, Uri},
        response::{IntoResponse, Response},
        routing::any,
        Router,
    };
    use tokio::net::TcpListener;

    #[derive(Clone)]
    struct ProxyState {
        client: reqwest::Client,
        upstream: String,
    }

    async fn proxy_handler(
        State(state): State<ProxyState>,
        method: Method,
        uri: Uri,
        headers: HeaderMap,
        body: Body,
    ) -> Response {
        let url = format!(
            "{}{}",
            state.upstream,
            uri.path_and_query().map(|pq| pq.as_str()).unwrap_or("/")
        );
        let body_bytes = match axum::body::to_bytes(body, 10 * 1024 * 1024).await {
            Ok(b) => b,
            Err(e) => {
                return (
                    axum::http::StatusCode::BAD_REQUEST,
                    format!("body error: {e}"),
                )
                    .into_response();
            }
        };

        let mut req = state.client.request(method.clone(), &url);
        for (key, val) in headers.iter() {
            if key != "host" {
                req = req.header(key, val);
            }
        }
        req = req.body(body_bytes);

        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                return (
                    axum::http::StatusCode::BAD_GATEWAY,
                    format!("upstream error: {e}"),
                )
                    .into_response();
            }
        };

        let status = resp.status();
        let resp_headers = resp.headers().clone();
        let resp_bytes = resp.bytes().await.unwrap_or_default();

        // Strip `settlementName` from quote responses so the aggregator
        // (which uses deny_unknown_fields) can parse them.
        let is_quotes = uri.path().contains("/quotes");
        let final_bytes = if is_quotes {
            strip_settlement_name(&resp_bytes)
        } else {
            resp_bytes.to_vec()
        };

        let mut response = (status, final_bytes).into_response();
        for (key, val) in resp_headers.iter() {
            if key != "content-length" && key != "transfer-encoding" {
                response.headers_mut().insert(key.clone(), val.clone());
            }
        }
        response
    }

    let state = ProxyState {
        client: reqwest::Client::new(),
        upstream,
    };

    let app = Router::new()
        .route("/{*path}", any(proxy_handler))
        .route("/", any(proxy_handler))
        .with_state(state);

    let addr = format!("{host}:{port}");
    let listener = TcpListener::bind(&addr).await?;
    tracing::info!("Compatibility proxy listening on {addr}");

    axum::serve(listener, app)
        .await
        .map_err(|e| anyhow::anyhow!("proxy error: {e}"))
}

/// Remove `settlementName` keys from JSON bytes.
#[cfg(feature = "solver-runtime")]
fn strip_settlement_name(bytes: &[u8]) -> Vec<u8> {
    match serde_json::from_slice::<serde_json::Value>(bytes) {
        Ok(mut val) => {
            remove_key_recursive(&mut val, "settlementName");
            serde_json::to_vec(&val).unwrap_or_else(|_| bytes.to_vec())
        }
        Err(_) => bytes.to_vec(),
    }
}

#[cfg(feature = "solver-runtime")]
fn remove_key_recursive(val: &mut serde_json::Value, key: &str) {
    match val {
        serde_json::Value::Object(map) => {
            map.remove(key);
            for v in map.values_mut() {
                remove_key_recursive(v, key);
            }
        }
        serde_json::Value::Array(arr) => {
            for v in arr.iter_mut() {
                remove_key_recursive(v, key);
            }
        }
        _ => {}
    }
}
