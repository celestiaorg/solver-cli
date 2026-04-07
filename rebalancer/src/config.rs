use alloy::primitives::Address;
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::Path;

/// (chain_id, token, optional warp_token_address) grouped by symbol.
type TokensBySymbol<'a> = BTreeMap<String, Vec<(u64, &'a StateToken, Option<String>)>>;

const WEIGHT_TOLERANCE: f64 = 1e-6;
const MIN_POLL_INTERVAL_SECONDS: u64 = 30;

// ── Public config types (consumed by service, planner, client) ─────────────

#[derive(Debug, Clone)]
pub struct RebalancerConfig {
    pub poll_interval_seconds: u64,
    pub max_parallel_transfers: usize,
    pub dry_run: bool,
    pub execution: ExecutionConfig,
    pub forwarding: ForwardingConfig,
    pub chains: Vec<ChainConfig>,
    pub assets: Vec<AssetConfig>,
}

#[derive(Debug, Clone)]
pub struct ExecutionConfig {
    pub min_transfer_bps: u16,
    pub max_transfer_bps: u16,
}

#[derive(Debug, Clone)]
pub struct ForwardingConfig {
    pub domain_id: u32,
    pub service_url: String,
    pub token_ids: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct ChainConfig {
    pub name: String,
    pub chain_id: u64,
    pub domain_id: u32,
    pub rpc_url: String,
    pub account_address: Address,
    pub signer: SignerConfig,
}

#[derive(Debug, Clone)]
pub enum SignerConfig {
    Env,
    File { key: String },
    AwsKms { key_id: String, region: String },
}

#[derive(Debug, Clone)]
pub struct AssetConfig {
    pub symbol: String,
    pub decimals: u8,
    pub tokens: HashMap<u64, AssetTokenConfig>,
    pub weights: HashMap<u64, f64>,
    pub min_weights: HashMap<u64, f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssetType {
    Erc20,
    Native,
}

#[derive(Debug, Clone, Copy)]
pub struct AssetTokenConfig {
    pub asset_type: AssetType,
    pub address: Option<Address>,
    pub collateral_token: Address,
}

// ── Slim TOML config (service-specific settings only) ──────────────────────

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawConfig {
    /// Path to state.json (default: state.json, resolved relative to TOML dir)
    #[serde(default = "default_state_file")]
    state_file: String,

    #[serde(default = "default_poll_interval_seconds")]
    poll_interval_seconds: u64,
    #[serde(default = "default_max_parallel_transfers")]
    max_parallel_transfers: usize,
    #[serde(default)]
    dry_run: bool,

    #[serde(default)]
    execution: RawExecutionConfig,
    forwarding: RawForwardingConfig,

    signer: Option<RawSignerConfig>,

    /// Optional per-asset weight overrides. If omitted, equal weights are computed.
    #[serde(default)]
    assets: HashMap<String, RawAssetOverride>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawForwardingConfig {
    domain_id: u64,
    service_url: String,
    #[serde(default)]
    token_ids: HashMap<String, String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(deny_unknown_fields)]
struct RawExecutionConfig {
    #[serde(default = "default_min_transfer_bps")]
    min_transfer_bps: u16,
    #[serde(default = "default_max_transfer_bps")]
    max_transfer_bps: u16,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
enum RawSignerConfig {
    Env,
    File { key: String },
    AwsKms { key_id: String, region: String },
}

/// Optional per-asset weight overrides in the TOML.
/// If present, weights/min_weights must be provided for all chains.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawAssetOverride {
    weights: Option<HashMap<String, f64>>,
    min_weights: Option<HashMap<String, f64>>,
}

fn default_state_file() -> String {
    "state.json".to_string()
}
fn default_poll_interval_seconds() -> u64 {
    MIN_POLL_INTERVAL_SECONDS
}
fn default_max_parallel_transfers() -> usize {
    2
}
fn default_min_transfer_bps() -> u16 {
    50
}
fn default_max_transfer_bps() -> u16 {
    5_000
}

// ── Minimal state.json deserialization ──────────────────────────────────────

#[derive(Deserialize)]
struct StateJson {
    chains: HashMap<u64, StateChain>,
    solver: StateSolver,
}

#[derive(Deserialize)]
struct StateSolver {
    address: Option<String>,
}

#[derive(Deserialize)]
struct StateChain {
    name: String,
    chain_id: u64,
    rpc: String,
    contracts: StateContracts,
    tokens: HashMap<String, StateToken>,
}

#[derive(Deserialize)]
struct StateContracts {
    #[serde(default)]
    hyperlane: Option<StateHyperlane>,
}

#[derive(Deserialize)]
struct StateHyperlane {
    domain_id: Option<u64>,
    warp_token: Option<String>,
}

#[derive(Deserialize)]
struct StateToken {
    address: String,
    symbol: String,
    decimals: u8,
}

// ── Config loading ─────────────────────────────────────────────────────────

impl RebalancerConfig {
    /// Load from a slim TOML that references state.json for chain/token data.
    ///
    /// Example rebalancer.toml:
    /// ```toml
    /// state_file = "state.json"
    /// poll_interval_seconds = 30
    /// dry_run = false
    ///
    /// [forwarding]
    /// domain_id = 69420
    /// service_url = "http://127.0.0.1:8080"
    ///
    /// [execution]
    /// min_transfer_bps = 50
    /// max_transfer_bps = 5000
    ///
    /// [signer]
    /// type = "env"
    /// ```
    pub fn load(path: &Path) -> Result<Self> {
        let toml_content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read config file: {}", path.display()))?;
        let raw: RawConfig =
            toml::from_str(&toml_content).context("Failed to parse rebalancer config TOML")?;

        // Resolve state_file relative to the TOML file's directory
        let config_dir = path.parent().unwrap_or(Path::new("."));
        let state_path = config_dir.join(&raw.state_file);

        let state_content = std::fs::read_to_string(&state_path).with_context(|| {
            format!(
                "Failed to read state file: {} (referenced from {})",
                state_path.display(),
                path.display()
            )
        })?;
        let state: StateJson =
            serde_json::from_str(&state_content).context("Failed to parse state.json")?;

        if state.chains.is_empty() {
            bail!("state.json contains no chains");
        }

        // Validate service-specific settings
        if raw.poll_interval_seconds < MIN_POLL_INTERVAL_SECONDS {
            bail!(
                "poll_interval_seconds must be >= {} (got {})",
                MIN_POLL_INTERVAL_SECONDS,
                raw.poll_interval_seconds
            );
        }
        if raw.execution.min_transfer_bps > 10_000 {
            bail!(
                "execution.min_transfer_bps must be <= 10000 (got {})",
                raw.execution.min_transfer_bps
            );
        }
        if raw.execution.max_transfer_bps > 10_000 {
            bail!(
                "execution.max_transfer_bps must be <= 10000 (got {})",
                raw.execution.max_transfer_bps
            );
        }
        if raw.execution.max_transfer_bps < raw.execution.min_transfer_bps {
            bail!(
                "execution.max_transfer_bps must be >= execution.min_transfer_bps ({} < {})",
                raw.execution.max_transfer_bps,
                raw.execution.min_transfer_bps
            );
        }

        // Forwarding config
        let forwarding_domain_id = u32::try_from(raw.forwarding.domain_id).with_context(|| {
            format!(
                "Invalid forwarding.domain_id: {} (must fit uint32)",
                raw.forwarding.domain_id
            )
        })?;
        let _: reqwest::Url = raw.forwarding.service_url.parse().with_context(|| {
            format!(
                "Invalid forwarding.service_url: {}",
                raw.forwarding.service_url
            )
        })?;
        let forwarding = ForwardingConfig {
            domain_id: forwarding_domain_id,
            service_url: raw.forwarding.service_url,
            token_ids: raw.forwarding.token_ids,
        };

        // Signer
        let signer = parse_signer_config(raw.signer)?;

        // Solver account address from state
        let account_str = state.solver.address.clone().ok_or_else(|| {
            anyhow::anyhow!(
                "Missing solver.address in state.json. Run 'solver-cli configure' first."
            )
        })?;
        let account_address: Address = account_str
            .parse()
            .with_context(|| format!("Invalid solver.address in state.json: {}", account_str))?;

        // Build chains from state
        let mut seen_chain_ids = HashSet::new();
        let mut seen_domain_ids = HashSet::new();
        let mut chains = Vec::with_capacity(state.chains.len());

        let mut sorted_chains: Vec<_> = state.chains.values().collect();
        sorted_chains.sort_by_key(|c| c.chain_id);

        for chain in &sorted_chains {
            if !seen_chain_ids.insert(chain.chain_id) {
                bail!("Duplicate chain_id in state.json: {}", chain.chain_id);
            }

            let raw_domain_id = chain
                .contracts
                .hyperlane
                .as_ref()
                .and_then(|h| h.domain_id)
                .unwrap_or_else(|| hyperlane_domain_id(chain.chain_id));
            let domain_id = u32::try_from(raw_domain_id).with_context(|| {
                format!(
                    "Invalid domain_id for chain {}: {} (must fit uint32)",
                    chain.name, raw_domain_id
                )
            })?;
            if !seen_domain_ids.insert(domain_id) {
                bail!("Duplicate domain_id: {}", domain_id);
            }

            chains.push(ChainConfig {
                name: chain.name.clone(),
                chain_id: chain.chain_id,
                domain_id,
                rpc_url: chain.rpc.clone(),
                account_address,
                signer: signer.clone(),
            });
        }

        // Collect assets from state (tokens present on 2+ chains)
        let assets = collect_assets(&state, &chains, &raw.assets)?;

        if assets.is_empty() {
            bail!("No asset found on at least two chains; cannot configure rebalancer");
        }

        Ok(Self {
            poll_interval_seconds: raw.poll_interval_seconds,
            max_parallel_transfers: raw.max_parallel_transfers,
            dry_run: raw.dry_run,
            execution: ExecutionConfig {
                min_transfer_bps: raw.execution.min_transfer_bps,
                max_transfer_bps: raw.execution.max_transfer_bps,
            },
            forwarding,
            chains,
            assets,
        })
    }

    pub fn chain_by_id(&self, chain_id: u64) -> Option<&ChainConfig> {
        self.chains.iter().find(|c| c.chain_id == chain_id)
    }
}

// ── Asset collection from state.json ───────────────────────────────────────

fn collect_assets(
    state: &StateJson,
    chains: &[ChainConfig],
    overrides: &HashMap<String, RawAssetOverride>,
) -> Result<Vec<AssetConfig>> {
    let chain_id_set: HashSet<u64> = chains.iter().map(|c| c.chain_id).collect();

    // Group tokens by symbol across chains
    let mut by_symbol: TokensBySymbol<'_> = BTreeMap::new();
    for (chain_id, chain) in &state.chains {
        let warp_token = chain
            .contracts
            .hyperlane
            .as_ref()
            .and_then(|h| h.warp_token.clone());
        for token in chain.tokens.values() {
            let normalized = token.symbol.to_ascii_uppercase();
            by_symbol
                .entry(normalized)
                .or_default()
                .push((*chain_id, token, warp_token.clone()));
        }
    }

    let mut assets = Vec::new();
    for (symbol, mut entries) in by_symbol {
        // Only include tokens present on 2+ chains
        if entries.len() < 2 {
            continue;
        }

        entries.sort_by_key(|(chain_id, _, _)| *chain_id);

        // Validate consistent decimals
        let expected_decimals = entries[0].1.decimals;
        if entries
            .iter()
            .any(|(_, t, _)| t.decimals != expected_decimals)
        {
            bail!("Token {} has inconsistent decimals across chains", symbol);
        }

        // Build token configs
        let mut token_configs: HashMap<u64, AssetTokenConfig> = HashMap::new();
        for (chain_id, token, warp_token) in &entries {
            if !chain_id_set.contains(chain_id) {
                continue;
            }
            let address: Address = token
                .address
                .parse()
                .with_context(|| format!("Invalid address for {} on chain {}", symbol, chain_id))?;
            let collateral_token = match warp_token {
                Some(wt) => wt
                    .parse()
                    .with_context(|| format!("Invalid warp_token for chain {}", chain_id))?,
                None => address,
            };
            token_configs.insert(
                *chain_id,
                AssetTokenConfig {
                    asset_type: AssetType::Erc20,
                    address: Some(address),
                    collateral_token,
                },
            );
        }

        if token_configs.len() < 2 {
            continue;
        }

        // Weights: use overrides from TOML if provided, otherwise equal distribution
        let relevant_chain_ids: Vec<u64> = token_configs.keys().copied().collect();
        let (weights, min_weights) = if let Some(ov) = overrides.get(&symbol) {
            let w = ov
                .weights
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("Asset override for {} missing weights", symbol))?;
            let mw = ov.min_weights.as_ref().ok_or_else(|| {
                anyhow::anyhow!("Asset override for {} missing min_weights", symbol)
            })?;
            (parse_weight_map(w)?, parse_weight_map(mw)?)
        } else {
            let w = equal_weight_distribution(&relevant_chain_ids, 1_000_000);
            let mw: HashMap<u64, f64> = w
                .iter()
                .map(|(&cid, &weight)| (cid, (weight * 0.8 * 1_000_000.0).floor() / 1_000_000.0))
                .collect();
            (w, mw)
        };

        // Validate weights
        if weights.len() < 2 {
            bail!("Asset {} must have weights for at least 2 chains", symbol);
        }
        let weight_sum: f64 = weights.values().sum();
        if (weight_sum - 1.0).abs() > WEIGHT_TOLERANCE {
            bail!(
                "weights for asset {} must sum to 1.0 (got {:.12})",
                symbol,
                weight_sum
            );
        }
        for (&chain_id, &target_weight) in &weights {
            if !chain_id_set.contains(&chain_id) {
                bail!(
                    "Asset {} references unknown chain {} in weights",
                    symbol,
                    chain_id
                );
            }
            if !(0.0..=1.0).contains(&target_weight) {
                bail!(
                    "Asset {} weight for chain {} out of range",
                    symbol,
                    chain_id
                );
            }
            let min_weight = min_weights.get(&chain_id).copied().ok_or_else(|| {
                anyhow::anyhow!("Asset {} missing min_weight for chain {}", symbol, chain_id)
            })?;
            if !(0.0..=1.0).contains(&min_weight) {
                bail!(
                    "Asset {} min_weight for chain {} out of range",
                    symbol,
                    chain_id
                );
            }
            if min_weight > target_weight {
                bail!(
                    "Asset {} min_weight > target_weight for chain {} ({} > {})",
                    symbol,
                    chain_id,
                    min_weight,
                    target_weight
                );
            }
        }
        for &chain_id in min_weights.keys() {
            if !weights.contains_key(&chain_id) {
                bail!(
                    "Asset {} has min_weight for chain {} without matching weight",
                    symbol,
                    chain_id
                );
            }
        }

        assets.push(AssetConfig {
            symbol,
            decimals: expected_decimals,
            tokens: token_configs,
            weights,
            min_weights,
        });
    }

    Ok(assets)
}

fn equal_weight_distribution(chain_ids: &[u64], precision: u64) -> HashMap<u64, f64> {
    let count = chain_ids.len() as u64;
    let base = precision / count;
    let remainder = precision % count;

    chain_ids
        .iter()
        .enumerate()
        .map(|(idx, &chain_id)| {
            let units = if (idx as u64) < remainder {
                base + 1
            } else {
                base
            };
            (chain_id, units as f64 / precision as f64)
        })
        .collect()
}

fn parse_weight_map(values: &HashMap<String, f64>) -> Result<HashMap<u64, f64>> {
    let mut parsed = HashMap::new();
    for (chain_id, weight) in values {
        let chain_id = chain_id
            .parse::<u64>()
            .with_context(|| format!("Invalid chain ID key in weight map: {}", chain_id))?;
        if parsed.insert(chain_id, *weight).is_some() {
            bail!("Duplicate chain {} in weight map", chain_id);
        }
    }
    Ok(parsed)
}

/// Map EVM chain ID to Hyperlane domain ID.
/// Domain IDs can differ from chain IDs to avoid conflicts with Hyperlane's
/// hardcoded KnownHyperlaneDomain enum (e.g. 31337 is hardcoded as "test4").
fn hyperlane_domain_id(chain_id: u64) -> u64 {
    match chain_id {
        31337 => 131337,
        _ => chain_id,
    }
}

fn parse_signer_config(value: Option<RawSignerConfig>) -> Result<SignerConfig> {
    let Some(value) = value else {
        bail!("Missing [signer] section in rebalancer config");
    };

    match value {
        RawSignerConfig::Env => Ok(SignerConfig::Env),
        RawSignerConfig::File { key } => {
            if key.trim().is_empty() {
                bail!("signer.key cannot be empty for type = \"file\"");
            }
            Ok(SignerConfig::File { key })
        }
        RawSignerConfig::AwsKms { key_id, region } => {
            if key_id.trim().is_empty() || region.trim().is_empty() {
                bail!("signer.key_id and signer.region cannot be empty");
            }
            Ok(SignerConfig::AwsKms { key_id, region })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_config(
        state_json: &str,
        rebalancer_toml: &str,
    ) -> (tempfile::TempDir, std::path::PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("state.json"), state_json).unwrap();
        let toml_path = dir.path().join("rebalancer.toml");
        fs::write(&toml_path, rebalancer_toml).unwrap();
        (dir, toml_path)
    }

    fn sample_state() -> String {
        serde_json::json!({
            "env": "local",
            "chains": {
                "31337": {
                    "name": "anvil1", "chain_id": 31337,
                    "rpc": "http://127.0.0.1:8545",
                    "contracts": {
                        "hyperlane": { "domain_id": 131337, "warp_token": "0x0000000000000000000000000000000000000A01" }
                    },
                    "tokens": {
                        "USDC": { "address": "0x0000000000000000000000000000000000001111", "symbol": "USDC", "decimals": 6 }
                    },
                    "deployer": null
                },
                "31338": {
                    "name": "anvil2", "chain_id": 31338,
                    "rpc": "http://127.0.0.1:8546",
                    "contracts": {
                        "hyperlane": { "domain_id": 31338, "warp_token": "0x0000000000000000000000000000000000000B01" }
                    },
                    "tokens": {
                        "USDC": { "address": "0x0000000000000000000000000000000000002222", "symbol": "USDC", "decimals": 6 }
                    },
                    "deployer": null
                }
            },
            "solver": {
                "address": "0x000000000000000000000000000000000000dEaD",
                "operator_address": null,
                "private_key_ref": "env",
                "configured": true
            },
            "users": {},
            "last_updated": "2025-01-01T00:00:00Z"
        })
        .to_string()
    }

    fn minimal_toml() -> &'static str {
        r#"
state_file = "state.json"
poll_interval_seconds = 30
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[signer]
type = "env"
"#
    }

    #[test]
    fn loads_slim_config() {
        let (_dir, path) = setup_config(&sample_state(), minimal_toml());
        let config = RebalancerConfig::load(&path).expect("valid config");
        assert_eq!(config.chains.len(), 2);
        assert_eq!(config.assets.len(), 1);
        assert_eq!(config.assets[0].symbol, "USDC");
        assert_eq!(config.forwarding.domain_id, 69420);
        assert!(config.dry_run);
        // Equal weights: 0.5 each
        let w = &config.assets[0].weights;
        assert!((w[&31337] - 0.5).abs() < 1e-6);
        assert!((w[&31338] - 0.5).abs() < 1e-6);
    }

    #[test]
    fn supports_custom_weights() {
        let toml = r#"
state_file = "state.json"
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[signer]
type = "env"

[assets.USDC]
weights = { "31337" = 0.7, "31338" = 0.3 }
min_weights = { "31337" = 0.5, "31338" = 0.2 }
"#;
        let (_dir, path) = setup_config(&sample_state(), toml);
        let config = RebalancerConfig::load(&path).expect("valid config");
        let w = &config.assets[0].weights;
        assert!((w[&31337] - 0.7).abs() < 1e-6);
        assert!((w[&31338] - 0.3).abs() < 1e-6);
    }

    #[test]
    fn rejects_poll_interval_below_minimum() {
        let toml = r#"
state_file = "state.json"
poll_interval_seconds = 10

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[signer]
type = "env"
"#;
        let (_dir, path) = setup_config(&sample_state(), toml);
        let err = RebalancerConfig::load(&path).expect_err("should fail");
        assert!(err.to_string().contains("poll_interval_seconds must be >="));
    }

    #[test]
    fn rejects_invalid_weight_sum() {
        let toml = r#"
state_file = "state.json"
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[signer]
type = "env"

[assets.USDC]
weights = { "31337" = 0.6, "31338" = 0.5 }
min_weights = { "31337" = 0.4, "31338" = 0.4 }
"#;
        let (_dir, path) = setup_config(&sample_state(), toml);
        let err = RebalancerConfig::load(&path).expect_err("should fail");
        assert!(err.to_string().contains("must sum to 1.0"));
    }

    #[test]
    fn rejects_missing_signer() {
        let toml = r#"
state_file = "state.json"
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"
"#;
        let (_dir, path) = setup_config(&sample_state(), toml);
        let err = RebalancerConfig::load(&path).expect_err("should fail");
        assert!(err.to_string().contains("Missing [signer]"));
    }

    #[test]
    fn rejects_invalid_transfer_bps_bounds() {
        let toml = r#"
state_file = "state.json"
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[execution]
min_transfer_bps = 6000
max_transfer_bps = 1000

[signer]
type = "env"
"#;
        let (_dir, path) = setup_config(&sample_state(), toml);
        let err = RebalancerConfig::load(&path).expect_err("should fail");
        assert!(err
            .to_string()
            .contains("max_transfer_bps must be >= execution.min_transfer_bps"));
    }
}
