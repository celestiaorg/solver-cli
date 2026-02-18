use alloy::primitives::U256;
use anyhow::{Context, Result};
use std::collections::BTreeMap;

use crate::config::AssetConfig;

const MIN_EFFECTIVE_RAW_TRANSFER: f64 = 1.0;
const WEIGHT_EPSILON: f64 = 1e-9;

#[derive(Debug, Clone)]
pub struct AssetPlan {
    pub symbol: String,
    pub decimals: u8,
    pub total_balance: U256,
    pub chain_states: Vec<ChainPlanState>,
    pub trigger_chain_ids: Vec<u64>,
    pub triggered: bool,
    pub reason: String,
    pub transfers: Vec<TransferPlan>,
}

#[derive(Debug, Clone)]
pub struct ChainPlanState {
    pub chain_id: u64,
    pub balance: U256,
    pub current_weight: f64,
    pub target_weight: f64,
    pub min_weight: f64,
    pub target_balance_raw: f64,
    pub deficit_raw: f64,
    pub surplus_raw: f64,
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

pub fn build_asset_plan(asset: &AssetConfig, balances: &BTreeMap<u64, U256>) -> Result<AssetPlan> {
    let mut total_balance = U256::ZERO;
    for balance in balances.values() {
        total_balance += *balance;
    }

    if total_balance.is_zero() {
        return Ok(AssetPlan {
            symbol: asset.symbol.clone(),
            decimals: asset.decimals,
            total_balance,
            chain_states: Vec::new(),
            trigger_chain_ids: Vec::new(),
            triggered: false,
            reason: "total balance is zero".to_string(),
            transfers: Vec::new(),
        });
    }

    let total_balance_f64 = u256_to_f64(total_balance)?;
    let mut chain_ids: Vec<u64> = asset.weights.keys().copied().collect();
    chain_ids.sort_unstable();

    let mut chain_states = Vec::with_capacity(chain_ids.len());
    let mut trigger_chain_ids = Vec::new();

    for chain_id in chain_ids {
        let balance = balances.get(&chain_id).copied().unwrap_or(U256::ZERO);
        let balance_f64 = u256_to_f64(balance)?;
        let target_weight = *asset
            .weights
            .get(&chain_id)
            .with_context(|| format!("Missing target weight for chain {}", chain_id))?;
        let min_weight = *asset
            .min_weights
            .get(&chain_id)
            .with_context(|| format!("Missing min_weight for chain {}", chain_id))?;

        let current_weight = if total_balance_f64 > 0.0 {
            balance_f64 / total_balance_f64
        } else {
            0.0
        };

        if current_weight + WEIGHT_EPSILON < min_weight {
            trigger_chain_ids.push(chain_id);
        }

        let target_balance_raw = total_balance_f64 * target_weight;
        let deficit_raw = (target_balance_raw - balance_f64).max(0.0);
        let surplus_raw = (balance_f64 - target_balance_raw).max(0.0);

        chain_states.push(ChainPlanState {
            chain_id,
            balance,
            current_weight,
            target_weight,
            min_weight,
            target_balance_raw,
            deficit_raw,
            surplus_raw,
        });
    }

    if trigger_chain_ids.is_empty() {
        return Ok(AssetPlan {
            symbol: asset.symbol.clone(),
            decimals: asset.decimals,
            total_balance,
            chain_states,
            trigger_chain_ids,
            triggered: false,
            reason: "no chain below configured min_weight".to_string(),
            transfers: Vec::new(),
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

    let transfers = match_greedy(deficits, surpluses);

    Ok(AssetPlan {
        symbol: asset.symbol.clone(),
        decimals: asset.decimals,
        total_balance,
        chain_states,
        trigger_chain_ids,
        triggered: true,
        reason: "one or more chains below min_weight".to_string(),
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
