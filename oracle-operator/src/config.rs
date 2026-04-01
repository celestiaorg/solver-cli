use alloy::primitives::Address;
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::path::Path;

// ── Public config types (consumed by operator & signer modules) ────────────

#[derive(Debug, Clone)]
pub struct OracleConfig {
    /// Operator address (must match signer)
    pub operator_address: String,

    /// Operator signer configuration
    pub signer: SignerConfig,

    /// Chain configurations
    pub chains: Vec<ChainConfig>,

    /// Polling interval in seconds
    pub poll_interval_seconds: u64,
}

#[derive(Debug, Clone)]
pub struct ChainConfig {
    pub name: String,
    pub chain_id: u64,
    pub rpc_url: String,
    pub oracle_address: String,
    pub output_settler_address: String,
    pub input_settler_address: Option<String>,
    pub start_block: Option<u64>,
}

#[derive(Debug, Clone)]
pub enum SignerConfig {
    Env,
    File { key: String },
    AwsKms { key_id: String, region: String },
}

// ── TOML config (service-specific settings only) ───────────────────────────

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawConfig {
    /// Path to state.json (default: .config/state.json)
    #[serde(default = "default_state_file")]
    state_file: String,

    #[serde(default = "default_poll_interval")]
    poll_interval_seconds: u64,

    signer: Option<RawSignerConfig>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawSignerConfig {
    #[serde(rename = "type")]
    signer_type: String,
    key: Option<String>,
    key_id: Option<String>,
    region: Option<String>,
}

fn default_state_file() -> String {
    ".config/state.json".to_string()
}

fn default_poll_interval() -> u64 {
    3
}

// ── Minimal state.json deserialization ──────────────────────────────────────

#[derive(Deserialize)]
struct StateJson {
    chains: HashMap<u64, StateChain>,
    solver: StateSolver,
}

#[derive(Deserialize)]
struct StateSolver {
    operator_address: Option<String>,
}

#[derive(Deserialize)]
struct StateChain {
    name: String,
    chain_id: u64,
    rpc: String,
    contracts: StateContracts,
}

#[derive(Deserialize)]
struct StateContracts {
    #[serde(default)]
    input_settler_escrow: Option<String>,
    #[serde(default)]
    output_settler_simple: Option<String>,
    #[serde(default)]
    oracle: Option<String>,
}

// ── Config loading ─────────────────────────────────────────────────────────

impl OracleConfig {
    /// Load from a slim TOML file that references state.json for chain data.
    ///
    /// Example oracle.toml:
    /// ```toml
    /// state_file = ".config/state.json"
    /// poll_interval_seconds = 3
    ///
    /// [signer]
    /// type = "env"
    /// ```
    pub fn load(path: &Path) -> Result<Self> {
        let toml_content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read config file: {}", path.display()))?;
        let raw: RawConfig =
            toml::from_str(&toml_content).context("Failed to parse oracle config TOML")?;

        // Resolve state_file relative to the TOML file's directory
        let config_dir = path.parent().unwrap_or(Path::new("."));
        let state_path = config_dir.join(&raw.state_file);

        let state_content = std::fs::read_to_string(&state_path).with_context(|| {
            format!(
                "Failed to read state file: {} (referenced from {})",
                state_path.display(),
                path.display()
            )
        })?;
        let state: StateJson =
            serde_json::from_str(&state_content).context("Failed to parse state.json")?;

        if state.chains.is_empty() {
            bail!("state.json contains no chains");
        }

        // Operator address from state
        let operator_address = state.solver.operator_address.ok_or_else(|| {
            anyhow::anyhow!(
                "Missing solver.operator_address in state.json. \
                 Run 'solver-cli configure' first."
            )
        })?;
        let _: Address = operator_address.parse().with_context(|| {
            format!(
                "Invalid operator_address in state.json: {}",
                operator_address
            )
        })?;

        // Signer from TOML
        let signer = parse_signer_config(raw.signer)?;

        // Build chain configs from state
        let mut seen_chain_ids = HashSet::new();
        let mut seen_chain_names = HashSet::new();
        let mut chains = Vec::with_capacity(state.chains.len());

        let mut sorted_chains: Vec<_> = state.chains.values().collect();
        sorted_chains.sort_by_key(|c| c.chain_id);

        for chain in sorted_chains {
            if !seen_chain_ids.insert(chain.chain_id) {
                bail!("Duplicate chain_id in state.json: {}", chain.chain_id);
            }
            if !seen_chain_names.insert(chain.name.to_ascii_lowercase()) {
                bail!("Duplicate chain name in state.json: {}", chain.name);
            }

            let oracle_address = chain.contracts.oracle.as_deref().ok_or_else(|| {
                anyhow::anyhow!("Chain {} missing oracle contract address", chain.name)
            })?;
            let output_settler_address = chain
                .contracts
                .output_settler_simple
                .as_deref()
                .ok_or_else(|| {
                    anyhow::anyhow!(
                        "Chain {} missing output_settler_simple contract address",
                        chain.name
                    )
                })?;

            // Validate addresses
            let _: Address = oracle_address.parse().with_context(|| {
                format!(
                    "Invalid oracle_address for chain {}: {}",
                    chain.name, oracle_address
                )
            })?;
            let _: Address = output_settler_address.parse().with_context(|| {
                format!(
                    "Invalid output_settler_address for chain {}: {}",
                    chain.name, output_settler_address
                )
            })?;
            if let Some(input) = &chain.contracts.input_settler_escrow {
                let _: Address = input.parse().with_context(|| {
                    format!(
                        "Invalid input_settler_address for chain {}: {}",
                        chain.name, input
                    )
                })?;
            }

            chains.push(ChainConfig {
                name: chain.name.clone(),
                chain_id: chain.chain_id,
                rpc_url: chain.rpc.clone(),
                oracle_address: oracle_address.to_string(),
                output_settler_address: output_settler_address.to_string(),
                input_settler_address: chain.contracts.input_settler_escrow.clone(),
                start_block: None,
            });
        }

        Ok(Self {
            operator_address,
            signer,
            chains,
            poll_interval_seconds: raw.poll_interval_seconds,
        })
    }
}

fn parse_signer_config(value: Option<RawSignerConfig>) -> Result<SignerConfig> {
    let Some(value) = value else {
        bail!("Missing [signer] section in oracle config");
    };

    match value.signer_type.as_str() {
        "env" => {
            if value.key.is_some() || value.key_id.is_some() || value.region.is_some() {
                bail!("signer type = \"env\" only accepts field \"type\"");
            }
            Ok(SignerConfig::Env)
        }
        "file" => {
            let key = value
                .key
                .ok_or_else(|| anyhow::anyhow!("signer.key is required for type = \"file\""))?;
            if key.trim().is_empty() {
                bail!("signer.key cannot be empty for type = \"file\"");
            }
            Ok(SignerConfig::File { key })
        }
        "aws_kms" => {
            let key_id = value.key_id.ok_or_else(|| {
                anyhow::anyhow!("signer.key_id is required for type = \"aws_kms\"")
            })?;
            let region = value.region.ok_or_else(|| {
                anyhow::anyhow!("signer.region is required for type = \"aws_kms\"")
            })?;
            if key_id.trim().is_empty() || region.trim().is_empty() {
                bail!("signer.key_id and signer.region cannot be empty");
            }
            Ok(SignerConfig::AwsKms { key_id, region })
        }
        other => bail!(
            "Unknown signer type: {} (expected env, file, or aws_kms)",
            other
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Helper: write state.json and oracle.toml to a temp dir, return the toml path.
    fn setup_config(
        state_json: &str,
        oracle_toml: &str,
    ) -> (tempfile::TempDir, std::path::PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("state.json"), state_json).unwrap();
        let toml_path = dir.path().join("oracle.toml");
        fs::write(&toml_path, oracle_toml).unwrap();
        (dir, toml_path)
    }

    fn sample_state() -> String {
        serde_json::json!({
            "env": "local",
            "chains": {
                "11155111": {
                    "name": "sepolia",
                    "chain_id": 11155111,
                    "rpc": "https://ethereum-sepolia-rpc.publicnode.com",
                    "contracts": {
                        "input_settler_escrow": "0x0000000000000000000000000000000000000003",
                        "output_settler_simple": "0x0000000000000000000000000000000000000002",
                        "oracle": "0x0000000000000000000000000000000000000001"
                    },
                    "tokens": {},
                    "deployer": null
                }
            },
            "solver": {
                "operator_address": "0x000000000000000000000000000000000000dEaD",
                "private_key_ref": "env",
                "configured": false
            },
            "users": {},
            "last_updated": "2025-01-01T00:00:00Z"
        })
        .to_string()
    }

    #[test]
    fn loads_slim_config() {
        let toml = r#"
state_file = "state.json"
poll_interval_seconds = 5

[signer]
type = "env"
"#;
        let (_dir, path) = setup_config(&sample_state(), toml);
        let config = OracleConfig::load(&path).expect("valid config");
        assert_eq!(config.chains.len(), 1);
        assert_eq!(config.chains[0].name, "sepolia");
        assert_eq!(config.poll_interval_seconds, 5);
        assert!(matches!(config.signer, SignerConfig::Env));
        assert_eq!(
            config.operator_address,
            "0x000000000000000000000000000000000000dEaD"
        );
    }

    #[test]
    fn uses_defaults() {
        let toml = r#"
state_file = "state.json"

[signer]
type = "env"
"#;
        let (_dir, path) = setup_config(&sample_state(), toml);
        let config = OracleConfig::load(&path).expect("valid config");
        assert_eq!(config.poll_interval_seconds, 3);
    }

    #[test]
    fn accepts_aws_kms_signer() {
        let toml = r#"
state_file = "state.json"

[signer]
type = "aws_kms"
key_id = "alias/test-key"
region = "us-east-1"
"#;
        let (_dir, path) = setup_config(&sample_state(), toml);
        let config = OracleConfig::load(&path).expect("valid config");
        assert!(matches!(config.signer, SignerConfig::AwsKms { .. }));
    }

    #[test]
    fn rejects_missing_signer() {
        let toml = r#"
state_file = "state.json"
"#;
        let (_dir, path) = setup_config(&sample_state(), toml);
        let err = OracleConfig::load(&path).expect_err("should fail");
        assert!(err.to_string().contains("Missing [signer]"));
    }

    #[test]
    fn rejects_missing_operator_address() {
        let state = serde_json::json!({
            "env": "local",
            "chains": {
                "11155111": {
                    "name": "sepolia", "chain_id": 11155111,
                    "rpc": "https://rpc.example.com",
                    "contracts": {
                        "oracle": "0x0000000000000000000000000000000000000001",
                        "output_settler_simple": "0x0000000000000000000000000000000000000002"
                    },
                    "tokens": {}, "deployer": null
                }
            },
            "solver": { "operator_address": null, "private_key_ref": "env", "configured": false },
            "users": {}, "last_updated": "2025-01-01T00:00:00Z"
        })
        .to_string();

        let toml = "state_file = \"state.json\"\n\n[signer]\ntype = \"env\"\n";
        let (_dir, path) = setup_config(&state, toml);
        let err = OracleConfig::load(&path).expect_err("should fail");
        assert!(err.to_string().contains("operator_address"));
    }

    #[test]
    fn rejects_missing_oracle_contract() {
        let state = serde_json::json!({
            "env": "local",
            "chains": {
                "11155111": {
                    "name": "sepolia", "chain_id": 11155111,
                    "rpc": "https://rpc.example.com",
                    "contracts": {
                        "output_settler_simple": "0x0000000000000000000000000000000000000002"
                    },
                    "tokens": {}, "deployer": null
                }
            },
            "solver": {
                "operator_address": "0x000000000000000000000000000000000000dEaD",
                "private_key_ref": "env", "configured": false
            },
            "users": {}, "last_updated": "2025-01-01T00:00:00Z"
        })
        .to_string();

        let toml = "state_file = \"state.json\"\n\n[signer]\ntype = \"env\"\n";
        let (_dir, path) = setup_config(&state, toml);
        let err = OracleConfig::load(&path).expect_err("should fail");
        assert!(err.to_string().contains("oracle contract"));
    }
}
