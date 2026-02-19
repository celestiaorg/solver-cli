use alloy::primitives::Address;
use anyhow::{Context, Result};
use std::collections::BTreeMap;
use std::path::Path;
use tokio::fs;

use crate::chain::ChainClient;
use crate::state::SolverState;

/// Generates rebalancer configuration files
pub struct RebalancerConfigGenerator;

impl RebalancerConfigGenerator {
    /// Generate rebalancer TOML configuration from state.
    /// Uses the solver account for all chains, and defaults to dry-run with
    /// equal per-asset weights across chains that support each asset.
    pub fn generate_toml(state: &SolverState) -> Result<String> {
        if state.chains.is_empty() {
            anyhow::bail!("No chains configured");
        }

        let mut chains: Vec<_> = state.chains.values().collect();
        chains.sort_by_key(|c| c.chain_id);

        let assets = collect_assets(state)?;
        if assets.is_empty() {
            anyhow::bail!(
                "No asset found on at least two chains; cannot generate rebalancer config"
            );
        }

        let account = derive_rebalancer_account(state)?;

        let mut chains_section = String::new();
        for chain in &chains {
            chains_section.push_str(&format!(
                r#"
[[chains]]
name = "{name}"
chain_id = {chain_id}
rpc_url = "{rpc_url}"
account = "{account}"
  [chains.signer]
  type = "env"
"#,
                name = chain.name,
                chain_id = chain.chain_id,
                rpc_url = chain.rpc,
                account = account,
            ));
        }

        let mut assets_section = String::new();
        for asset in &assets {
            assets_section.push_str(&format!(
                r#"
[[assets]]
symbol = "{symbol}"
decimals = {decimals}
"#,
                symbol = asset.symbol,
                decimals = asset.decimals,
            ));

            for token in &asset.tokens {
                assets_section.push_str(&format!(
                    r#"
  [[assets.tokens]]
  chain_id = {chain_id}
  address = "{address}"
"#,
                    chain_id = token.chain_id,
                    address = token.address
                ));
            }

            assets_section.push_str("\n  [assets.weights]\n");
            for (chain_id, weight) in &asset.weights {
                assets_section.push_str(&format!("  \"{}\" = {:.6}\n", chain_id, weight));
            }

            assets_section.push_str("\n  [assets.min_weights]\n");
            for (chain_id, min_weight) in &asset.min_weights {
                assets_section.push_str(&format!("  \"{}\" = {:.6}\n", chain_id, min_weight));
            }
        }

        let config = format!(
            r#"# Auto-generated rebalancer configuration
# DO NOT EDIT MANUALLY - regenerate with 'solver-cli configure'
# Supports {chain_count} chain(s)

poll_interval_seconds = 15
max_parallel_transfers = 2
dry_run = true

[execution]
min_transfer_bps = 50
max_transfer_bps = 5000

{chains_section}

{assets_section}

[hyperlane]
default_timeout_seconds = 1800
"#,
            chain_count = chains.len(),
            chains_section = chains_section.trim(),
            assets_section = assets_section.trim(),
        );

        Ok(config)
    }

    /// Write rebalancer configuration to a file
    pub async fn write_config(state: &SolverState, path: &Path) -> Result<()> {
        let content = Self::generate_toml(state)?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .await
                .context("Failed to create config directory")?;
        }

        fs::write(path, &content)
            .await
            .context("Failed to write rebalancer config file")?;

        Ok(())
    }
}

#[derive(Debug, Clone)]
struct RebalancerTokenEntry {
    chain_id: u64,
    address: String,
}

#[derive(Debug, Clone)]
struct RebalancerAsset {
    symbol: String,
    decimals: u8,
    tokens: Vec<RebalancerTokenEntry>,
    weights: Vec<(u64, f64)>,
    min_weights: Vec<(u64, f64)>,
}

fn collect_assets(state: &SolverState) -> Result<Vec<RebalancerAsset>> {
    let mut by_symbol: BTreeMap<String, Vec<(u64, String, u8)>> = BTreeMap::new();

    for (chain_id, chain) in &state.chains {
        for token in chain.tokens.values() {
            let normalized = token.symbol.to_ascii_uppercase();
            by_symbol.entry(normalized).or_default().push((
                *chain_id,
                token.address.clone(),
                token.decimals,
            ));
        }
    }

    let mut assets = Vec::new();
    for (symbol, mut entries) in by_symbol {
        if entries.len() < 2 {
            continue;
        }

        entries.sort_by_key(|(chain_id, _, _)| *chain_id);
        let expected_decimals = entries[0].2;
        if entries
            .iter()
            .any(|(_, _, decimals)| *decimals != expected_decimals)
        {
            anyhow::bail!(
                "Token {} has inconsistent decimals across chains, cannot generate rebalancer config",
                symbol
            );
        }

        let chain_ids: Vec<u64> = entries.iter().map(|(chain_id, _, _)| *chain_id).collect();
        let weights = equal_weight_distribution(&chain_ids, 1_000_000);
        let min_weights: Vec<(u64, f64)> = weights
            .iter()
            .map(|(chain_id, weight)| {
                (
                    *chain_id,
                    (weight * 0.8 * 1_000_000.0).floor() / 1_000_000.0,
                )
            })
            .collect();

        assets.push(RebalancerAsset {
            symbol,
            decimals: expected_decimals,
            tokens: entries
                .into_iter()
                .map(|(chain_id, address, _)| RebalancerTokenEntry { chain_id, address })
                .collect(),
            weights,
            min_weights,
        });
    }

    Ok(assets)
}

fn equal_weight_distribution(chain_ids: &[u64], precision: u64) -> Vec<(u64, f64)> {
    let count = chain_ids.len() as u64;
    let base = precision / count;
    let remainder = precision % count;

    chain_ids
        .iter()
        .enumerate()
        .map(|(idx, chain_id)| {
            let units = if (idx as u64) < remainder {
                base + 1
            } else {
                base
            };
            (*chain_id, units as f64 / precision as f64)
        })
        .collect()
}

fn derive_rebalancer_account(state: &SolverState) -> Result<String> {
    if let Some(address) = state.solver.address.as_deref() {
        return normalize_address(address).context("Invalid solver.address in state");
    }

    let fallback_pk = std::env::var("SOLVER_PRIVATE_KEY")
        .or_else(|_| std::env::var("SEPOLIA_PK"))
        .map_err(|_| {
            anyhow::anyhow!(
                "Missing solver address in state and no fallback key found (SOLVER_PRIVATE_KEY / SEPOLIA_PK)"
            )
        })?;
    let address = ChainClient::address_from_pk(&fallback_pk)
        .context("Invalid SOLVER_PRIVATE_KEY/SEPOLIA_PK for rebalancer account derivation")?;
    Ok(format!("{:?}", address))
}

fn normalize_address(value: &str) -> Result<String> {
    let address: Address = value.parse()?;
    Ok(format!("{:?}", address))
}
