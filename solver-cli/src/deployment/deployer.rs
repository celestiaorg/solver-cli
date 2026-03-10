#![allow(clippy::too_many_arguments)]

use anyhow::{Context, Result};
use std::path::Path;
use tracing::info;

use crate::chain::ChainClient;
use crate::state::{ChainConfig, ContractAddresses, HyperlaneAddresses, SolverState, TokenInfo};
use crate::utils::ChainEnvConfig;

use super::forge::ForgeRunner;

/// Handles contract deployment to multiple chains
pub struct Deployer {
    forge: ForgeRunner,
}

impl Deployer {
    pub fn new(contracts_path: &Path) -> Self {
        Self {
            forge: ForgeRunner::new(contracts_path),
        }
    }

    /// Deploy OIF infrastructure contracts to a chain.
    /// Token addresses are read from Hyperlane deployment artifacts separately.
    pub async fn deploy_to_chain(
        &self,
        chain_name: &str,
        rpc_url: &str,
        private_key: &str,
        operator_address: Option<&str>,
    ) -> Result<ChainConfig> {
        info!("Deploying OIF infra to {} at {}", chain_name, rpc_url);

        // Get chain ID
        let client = ChainClient::new(chain_name, rpc_url).await?;
        let chain_id = client.chain_id;
        let deployer = ChainClient::address_from_pk(private_key)?;

        info!("Chain ID: {}, Deployer: {}", chain_id, deployer);

        // Deploy OIF contracts (oracle, settlers) — no token
        let deployment = self
            .forge
            .deploy(rpc_url, private_key, operator_address)
            .await
            .context("Contract deployment failed")?;

        // Build chain config
        let contracts = ContractAddresses {
            input_settler_escrow: deployment.input_settler().cloned(),
            output_settler_simple: deployment.output_settler().cloned(),
            oracle: deployment.oracle().cloned(),
            permit2: deployment.permit2().cloned(),
            hyperlane: None,
        };

        Ok(ChainConfig {
            name: chain_name.to_string(),
            chain_id,
            rpc: rpc_url.to_string(),
            contracts,
            tokens: std::collections::HashMap::new(),
            deployer: Some(format!("{:?}", deployer)),
        })
    }

    /// Build contracts without deploying
    pub async fn build(&self) -> Result<()> {
        self.forge.build().await
    }

    /// Deploy OIF contracts to all specified chains and update state.
    /// After deploying infra, reads token addresses from Hyperlane artifacts.
    pub async fn deploy_to_chains(
        &self,
        state: &mut SolverState,
        chain_configs: &[&ChainEnvConfig],
        token_symbol: &str,
        token_decimals: u8,
        skip_build: bool,
    ) -> Result<()> {
        if chain_configs.is_empty() {
            anyhow::bail!("No chains to deploy to");
        }

        // Build first (unless skipped)
        if !skip_build {
            self.build().await?;
        }

        // Derive operator address from ORACLE_SIGNER_TYPE (env key or AWS KMS).
        let operator_address = match crate::utils::OracleSignerConfig::from_env()? {
            crate::utils::OracleSignerConfig::AwsKms {
                key_id,
                region,
                endpoint,
            } => {
                use alloy::signers::aws::AwsSigner;
                use alloy::signers::Signer;
                use aws_sdk_kms::config::Region;
                let mut loader = aws_config::defaults(aws_config::BehaviorVersion::latest())
                    .region(Region::new(region));
                if let Some(ep) = endpoint {
                    loader = loader.endpoint_url(ep);
                }
                let sdk_config = loader.load().await;
                let client = aws_sdk_kms::Client::new(&sdk_config);
                let signer = AwsSigner::new(client, key_id, None)
                    .await
                    .map_err(|e| anyhow::anyhow!("Oracle KMS initialization failed: {e}"))?;
                format!("{:?}", Signer::address(&signer))
            }
            crate::utils::OracleSignerConfig::Env => {
                let operator_pk = std::env::var("ORACLE_OPERATOR_PK")
                    .context("Missing required environment variable: ORACLE_OPERATOR_PK")?;
                format!("{:?}", ChainClient::address_from_pk(&operator_pk)?)
            }
        };
        info!("Using operator address: {}", operator_address);

        // Try to load Hyperlane deployment artifacts
        let hyperlane_addresses = Self::load_hyperlane_addresses().ok();
        if hyperlane_addresses.is_some() {
            info!("Found Hyperlane deployment artifacts — will use warp route token addresses");
        } else {
            info!(
                "No Hyperlane artifacts found — tokens must be added manually or via mock deploy"
            );
        }

        // Deploy to each chain
        for chain_env in chain_configs {
            info!("Deploying OIF infra to chain: {}", chain_env.name);
            let mut chain_config = self
                .deploy_to_chain(
                    &chain_env.name,
                    &chain_env.rpc_url,
                    &chain_env.private_key,
                    Some(&operator_address),
                )
                .await?;

            // Populate token addresses from Hyperlane artifacts if available
            if let Some(ref hyp_addrs) = hyperlane_addresses {
                Self::populate_tokens_from_hyperlane(
                    &mut chain_config,
                    hyp_addrs,
                    token_symbol,
                    token_decimals,
                );
            }

            // Insert into state by chain_id
            state.chains.insert(chain_config.chain_id, chain_config);
        }

        // Store operator address in solver config
        state.solver.operator_address = Some(operator_address);

        // Compute deployment version hash
        state.deployment_version = Some(compute_deployment_hash(state));

        Ok(())
    }

    /// Load Hyperlane deployment addresses from .config/hyperlane-addresses.json
    fn load_hyperlane_addresses() -> Result<serde_json::Value> {
        let path = std::path::Path::new(".config/hyperlane-addresses.json");
        let content = std::fs::read_to_string(path)
            .context("Failed to read .config/hyperlane-addresses.json")?;
        let value: serde_json::Value =
            serde_json::from_str(&content).context("Failed to parse hyperlane-addresses.json")?;
        Ok(value)
    }

    /// Populate token and Hyperlane addresses from the deployment artifacts
    fn populate_tokens_from_hyperlane(
        chain_config: &mut ChainConfig,
        hyp_addrs: &serde_json::Value,
        token_symbol: &str,
        token_decimals: u8,
    ) {
        let chain_name = chain_config.name.to_lowercase();

        // Look up this chain in the Hyperlane addresses
        if let Some(chain_data) = hyp_addrs.get(&chain_name) {
            // Determine which address to use as the solver's token:
            // - On anvil1 (collateral chain): use the underlying MockERC20 address
            // - On anvil2 (synthetic chain): use the HypSynthetic warp token address
            let token_address = if let Some(mock_usdc) = chain_data.get("mock_usdc") {
                // Collateral chain — solver interacts with the underlying ERC20
                mock_usdc.as_str().map(|s| s.to_string())
            } else {
                // Synthetic chain — solver interacts with the HypSynthetic token
                chain_data
                    .get("warp_token")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            };

            if let Some(addr) = token_address {
                chain_config.tokens.insert(
                    token_symbol.to_string(),
                    TokenInfo {
                        address: addr,
                        symbol: token_symbol.to_string(),
                        decimals: token_decimals,
                        token_type: "erc20".to_string(),
                    },
                );
                info!(
                    "  Token {} on {}: {}",
                    token_symbol,
                    chain_config.name,
                    chain_config.tokens.get(token_symbol).unwrap().address
                );
            }

            // Store Hyperlane contract addresses
            let hyperlane = HyperlaneAddresses {
                mailbox: chain_data
                    .get("mailbox")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                merkle_tree_hook: chain_data
                    .get("merkle_tree_hook")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                validator_announce: chain_data
                    .get("validator_announce")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                igp: None,
                warp_token: chain_data
                    .get("warp_token")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                warp_token_type: chain_data
                    .get("warp_token_type")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            };
            chain_config.contracts.hyperlane = Some(hyperlane);
        }
    }
}

/// Compute a hash of the deployment for version tracking
fn compute_deployment_hash(state: &SolverState) -> String {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();

    // Sort chain IDs for deterministic hashing
    let mut chain_ids: Vec<u64> = state.chains.keys().copied().collect();
    chain_ids.sort();

    for chain_id in chain_ids {
        if let Some(chain) = state.chains.get(&chain_id) {
            hasher.update(chain.chain_id.to_le_bytes());
            if let Some(addr) = &chain.contracts.input_settler_escrow {
                hasher.update(addr.as_bytes());
            }
        }
    }

    let result = hasher.finalize();
    hex::encode(&result[..8])
}
