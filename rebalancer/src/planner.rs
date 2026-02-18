use alloy::primitives::U256;
use anyhow::{Context, Result};
use std::collections::{BTreeMap, BTreeSet};

use crate::config::AssetConfig;

const MIN_EFFECTIVE_RAW_TRANSFER: f64 = 1.0;
const WEIGHT_EPSILON: f64 = 1e-9;

pub struct PlannerContext<'a> {
    pub now_unix_seconds: u64,
    pub cooldown_seconds_per_route: u64,
    pub settle_buffer_weight: f64,
    pub reserved_outgoing_by_chain: &'a BTreeMap<u64, U256>,
    pub previously_active_deficits: &'a BTreeSet<u64>,
    pub route_last_execution_by_pair: &'a BTreeMap<(u64, u64), u64>,
}

#[derive(Debug, Clone)]
pub struct AssetPlan {
    pub symbol: String,
    pub decimals: u8,
    pub observed_total_balance: U256,
    pub effective_total_balance: U256,
    pub chain_states: Vec<ChainPlanState>,
    pub active_deficit_chain_ids: Vec<u64>,
    pub newly_activated_chain_ids: Vec<u64>,
    pub cleared_chain_ids: Vec<u64>,
    pub triggered: bool,
    pub reason: String,
    pub transfers: Vec<TransferPlan>,
    pub cooldown_blocked_transfers: Vec<CooldownBlockedTransfer>,
}

#[derive(Debug, Clone)]
pub struct ChainPlanState {
    pub chain_id: u64,
    pub observed_balance: U256,
    pub reserved_outgoing: U256,
    pub effective_balance: U256,
    pub current_weight: f64,
    pub target_weight: f64,
    pub min_weight: f64,
    pub clear_threshold_weight: f64,
    pub target_balance_raw: f64,
    pub deficit_raw: f64,
    pub surplus_raw: f64,
    pub was_active: bool,
    pub is_active: bool,
}

#[derive(Debug, Clone)]
pub struct TransferPlan {
    pub source_chain_id: u64,
    pub destination_chain_id: u64,
    pub amount_raw: u128,
}

#[derive(Debug, Clone)]
pub struct CooldownBlockedTransfer {
    pub transfer: TransferPlan,
    pub last_execution_unix_seconds: u64,
    pub available_at_unix_seconds: u64,
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
            chain_states: Vec::new(),
            active_deficit_chain_ids: Vec::new(),
            newly_activated_chain_ids: Vec::new(),
            cleared_chain_ids: Vec::new(),
            triggered: false,
            reason: "effective total balance is zero".to_string(),
            transfers: Vec::new(),
            cooldown_blocked_transfers: Vec::new(),
        });
    }

    let effective_total_f64 = u256_to_f64(effective_total_balance)?;
    let settle_buffer_weight = context.settle_buffer_weight.max(0.0).min(1.0);

    let mut chain_states = Vec::with_capacity(chain_ids.len());
    let mut active_deficit_chain_ids = Vec::new();
    let mut newly_activated_chain_ids = Vec::new();
    let mut cleared_chain_ids = Vec::new();

    for chain_id in chain_ids {
        let observed_balance = observed_balances
            .get(&chain_id)
            .copied()
            .unwrap_or(U256::ZERO);
        let reserved_outgoing = context
            .reserved_outgoing_by_chain
            .get(&chain_id)
            .copied()
            .unwrap_or(U256::ZERO);
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
        if !was_active && is_active {
            newly_activated_chain_ids.push(chain_id);
        }
        if was_active && !is_active {
            cleared_chain_ids.push(chain_id);
        }

        chain_states.push(ChainPlanState {
            chain_id,
            observed_balance,
            reserved_outgoing,
            effective_balance,
            current_weight,
            target_weight,
            min_weight,
            clear_threshold_weight,
            target_balance_raw,
            deficit_raw,
            surplus_raw,
            was_active,
            is_active,
        });
    }

    if active_deficit_chain_ids.is_empty() {
        return Ok(AssetPlan {
            symbol: asset.symbol.clone(),
            decimals: asset.decimals,
            observed_total_balance,
            effective_total_balance,
            chain_states,
            active_deficit_chain_ids,
            newly_activated_chain_ids,
            cleared_chain_ids,
            triggered: false,
            reason: "no active deficit chain after hysteresis".to_string(),
            transfers: Vec::new(),
            cooldown_blocked_transfers: Vec::new(),
        });
    }

    let deficits: Vec<WorkingAmount> = chain_states
        .iter()
        .filter(|state| state.deficit_raw >= MIN_EFFECTIVE_RAW_TRANSFER)
        .map(|state| WorkingAmount {
            chain_id: state.chain_id,
            amount_raw: state.deficit_raw,
        })
        .collect();

    let surpluses: Vec<WorkingAmount> = chain_states
        .iter()
        .filter(|state| state.surplus_raw >= MIN_EFFECTIVE_RAW_TRANSFER)
        .map(|state| WorkingAmount {
            chain_id: state.chain_id,
            amount_raw: state.surplus_raw,
        })
        .collect();

    let candidate_transfers = match_greedy(deficits, surpluses);
    let (transfers, cooldown_blocked_transfers) = apply_cooldown(candidate_transfers, &context);

    let reason = if transfers.is_empty() && !cooldown_blocked_transfers.is_empty() {
        "all candidate routes are in cooldown".to_string()
    } else {
        "one or more chains are active deficits".to_string()
    };

    Ok(AssetPlan {
        symbol: asset.symbol.clone(),
        decimals: asset.decimals,
        observed_total_balance,
        effective_total_balance,
        chain_states,
        active_deficit_chain_ids,
        newly_activated_chain_ids,
        cleared_chain_ids,
        triggered: true,
        reason,
        transfers,
        cooldown_blocked_transfers,
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

fn apply_cooldown(
    candidates: Vec<TransferPlan>,
    context: &PlannerContext<'_>,
) -> (Vec<TransferPlan>, Vec<CooldownBlockedTransfer>) {
    if context.cooldown_seconds_per_route == 0 {
        return (candidates, Vec::new());
    }

    let mut allowed = Vec::new();
    let mut blocked = Vec::new();
    for transfer in candidates {
        if let Some(last_execution) = context
            .route_last_execution_by_pair
            .get(&(transfer.source_chain_id, transfer.destination_chain_id))
        {
            let available_at = last_execution.saturating_add(context.cooldown_seconds_per_route);
            if context.now_unix_seconds < available_at {
                blocked.push(CooldownBlockedTransfer {
                    transfer,
                    last_execution_unix_seconds: *last_execution,
                    available_at_unix_seconds: available_at,
                });
                continue;
            }
        }
        allowed.push(transfer);
    }

    (allowed, blocked)
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
        let route_last = BTreeMap::new();

        let plan = build_asset_plan(
            &asset,
            &observed,
            PlannerContext {
                now_unix_seconds: 100,
                cooldown_seconds_per_route: 0,
                settle_buffer_weight: 0.01,
                reserved_outgoing_by_chain: &reserved,
                previously_active_deficits: &active,
                route_last_execution_by_pair: &route_last,
            },
        )
        .unwrap();

        assert!(plan.triggered);
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
        let route_last = BTreeMap::new();

        let plan = build_asset_plan(
            &asset,
            &observed,
            PlannerContext {
                now_unix_seconds: 100,
                cooldown_seconds_per_route: 0,
                settle_buffer_weight: 0.01,
                reserved_outgoing_by_chain: &reserved,
                previously_active_deficits: &active,
                route_last_execution_by_pair: &route_last,
            },
        )
        .unwrap();

        assert!(plan.active_deficit_chain_ids.contains(&1));
        assert!(plan.cleared_chain_ids.is_empty());
    }

    #[test]
    fn cooldown_blocks_candidate_route() {
        let asset = sample_asset();
        let observed = BTreeMap::from([(1u64, U256::from(300u64)), (2u64, U256::from(700u64))]);
        let reserved = BTreeMap::new();
        let active = BTreeSet::new();
        let route_last = BTreeMap::from([((2u64, 1u64), 140u64)]);

        let plan = build_asset_plan(
            &asset,
            &observed,
            PlannerContext {
                now_unix_seconds: 150,
                cooldown_seconds_per_route: 30,
                settle_buffer_weight: 0.01,
                reserved_outgoing_by_chain: &reserved,
                previously_active_deficits: &active,
                route_last_execution_by_pair: &route_last,
            },
        )
        .unwrap();

        assert!(plan.triggered);
        assert!(plan.transfers.is_empty());
        assert_eq!(plan.cooldown_blocked_transfers.len(), 1);
        assert_eq!(
            plan.cooldown_blocked_transfers[0].transfer.source_chain_id,
            2
        );
        assert_eq!(
            plan.cooldown_blocked_transfers[0]
                .transfer
                .destination_chain_id,
            1
        );
    }
}
