use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OracleConfig {
    /// Operator private key (for signing attestations)
    pub operator_private_key: String,

    /// Operator address (derived from key)
    pub operator_address: String,

    /// Chain configurations (array)
    pub chains: Vec<ChainConfig>,

    /// Polling interval in seconds
    #[serde(default = "default_poll_interval")]
    pub poll_interval_seconds: u64,
}

fn default_poll_interval() -> u64 {
    3
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    /// Chain ID
    pub chain_id: u64,

    /// RPC URL
    pub rpc_url: String,

    /// CentralizedOracle contract address
    pub oracle_address: String,

    /// OutputSettlerSimple contract address (to watch for fills)
    pub output_settler_address: String,

    /// InputSettlerEscrow contract address (to query order status)
    #[serde(default)]
    pub input_settler_address: Option<String>,

    /// Block number to start watching from
    #[serde(default)]
    pub start_block: Option<u64>,
}

impl OracleConfig {
    /// Load config from TOML file
    pub fn load(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read config file: {:?}", path))?;

        let config: OracleConfig =
            toml::from_str(&content).context("Failed to parse config TOML")?;

        Ok(config)
    }
}
