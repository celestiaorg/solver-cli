use anyhow::{Context, Result};
use std::collections::BTreeMap;
use std::path::Path;
use tokio::fs;

use crate::state::SolverState;

/// Read forwarding token_ids from hyperlane-addresses.json.
/// Returns a map of asset symbol → Celestia warp token ID.
fn load_forwarding_token_ids(config_dir: &Path) -> BTreeMap<String, String> {
    let path = config_dir.join("hyperlane-addresses.json");
    let Ok(data) = std::fs::read_to_string(&path) else {
        return BTreeMap::new();
    };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) else {
        return BTreeMap::new();
    };
    let mut result = BTreeMap::new();
    if let Some(tokens) = json
        .get("celestiadev")
        .and_then(|c| c.get("synthetic_tokens"))
        .and_then(|t| t.as_object())
    {
        for (symbol, id) in tokens {
            if let Some(id_str) = id.as_str() {
                result.insert(symbol.to_ascii_uppercase(), id_str.to_string());
            }
        }
    }
    // Fallback: single synthetic_token → map to all assets
    if result.is_empty() {
        if let Some(id) = json
            .get("celestiadev")
            .and_then(|c| c.get("synthetic_token"))
            .and_then(|t| t.as_str())
        {
            result.insert("*".to_string(), id.to_string());
        }
    }
    result
}

/// Generates slim rebalancer configuration (service settings only).
/// Chain/token/contract data is read from state.json at runtime by the rebalancer.
pub struct RebalancerConfigGenerator;

impl RebalancerConfigGenerator {
    pub fn generate_toml(state: &SolverState) -> Result<String> {
        Self::generate_toml_with_config_dir(state, Path::new(".config"))
    }

    pub fn generate_toml_with_config_dir(state: &SolverState, config_dir: &Path) -> Result<String> {
        if state.chains.is_empty() {
            anyhow::bail!("No chains configured");
        }

        // Verify at least one token exists on 2+ chains (so rebalancer has something to do)
        let has_multi_chain_token = {
            let mut by_symbol: BTreeMap<String, usize> = BTreeMap::new();
            for chain in state.chains.values() {
                for token in chain.tokens.values() {
                    *by_symbol
                        .entry(token.symbol.to_ascii_uppercase())
                        .or_default() += 1;
                }
            }
            by_symbol.values().any(|&count| count >= 2)
        };
        if !has_multi_chain_token {
            anyhow::bail!(
                "No asset found on at least two chains; cannot generate rebalancer config"
            );
        }

        let forwarding_service_url = std::env::var("FORWARDING_BACKEND")
            .unwrap_or_else(|_| "http://127.0.0.1:8080".to_string());
        let _: reqwest::Url = forwarding_service_url
            .parse()
            .context("Invalid FORWARDING_BACKEND URL")?;
        let forwarding_domain_id: u64 = match std::env::var("CELESTIA_DOMAIN") {
            Ok(raw) => raw
                .parse::<u64>()
                .with_context(|| format!("Invalid CELESTIA_DOMAIN value: {}", raw))?,
            Err(_) => 69420u64,
        };

        // Load per-asset Celestia warp token IDs from hyperlane deployment
        let forwarding_token_ids = load_forwarding_token_ids(config_dir);
        let mut token_ids_section = String::new();
        for (symbol, id) in &forwarding_token_ids {
            if symbol == "*" {
                // Wildcard: the rebalancer's asset collection will use this for all assets.
                // We write it as a known symbol if there's only one asset.
                for chain in state.chains.values() {
                    for token in chain.tokens.values() {
                        let sym = token.symbol.to_ascii_uppercase();
                        if !token_ids_section.contains(&sym) {
                            token_ids_section.push_str(&format!("{} = \"{}\"\n", sym, id));
                        }
                    }
                }
            } else {
                token_ids_section.push_str(&format!("{} = \"{}\"\n", symbol, id));
            }
        }

        let signer_section = match crate::utils::RebalancerSignerConfig::from_env()? {
            crate::utils::RebalancerSignerConfig::AwsKms { key_id, region } => {
                format!(
                    "[signer]\ntype = \"aws_kms\"\nkey_id = \"{key_id}\"\nregion = \"{region}\""
                )
            }
            crate::utils::RebalancerSignerConfig::Env => "[signer]\ntype = \"env\"".to_string(),
        };

        let config = format!(
            r#"# Auto-generated rebalancer configuration
# Chain/token data is read from state.json at startup.

state_file = "state.json"
poll_interval_seconds = 30
max_parallel_transfers = 2
dry_run = false

[forwarding]
domain_id = {forwarding_domain_id}
service_url = "{forwarding_service_url}"

[forwarding.token_ids]
{token_ids_section}
[execution]
min_transfer_bps = 50
max_transfer_bps = 5000

{signer_section}
"#,
            forwarding_domain_id = forwarding_domain_id,
            forwarding_service_url = forwarding_service_url,
            token_ids_section = token_ids_section.trim(),
            signer_section = signer_section,
        );

        Ok(config)
    }

    /// Write rebalancer configuration to a file
    pub async fn write_config(state: &SolverState, path: &Path) -> Result<()> {
        let content = Self::generate_toml(state)?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .await
                .context("Failed to create config directory")?;
        }

        fs::write(path, &content)
            .await
            .context("Failed to write rebalancer config file")?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{
        ChainConfig, ContractAddresses, HyperlaneAddresses, SolverState, TokenInfo,
    };
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn sample_state() -> SolverState {
        let mut state = SolverState::default();
        state.solver.address = Some("0xd5e85e86fc692cedad6d6992f1f0ccf273e39913".to_string());

        let chain_one = ChainConfig {
            name: "anvil1".to_string(),
            chain_id: 31337,
            rpc: "http://127.0.0.1:8545".to_string(),
            contracts: ContractAddresses {
                input_settler_escrow: Some(
                    "0x0000000000000000000000000000000000000101".to_string(),
                ),
                output_settler_simple: Some(
                    "0x0000000000000000000000000000000000000102".to_string(),
                ),
                oracle: Some("0x0000000000000000000000000000000000000103".to_string()),
                hyperlane: Some(HyperlaneAddresses {
                    domain_id: None,
                    mailbox: None,
                    merkle_tree_hook: None,
                    validator_announce: None,
                    igp: None,
                    warp_token: None,
                    warp_token_type: None,
                }),
            },
            tokens: HashMap::from([(
                "USDC".to_string(),
                TokenInfo {
                    address: "0x0000000000000000000000000000000000001111".to_string(),
                    symbol: "USDC".to_string(),
                    decimals: 6,
                    token_type: "erc20".to_string(),
                },
            )]),
            deployer: None,
        };

        let chain_two = ChainConfig {
            name: "anvil2".to_string(),
            chain_id: 31338,
            rpc: "http://127.0.0.1:8546".to_string(),
            contracts: ContractAddresses {
                input_settler_escrow: Some(
                    "0x0000000000000000000000000000000000000201".to_string(),
                ),
                output_settler_simple: Some(
                    "0x0000000000000000000000000000000000000202".to_string(),
                ),
                oracle: Some("0x0000000000000000000000000000000000000203".to_string()),
                hyperlane: Some(HyperlaneAddresses {
                    domain_id: None,
                    mailbox: None,
                    merkle_tree_hook: None,
                    validator_announce: None,
                    igp: None,
                    warp_token: None,
                    warp_token_type: None,
                }),
            },
            tokens: HashMap::from([(
                "USDC".to_string(),
                TokenInfo {
                    address: "0x0000000000000000000000000000000000002222".to_string(),
                    symbol: "USDC".to_string(),
                    decimals: 6,
                    token_type: "erc20".to_string(),
                },
            )]),
            deployer: None,
        };

        state.chains.insert(chain_one.chain_id, chain_one);
        state.chains.insert(chain_two.chain_id, chain_two);
        state
    }

    #[test]
    fn generate_toml_includes_forwarding_defaults() {
        let _guard = env_lock().lock().unwrap();
        std::env::remove_var("FORWARDING_BACKEND");
        std::env::remove_var("CELESTIA_DOMAIN");

        let toml = RebalancerConfigGenerator::generate_toml(&sample_state()).unwrap();

        assert!(toml.contains("state_file = \"state.json\""));
        assert!(toml.contains("[forwarding]"));
        assert!(toml.contains("domain_id = 69420"));
        assert!(toml.contains("service_url = \"http://127.0.0.1:8080\""));
        assert!(toml.contains("[signer]"));
        // Should NOT contain chain/token data (that comes from state.json now)
        assert!(!toml.contains("[[chains]]"));
        assert!(!toml.contains("[[assets]]"));
    }

    #[test]
    fn generate_toml_uses_forwarding_env_values() {
        let _guard = env_lock().lock().unwrap();
        std::env::set_var("FORWARDING_BACKEND", "https://forwarding.example");
        std::env::set_var("CELESTIA_DOMAIN", "77777");

        let toml = RebalancerConfigGenerator::generate_toml(&sample_state()).unwrap();

        assert!(toml.contains("domain_id = 77777"));
        assert!(toml.contains("service_url = \"https://forwarding.example\""));

        std::env::remove_var("FORWARDING_BACKEND");
        std::env::remove_var("CELESTIA_DOMAIN");
    }
}
