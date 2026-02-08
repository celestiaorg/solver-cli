#![allow(dead_code)]
#![allow(clippy::too_many_arguments)]

use anyhow::{Context, Result};
use std::path::Path;
use tracing::info;

use crate::chain::ChainClient;
use crate::state::{ChainConfig, ContractAddresses, SolverState, TokenInfo};

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
            )
            .await
            .context("Contract deployment failed")?;

        // Build chain config
        let contracts = ContractAddresses {
            input_settler_escrow: deployment.input_settler().cloned(),
            output_settler_simple: deployment.output_settler().cloned(),
            oracle: deployment.oracle().cloned(),
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

    /// Deploy to both chains and update state
    pub async fn deploy_all(
        &self,
        state: &mut SolverState,
        source_rpc: &str,
        source_pk: &str,
        source_name: &str,
        dest_rpc: &str,
        dest_pk: &str,
        dest_name: &str,
        token_symbol: &str,
        token_decimals: u8,
        skip_build: bool,
    ) -> Result<()> {
        // Build first (unless skipped)
        if !skip_build {
            self.build().await?;
        }

        // Deploy to source chain
        let source_config = self
            .deploy_to_chain(
                source_name,
                source_rpc,
                source_pk,
                token_symbol,
                token_decimals,
            )
            .await?;

        // Deploy to destination chain
        let dest_config = self
            .deploy_to_chain(dest_name, dest_rpc, dest_pk, token_symbol, token_decimals)
            .await?;

        // Update state
        state.chains.source = Some(source_config);
        state.chains.destination = Some(dest_config);

        // Compute deployment version hash
        state.deployment_version = Some(compute_deployment_hash(state));

        Ok(())
    }
}

/// Compute a hash of the deployment for version tracking
fn compute_deployment_hash(state: &SolverState) -> String {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();

    if let Some(source) = &state.chains.source {
        hasher.update(source.chain_id.to_le_bytes());
        if let Some(addr) = &source.contracts.input_settler_escrow {
            hasher.update(addr.as_bytes());
        }
    }

    if let Some(dest) = &state.chains.destination {
        hasher.update(dest.chain_id.to_le_bytes());
        if let Some(addr) = &dest.contracts.input_settler_escrow {
            hasher.update(addr.as_bytes());
        }
    }

    let result = hasher.finalize();
    hex::encode(&result[..8])
}
