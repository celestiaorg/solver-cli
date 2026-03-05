use alloy::primitives::Address;
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::collections::HashSet;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct OracleConfig {
    /// Operator address (must match signer)
    pub operator_address: String,

    /// Operator signer configuration
    pub signer: SignerConfig,

    /// Chain configurations (array)
    pub chains: Vec<ChainConfig>,

    /// Polling interval in seconds
    pub poll_interval_seconds: u64,
}

#[derive(Debug, Clone)]
pub struct ChainConfig {
    /// Human-readable chain name
    pub name: String,

    /// Chain ID
    pub chain_id: u64,

    /// RPC URL
    pub rpc_url: String,

    /// CentralizedOracle contract address
    pub oracle_address: String,

    /// OutputSettlerSimple contract address (to watch for fills)
    pub output_settler_address: String,

    /// InputSettlerEscrow contract address (to query order status)
    pub input_settler_address: Option<String>,

    /// Block number to start watching from
    pub start_block: Option<u64>,
}

#[derive(Debug, Clone)]
pub enum SignerConfig {
    Env,
    File { key: String },
    AwsKms { key_id: String, region: String },
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawOracleConfig {
    operator_address: String,
    signer: Option<RawSignerConfig>,
    chains: Vec<RawChainConfig>,
    #[serde(default = "default_poll_interval")]
    poll_interval_seconds: u64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawChainConfig {
    name: String,
    chain_id: u64,
    rpc_url: String,
    oracle_address: String,
    output_settler_address: String,
    #[serde(default)]
    input_settler_address: Option<String>,
    #[serde(default)]
    start_block: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum RawSignerType {
    Env,
    File,
    AwsKms,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawSignerConfig {
    #[serde(rename = "type")]
    signer_type: RawSignerType,
    key: Option<String>,
    key_id: Option<String>,
    region: Option<String>,
    env_var: Option<String>,
}

fn default_poll_interval() -> u64 {
    3
}

impl OracleConfig {
    /// Load config from TOML file
    pub fn load(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read config file: {:?}", path))?;

        let raw: RawOracleConfig =
            toml::from_str(&content).context("Failed to parse config TOML")?;

        Self::from_raw(raw)
    }

    fn from_raw(raw: RawOracleConfig) -> Result<Self> {
        if raw.chains.is_empty() {
            bail!("Config must include at least one chain");
        }

        let signer = parse_signer_config(raw.signer)?;
        let _operator_address: Address = raw
            .operator_address
            .parse()
            .with_context(|| format!("Invalid operator_address: {}", raw.operator_address))?;

        let mut seen_chain_ids = HashSet::new();
        let mut seen_chain_names = HashSet::new();
        let mut chains = Vec::with_capacity(raw.chains.len());

        for chain in raw.chains {
            if chain.name.trim().is_empty() {
                bail!("chains.name cannot be empty");
            }
            if !seen_chain_ids.insert(chain.chain_id) {
                bail!("Duplicate chain_id in chains: {}", chain.chain_id);
            }
            if !seen_chain_names.insert(chain.name.to_ascii_lowercase()) {
                bail!("Duplicate chain name in chains: {}", chain.name);
            }

            let _rpc_url: reqwest::Url = chain.rpc_url.parse().with_context(|| {
                format!(
                    "Invalid rpc_url for chain {}: {}",
                    chain.name, chain.rpc_url
                )
            })?;
            let _oracle_address: Address = chain.oracle_address.parse().with_context(|| {
                format!(
                    "Invalid oracle_address for chain {}: {}",
                    chain.name, chain.oracle_address
                )
            })?;
            let _output_settler_address: Address =
                chain.output_settler_address.parse().with_context(|| {
                    format!(
                        "Invalid output_settler_address for chain {}: {}",
                        chain.name, chain.output_settler_address
                    )
                })?;
            if let Some(input_settler_address) = &chain.input_settler_address {
                let _input_settler_address: Address =
                    input_settler_address.parse().with_context(|| {
                        format!(
                            "Invalid input_settler_address for chain {}: {}",
                            chain.name, input_settler_address
                        )
                    })?;
            }

            chains.push(ChainConfig {
                name: chain.name,
                chain_id: chain.chain_id,
                rpc_url: chain.rpc_url,
                oracle_address: chain.oracle_address,
                output_settler_address: chain.output_settler_address,
                input_settler_address: chain.input_settler_address,
                start_block: chain.start_block,
            });
        }

        Ok(Self {
            operator_address: raw.operator_address,
            signer,
            chains,
            poll_interval_seconds: raw.poll_interval_seconds,
        })
    }
}

fn parse_signer_config(value: Option<RawSignerConfig>) -> Result<SignerConfig> {
    let Some(value) = value else {
        bail!("Missing signer");
    };

    let signer = match value.signer_type {
        RawSignerType::Env => {
            if value.env_var.is_some() {
                bail!("signer.env_var is not supported for type = \"env\"");
            }
            if value.key.is_some() || value.key_id.is_some() || value.region.is_some() {
                bail!("signer type = \"env\" only accepts field \"type\"");
            }
            SignerConfig::Env
        }
        RawSignerType::File => {
            if value.env_var.is_some() || value.key_id.is_some() || value.region.is_some() {
                bail!("signer type = \"file\" only accepts fields \"type\" and \"key\"");
            }
            let key = value
                .key
                .ok_or_else(|| anyhow::anyhow!("signer.key is required for type = \"file\""))?;
            if key.trim().is_empty() {
                bail!("signer.key cannot be empty for type = \"file\"");
            }
            SignerConfig::File { key }
        }
        RawSignerType::AwsKms => {
            if value.env_var.is_some() || value.key.is_some() {
                bail!(
                    "signer type = \"aws_kms\" only accepts fields \"type\", \"key_id\", and \"region\""
                );
            }
            let key_id = value.key_id.ok_or_else(|| {
                anyhow::anyhow!("signer.key_id is required for type = \"aws_kms\"")
            })?;
            let region = value.region.ok_or_else(|| {
                anyhow::anyhow!("signer.region is required for type = \"aws_kms\"")
            })?;
            if key_id.trim().is_empty() {
                bail!("signer.key_id cannot be empty for type = \"aws_kms\"");
            }
            if region.trim().is_empty() {
                bail!("signer.region cannot be empty for type = \"aws_kms\"");
            }
            SignerConfig::AwsKms { key_id, region }
        }
    };

    Ok(signer)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_valid_config_with_env_signer() {
        let toml = r#"
operator_address = "0x000000000000000000000000000000000000dEaD"
poll_interval_seconds = 3

[signer]
type = "env"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://ethereum-sepolia-rpc.publicnode.com"
oracle_address = "0x0000000000000000000000000000000000000001"
output_settler_address = "0x0000000000000000000000000000000000000002"
input_settler_address = "0x0000000000000000000000000000000000000003"
"#;

        let raw: RawOracleConfig = toml::from_str(toml).expect("valid TOML");
        let config = OracleConfig::from_raw(raw).expect("valid config");
        assert_eq!(config.chains.len(), 1);
        assert!(matches!(config.signer, SignerConfig::Env));
    }

    #[test]
    fn accepts_valid_config_with_file_signer() {
        let toml = r#"
operator_address = "0x000000000000000000000000000000000000dEaD"

[signer]
type = "file"
key = "0x1234"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://ethereum-sepolia-rpc.publicnode.com"
oracle_address = "0x0000000000000000000000000000000000000001"
output_settler_address = "0x0000000000000000000000000000000000000002"
"#;

        let raw: RawOracleConfig = toml::from_str(toml).expect("valid TOML");
        let config = OracleConfig::from_raw(raw).expect("valid config");
        assert!(matches!(config.signer, SignerConfig::File { .. }));
    }

    #[test]
    fn accepts_valid_config_with_aws_kms_signer() {
        let toml = r#"
operator_address = "0x000000000000000000000000000000000000dEaD"

[signer]
type = "aws_kms"
key_id = "alias/test-key"
region = "us-east-1"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://ethereum-sepolia-rpc.publicnode.com"
oracle_address = "0x0000000000000000000000000000000000000001"
output_settler_address = "0x0000000000000000000000000000000000000002"
"#;

        let raw: RawOracleConfig = toml::from_str(toml).expect("valid TOML");
        let config = OracleConfig::from_raw(raw).expect("valid config");
        assert!(matches!(config.signer, SignerConfig::AwsKms { .. }));
    }

    #[test]
    fn rejects_missing_signer() {
        let toml = r#"
operator_address = "0x000000000000000000000000000000000000dEaD"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://ethereum-sepolia-rpc.publicnode.com"
oracle_address = "0x0000000000000000000000000000000000000001"
output_settler_address = "0x0000000000000000000000000000000000000002"
"#;

        let raw: RawOracleConfig = toml::from_str(toml).expect("valid TOML");
        let err = OracleConfig::from_raw(raw).expect_err("expected error");
        assert!(err.to_string().contains("Missing signer"));
    }

    #[test]
    fn rejects_invalid_signer_field_combo() {
        let toml = r#"
operator_address = "0x000000000000000000000000000000000000dEaD"

[signer]
type = "env"
key = "0x1234"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://ethereum-sepolia-rpc.publicnode.com"
oracle_address = "0x0000000000000000000000000000000000000001"
output_settler_address = "0x0000000000000000000000000000000000000002"
"#;

        let raw: RawOracleConfig = toml::from_str(toml).expect("valid TOML");
        let err = OracleConfig::from_raw(raw).expect_err("expected error");
        assert!(err
            .to_string()
            .contains("signer type = \"env\" only accepts field \"type\""));
    }
}
