use alloy::primitives::Address;
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::path::Path;

const WEIGHT_TOLERANCE: f64 = 1e-6;
const MIN_POLL_INTERVAL_SECONDS: u64 = 30;

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
    /// Maps asset symbol (e.g. "USDC") to the Celestia warp token ID used for forwarding.
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

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawRebalancerConfig {
    #[serde(default = "default_poll_interval_seconds")]
    poll_interval_seconds: u64,
    #[serde(default = "default_max_parallel_transfers")]
    max_parallel_transfers: usize,
    #[serde(default)]
    dry_run: bool,
    #[serde(default)]
    execution: RawExecutionConfig,
    forwarding: RawForwardingConfig,
    #[serde(default)]
    accounts: HashMap<String, String>,
    chains: Vec<RawChainConfig>,
    assets: Vec<RawAssetConfig>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawForwardingConfig {
    domain_id: u64,
    service_url: String,
    #[serde(default)]
    token_ids: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawChainConfig {
    name: String,
    chain_id: u64,
    domain_id: Option<u64>,
    rpc_url: String,
    account: String,
    signer: Option<RawSignerConfig>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawAssetConfig {
    symbol: String,
    decimals: u8,
    tokens: Vec<RawTokenConfig>,
    weights: HashMap<String, f64>,
    min_weights: HashMap<String, f64>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawTokenConfig {
    chain_id: u64,
    #[serde(rename = "type", default)]
    asset_type: RawAssetType,
    address: Option<String>,
    collateral_token: Option<String>,
}

#[derive(Debug, Deserialize, Clone, Copy, Default)]
#[serde(rename_all = "snake_case")]
enum RawAssetType {
    #[default]
    Erc20,
    Native,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawExecutionConfig {
    #[serde(default = "default_min_transfer_bps")]
    min_transfer_bps: u16,
    #[serde(default = "default_max_transfer_bps")]
    max_transfer_bps: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum RawSignerType {
    Env,
    File,
    AwsKms,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawSignerConfig {
    #[serde(rename = "type")]
    signer_type: RawSignerType,
    key: Option<String>,
    key_id: Option<String>,
    region: Option<String>,
    env_var: Option<String>,
}

impl Default for RawExecutionConfig {
    fn default() -> Self {
        Self {
            min_transfer_bps: default_min_transfer_bps(),
            max_transfer_bps: default_max_transfer_bps(),
        }
    }
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

impl RebalancerConfig {
    pub fn load(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read config file: {}", path.display()))?;
        let raw: RawRebalancerConfig =
            toml::from_str(&content).context("Failed to parse rebalancer config TOML")?;
        Self::from_raw(raw)
    }

    pub fn chain_by_id(&self, chain_id: u64) -> Option<&ChainConfig> {
        self.chains.iter().find(|c| c.chain_id == chain_id)
    }

    fn from_raw(raw: RawRebalancerConfig) -> Result<Self> {
        if raw.chains.is_empty() {
            bail!("Config must include at least one chain");
        }
        if raw.assets.is_empty() {
            bail!("Config must include at least one asset");
        }
        if raw.poll_interval_seconds < MIN_POLL_INTERVAL_SECONDS {
            bail!(
                "poll_interval_seconds must be >= {} (got {})",
                MIN_POLL_INTERVAL_SECONDS,
                raw.poll_interval_seconds
            );
        }
        let forwarding_domain_id = u32::try_from(raw.forwarding.domain_id).with_context(|| {
            format!(
                "Invalid forwarding.domain_id: {} (must fit uint32)",
                raw.forwarding.domain_id
            )
        })?;
        let _forwarding_url: reqwest::Url =
            raw.forwarding.service_url.parse().with_context(|| {
                format!(
                    "Invalid forwarding.service_url: {}",
                    raw.forwarding.service_url
                )
            })?;
        let forwarding = ForwardingConfig {
            domain_id: forwarding_domain_id,
            service_url: raw.forwarding.service_url.clone(),
            token_ids: raw.forwarding.token_ids.clone(),
        };

        let mut seen_chain_ids = HashSet::new();
        let mut seen_domain_ids = HashSet::new();
        let mut seen_chain_names = HashSet::new();
        let mut chains = Vec::with_capacity(raw.chains.len());
        let dry_run = raw.dry_run;

        for chain in raw.chains {
            if !seen_chain_ids.insert(chain.chain_id) {
                bail!("Duplicate chain_id in chains: {}", chain.chain_id);
            }

            let normalized_name = chain.name.to_ascii_lowercase();
            if !seen_chain_names.insert(normalized_name) {
                bail!("Duplicate chain name in chains: {}", chain.name);
            }

            let _rpc_url: reqwest::Url = chain.rpc_url.parse().with_context(|| {
                format!(
                    "Invalid rpc_url for chain {}: {}",
                    chain.name, chain.rpc_url
                )
            })?;

            let account_address = resolve_account_address(&chain.account, &raw.accounts)
                .with_context(|| format!("Failed to resolve account for chain {}", chain.name))?;
            let signer = parse_signer_config(chain.signer)
                .with_context(|| format!("Invalid signer config for chain {}", chain.name))?;
            let raw_domain_id = chain.domain_id.unwrap_or(chain.chain_id);
            let domain_id = u32::try_from(raw_domain_id).with_context(|| {
                format!(
                    "Invalid domain_id for chain {}: {} (must fit uint32)",
                    chain.name, raw_domain_id
                )
            })?;
            if !seen_domain_ids.insert(domain_id) {
                bail!("Duplicate domain_id in chains: {}", domain_id);
            }

            chains.push(ChainConfig {
                name: chain.name,
                chain_id: chain.chain_id,
                domain_id,
                rpc_url: chain.rpc_url,
                account_address,
                signer,
            });
        }

        let chain_id_set: HashSet<u64> = chains.iter().map(|c| c.chain_id).collect();
        let mut assets = Vec::with_capacity(raw.assets.len());

        for asset in raw.assets {
            if asset.symbol.trim().is_empty() {
                bail!("Asset symbol cannot be empty");
            }

            let weights = parse_weight_map(&asset.weights)
                .with_context(|| format!("Invalid weights for asset {}", asset.symbol))?;
            let min_weights = parse_weight_map(&asset.min_weights)
                .with_context(|| format!("Invalid min_weights for asset {}", asset.symbol))?;

            if weights.len() < 2 {
                bail!(
                    "Asset {} must define at least 2 chains in weights",
                    asset.symbol
                );
            }

            let weight_sum: f64 = weights.values().sum();
            if (weight_sum - 1.0).abs() > WEIGHT_TOLERANCE {
                bail!(
                    "weights for asset {} must sum to 1.0 (got {:.12})",
                    asset.symbol,
                    weight_sum
                );
            }

            for (&chain_id, &target_weight) in &weights {
                if !chain_id_set.contains(&chain_id) {
                    bail!(
                        "Asset {} references unknown chain {} in weights",
                        asset.symbol,
                        chain_id
                    );
                }

                if !(0.0..=1.0).contains(&target_weight) {
                    bail!(
                        "Asset {} target weight for chain {} must be between 0 and 1",
                        asset.symbol,
                        chain_id
                    );
                }

                let min_weight = min_weights.get(&chain_id).copied().ok_or_else(|| {
                    anyhow::anyhow!(
                        "Asset {} missing min_weight for chain {}",
                        asset.symbol,
                        chain_id
                    )
                })?;

                if !(0.0..=1.0).contains(&min_weight) {
                    bail!(
                        "Asset {} min_weight for chain {} must be between 0 and 1",
                        asset.symbol,
                        chain_id
                    );
                }

                if min_weight > target_weight {
                    bail!(
                        "Asset {} violates min_weight <= target_weight for chain {} ({} > {})",
                        asset.symbol,
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
                        asset.symbol,
                        chain_id
                    );
                }
            }

            let mut token_configs: HashMap<u64, AssetTokenConfig> = HashMap::new();
            for token in asset.tokens {
                if !chain_id_set.contains(&token.chain_id) {
                    bail!(
                        "Asset {} token entry references unknown chain {}",
                        asset.symbol,
                        token.chain_id
                    );
                }

                let parsed = match token.asset_type {
                    RawAssetType::Erc20 => {
                        let address_raw = token.address.ok_or_else(|| {
                            anyhow::anyhow!(
                                "Asset {} chain {} type=erc20 requires address",
                                asset.symbol,
                                token.chain_id
                            )
                        })?;
                        let address: Address = address_raw.parse().with_context(|| {
                            format!(
                                "Invalid address for asset {} chain {}: {}",
                                asset.symbol, token.chain_id, address_raw
                            )
                        })?;
                        if address.is_zero() {
                            bail!(
                                "Asset {} chain {} type=erc20 requires non-zero address",
                                asset.symbol,
                                token.chain_id
                            );
                        }

                        let collateral_token = match token.collateral_token {
                            Some(collateral_raw) => {
                                let parsed: Address =
                                    collateral_raw.parse().with_context(|| {
                                        format!(
                                            "Invalid collateral_token for asset {} chain {}: {}",
                                            asset.symbol, token.chain_id, collateral_raw
                                        )
                                    })?;
                                if parsed.is_zero() {
                                    bail!(
                                        "Asset {} chain {} requires non-zero collateral_token",
                                        asset.symbol,
                                        token.chain_id
                                    );
                                }
                                parsed
                            }
                            None => address,
                        };

                        AssetTokenConfig {
                            asset_type: AssetType::Erc20,
                            address: Some(address),
                            collateral_token,
                        }
                    }
                    RawAssetType::Native => {
                        if token.address.is_some() {
                            bail!(
                                "Asset {} chain {} type=native must omit address",
                                asset.symbol,
                                token.chain_id
                            );
                        }
                        let collateral_raw = token.collateral_token.ok_or_else(|| {
                            anyhow::anyhow!(
                                "Asset {} chain {} type=native requires collateral_token",
                                asset.symbol,
                                token.chain_id
                            )
                        })?;
                        let collateral_token: Address =
                            collateral_raw.parse().with_context(|| {
                                format!(
                                    "Invalid collateral_token for asset {} chain {}: {}",
                                    asset.symbol, token.chain_id, collateral_raw
                                )
                            })?;
                        if collateral_token.is_zero() {
                            bail!(
                                "Asset {} chain {} type=native requires non-zero collateral_token",
                                asset.symbol,
                                token.chain_id
                            );
                        }

                        AssetTokenConfig {
                            asset_type: AssetType::Native,
                            address: None,
                            collateral_token,
                        }
                    }
                };

                if token_configs.insert(token.chain_id, parsed).is_some() {
                    bail!(
                        "Duplicate token entry for asset {} chain {}",
                        asset.symbol,
                        token.chain_id
                    );
                }
            }

            for &chain_id in weights.keys() {
                if !token_configs.contains_key(&chain_id) {
                    bail!(
                        "Asset {} missing token config for weighted chain {}",
                        asset.symbol,
                        chain_id
                    );
                }
            }

            assets.push(AssetConfig {
                symbol: asset.symbol,
                decimals: asset.decimals,
                tokens: token_configs,
                weights,
                min_weights,
            });
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

        Ok(Self {
            poll_interval_seconds: raw.poll_interval_seconds,
            max_parallel_transfers: raw.max_parallel_transfers,
            dry_run,
            execution: ExecutionConfig {
                min_transfer_bps: raw.execution.min_transfer_bps,
                max_transfer_bps: raw.execution.max_transfer_bps,
            },
            forwarding,
            chains,
            assets,
        })
    }
}

fn parse_signer_config(value: Option<RawSignerConfig>) -> Result<SignerConfig> {
    let Some(value) = value else {
        bail!("Missing chains.signer");
    };

    let signer = match value.signer_type {
        RawSignerType::Env => {
            if value.env_var.is_some() {
                bail!("chains.signer.env_var is not supported for type = \"env\"");
            }
            if value.key.is_some() || value.key_id.is_some() || value.region.is_some() {
                bail!("chains.signer type = \"env\" only accepts field \"type\"");
            }
            SignerConfig::Env
        }
        RawSignerType::File => {
            if value.env_var.is_some() || value.key_id.is_some() || value.region.is_some() {
                bail!("chains.signer type = \"file\" only accepts fields \"type\" and \"key\"");
            }
            let key = value.key.ok_or_else(|| {
                anyhow::anyhow!("chains.signer.key is required for type = \"file\"")
            })?;
            if key.trim().is_empty() {
                bail!("chains.signer.key cannot be empty for type = \"file\"");
            }
            SignerConfig::File { key }
        }
        RawSignerType::AwsKms => {
            if value.env_var.is_some() || value.key.is_some() {
                bail!(
                    "chains.signer type = \"aws_kms\" only accepts fields \"type\", \"key_id\", and \"region\""
                );
            }
            let key_id = value.key_id.ok_or_else(|| {
                anyhow::anyhow!("chains.signer.key_id is required for type = \"aws_kms\"")
            })?;
            let region = value.region.ok_or_else(|| {
                anyhow::anyhow!("chains.signer.region is required for type = \"aws_kms\"")
            })?;
            if key_id.trim().is_empty() {
                bail!("chains.signer.key_id cannot be empty for type = \"aws_kms\"");
            }
            if region.trim().is_empty() {
                bail!("chains.signer.region cannot be empty for type = \"aws_kms\"");
            }
            SignerConfig::AwsKms { key_id, region }
        }
    };

    Ok(signer)
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

fn resolve_account_address(account: &str, aliases: &HashMap<String, String>) -> Result<Address> {
    if let Ok(address) = account.parse::<Address>() {
        return Ok(address);
    }

    if let Some(value) = aliases.get(account) {
        return value
            .parse()
            .with_context(|| format!("Invalid address for accounts.{}: {}", account, value));
    }

    let env_key = format!("{}_ADDRESS", normalize_env_key(account));
    if let Ok(value) = std::env::var(&env_key) {
        return value.parse().with_context(|| {
            format!(
                "Invalid address in environment variable {}: {}",
                env_key, value
            )
        });
    }

    bail!(
        "Account '{}' is not an address and was not found in [accounts] or env var {}",
        account,
        env_key
    );
}

fn normalize_env_key(value: &str) -> String {
    value
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_uppercase()
            } else {
                '_'
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_valid_config() {
        let toml = r#"
poll_interval_seconds = 30
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[accounts]
rebalancer = "0x000000000000000000000000000000000000dEaD"

[[chains]]
name = "evolve"
chain_id = 1234
rpc_url = "http://127.0.0.1:8545"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://rpc.sepolia.org"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[assets]]
symbol = "USDC"
decimals = 6

  [[assets.tokens]]
  chain_id = 1234
  address = "0x0000000000000000000000000000000000000001"

  [[assets.tokens]]
  chain_id = 11155111
  address = "0x0000000000000000000000000000000000000002"

  [assets.weights]
  "1234" = 0.50
  "11155111" = 0.50

  [assets.min_weights]
  "1234" = 0.40
  "11155111" = 0.40
"#;

        let raw: RawRebalancerConfig = toml::from_str(toml).expect("valid TOML");
        let config = RebalancerConfig::from_raw(raw).expect("valid config");
        assert_eq!(config.chains.len(), 2);
        assert_eq!(config.assets.len(), 1);
        assert_eq!(config.forwarding.domain_id, 69420);
        assert_eq!(config.forwarding.service_url, "http://127.0.0.1:8080");
    }

    #[test]
    fn rejects_poll_interval_below_minimum() {
        let toml = r#"
poll_interval_seconds = 29
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[accounts]
rebalancer = "0x000000000000000000000000000000000000dEaD"

[[chains]]
name = "evolve"
chain_id = 1234
rpc_url = "http://127.0.0.1:8545"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://rpc.sepolia.org"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[assets]]
symbol = "USDC"
decimals = 6

  [[assets.tokens]]
  chain_id = 1234
  address = "0x0000000000000000000000000000000000000001"

  [[assets.tokens]]
  chain_id = 11155111
  address = "0x0000000000000000000000000000000000000002"

  [assets.weights]
  "1234" = 0.50
  "11155111" = 0.50

  [assets.min_weights]
  "1234" = 0.40
  "11155111" = 0.40
"#;

        let raw: RawRebalancerConfig = toml::from_str(toml).expect("valid TOML");
        let err = RebalancerConfig::from_raw(raw).expect_err("should fail");
        assert!(err.to_string().contains("poll_interval_seconds must be >="));
    }

    #[test]
    fn rejects_invalid_weight_sum() {
        let toml = r#"
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[accounts]
rebalancer = "0x000000000000000000000000000000000000dEaD"

[[chains]]
name = "evolve"
chain_id = 1234
rpc_url = "http://127.0.0.1:8545"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://rpc.sepolia.org"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[assets]]
symbol = "USDC"
decimals = 6

  [[assets.tokens]]
  chain_id = 1234
  address = "0x0000000000000000000000000000000000000001"

  [[assets.tokens]]
  chain_id = 11155111
  address = "0x0000000000000000000000000000000000000002"

  [assets.weights]
  "1234" = 0.60
  "11155111" = 0.50

  [assets.min_weights]
  "1234" = 0.40
  "11155111" = 0.40
"#;

        let raw: RawRebalancerConfig = toml::from_str(toml).expect("valid TOML");
        let err = RebalancerConfig::from_raw(raw).expect_err("should fail");
        assert!(err.to_string().contains("must sum to 1.0"));
    }

    #[test]
    fn rejects_invalid_transfer_bps_bounds() {
        let toml = r#"
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[execution]
min_transfer_bps = 6000
max_transfer_bps = 1000

[accounts]
rebalancer = "0x000000000000000000000000000000000000dEaD"

[[chains]]
name = "evolve"
chain_id = 1234
rpc_url = "http://127.0.0.1:8545"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://rpc.sepolia.org"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[assets]]
symbol = "USDC"
decimals = 6

  [[assets.tokens]]
  chain_id = 1234
  address = "0x0000000000000000000000000000000000000001"

  [[assets.tokens]]
  chain_id = 11155111
  address = "0x0000000000000000000000000000000000000002"

  [assets.weights]
  "1234" = 0.50
  "11155111" = 0.50

  [assets.min_weights]
  "1234" = 0.40
  "11155111" = 0.40
"#;

        let raw: RawRebalancerConfig = toml::from_str(toml).expect("valid TOML");
        let err = RebalancerConfig::from_raw(raw).expect_err("should fail");
        assert!(err
            .to_string()
            .contains("max_transfer_bps must be >= execution.min_transfer_bps"));
    }

    #[test]
    fn rejects_missing_signer_even_in_dry_mode() {
        let toml = r#"
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[accounts]
rebalancer = "0x000000000000000000000000000000000000dEaD"

[[chains]]
name = "evolve"
chain_id = 1234
rpc_url = "http://127.0.0.1:8545"
account = "rebalancer"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://rpc.sepolia.org"
account = "rebalancer"

[[assets]]
symbol = "USDC"
decimals = 6

  [[assets.tokens]]
  chain_id = 1234
  address = "0x0000000000000000000000000000000000000001"

  [[assets.tokens]]
  chain_id = 11155111
  address = "0x0000000000000000000000000000000000000002"

  [assets.weights]
  "1234" = 0.50
  "11155111" = 0.50

  [assets.min_weights]
  "1234" = 0.40
  "11155111" = 0.40
"#;

        let raw: RawRebalancerConfig = toml::from_str(toml).expect("valid TOML");
        let err = RebalancerConfig::from_raw(raw).expect_err("should fail");
        assert!(err.to_string().contains("Invalid signer config for chain"));
    }

    #[test]
    fn rejects_env_var_field_for_env_signer_type() {
        let toml = r#"
dry_run = false

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[accounts]
rebalancer = "0x000000000000000000000000000000000000dEaD"

[[chains]]
name = "evolve"
chain_id = 1234
rpc_url = "http://127.0.0.1:8545"
account = "rebalancer"
  [chains.signer]
  type = "env"
  env_var = "REBALANCER_EVOLVE_PK"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://rpc.sepolia.org"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[assets]]
symbol = "USDC"
decimals = 6

  [[assets.tokens]]
  chain_id = 1234
  address = "0x0000000000000000000000000000000000000001"

  [[assets.tokens]]
  chain_id = 11155111
  address = "0x0000000000000000000000000000000000000002"

  [assets.weights]
  "1234" = 0.50
  "11155111" = 0.50

  [assets.min_weights]
  "1234" = 0.40
  "11155111" = 0.40
"#;

        let raw: RawRebalancerConfig = toml::from_str(toml).expect("valid TOML");
        let err = RebalancerConfig::from_raw(raw).expect_err("should fail");
        assert!(err.to_string().contains("Invalid signer config for chain"));
    }

    #[test]
    fn supports_optional_collateral_token_with_fallback_to_address() {
        let toml = r#"
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[accounts]
rebalancer = "0x000000000000000000000000000000000000dEaD"

[[chains]]
name = "evolve"
chain_id = 1234
rpc_url = "http://127.0.0.1:8545"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://rpc.sepolia.org"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[assets]]
symbol = "USDC"
decimals = 6

  [[assets.tokens]]
  chain_id = 1234
  address = "0x0000000000000000000000000000000000000001"
  collateral_token = "0x0000000000000000000000000000000000000011"

  [[assets.tokens]]
  chain_id = 11155111
  address = "0x0000000000000000000000000000000000000002"

  [assets.weights]
  "1234" = 0.50
  "11155111" = 0.50

  [assets.min_weights]
  "1234" = 0.40
  "11155111" = 0.40
"#;

        let raw: RawRebalancerConfig = toml::from_str(toml).expect("valid TOML");
        let config = RebalancerConfig::from_raw(raw).expect("valid config");
        let asset = &config.assets[0];
        let chain_1234 = asset.tokens.get(&1234u64).expect("missing chain 1234");
        let chain_11155111 = asset
            .tokens
            .get(&11155111u64)
            .expect("missing chain 11155111");

        assert_eq!(
            chain_1234.collateral_token,
            "0x0000000000000000000000000000000000000011"
                .parse::<Address>()
                .unwrap()
        );
        assert_eq!(chain_1234.asset_type, AssetType::Erc20);
        assert_eq!(
            chain_1234.address,
            Some(
                "0x0000000000000000000000000000000000000001"
                    .parse::<Address>()
                    .unwrap()
            )
        );
        assert_eq!(
            chain_11155111.collateral_token,
            chain_11155111.address.expect("missing erc20 address")
        );
    }

    #[test]
    fn supports_chain_domain_id_override_with_chain_id_default() {
        let toml = r#"
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[accounts]
rebalancer = "0x000000000000000000000000000000000000dEaD"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://rpc.sepolia.org"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[chains]]
name = "eden"
chain_id = 3735928814
domain_id = 2147483647
rpc_url = "https://eden.invalid"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[assets]]
symbol = "USDC"
decimals = 6

  [[assets.tokens]]
  chain_id = 11155111
  address = "0x0000000000000000000000000000000000000001"

  [[assets.tokens]]
  chain_id = 3735928814
  address = "0x0000000000000000000000000000000000000002"

  [assets.weights]
  "11155111" = 0.50
  "3735928814" = 0.50

  [assets.min_weights]
  "11155111" = 0.40
  "3735928814" = 0.40
"#;

        let raw: RawRebalancerConfig = toml::from_str(toml).expect("valid TOML");
        let config = RebalancerConfig::from_raw(raw).expect("valid config");

        let sepolia = config
            .chains
            .iter()
            .find(|c| c.chain_id == 11155111)
            .expect("missing sepolia chain");
        assert_eq!(sepolia.domain_id, 11155111u32);

        let eden = config
            .chains
            .iter()
            .find(|c| c.chain_id == 3735928814)
            .expect("missing eden chain");
        assert_eq!(eden.domain_id, 2147483647u32);
    }

    #[test]
    fn accepts_native_token_type() {
        let toml = r#"
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[accounts]
rebalancer = "0x000000000000000000000000000000000000dEaD"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://rpc.sepolia.org"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[chains]]
name = "eden"
chain_id = 3735928814
domain_id = 2147483647
rpc_url = "https://eden.invalid"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[assets]]
symbol = "ETH"
decimals = 18

  [[assets.tokens]]
  chain_id = 11155111
  type = "native"
  collateral_token = "0x0000000000000000000000000000000000000011"

  [[assets.tokens]]
  chain_id = 3735928814
  type = "native"
  collateral_token = "0x0000000000000000000000000000000000000022"

  [assets.weights]
  "11155111" = 0.50
  "3735928814" = 0.50

  [assets.min_weights]
  "11155111" = 0.40
  "3735928814" = 0.40
"#;

        let raw: RawRebalancerConfig = toml::from_str(toml).expect("valid TOML");
        let config = RebalancerConfig::from_raw(raw).expect("valid config");
        let asset = &config.assets[0];
        let chain = asset
            .tokens
            .get(&11155111u64)
            .expect("missing sepolia token");

        assert_eq!(chain.asset_type, AssetType::Native);
        assert!(chain.address.is_none());
        assert_eq!(
            chain.collateral_token,
            "0x0000000000000000000000000000000000000011"
                .parse::<Address>()
                .unwrap()
        );
    }

    #[test]
    fn rejects_native_type_with_address() {
        let toml = r#"
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[accounts]
rebalancer = "0x000000000000000000000000000000000000dEaD"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://rpc.sepolia.org"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[chains]]
name = "eden"
chain_id = 3735928814
rpc_url = "https://eden.invalid"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[assets]]
symbol = "ETH"
decimals = 18

  [[assets.tokens]]
  chain_id = 11155111
  type = "native"
  address = "0x0000000000000000000000000000000000000001"
  collateral_token = "0x0000000000000000000000000000000000000011"

  [[assets.tokens]]
  chain_id = 3735928814
  type = "native"
  collateral_token = "0x0000000000000000000000000000000000000022"

  [assets.weights]
  "11155111" = 0.50
  "3735928814" = 0.50

  [assets.min_weights]
  "11155111" = 0.40
  "3735928814" = 0.40
"#;

        let raw: RawRebalancerConfig = toml::from_str(toml).expect("valid TOML");
        let err = RebalancerConfig::from_raw(raw).expect_err("should fail");
        assert!(err.to_string().contains("type=native must omit address"));
    }

    #[test]
    fn rejects_missing_forwarding_block() {
        let toml = r#"
dry_run = true

[accounts]
rebalancer = "0x000000000000000000000000000000000000dEaD"

[[chains]]
name = "evolve"
chain_id = 1234
rpc_url = "http://127.0.0.1:8545"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://rpc.sepolia.org"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[assets]]
symbol = "USDC"
decimals = 6

  [[assets.tokens]]
  chain_id = 1234
  address = "0x0000000000000000000000000000000000000001"

  [[assets.tokens]]
  chain_id = 11155111
  address = "0x0000000000000000000000000000000000000002"

  [assets.weights]
  "1234" = 0.50
  "11155111" = 0.50

  [assets.min_weights]
  "1234" = 0.40
  "11155111" = 0.40
"#;

        let err = toml::from_str::<RawRebalancerConfig>(toml).expect_err("should fail");
        assert!(err.to_string().contains("missing field `forwarding`"));
    }

    #[test]
    fn rejects_router_address_field() {
        let toml = r#"
dry_run = true

[forwarding]
domain_id = 69420
service_url = "http://127.0.0.1:8080"

[accounts]
rebalancer = "0x000000000000000000000000000000000000dEaD"

[[chains]]
name = "evolve"
chain_id = 1234
rpc_url = "http://127.0.0.1:8545"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://rpc.sepolia.org"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[assets]]
symbol = "USDC"
decimals = 6

  [[assets.tokens]]
  chain_id = 1234
  address = "0x0000000000000000000000000000000000000001"
  router_address = "0x0000000000000000000000000000000000000011"

  [[assets.tokens]]
  chain_id = 11155111
  address = "0x0000000000000000000000000000000000000002"

  [assets.weights]
  "1234" = 0.50
  "11155111" = 0.50

  [assets.min_weights]
  "1234" = 0.40
  "11155111" = 0.40
"#;

        let err = toml::from_str::<RawRebalancerConfig>(toml).expect_err("should fail");
        assert!(err.to_string().contains("unknown field"));
        assert!(err.to_string().contains("router_address"));
    }
}
