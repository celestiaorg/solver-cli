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

/// Get optional environment variable
pub fn get_env(name: &str) -> Option<String> {
    env::var(name).ok()
}

/// Per-chain environment configuration
#[derive(Debug, Clone)]
pub struct ChainEnvConfig {
    pub name: String,
    pub rpc_url: String,
    pub private_key: String,
}

/// Environment configuration loaded from .env
/// Chains are configured with {CHAIN}_RPC and {CHAIN}_PK pattern
#[derive(Debug, Clone)]
pub struct EnvConfig {
    /// Chain configurations indexed by name
    pub chains: HashMap<String, ChainEnvConfig>,

    /// User private key (for intent submission)
    pub user_pk: Option<String>,
}

impl EnvConfig {
    /// Load configuration from environment
    /// Auto-detects chains by scanning env vars for the {NAME}_RPC + {NAME}_PK pattern
    pub fn from_env() -> Result<Self> {
        let mut chains = HashMap::new();

        // If CHAINS is set explicitly, use that list
        // Otherwise, scan all env vars for the {NAME}_RPC pattern
        let chain_names: Vec<String> = if let Ok(list) = env::var("CHAINS") {
            list.split(',')
                .map(|s| s.trim().to_lowercase())
                .filter(|s| !s.is_empty())
                .collect()
        } else {
            // Scan env vars for *_RPC and derive chain names
            env::vars()
                .filter_map(|(key, _)| key.strip_suffix("_RPC").map(|name| name.to_lowercase()))
                .collect()
        };

        for chain_name in &chain_names {
            let upper = chain_name.to_uppercase();
            let rpc_var = format!("{}_RPC", upper);
            let pk_var = format!("{}_PK", upper);

            if let (Ok(rpc), Ok(pk)) = (env::var(&rpc_var), env::var(&pk_var)) {
                if !rpc.is_empty() && !pk.is_empty() {
                    chains.insert(
                        chain_name.clone(),
                        ChainEnvConfig {
                            name: chain_name.clone(),
                            rpc_url: rpc,
                            private_key: pk,
                        },
                    );
                }
            }
        }

        Ok(Self {
            chains,
            user_pk: get_env("USER_PK"),
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

        if let (Ok(rpc), Ok(pk)) = (env::var(&rpc_var), env::var(&pk_var)) {
            if !rpc.is_empty() && !pk.is_empty() {
                return Some(ChainEnvConfig {
                    name: name.to_lowercase(),
                    rpc_url: rpc,
                    private_key: pk,
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

    /// Get solver private key (requires SOLVER_PRIVATE_KEY)
    pub fn get_solver_pk(&self) -> Result<String> {
        env::var("SOLVER_PRIVATE_KEY")
            .context("Missing required environment variable: SOLVER_PRIVATE_KEY")
    }
}

/// Solver signer configuration — mirrors the oracle-operator's SignerConfig.
///
/// Select the backend via SOLVER_SIGNER_TYPE in .env:
///   - "env" (default): reads SOLVER_PRIVATE_KEY
///   - "aws_kms": reads SOLVER_KMS_KEY_ID + SOLVER_KMS_REGION (+ optional SOLVER_KMS_ENDPOINT)
#[derive(Debug, Clone)]
pub enum SolverSignerConfig {
    /// Local private key read from SOLVER_PRIVATE_KEY env var (default)
    Env,
    /// AWS KMS signing — private key never leaves the HSM
    AwsKms {
        key_id: String,
        region: String,
        /// Optional custom endpoint, e.g. for LocalStack (SOLVER_KMS_ENDPOINT)
        endpoint: Option<String>,
    },
}

impl SolverSignerConfig {
    /// Load from SOLVER_SIGNER_TYPE (defaults to "env" if unset).
    pub fn from_env() -> Result<Self> {
        let signer_type = env::var("SOLVER_SIGNER_TYPE").unwrap_or_else(|_| "env".to_string());
        match signer_type.as_str() {
            "aws_kms" => {
                let key_id = env::var("SOLVER_KMS_KEY_ID")
                    .context("Missing required environment variable: SOLVER_KMS_KEY_ID")?;
                let region = env::var("SOLVER_KMS_REGION")
                    .context("Missing required environment variable: SOLVER_KMS_REGION")?;
                let endpoint = env::var("SOLVER_KMS_ENDPOINT").ok();
                Ok(Self::AwsKms { key_id, region, endpoint })
            }
            _ => Ok(Self::Env),
        }
    }
}

/// Rebalancer signer configuration.
///
/// Select the backend via REBALANCER_SIGNER_TYPE in .env:
///   - "env" (default): reads REBALANCER_PRIVATE_KEY (or per-chain REBALANCER_<CHAIN>_PK)
///   - "aws_kms": reads REBALANCER_KMS_KEY_ID + REBALANCER_KMS_REGION
#[derive(Debug, Clone)]
pub enum RebalancerSignerConfig {
    Env,
    AwsKms { key_id: String, region: String },
}

impl RebalancerSignerConfig {
    pub fn from_env() -> Result<Self> {
        let signer_type =
            env::var("REBALANCER_SIGNER_TYPE").unwrap_or_else(|_| "env".to_string());
        match signer_type.as_str() {
            "aws_kms" => {
                let key_id = env::var("REBALANCER_KMS_KEY_ID")
                    .context("Missing required environment variable: REBALANCER_KMS_KEY_ID")?;
                let region = env::var("REBALANCER_KMS_REGION")
                    .context("Missing required environment variable: REBALANCER_KMS_REGION")?;
                Ok(Self::AwsKms { key_id, region })
            }
            _ => Ok(Self::Env),
        }
    }
}

/// Oracle operator signer configuration.
///
/// Select the backend via ORACLE_SIGNER_TYPE in .env:
///   - "env" (default): reads ORACLE_OPERATOR_PK
///   - "aws_kms": reads ORACLE_KMS_KEY_ID + ORACLE_KMS_REGION (+ optional ORACLE_KMS_ENDPOINT)
#[derive(Debug, Clone)]
pub enum OracleSignerConfig {
    Env,
    AwsKms {
        key_id: String,
        region: String,
        endpoint: Option<String>,
    },
}

impl OracleSignerConfig {
    pub fn from_env() -> Result<Self> {
        let signer_type = env::var("ORACLE_SIGNER_TYPE").unwrap_or_else(|_| "env".to_string());
        match signer_type.as_str() {
            "aws_kms" => {
                let key_id = env::var("ORACLE_KMS_KEY_ID")
                    .context("Missing required environment variable: ORACLE_KMS_KEY_ID")?;
                let region = env::var("ORACLE_KMS_REGION")
                    .context("Missing required environment variable: ORACLE_KMS_REGION")?;
                let endpoint = env::var("ORACLE_KMS_ENDPOINT").ok();
                Ok(Self::AwsKms { key_id, region, endpoint })
            }
            _ => Ok(Self::Env),
        }
    }
}
