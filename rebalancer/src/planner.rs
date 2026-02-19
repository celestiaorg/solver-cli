use alloy::primitives::U256;
use anyhow::{Context, Result};
use std::collections::{BTreeMap, BTreeSet};

use crate::config::AssetConfig;

const MIN_EFFECTIVE_RAW_TRANSFER: f64 = 1.0;
const WEIGHT_EPSILON: f64 = 1e-9;

pub struct PlannerContext<'a> {
    pub settle_buffer_weight: f64,
    pub reserved_outgoing_by_chain: &'a BTreeMap<u64, U256>,
    pub previously_active_deficits: &'a BTreeSet<u64>,
}

#[derive(Debug, Clone)]
pub struct AssetPlan {
    pub symbol: String,
    pub decimals: u8,
    pub observed_total_balance: U256,
    pub effective_total_balance: U256,
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

pub fn build_asset_plan(
    asset: &AssetConfig,
    observed_balances: &BTreeMap<u64, U256>,
    context: PlannerContext<'_>,
) -> Result<AssetPlan> {
    let mut observed_total_balance = U256::ZERO;
    for balance in observed_balances.values() {
        observed_total_balance += *balance;
    }

    let mut chain_ids: Vec<u64> = asset.weights.keys().copied().collect();
    chain_ids.sort_unstable();

    let mut effective_balances = BTreeMap::<u64, U256>::new();
    let mut effective_total_balance = U256::ZERO;

    for chain_id in &chain_ids {
        let observed_balance = observed_balances
            .get(chain_id)
            .copied()
            .unwrap_or(U256::ZERO);
        let reserved = context
            .reserved_outgoing_by_chain
            .get(chain_id)
            .copied()
            .unwrap_or(U256::ZERO);
        let effective = observed_balance.saturating_sub(reserved);
        effective_balances.insert(*chain_id, effective);
        effective_total_balance += effective;
    }

    if effective_total_balance.is_zero() {
        return Ok(AssetPlan {
            symbol: asset.symbol.clone(),
            decimals: asset.decimals,
            observed_total_balance,
            effective_total_balance,
            active_deficit_chain_ids: Vec::new(),
            transfers: Vec::new(),
        });
    }

    let effective_total_f64 = u256_to_f64(effective_total_balance)?;
    let settle_buffer_weight = context.settle_buffer_weight.max(0.0).min(1.0);

    let mut active_deficit_chain_ids = Vec::new();
    let mut deficits = Vec::new();
    let mut surpluses = Vec::new();

    for chain_id in chain_ids {
        let effective_balance = *effective_balances.get(&chain_id).unwrap_or(&U256::ZERO);
        let effective_f64 = u256_to_f64(effective_balance)?;

        let target_weight = *asset
            .weights
            .get(&chain_id)
            .with_context(|| format!("Missing target weight for chain {}", chain_id))?;
        let min_weight = *asset
            .min_weights
            .get(&chain_id)
            .with_context(|| format!("Missing min_weight for chain {}", chain_id))?;

        let current_weight = effective_f64 / effective_total_f64;
        let clear_threshold_weight = (target_weight - settle_buffer_weight).max(min_weight);
        let target_balance_raw = effective_total_f64 * target_weight;
        let deficit_raw = (target_balance_raw - effective_f64).max(0.0);
        let surplus_raw = (effective_f64 - target_balance_raw).max(0.0);

        let was_active = context.previously_active_deficits.contains(&chain_id);
        let is_active = if current_weight + WEIGHT_EPSILON < min_weight {
            true
        } else {
            was_active && current_weight + WEIGHT_EPSILON < clear_threshold_weight
        };

        if is_active {
            active_deficit_chain_ids.push(chain_id);
        }

        if deficit_raw >= MIN_EFFECTIVE_RAW_TRANSFER {
            deficits.push(WorkingAmount {
                chain_id,
                amount_raw: deficit_raw,
            });
        }
        if surplus_raw >= MIN_EFFECTIVE_RAW_TRANSFER {
            surpluses.push(WorkingAmount {
                chain_id,
                amount_raw: surplus_raw,
            });
        }
    }

    if active_deficit_chain_ids.is_empty() {
        return Ok(AssetPlan {
            symbol: asset.symbol.clone(),
            decimals: asset.decimals,
            observed_total_balance,
            effective_total_balance,
            active_deficit_chain_ids,
            transfers: Vec::new(),
        });
    }

    let transfers = match_greedy(deficits, surpluses);

    Ok(AssetPlan {
        symbol: asset.symbol.clone(),
        decimals: asset.decimals,
        observed_total_balance,
        effective_total_balance,
        active_deficit_chain_ids,
        transfers,
    })
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

fn match_greedy(
    mut deficits: Vec<WorkingAmount>,
    mut surpluses: Vec<WorkingAmount>,
) -> Vec<TransferPlan> {
    let mut transfers = Vec::new();

    loop {
        deficits.retain(|d| d.amount_raw >= MIN_EFFECTIVE_RAW_TRANSFER);
        surpluses.retain(|s| s.amount_raw >= MIN_EFFECTIVE_RAW_TRANSFER);

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

        if matched_raw < MIN_EFFECTIVE_RAW_TRANSFER {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::AssetConfig;
    use std::collections::HashMap;

    fn sample_asset() -> AssetConfig {
        AssetConfig {
            symbol: "USDC".to_string(),
            decimals: 6,
            tokens: HashMap::from([
                (
                    1u64,
                    "0x0000000000000000000000000000000000000001"
                        .parse()
                        .unwrap(),
                ),
                (
                    2u64,
                    "0x0000000000000000000000000000000000000002"
                        .parse()
                        .unwrap(),
                ),
            ]),
            weights: HashMap::from([(1u64, 0.5), (2u64, 0.5)]),
            min_weights: HashMap::from([(1u64, 0.4), (2u64, 0.4)]),
        }
    }

    #[test]
    fn reservation_affects_effective_balances_and_plans_transfer() {
        let asset = sample_asset();
        let observed = BTreeMap::from([(1u64, U256::from(500u64)), (2u64, U256::from(500u64))]);
        let reserved = BTreeMap::from([(1u64, U256::from(200u64))]);
        let active = BTreeSet::new();

        let plan = build_asset_plan(
            &asset,
            &observed,
            PlannerContext {
                settle_buffer_weight: 0.01,
                reserved_outgoing_by_chain: &reserved,
                previously_active_deficits: &active,
            },
        )
        .unwrap();

        assert_eq!(plan.active_deficit_chain_ids, vec![1]);
        assert_eq!(plan.transfers.len(), 1);
        assert_eq!(plan.transfers[0].source_chain_id, 2);
        assert_eq!(plan.transfers[0].destination_chain_id, 1);
        assert_eq!(plan.transfers[0].amount_raw, 100);
    }

    #[test]
    fn hysteresis_keeps_chain_active_until_clear_threshold() {
        let asset = sample_asset();
        let observed = BTreeMap::from([(1u64, U256::from(450u64)), (2u64, U256::from(550u64))]);
        let reserved = BTreeMap::new();
        let active = BTreeSet::from([1u64]);

        let plan = build_asset_plan(
            &asset,
            &observed,
            PlannerContext {
                settle_buffer_weight: 0.01,
                reserved_outgoing_by_chain: &reserved,
                previously_active_deficits: &active,
            },
        )
        .unwrap();

        assert!(plan.active_deficit_chain_ids.contains(&1));
    }

    #[test]
    fn returns_empty_transfers_when_no_active_deficit() {
        let asset = sample_asset();
        let observed = BTreeMap::from([(1u64, U256::from(450u64)), (2u64, U256::from(550u64))]);
        let reserved = BTreeMap::new();
        let active = BTreeSet::new();

        let plan = build_asset_plan(
            &asset,
            &observed,
            PlannerContext {
                settle_buffer_weight: 0.01,
                reserved_outgoing_by_chain: &reserved,
                previously_active_deficits: &active,
            },
        )
        .unwrap();

        assert!(plan.transfers.is_empty());
        assert!(plan.active_deficit_chain_ids.is_empty());
    }
}
