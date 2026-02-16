#![allow(dead_code)]

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// The main state file structure
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SolverState {
    /// Environment identifier (local, sepolia, mainnet)
    pub env: Environment,

    /// Chain configurations
    pub chains: ChainConfigs,

    /// Solver configuration
    pub solver: SolverConfig,

    /// User addresses
    pub users: HashMap<String, String>,

    /// Deployment version hash (for bytecode tracking)
    pub deployment_version: Option<String>,

    /// Last state update timestamp
    pub last_updated: DateTime<Utc>,

    /// Active intents
    #[serde(default)]
    pub intents: Vec<IntentRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    #[default]
    Local,
    Sepolia,
    Mainnet,
}

impl std::fmt::Display for Environment {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Environment::Local => write!(f, "local"),
            Environment::Sepolia => write!(f, "sepolia"),
            Environment::Mainnet => write!(f, "mainnet"),
        }
    }
}

impl std::str::FromStr for Environment {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "local" => Ok(Environment::Local),
            "sepolia" => Ok(Environment::Sepolia),
            "mainnet" => Ok(Environment::Mainnet),
            _ => anyhow::bail!("Unknown environment: {}", s),
        }
    }
}

/// Chain configurations indexed by chain ID
/// Supports any number of EVM chains
pub type ChainConfigs = HashMap<u64, ChainConfig>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    /// Human-readable name
    pub name: String,

    /// Chain ID
    pub chain_id: u64,

    /// RPC endpoint
    pub rpc: String,

    /// Deployed contract addresses
    pub contracts: ContractAddresses,

    /// Token addresses on this chain
    pub tokens: HashMap<String, TokenInfo>,

    /// Deployer address used
    pub deployer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ContractAddresses {
    /// Input settler / escrow contract
    pub input_settler_escrow: Option<String>,

    /// Output settler simple contract
    pub output_settler_simple: Option<String>,

    /// Oracle contract
    pub oracle: Option<String>,
}

impl ContractAddresses {
    pub fn is_complete(&self) -> bool {
        self.input_settler_escrow.is_some()
            && self.output_settler_simple.is_some()
            && self.oracle.is_some()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    /// Token contract address
    pub address: String,

    /// Token symbol
    pub symbol: String,

    /// Token decimals
    pub decimals: u8,

    /// Token type (erc20, native)
    #[serde(default = "default_token_type")]
    pub token_type: String,
}

fn default_token_type() -> String {
    "erc20".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SolverConfig {
    /// Solver address
    pub address: Option<String>,

    /// Operator address (used for CentralizedOracle)
    pub operator_address: Option<String>,

    /// Reference to private key (never stored raw)
    pub private_key_ref: PrivateKeyRef,

    /// Whether solver is configured
    pub configured: bool,

    /// Solver ID
    pub solver_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum PrivateKeyRef {
    #[default]
    Env,
    File(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentRecord {
    /// Intent ID
    pub id: String,

    /// Transaction hash
    pub tx_hash: String,

    /// Source chain ID
    pub source_chain_id: u64,

    /// Destination chain ID
    pub dest_chain_id: u64,

    /// Token symbol
    pub token: String,

    /// Amount in base units
    pub amount: String,

    /// User address
    pub user: String,

    /// Intent status
    pub status: IntentStatus,

    /// Timestamp
    pub created_at: DateTime<Utc>,

    /// Fulfillment tx hash (if fulfilled)
    pub fulfillment_tx: Option<String>,

    /// Settlement tx hash (if settled)
    pub settlement_tx: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum IntentStatus {
    Pending,
    Executing,
    Fulfilled,
    Settled,
    Failed,
}

impl std::fmt::Display for IntentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IntentStatus::Pending => write!(f, "pending"),
            IntentStatus::Executing => write!(f, "executing"),
            IntentStatus::Fulfilled => write!(f, "fulfilled"),
            IntentStatus::Settled => write!(f, "settled"),
            IntentStatus::Failed => write!(f, "failed"),
        }
    }
}

/// Token registry entry (from tokens.json)
/// Generic structure supporting any chain by name
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenRegistryEntry {
    pub decimals: u8,
    /// Chain-specific token info, keyed by chain name (e.g., "sepolia", "evolve")
    #[serde(flatten)]
    pub chains: HashMap<String, TokenChainInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenChainInfo {
    pub address: String,
    #[serde(rename = "type")]
    pub token_type: String,
}

/// Helper methods for working with chain configs
impl SolverState {
    /// Get all chain IDs
    pub fn chain_ids(&self) -> Vec<u64> {
        self.chains.keys().copied().collect()
    }

    /// Get a chain by ID
    pub fn get_chain(&self, chain_id: u64) -> Option<&ChainConfig> {
        self.chains.get(&chain_id)
    }

    /// Get a chain by name (case-insensitive)
    pub fn get_chain_by_name(&self, name: &str) -> Option<&ChainConfig> {
        self.chains
            .values()
            .find(|c| c.name.eq_ignore_ascii_case(name))
    }

    /// Check if all chains have complete contract deployments
    pub fn all_chains_deployed(&self) -> bool {
        !self.chains.is_empty() && self.chains.values().all(|c| c.contracts.is_complete())
    }

    /// Get routes between all chains (all-to-all)
    pub fn get_all_routes(&self) -> Vec<(u64, u64)> {
        let chain_ids: Vec<u64> = self.chain_ids();
        let mut routes = Vec::new();
        for &from in &chain_ids {
            for &to in &chain_ids {
                if from != to {
                    routes.push((from, to));
                }
            }
        }
        routes
    }
}
