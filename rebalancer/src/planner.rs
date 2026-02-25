use alloy::primitives::U256;
use anyhow::{Context, Result};
use std::collections::BTreeMap;

use crate::config::AssetConfig;

const MIN_TRANSFER_RAW: f64 = 1.0;
const WEIGHT_EPSILON: f64 = 1e-9;

#[derive(Debug, Clone)]
pub struct AssetPlan {
    pub symbol: String,
    pub decimals: u8,
    pub total_balance: U256,
    pub active_deficit_chain_ids: Vec<u64>,
    pub transfers: Vec<TransferPlan>,
}

#[derive(Debug, Clone)]
pub struct TransferPlan {
    pub source_chain_id: u64,
    pub destination_chain_id: u64,
    pub amount_raw: u128,
}

#[derive(Debug, Clone)]
struct WorkingAmount {
    chain_id: u64,
    amount_raw: f64,
}

impl AssetPlan {
    pub fn new(
        asset: &AssetConfig,
        observed_balances: &BTreeMap<u64, U256>,
        total_balance: U256,
    ) -> Result<Self> {
        let mut chain_ids: Vec<u64> = asset.weights.keys().copied().collect();
        chain_ids.sort_unstable();

        if total_balance.is_zero() {
            return Ok(Self {
                symbol: asset.symbol.clone(),
                decimals: asset.decimals,
                total_balance,
                active_deficit_chain_ids: Vec::new(),
                transfers: Vec::new(),
            });
        }

        let total_balance_f64 = Self::u256_to_f64(total_balance)?;

        let mut active_deficit_chain_ids = Vec::new();
        let mut deficits = Vec::new();
        let mut surpluses = Vec::new();

        for chain_id in chain_ids {
            let current_balance = *observed_balances.get(&chain_id).unwrap_or(&U256::ZERO);
            let current_f64 = Self::u256_to_f64(current_balance)?;

            let target_weight = *asset
                .weights
                .get(&chain_id)
                .with_context(|| format!("Missing target weight for chain {}", chain_id))?;
            let min_weight = *asset
                .min_weights
                .get(&chain_id)
                .with_context(|| format!("Missing min_weight for chain {}", chain_id))?;

            let current_weight = current_f64 / total_balance_f64;
            let target_balance_raw = total_balance_f64 * target_weight;
            let deficit_raw = (target_balance_raw - current_f64).max(0.0);
            let surplus_raw = (current_f64 - target_balance_raw).max(0.0);

            if current_weight + WEIGHT_EPSILON < min_weight {
                active_deficit_chain_ids.push(chain_id);
            }

            if deficit_raw >= MIN_TRANSFER_RAW {
                deficits.push(WorkingAmount {
                    chain_id,
                    amount_raw: deficit_raw,
                });
            }
            if surplus_raw >= MIN_TRANSFER_RAW {
                surpluses.push(WorkingAmount {
                    chain_id,
                    amount_raw: surplus_raw,
                });
            }
        }

        if active_deficit_chain_ids.is_empty() {
            return Ok(Self {
                symbol: asset.symbol.clone(),
                decimals: asset.decimals,
                total_balance,
                active_deficit_chain_ids,
                transfers: Vec::new(),
            });
        }

        let transfers = Self::match_greedy(deficits, surpluses);

        Ok(Self {
            symbol: asset.symbol.clone(),
            decimals: asset.decimals,
            total_balance,
            active_deficit_chain_ids,
            transfers,
        })
    }

    fn match_greedy(
        mut deficits: Vec<WorkingAmount>,
        mut surpluses: Vec<WorkingAmount>,
    ) -> Vec<TransferPlan> {
        let mut transfers = Vec::new();

        loop {
            deficits.retain(|d| d.amount_raw >= MIN_TRANSFER_RAW);
            surpluses.retain(|s| s.amount_raw >= MIN_TRANSFER_RAW);

            if deficits.is_empty() || surpluses.is_empty() {
                break;
            }

            deficits.sort_by(|a, b| {
                b.amount_raw
                    .total_cmp(&a.amount_raw)
                    .then_with(|| a.chain_id.cmp(&b.chain_id))
            });
            surpluses.sort_by(|a, b| {
                b.amount_raw
                    .total_cmp(&a.amount_raw)
                    .then_with(|| a.chain_id.cmp(&b.chain_id))
            });

            let deficit = &deficits[0];
            let surplus = &surpluses[0];
            let matched_raw = deficit.amount_raw.min(surplus.amount_raw).floor();

            if matched_raw < MIN_TRANSFER_RAW {
                break;
            }

            let amount_raw = if matched_raw > u128::MAX as f64 {
                u128::MAX
            } else {
                matched_raw as u128
            };

            if amount_raw == 0 {
                break;
            }

            transfers.push(TransferPlan {
                source_chain_id: surplus.chain_id,
                destination_chain_id: deficit.chain_id,
                amount_raw,
            });

            deficits[0].amount_raw -= amount_raw as f64;
            surpluses[0].amount_raw -= amount_raw as f64;
        }

        transfers
    }

    fn u256_to_f64(value: U256) -> Result<f64> {
        value
            .to_string()
            .parse::<f64>()
            .context("Failed to convert U256 to f64 for planning math")
    }
}

pub fn format_token_amount(amount: U256, decimals: u8) -> String {
    let divisor = U256::from(10u64).pow(U256::from(decimals));
    let whole = amount / divisor;
    let frac = amount % divisor;

    if frac.is_zero() {
        whole.to_string()
    } else {
        let frac_str = format!("{:0>width$}", frac, width = decimals as usize);
        let trimmed = frac_str.trim_end_matches('0');
        format!("{}.{}", whole, trimmed)
    }
}

pub fn format_raw_u128(amount_raw: u128, decimals: u8) -> String {
    format_token_amount(U256::from(amount_raw), decimals)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{AssetConfig, AssetTokenConfig, AssetType};
    use std::collections::{BTreeMap, HashMap};

    fn sample_asset() -> AssetConfig {
        AssetConfig {
            symbol: "USDC".to_string(),
            decimals: 6,
            tokens: HashMap::from([
                (
                    1u64,
                    AssetTokenConfig {
                        asset_type: AssetType::Erc20,
                        address: Some(
                            "0x0000000000000000000000000000000000000001"
                                .parse()
                                .unwrap(),
                        ),
                        collateral_token: "0x0000000000000000000000000000000000000011"
                            .parse()
                            .unwrap(),
                    },
                ),
                (
                    2u64,
                    AssetTokenConfig {
                        asset_type: AssetType::Erc20,
                        address: Some(
                            "0x0000000000000000000000000000000000000002"
                                .parse()
                                .unwrap(),
                        ),
                        collateral_token: "0x0000000000000000000000000000000000000022"
                            .parse()
                            .unwrap(),
                    },
                ),
            ]),
            weights: HashMap::from([(1u64, 0.5), (2u64, 0.5)]),
            min_weights: HashMap::from([(1u64, 0.4), (2u64, 0.4)]),
        }
    }

    fn sample_asset_three_chains() -> AssetConfig {
        AssetConfig {
            symbol: "USDC".to_string(),
            decimals: 6,
            tokens: HashMap::from([
                (
                    1u64,
                    AssetTokenConfig {
                        asset_type: AssetType::Erc20,
                        address: Some(
                            "0x0000000000000000000000000000000000000001"
                                .parse()
                                .unwrap(),
                        ),
                        collateral_token: "0x0000000000000000000000000000000000000011"
                            .parse()
                            .unwrap(),
                    },
                ),
                (
                    2u64,
                    AssetTokenConfig {
                        asset_type: AssetType::Erc20,
                        address: Some(
                            "0x0000000000000000000000000000000000000002"
                                .parse()
                                .unwrap(),
                        ),
                        collateral_token: "0x0000000000000000000000000000000000000022"
                            .parse()
                            .unwrap(),
                    },
                ),
                (
                    3u64,
                    AssetTokenConfig {
                        asset_type: AssetType::Erc20,
                        address: Some(
                            "0x0000000000000000000000000000000000000003"
                                .parse()
                                .unwrap(),
                        ),
                        collateral_token: "0x0000000000000000000000000000000000000033"
                            .parse()
                            .unwrap(),
                    },
                ),
            ]),
            weights: HashMap::from([(1u64, 1.0 / 3.0), (2u64, 1.0 / 3.0), (3u64, 1.0 / 3.0)]),
            min_weights: HashMap::from([(1u64, 0.30), (2u64, 0.30), (3u64, 0.30)]),
        }
    }

    fn sample_asset_four_chains() -> AssetConfig {
        AssetConfig {
            symbol: "USDC".to_string(),
            decimals: 6,
            tokens: HashMap::from([
                (
                    1u64,
                    AssetTokenConfig {
                        asset_type: AssetType::Erc20,
                        address: Some(
                            "0x0000000000000000000000000000000000000001"
                                .parse()
                                .unwrap(),
                        ),
                        collateral_token: "0x0000000000000000000000000000000000000011"
                            .parse()
                            .unwrap(),
                    },
                ),
                (
                    2u64,
                    AssetTokenConfig {
                        asset_type: AssetType::Erc20,
                        address: Some(
                            "0x0000000000000000000000000000000000000002"
                                .parse()
                                .unwrap(),
                        ),
                        collateral_token: "0x0000000000000000000000000000000000000022"
                            .parse()
                            .unwrap(),
                    },
                ),
                (
                    3u64,
                    AssetTokenConfig {
                        asset_type: AssetType::Erc20,
                        address: Some(
                            "0x0000000000000000000000000000000000000003"
                                .parse()
                                .unwrap(),
                        ),
                        collateral_token: "0x0000000000000000000000000000000000000033"
                            .parse()
                            .unwrap(),
                    },
                ),
                (
                    4u64,
                    AssetTokenConfig {
                        asset_type: AssetType::Erc20,
                        address: Some(
                            "0x0000000000000000000000000000000000000004"
                                .parse()
                                .unwrap(),
                        ),
                        collateral_token: "0x0000000000000000000000000000000000000044"
                            .parse()
                            .unwrap(),
                    },
                ),
            ]),
            weights: HashMap::from([(1u64, 0.25), (2u64, 0.25), (3u64, 0.25), (4u64, 0.25)]),
            min_weights: HashMap::from([(1u64, 0.20), (2u64, 0.20), (3u64, 0.20), (4u64, 0.20)]),
        }
    }

    #[test]
    /// Two-chain rebalance scenario in plain terms:
    /// - Starting balances are: chain1=350, chain2=650.
    /// - Total balance is 1000, so the target per chain at 50% is 500.
    /// - Chain1 is short by 150 and chain2 has 150 extra.
    /// - Expected rebalance transfer: 150 from chain2->chain1.
    fn plans_transfer_when_min_weight_is_violated() {
        let asset = sample_asset();
        let observed = BTreeMap::from([(1u64, U256::from(350u64)), (2u64, U256::from(650u64))]);
        let plan = AssetPlan::new(&asset, &observed, U256::from(1000u64)).unwrap();

        assert_eq!(plan.active_deficit_chain_ids, vec![1]);
        assert_eq!(plan.transfers.len(), 1);
        assert_eq!(plan.transfers[0].source_chain_id, 2);
        assert_eq!(plan.transfers[0].destination_chain_id, 1);
        assert_eq!(plan.transfers[0].amount_raw, 150);
    }

    #[test]
    /// Three-chain rebalance scenario in plain terms:
    /// - Starting balances are: chain1=200, chain2=400, chain3=300.
    /// - Total balance is 900, so the target per chain at 1/3 is 300.
    /// - Chain1 is short by 100 and chain2 has 100 extra.
    /// - Expected rebalance transfer: 100 from chain2->chain1.
    fn plans_transfer_with_three_chain_setup_when_min_weight_is_violated() {
        let asset = sample_asset_three_chains();
        let observed = BTreeMap::from([
            (1u64, U256::from(200u64)),
            (2u64, U256::from(400u64)),
            (3u64, U256::from(300u64)),
        ]);
        let plan = AssetPlan::new(&asset, &observed, U256::from(900u64)).unwrap();

        assert_eq!(plan.active_deficit_chain_ids, vec![1]);
        assert_eq!(plan.transfers.len(), 1);
        assert_eq!(plan.transfers[0].source_chain_id, 2);
        assert_eq!(plan.transfers[0].destination_chain_id, 1);
        assert_eq!(plan.transfers[0].amount_raw, 100);
    }

    #[test]
    /// Four-chain rebalance scenario in plain terms:
    /// - Starting balances are: chain1=100, chain2=300, chain3=150, chain4=250.
    /// - Total balance is 800, so the target per chain at 25% is 200.
    /// - Deficits are chain1 (-100) and chain3 (-50).
    /// - Surpluses are chain2 (+100) and chain4 (+50).
    /// - Expected rebalance transfers: 100 from chain2->chain1 and 50 from chain4->chain3.
    fn plans_transfer_with_four_chain_setup_when_min_weight_is_violated() {
        let asset = sample_asset_four_chains();
        let observed = BTreeMap::from([
            (1u64, U256::from(100u64)),
            (2u64, U256::from(300u64)),
            (3u64, U256::from(150u64)),
            (4u64, U256::from(250u64)),
        ]);
        let plan = AssetPlan::new(&asset, &observed, U256::from(800u64)).unwrap();

        assert_eq!(plan.active_deficit_chain_ids, vec![1, 3]);
        assert_eq!(plan.transfers.len(), 2);
        assert_eq!(plan.transfers[0].source_chain_id, 2);
        assert_eq!(plan.transfers[0].destination_chain_id, 1);
        assert_eq!(plan.transfers[0].amount_raw, 100);
        assert_eq!(plan.transfers[1].source_chain_id, 4);
        assert_eq!(plan.transfers[1].destination_chain_id, 3);
        assert_eq!(plan.transfers[1].amount_raw, 50);
    }

    #[test]
    fn returns_empty_transfers_when_no_active_deficit() {
        let asset = sample_asset();
        let observed = BTreeMap::from([(1u64, U256::from(450u64)), (2u64, U256::from(550u64))]);
        let plan = AssetPlan::new(&asset, &observed, U256::from(1000u64)).unwrap();
        assert!(plan.transfers.is_empty());
        assert!(plan.active_deficit_chain_ids.is_empty());
    }

    #[test]
    fn uses_provided_total_balance() {
        let asset = sample_asset();
        let observed = BTreeMap::from([(1u64, U256::from(100u64)), (2u64, U256::from(200u64))]);
        let plan = AssetPlan::new(&asset, &observed, U256::from(999u64)).unwrap();
        assert_eq!(plan.total_balance, U256::from(999u64));
    }
}
