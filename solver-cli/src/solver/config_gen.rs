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

        // Build account section based on SOLVER_SIGNER_TYPE.
        let account_section = match crate::utils::SolverSignerConfig::from_env()? {
            crate::utils::SolverSignerConfig::AwsKms {
                key_id,
                region,
                endpoint,
            } => {
                let endpoint_line = endpoint
                    .map(|ep| format!("endpoint = \"{ep}\"\n"))
                    .unwrap_or_default();
                format!(
                    "[account]\nprimary = \"kms\"\n\n[account.implementations.kms]\nkey_id = \"{key_id}\"\nregion = \"{region}\"\n{endpoint_line}"
                )
            }
            crate::utils::SolverSignerConfig::Env => {
                let raw = std::env::var("SOLVER_PRIVATE_KEY")
                    .context("Missing required environment variable: SOLVER_PRIVATE_KEY")?;
                let key = if raw.starts_with("0x") {
                    raw
                } else {
                    format!("0x{raw}")
                };
                format!(
                    "[account]\nprimary = \"local\"\n\n[account.implementations.local]\nprivate_key = \"{key}\""
                )
            }
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

        // Include OFAC list path if the file exists
        let ofac_line = if std::path::Path::new(".config/ofac.json").exists() {
            "ofac_list = \".config/ofac.json\"\n".to_string()
        } else {
            String::new()
        };

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
min_profitability_pct = 0.0
commission_bps = 20
rate_buffer_bps = 15
monitoring_timeout_seconds = 28800
{ofac_line}
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
# File-backed so in-flight orders survive a solver restart. Memory storage
# silently drops every pending order on restart, which once left 19 filled
# orders orphaned in Deposited state (2026-04-17..21) — we had filled on the
# destination but had no record to claim on source after the restart.
primary = "file"
cleanup_interval_seconds = 60

[storage.implementations.file]
storage_path = "./.config/solver-storage"

# ============================================================================
# ACCOUNT
# ============================================================================
{account_section}

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
polling_interval_secs = 12

[discovery.implementations.offchain_eip7683]
# Offchain discovery runs its own API server for order submission
api_host = "127.0.0.1"
api_port = 5002
network_ids = [{chain_ids_str}]

# ============================================================================
# GAS ESTIMATES (per flow, in gas units)
# ============================================================================
[gas]

[gas.flows.resource_lock]
open = 0
fill = 77298
claim = 122793

[gas.flows.permit2_escrow]
open = 146306
fill = 77298
claim = 60084

[gas.flows.eip3009_escrow]
open = 130254
fill = 77298
claim = 60084

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
primary = "defillama"
fallbacks = ["coingecko"]

[pricing.implementations.defillama]
# base_url = "https://coins.llama.fi"  # default
# cache_duration_seconds = 60          # default

[pricing.implementations.coingecko]
# api_key = ""        # optional, omit for free tier
# cache_duration_seconds = 60
# rate_limit_delay_ms = 1200           # free tier default

# ============================================================================
# SETTLEMENT
# ============================================================================
[settlement]
primary = "centralized"
settlement_poll_interval_seconds = 12

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
            account_section = account_section,
            networks_section = networks_section.trim(),
            chain_ids_str = chain_ids_str,
            ofac_line = ofac_line,
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

    /// Generate slim oracle operator TOML (service settings only; chain data from state.json).
    pub fn generate_oracle_toml(_state: &SolverState) -> Result<String> {
        let signer_section = match crate::utils::OracleSignerConfig::from_env()? {
            crate::utils::OracleSignerConfig::AwsKms { key_id, region, .. } => {
                format!(
                    "[signer]\ntype = \"aws_kms\"\nkey_id = \"{key_id}\"\nregion = \"{region}\""
                )
            }
            crate::utils::OracleSignerConfig::Env => "[signer]\ntype = \"env\"".to_string(),
        };

        let config = format!(
            r#"# Auto-generated oracle operator configuration
# Chain/contract data is read from state.json at startup.

state_file = "state.json"
poll_interval_seconds = 3

{signer_section}
"#,
            signer_section = signer_section,
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
    "global_timeout_ms": 60000,
    "per_solver_timeout_ms": 60000,
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

    /// Generate Hyperlane agent relayer configuration JSON from state.
    /// Includes all EVM chains + Celestia with their Hyperlane contract addresses.
    pub fn generate_hyperlane_relayer_json(state: &SolverState) -> Result<String> {
        if state.chains.is_empty() {
            anyhow::bail!("No chains configured");
        }

        // Build EVM signer config based on SOLVER_SIGNER_TYPE.
        let evm_signer = match crate::utils::SolverSignerConfig::from_env()? {
            crate::utils::SolverSignerConfig::AwsKms { key_id, region, .. } => {
                serde_json::json!({ "type": "aws", "id": key_id, "region": region })
            }
            crate::utils::SolverSignerConfig::Env => {
                let raw = std::env::var("SOLVER_PRIVATE_KEY")
                    .context("Missing required environment variable: SOLVER_PRIVATE_KEY")?;
                let key = if raw.starts_with("0x") {
                    raw
                } else {
                    format!("0x{raw}")
                };
                serde_json::json!({ "type": "hexKey", "key": key })
            }
        };

        let cosmos_signer_key = std::env::var("CELESTIA_SIGNER_KEY").unwrap_or_else(|_| {
            // Default hyp account key from testnet init
            "0x6e30efb1d3ebd30d1ba08c8d5fc9b190e08394009dc1dd787a69e60c33288a8c".to_string()
        });

        let mut chains = serde_json::Map::new();
        let mut relay_chain_names: Vec<String> = Vec::new();

        // Add EVM chains from state
        let mut chain_ids: Vec<u64> = state.chains.keys().copied().collect();
        chain_ids.sort();

        for chain_id in &chain_ids {
            let chain = &state.chains[chain_id];
            let hyp = chain.contracts.hyperlane.as_ref();

            let mailbox = hyp
                .and_then(|h| h.mailbox.as_deref())
                .unwrap_or("PLACEHOLDER");
            let merkle_tree_hook = hyp
                .and_then(|h| h.merkle_tree_hook.as_deref())
                .unwrap_or("PLACEHOLDER");
            let validator_announce = hyp
                .and_then(|h| h.validator_announce.as_deref())
                .unwrap_or("PLACEHOLDER");
            let igp = hyp.and_then(|h| h.igp.as_deref()).unwrap_or("PLACEHOLDER");

            let display_name = {
                let mut chars = chain.name.chars();
                match chars.next() {
                    None => chain.name.clone(),
                    Some(c) => c.to_uppercase().to_string() + chars.as_str(),
                }
            };

            let chain_obj = serde_json::json!({
                "blocks": {
                    "confirmations": 1,
                    "estimateBlockTime": 1,
                    "reorgPeriod": 0
                },
                "chainId": chain.chain_id,
                "displayName": display_name,
                "domainId": Self::hyperlane_domain_id(chain.chain_id),
                "isTestnet": true,
                "name": chain.name,
                "nativeToken": {
                    "decimals": 18,
                    "name": "Ether",
                    "symbol": "ETH"
                },
                "protocol": "ethereum",
                "rpcUrls": [{ "http": chain.rpc }],
                "signer": evm_signer.clone(),
                "mailbox": mailbox,
                "merkleTreeHook": merkle_tree_hook,
                "validatorAnnounce": validator_announce,
                "interchainGasPaymaster": igp
            });

            chains.insert(chain.name.clone(), chain_obj);
            relay_chain_names.push(chain.name.clone());
        }

        // Add Celestia chain (infrastructure only, not an EVM chain in state)
        let celestia_rpc = std::env::var("CELESTIA_RPC")
            .unwrap_or_else(|_| "http://celestia-validator:26657".to_string());
        let celestia_rest = std::env::var("CELESTIA_REST")
            .unwrap_or_else(|_| "http://celestia-validator:1317".to_string());
        let celestia_grpc = std::env::var("CELESTIA_GRPC")
            .unwrap_or_else(|_| "http://celestia-validator:9090".to_string());

        // Try to read Celestia Hyperlane addresses from the hyperlane-addresses.json
        let celestia_hyp = Self::read_celestia_hyperlane_addresses();

        let celestia_obj = serde_json::json!({
            "bech32Prefix": "celestia",
            "blocks": {
                "confirmations": 1,
                "estimateBlockTime": 6,
                "reorgPeriod": 1
            },
            "canonicalAsset": "utia",
            "chainId": "celestia-zkevm-testnet",
            "contractAddressBytes": 32,
            "displayName": "Celestia ZKEVM Testnet",
            "domainId": 69420,
            "gasPrice": {
                "denom": "utia",
                "amount": "0.1"
            },
            "index": {
                "from": 1,
                "chunk": 10
            },
            "isTestnet": true,
            "name": "celestiadev",
            "nativeToken": {
                "decimals": 6,
                "denom": "utia",
                "name": "TIA",
                "symbol": "TIA"
            },
            "protocol": "cosmosnative",
            "restUrls": [{ "http": celestia_rest }],
            "rpcUrls": [{ "http": celestia_rpc }],
            "grpcUrls": [{ "http": celestia_grpc }],
            "signer": {
                "type": "cosmosKey",
                "key": cosmos_signer_key,
                "prefix": "celestia"
            },
            "slip44": 118,
            "technicalStack": "other",
            "transactionOverrides": {
                "gasPrice": "0.0"
            },
            "interchainSecurityModule": celestia_hyp.get("interchainSecurityModule")
                .and_then(|v| v.as_str()).unwrap_or("PLACEHOLDER"),
            "mailbox": celestia_hyp.get("mailbox")
                .and_then(|v| v.as_str()).unwrap_or("PLACEHOLDER"),
            "interchainGasPaymaster": celestia_hyp.get("interchainGasPaymaster")
                .and_then(|v| v.as_str()).unwrap_or("PLACEHOLDER"),
            "merkleTreeHook": celestia_hyp.get("merkleTreeHook")
                .and_then(|v| v.as_str()).unwrap_or("PLACEHOLDER"),
            "validatorAnnounce": celestia_hyp.get("validatorAnnounce")
                .and_then(|v| v.as_str()).unwrap_or("PLACEHOLDER")
        });

        chains.insert("celestiadev".to_string(), celestia_obj);
        relay_chain_names.push("celestiadev".to_string());

        let config = serde_json::json!({
            "chains": chains,
            "defaultRpcConsensusType": "fallback",
            "relayChains": relay_chain_names.join(",")
        });

        serde_json::to_string_pretty(&config)
            .context("Failed to serialize Hyperlane relayer config")
    }

    /// Map EVM chain ID to Hyperlane domain ID.
    /// Domain IDs can differ from chain IDs to avoid conflicts with the Hyperlane agent's
    /// hardcoded KnownHyperlaneDomain enum (e.g. 31337 is hardcoded as "test4").
    /// Using domain 131337 for chain 31337 lets us keep the "anvil1" name.
    fn hyperlane_domain_id(chain_id: u64) -> u64 {
        match chain_id {
            31337 => 131337,
            _ => chain_id,
        }
    }

    /// Read Celestia Hyperlane addresses from the shared hyperlane-addresses.json
    fn read_celestia_hyperlane_addresses() -> serde_json::Map<String, serde_json::Value> {
        let path = std::path::Path::new(".config/hyperlane-addresses.json");
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(celestia) = value.get("celestiadev").and_then(|v| v.as_object()) {
                    return celestia.clone();
                }
            }
        }
        serde_json::Map::new()
    }

    /// Write Hyperlane relayer configuration to a file
    pub async fn write_hyperlane_relayer_config(state: &SolverState, path: &Path) -> Result<()> {
        let content = Self::generate_hyperlane_relayer_json(state)?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .await
                .context("Failed to create config directory")?;
        }

        fs::write(path, &content)
            .await
            .context("Failed to write Hyperlane relayer config file")?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::ConfigGenerator;
    use crate::state::{ChainConfig, ContractAddresses, SolverState};
    use std::collections::HashMap;

    fn sample_state() -> SolverState {
        let mut state = SolverState::default();
        state.solver.operator_address =
            Some("0x000000000000000000000000000000000000dEaD".to_string());

        state.chains.insert(
            3735928814,
            ChainConfig {
                name: "eden".to_string(),
                chain_id: 3735928814,
                rpc: "https://eden.example".to_string(),
                contracts: ContractAddresses {
                    oracle: Some("0x0000000000000000000000000000000000000001".to_string()),
                    output_settler_simple: Some(
                        "0x0000000000000000000000000000000000000002".to_string(),
                    ),
                    input_settler_escrow: Some(
                        "0x0000000000000000000000000000000000000003".to_string(),
                    ),
                    ..Default::default()
                },
                tokens: HashMap::new(),
                deployer: None,
            },
        );
        state.chains.insert(
            11155111,
            ChainConfig {
                name: "sepolia".to_string(),
                chain_id: 11155111,
                rpc: "https://sepolia.example".to_string(),
                contracts: ContractAddresses {
                    oracle: Some("0x0000000000000000000000000000000000000004".to_string()),
                    output_settler_simple: Some(
                        "0x0000000000000000000000000000000000000005".to_string(),
                    ),
                    input_settler_escrow: Some(
                        "0x0000000000000000000000000000000000000006".to_string(),
                    ),
                    ..Default::default()
                },
                tokens: HashMap::new(),
                deployer: None,
            },
        );

        state
    }

    #[test]
    fn oracle_config_is_slim() {
        let state = sample_state();
        let toml = ConfigGenerator::generate_oracle_toml(&state).expect("oracle config");

        // Slim format: references state.json, has signer, no chain data
        assert!(toml.contains("state_file = \"state.json\""));
        assert!(toml.contains("[signer]"));
        assert!(toml.contains("type = \"env\""));
        assert!(toml.contains("poll_interval_seconds = 3"));
        // Should NOT contain chain data (that comes from state.json now)
        assert!(!toml.contains("[[chains]]"));
        assert!(!toml.contains("oracle_address"));
    }
}
