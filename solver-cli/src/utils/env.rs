#![allow(dead_code)]

use anyhow::{Context, Result};
use std::collections::HashMap;
use std::env;
use std::path::Path;

/// Load environment from .env file
pub fn load_dotenv(project_dir: &Path) -> Result<()> {
    let env_path = project_dir.join(".env");
    if env_path.exists() {
        dotenvy::from_path(&env_path).context("Failed to load .env file")?;
    }
    Ok(())
}

/// Get required environment variable
pub fn require_env(name: &str) -> Result<String> {
    env::var(name).with_context(|| format!("Missing required environment variable: {}", name))
}

/// Get optional environment variable
pub fn get_env(name: &str) -> Option<String> {
    env::var(name).ok()
}

/// Get environment variable with default
pub fn get_env_or(name: &str, default: &str) -> String {
    env::var(name).unwrap_or_else(|_| default.to_string())
}

/// Check all required environment variables
pub fn check_required_vars(vars: &[&str]) -> Result<()> {
    let mut missing = vec![];
    for var in vars {
        if env::var(var).is_err() {
            missing.push(*var);
        }
    }

    if !missing.is_empty() {
        anyhow::bail!(
            "Missing required environment variables: {}",
            missing.join(", ")
        );
    }

    Ok(())
}

/// Per-chain environment configuration
#[derive(Debug, Clone)]
pub struct ChainEnvConfig {
    pub name: String,
    pub rpc_url: String,
    pub private_key: String,
    pub chain_id: Option<u64>,
}

/// Environment configuration loaded from .env
/// Chains are configured with {CHAIN}_RPC and {CHAIN}_PK pattern
#[derive(Debug, Clone)]
pub struct EnvConfig {
    /// Chain configurations indexed by name
    pub chains: HashMap<String, ChainEnvConfig>,

    /// User private key (for intent submission)
    pub user_pk: Option<String>,

    /// Default token symbol
    pub token_symbol: String,

    /// Default transfer amount
    pub transfer_amount: String,

    // Common chain fields for convenience
    pub evolve_rpc: String,
    pub sepolia_rpc: String,
    pub evolve_pk: String,
    pub sepolia_pk: String,
}

/// Known chain names to auto-detect from environment
const KNOWN_CHAINS: &[&str] = &[
    "evolve", "sepolia", "arbitrum", "optimism", "base", "polygon",
];

impl EnvConfig {
    /// Load configuration from environment
    /// Auto-detects chains based on {CHAIN}_RPC + {CHAIN}_PK pattern
    pub fn from_env() -> Result<Self> {
        let mut chains = HashMap::new();

        // Auto-detect known chains from environment
        for &chain_name in KNOWN_CHAINS {
            let upper = chain_name.to_uppercase();
            let rpc_var = format!("{}_RPC", upper);
            let pk_var = format!("{}_PK", upper);
            let chain_id_var = format!("{}_CHAIN_ID", upper);

            if let (Ok(rpc), Ok(pk)) = (env::var(&rpc_var), env::var(&pk_var)) {
                if !rpc.is_empty() && !pk.is_empty() {
                    let chain_id = env::var(&chain_id_var).ok().and_then(|s| s.parse().ok());
                    chains.insert(
                        chain_name.to_lowercase(),
                        ChainEnvConfig {
                            name: chain_name.to_lowercase(),
                            rpc_url: rpc,
                            private_key: pk,
                            chain_id,
                        },
                    );
                }
            }
        }

        let evolve_rpc = get_env("EVOLVE_RPC").unwrap_or_default();
        let sepolia_rpc = get_env("SEPOLIA_RPC").unwrap_or_default();
        let evolve_pk = get_env("EVOLVE_PK").unwrap_or_default();
        let sepolia_pk = get_env("SEPOLIA_PK").unwrap_or_default();

        Ok(Self {
            chains,
            user_pk: get_env("USER_PK"),
            token_symbol: get_env_or("TOKEN_SYMBOL", "USDC"),
            transfer_amount: get_env_or("TRANSFER_AMOUNT", "1000000"),
            evolve_rpc,
            sepolia_rpc,
            evolve_pk,
            sepolia_pk,
        })
    }

    /// Try to load a chain by name even if not in KNOWN_CHAINS
    /// This allows the --chains CLI arg to work with any chain
    pub fn load_chain(&self, name: &str) -> Option<ChainEnvConfig> {
        // First check if already loaded
        if let Some(chain) = self.chains.get(&name.to_lowercase()) {
            return Some(chain.clone());
        }

        // Try to load from environment
        let upper = name.to_uppercase();
        let rpc_var = format!("{}_RPC", upper);
        let pk_var = format!("{}_PK", upper);
        let chain_id_var = format!("{}_CHAIN_ID", upper);

        if let (Ok(rpc), Ok(pk)) = (env::var(&rpc_var), env::var(&pk_var)) {
            if !rpc.is_empty() && !pk.is_empty() {
                let chain_id = env::var(&chain_id_var).ok().and_then(|s| s.parse().ok());
                return Some(ChainEnvConfig {
                    name: name.to_lowercase(),
                    rpc_url: rpc,
                    private_key: pk,
                    chain_id,
                });
            }
        }

        None
    }

    /// Get chain configuration by name (case-insensitive)
    pub fn get_chain(&self, name: &str) -> Option<&ChainEnvConfig> {
        self.chains.get(&name.to_lowercase())
    }

    /// Get all chain names
    pub fn chain_names(&self) -> Vec<String> {
        self.chains.keys().cloned().collect()
    }

    /// Get solver private key (SOLVER_PRIVATE_KEY or SEPOLIA_PK)
    pub fn get_solver_pk(&self) -> Result<String> {
        env::var("SOLVER_PRIVATE_KEY")
            .or_else(|_| env::var("SEPOLIA_PK"))
            .context("SOLVER_PRIVATE_KEY or SEPOLIA_PK must be set")
    }

    /// Get oracle operator private key (ORACLE_OPERATOR_PK or SEPOLIA_PK)
    pub fn get_operator_pk(&self) -> Result<String> {
        env::var("ORACLE_OPERATOR_PK")
            .or_else(|_| env::var("SEPOLIA_PK"))
            .context("ORACLE_OPERATOR_PK or SEPOLIA_PK must be set")
    }

    /// Get any available private key (for fallback purposes)
    pub fn get_any_pk(&self) -> Option<String> {
        // Priority: SOLVER_PRIVATE_KEY > SEPOLIA_PK > first chain's PK
        env::var("SOLVER_PRIVATE_KEY")
            .or_else(|_| env::var("SEPOLIA_PK"))
            .ok()
            .or_else(|| self.chains.values().next().map(|c| c.private_key.clone()))
    }
}
