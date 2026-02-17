#![allow(dead_code)]
#![allow(clippy::too_many_arguments)]

use anyhow::{Context, Result};
use std::path::Path;
use tracing::info;

use crate::chain::ChainClient;
use crate::state::{ChainConfig, ContractAddresses, SolverState, TokenInfo};
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

    /// Deploy contracts to a chain
    pub async fn deploy_to_chain(
        &self,
        chain_name: &str,
        rpc_url: &str,
        private_key: &str,
        token_symbol: &str,
        token_decimals: u8,
        operator_address: Option<&str>,
    ) -> Result<ChainConfig> {
        info!("Deploying to {} at {}", chain_name, rpc_url);

        // Get chain ID
        let client = ChainClient::new(chain_name, rpc_url).await?;
        let chain_id = client.chain_id;
        let deployer = ChainClient::address_from_pk(private_key)?;

        info!("Chain ID: {}, Deployer: {}", chain_id, deployer);

        // Deploy contracts
        let deployment = self
            .forge
            .deploy(
                rpc_url,
                private_key,
                &format!("Mock {}", token_symbol),
                token_symbol,
                token_decimals,
                operator_address,
            )
            .await
            .context("Contract deployment failed")?;

        // Build chain config
        let contracts = ContractAddresses {
            input_settler_escrow: deployment.input_settler().cloned(),
            output_settler_simple: deployment.output_settler().cloned(),
            oracle: deployment.oracle().cloned(),
            permit2: deployment.permit2().cloned(),
        };

        let mut tokens = std::collections::HashMap::new();
        if let Some(token_addr) = deployment.token() {
            tokens.insert(
                token_symbol.to_string(),
                TokenInfo {
                    address: token_addr.clone(),
                    symbol: token_symbol.to_string(),
                    decimals: token_decimals,
                    token_type: "erc20".to_string(),
                },
            );
        }

        Ok(ChainConfig {
            name: chain_name.to_string(),
            chain_id,
            rpc: rpc_url.to_string(),
            contracts,
            tokens,
            deployer: Some(format!("{:?}", deployer)),
        })
    }

    /// Check if contracts are already deployed
    pub async fn check_deployment(&self, config: &ChainConfig) -> Result<bool> {
        if !config.contracts.is_complete() {
            return Ok(false);
        }

        // TODO: Optionally verify bytecode matches
        Ok(true)
    }

    /// Build contracts without deploying
    pub async fn build(&self) -> Result<()> {
        self.forge.build().await
    }

    /// Deploy to all specified chains and update state
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

        // Derive operator address from ORACLE_OPERATOR_PK
        let operator_pk = std::env::var("ORACLE_OPERATOR_PK")
            .or_else(|_| std::env::var("SEPOLIA_PK"))
            .context("ORACLE_OPERATOR_PK or SEPOLIA_PK must be set")?;
        let operator_address = format!("{:?}", ChainClient::address_from_pk(&operator_pk)?);
        info!(
            "Using operator address: {} (derived from ORACLE_OPERATOR_PK)",
            operator_address
        );

        // Deploy to each chain
        for chain_env in chain_configs {
            info!("Deploying to chain: {}", chain_env.name);
            let chain_config = self
                .deploy_to_chain(
                    &chain_env.name,
                    &chain_env.rpc_url,
                    &chain_env.private_key,
                    token_symbol,
                    token_decimals,
                    Some(&operator_address),
                )
                .await?;

            // Insert into state by chain_id
            state.chains.insert(chain_config.chain_id, chain_config);
        }

        // Store operator address in solver config
        state.solver.operator_address = Some(operator_address);

        // Compute deployment version hash
        state.deployment_version = Some(compute_deployment_hash(state));

        Ok(())
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
