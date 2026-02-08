#![allow(dead_code)]

use anyhow::{Context, Result};
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

/// Environment variables required for deployment
pub const REQUIRED_DEPLOY_VARS: &[&str] = &["EVOLVE_RPC", "SEPOLIA_RPC", "EVOLVE_PK", "SEPOLIA_PK"];

/// Environment variables required for transfers
pub const REQUIRED_TRANSFER_VARS: &[&str] = &["USER_PK"];

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

/// Environment configuration loaded from .env
#[derive(Debug, Clone)]
pub struct EnvConfig {
    pub evolve_rpc: String,
    pub sepolia_rpc: String,
    pub evolve_pk: String,
    pub sepolia_pk: String,
    pub user_pk: Option<String>,
    pub evolve_chain_id: Option<u64>,
    pub sepolia_chain_id: Option<u64>,
    pub token_symbol: String,
    pub transfer_amount: String,
}

impl EnvConfig {
    /// Load configuration from environment
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            evolve_rpc: require_env("EVOLVE_RPC")?,
            sepolia_rpc: require_env("SEPOLIA_RPC")?,
            evolve_pk: require_env("EVOLVE_PK")?,
            sepolia_pk: require_env("SEPOLIA_PK")?,
            user_pk: get_env("USER_PK"),
            evolve_chain_id: get_env("EVOLVE_CHAIN_ID").and_then(|s| s.parse().ok()),
            sepolia_chain_id: get_env("SEPOLIA_CHAIN_ID").and_then(|s| s.parse().ok()),
            token_symbol: get_env_or("TOKEN_SYMBOL", "USDC"),
            transfer_amount: get_env_or("TRANSFER_AMOUNT", "1000000"),
        })
    }
}
