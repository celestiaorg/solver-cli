use anyhow::{Context, Result};
use std::path::Path;
use tokio::fs;

use crate::state::SolverState;

/// Generates solver configuration files
pub struct ConfigGenerator;

impl ConfigGenerator {
    /// Generate solver TOML configuration from state
    /// Supports any number of chains with all-to-all routing
    pub fn generate_toml(state: &SolverState) -> Result<String> {
        if state.chains.is_empty() {
            anyhow::bail!("No chains configured");
        }

        // Read private key from environment at generation time
        let solver_private_key = std::env::var("SOLVER_PRIVATE_KEY")
            .or_else(|_| std::env::var("SEPOLIA_PK"))
            .map_err(|_| anyhow::anyhow!("SOLVER_PRIVATE_KEY or SEPOLIA_PK must be set"))?;

        // Ensure the key has 0x prefix
        let solver_private_key = if solver_private_key.starts_with("0x") {
            solver_private_key
        } else {
            format!("0x{}", solver_private_key)
        };

        // Collect all chain IDs
        let chain_ids: Vec<u64> = state.chain_ids();
        let chain_ids_str = chain_ids
            .iter()
            .map(|id| id.to_string())
            .collect::<Vec<_>>()
            .join(", ");

        // Build networks section
        let mut networks_section = String::new();
        for chain in state.chains.values() {
            networks_section.push_str(&format!(
                r#"
[networks.{}]
input_settler_address = "{}"
output_settler_address = "{}"
permit2_address = "{}"

[[networks.{}.rpc_urls]]
http = "{}"
"#,
                chain.chain_id,
                chain
                    .contracts
                    .input_settler_escrow
                    .as_deref()
                    .unwrap_or(""),
                chain
                    .contracts
                    .output_settler_simple
                    .as_deref()
                    .unwrap_or(""),
                chain
                    .contracts
                    .permit2
                    .as_deref()
                    .unwrap_or(""),
                chain.chain_id,
                chain.rpc,
            ));

            // Add tokens for this chain
            for token in chain.tokens.values() {
                networks_section.push_str(&format!(
                    r#"
[[networks.{}.tokens]]
symbol = "{}"
address = "{}"
decimals = {}
"#,
                    chain.chain_id, token.symbol, token.address, token.decimals,
                ));
            }
        }

        // Build oracle configs (input/output for each chain)
        let mut input_oracles = Vec::new();
        let mut output_oracles = Vec::new();
        for chain in state.chains.values() {
            let oracle = chain.contracts.oracle.as_deref().unwrap_or("");
            input_oracles.push(format!("{} = [\"{}\"]", chain.chain_id, oracle));
            output_oracles.push(format!("{} = [\"{}\"]", chain.chain_id, oracle));
        }

        // Build routes (all-to-all)
        let mut routes = Vec::new();
        for &from_id in &chain_ids {
            let destinations: Vec<String> = chain_ids
                .iter()
                .filter(|&&id| id != from_id)
                .map(|id| id.to_string())
                .collect();
            if !destinations.is_empty() {
                routes.push(format!("{} = [{}]", from_id, destinations.join(", ")));
            }
        }

        let config = format!(
            r#"# Auto-generated solver configuration
# DO NOT EDIT MANUALLY - regenerate with 'solver-cli configure'
# Supports {} chain(s): {}

[solver]
id = "{solver_id}"
min_profitability_pct = -1000.0  # Allow massive losses for testing
monitoring_timeout_seconds = 28800

# ============================================================================
# HTTP API
# ============================================================================
[api]
enabled = true
host = "127.0.0.1"
port = 5001

[api.implementations]
discovery = "offchain_eip7683"

# ============================================================================
# STORAGE
# ============================================================================
[storage]
primary = "memory"
cleanup_interval_seconds = 60

[storage.implementations.memory]
# Memory storage has no configuration

# ============================================================================
# ACCOUNT
# ============================================================================
[account]
primary = "local"

[account.implementations.local]
private_key = "{solver_private_key}"

# ============================================================================
# NETWORKS
# ============================================================================
{networks_section}

# ============================================================================
# DELIVERY
# ============================================================================
[delivery]
min_confirmations = 1

[delivery.implementations.evm_alloy]
network_ids = [{chain_ids_str}]

# ============================================================================
# DISCOVERY
# ============================================================================
[discovery]

[discovery.implementations.onchain_eip7683]
network_ids = [{chain_ids_str}]
polling_interval_secs = 2

[discovery.implementations.offchain_eip7683]
# Offchain discovery runs its own API server for order submission
api_host = "127.0.0.1"
api_port = 5002
network_ids = [{chain_ids_str}]

# ============================================================================
# ORDER
# ============================================================================
[order]
simulate_callbacks = false

[order.implementations.eip7683]

[order.strategy]
primary = "simple"

[order.strategy.implementations.simple]
max_gas_price_gwei = 100

# ============================================================================
# PRICING
# ============================================================================
[pricing]
primary = "mock"

[pricing.implementations.mock]
# Mock prices for testing (stablecoins pegged to $1)
[pricing.implementations.mock.pair_prices]
"USDC/USD" = "1.0"
"USDT/USD" = "1.0"
"DAI/USD" = "1.0"

# ============================================================================
# SETTLEMENT
# ============================================================================
[settlement]
settlement_poll_interval_seconds = 3

[settlement.implementations.centralized]
order = "eip7683"
network_ids = [{chain_ids_str}]

# Oracle configuration (CentralizedOracle addresses)
# Attestations are submitted by the separate oracle operator service
[settlement.implementations.centralized.oracles]
input = {{ {input_oracles} }}
output = {{ {output_oracles} }}

# Valid routes (all-to-all)
[settlement.implementations.centralized.routes]
{routes}
"#,
            chain_ids.len(),
            chain_ids_str,
            solver_id = state.solver.solver_id.as_deref().unwrap_or("solver-001"),
            solver_private_key = solver_private_key,
            networks_section = networks_section.trim(),
            chain_ids_str = chain_ids_str,
            input_oracles = input_oracles.join(", "),
            output_oracles = output_oracles.join(", "),
            routes = routes.join("\n"),
        );

        Ok(config)
    }

    /// Write configuration to a file
    pub async fn write_config(state: &SolverState, path: &Path) -> Result<()> {
        let content = Self::generate_toml(state)?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .await
                .context("Failed to create config directory")?;
        }

        fs::write(path, &content)
            .await
            .context("Failed to write config file")?;

        Ok(())
    }

    /// Generate oracle operator configuration for all chains
    pub fn generate_oracle_toml(state: &SolverState) -> Result<String> {
        if state.chains.is_empty() {
            anyhow::bail!("No chains configured");
        }

        // Read operator private key from environment at generation time
        let operator_private_key = std::env::var("ORACLE_OPERATOR_PK")
            .or_else(|_| std::env::var("SEPOLIA_PK"))
            .map_err(|_| {
                anyhow::anyhow!("ORACLE_OPERATOR_PK or SEPOLIA_PK must be set for oracle operator")
            })?;

        // Ensure the key has 0x prefix
        let operator_private_key = if operator_private_key.starts_with("0x") {
            operator_private_key
        } else {
            format!("0x{}", operator_private_key)
        };

        let operator_address = state
            .solver
            .operator_address
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Operator address not configured"))?;

        // Build chain configurations
        let mut chains_section = String::new();
        for chain in state.chains.values() {
            chains_section.push_str(&format!(
                r#"
[[chains]]
chain_id = {}
rpc_url = "{}"
oracle_address = "{}"
output_settler_address = "{}"
input_settler_address = "{}"
"#,
                chain.chain_id,
                chain.rpc,
                chain.contracts.oracle.as_deref().unwrap_or(""),
                chain
                    .contracts
                    .output_settler_simple
                    .as_deref()
                    .unwrap_or(""),
                chain
                    .contracts
                    .input_settler_escrow
                    .as_deref()
                    .unwrap_or(""),
            ));
        }

        let config = format!(
            r#"# Auto-generated oracle operator configuration
# DO NOT EDIT MANUALLY - regenerate with 'solver-cli configure'
# Supports {} chain(s)

# Operator private key (signs attestations)
operator_private_key = "{operator_private_key}"

# Operator address (must match CentralizedOracle operator)
operator_address = "{operator_address}"

# Polling interval in seconds
poll_interval_seconds = 3

# Chain configurations
{chains_section}"#,
            state.chains.len(),
            operator_private_key = operator_private_key,
            operator_address = operator_address,
            chains_section = chains_section.trim(),
        );

        Ok(config)
    }

    /// Write oracle operator configuration to a file
    pub async fn write_oracle_config(state: &SolverState, path: &Path) -> Result<()> {
        let content = Self::generate_oracle_toml(state)?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .await
                .context("Failed to create config directory")?;
        }

        fs::write(path, &content)
            .await
            .context("Failed to write oracle config file")?;

        Ok(())
    }

    /// Generate aggregator config.json with routes from state
    pub fn generate_aggregator_json(state: &SolverState) -> Result<String> {
        if state.chains.is_empty() {
            anyhow::bail!("No chains configured");
        }

        // Build routes array
        let chain_ids: Vec<u64> = state.chain_ids();
        let mut routes = Vec::new();

        for &from_id in &chain_ids {
            let from_chain = &state.chains[&from_id];
            for &to_id in &chain_ids {
                if from_id == to_id {
                    continue;
                }
                let to_chain = &state.chains[&to_id];

                // Create routes for each token
                for (token_symbol, from_token) in &from_chain.tokens {
                    if let Some(to_token) = to_chain.tokens.get(token_symbol) {
                        routes.push(format!(
                            r#"          {{
            "originChainId": {},
            "originTokenAddress": "{}",
            "originTokenSymbol": "{}",
            "destinationChainId": {},
            "destinationTokenAddress": "{}",
            "destinationTokenSymbol": "{}"
          }}"#,
                            from_id,
                            from_token.address,
                            token_symbol,
                            to_id,
                            to_token.address,
                            token_symbol
                        ));
                    }
                }
            }
        }

        let routes_str = if routes.is_empty() {
            String::new()
        } else {
            routes.join(",\n")
        };

        let config = format!(
            r#"{{
  "server": {{
    "host": "0.0.0.0",
    "port": 4000
  }},
  "solvers": {{
    "local-oif-solver": {{
      "solver_id": "local-oif-solver",
      "adapter_id": "oif-v1",
      "endpoint": "http://127.0.0.1:5001/api/v1",
      "enabled": true,
      "headers": null,
      "name": "Local OIF Solver",
      "description": "Local OIF solver for cross-chain intents",
      "supported_assets": {{
        "type": "routes",
        "assets": [
{}
        ]
      }}
    }}
  }},
  "aggregation": {{
    "global_timeout_ms": 10000,
    "per_solver_timeout_ms": 5000,
    "max_concurrent_solvers": 10,
    "max_retries_per_solver": 2,
    "retry_delay_ms": 500,
    "include_unknown_compatibility": false
  }},
  "environment": {{
    "rate_limiting": {{
      "enabled": false,
      "requests_per_minute": 1000,
      "burst_size": 100
    }}
  }},
  "logging": {{
    "level": "info",
    "format": "compact",
    "structured": false
  }},
  "security": {{
    "integrity_secret": {{
      "type": "env",
      "value": "INTEGRITY_SECRET"
    }}
  }},
  "circuit_breaker": {{
    "enabled": true,
    "failure_threshold": 5,
    "success_rate_threshold": 0.3,
    "min_requests_for_rate_check": 20,
    "base_timeout_seconds": 30,
    "max_timeout_seconds": 600,
    "half_open_max_calls": 3,
    "max_recovery_attempts": 10,
    "persistent_failure_action": "ExtendTimeout",
    "metrics_max_age_minutes": 30,
    "service_error_threshold": 0.5,
    "metrics_window_duration_minutes": 15,
    "metrics_max_window_age_minutes": 60
  }},
  "metrics": {{
    "retention_hours": 168,
    "cleanup_interval_hours": 24,
    "aggregation_interval_minutes": 5,
    "min_timeout_for_metrics_ms": 5000
  }}
}}
"#,
            routes_str
        );

        Ok(config)
    }

    /// Write aggregator configuration to a file
    pub async fn write_aggregator_config(state: &SolverState, path: &Path) -> Result<()> {
        let content = Self::generate_aggregator_json(state)?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .await
                .context("Failed to create config directory")?;
        }

        fs::write(path, &content)
            .await
            .context("Failed to write aggregator config file")?;

        Ok(())
    }
}
