use alloy::primitives::U256;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::path::{Path, PathBuf};
use tracing::{debug, info, warn};

const STATE_DIR: &str = ".rebalancer";
const STATE_FILE: &str = "state.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebalancerState {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub last_cycle_at_unix_seconds: Option<u64>,
    #[serde(default)]
    pub last_observed_balances: HashMap<String, HashMap<u64, String>>,
    #[serde(default)]
    pub inflight_transfers: Vec<InFlightTransfer>,
    #[serde(default)]
    pub route_last_execution_unix: HashMap<String, HashMap<u64, HashMap<u64, u64>>>,
    #[serde(default)]
    pub active_deficit_chains: HashMap<String, Vec<u64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InFlightTransfer {
    pub id: String,
    pub asset_symbol: String,
    pub source_chain_id: u64,
    pub destination_chain_id: u64,
    pub amount_raw: String,
    pub status: TransferStatus,
    pub created_at_unix_seconds: u64,
    pub updated_at_unix_seconds: u64,
    #[serde(default)]
    pub message_id: Option<String>,
    #[serde(default)]
    pub source_tx_hash: Option<String>,
    #[serde(default)]
    pub destination_tx_hash: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TransferStatus {
    Planned,
    Submitted,
    Delivered,
    Failed,
    TimedOut,
}

impl TransferStatus {
    pub fn is_pending(&self) -> bool {
        matches!(self, Self::Planned | Self::Submitted)
    }
}

fn default_version() -> u32 {
    1
}

impl Default for RebalancerState {
    fn default() -> Self {
        Self {
            version: default_version(),
            last_cycle_at_unix_seconds: None,
            last_observed_balances: HashMap::new(),
            inflight_transfers: Vec::new(),
            route_last_execution_unix: HashMap::new(),
            active_deficit_chains: HashMap::new(),
        }
    }
}

pub struct StateManager {
    state_path: PathBuf,
    state: RebalancerState,
    dirty: bool,
}

impl StateManager {
    pub fn new(project_root: &Path) -> Result<Self> {
        let state_path = project_root.join(STATE_DIR).join(STATE_FILE);

        let state = if state_path.exists() {
            let raw = std::fs::read_to_string(&state_path)
                .with_context(|| format!("Failed to read state file: {}", state_path.display()))?;
            match serde_json::from_str::<RebalancerState>(&raw) {
                Ok(state) => {
                    info!(
                        "Loaded rebalancer state: {} assets with balances, {} inflight transfers",
                        state.last_observed_balances.len(),
                        state.inflight_transfers.len()
                    );
                    state
                }
                Err(err) => {
                    warn!("Failed to parse rebalancer state (starting fresh): {}", err);
                    RebalancerState::default()
                }
            }
        } else {
            info!("No rebalancer state found, starting fresh");
            RebalancerState::default()
        };

        let mut manager = Self {
            state_path,
            state,
            dirty: false,
        };

        if manager.state.version == 0 {
            manager.state.version = default_version();
            manager.dirty = true;
        }

        Ok(manager)
    }

    pub fn state_path(&self) -> &Path {
        &self.state_path
    }

    pub fn set_last_cycle(&mut self, now_unix_seconds: u64) {
        if self.state.last_cycle_at_unix_seconds != Some(now_unix_seconds) {
            self.state.last_cycle_at_unix_seconds = Some(now_unix_seconds);
            self.dirty = true;
        }
    }

    pub fn set_last_observed_balance(&mut self, asset_symbol: &str, chain_id: u64, balance: U256) {
        let asset_key = normalize_asset_key(asset_symbol);
        let chain_balances = self
            .state
            .last_observed_balances
            .entry(asset_key)
            .or_default();
        let next = balance.to_string();
        if chain_balances.get(&chain_id) != Some(&next) {
            chain_balances.insert(chain_id, next);
            self.dirty = true;
        }
    }

    pub fn reserved_outgoing_by_chain(&self, asset_symbol: &str) -> BTreeMap<u64, U256> {
        let mut reserved = BTreeMap::new();
        let normalized_asset = normalize_asset_key(asset_symbol);

        for transfer in &self.state.inflight_transfers {
            if normalize_asset_key(&transfer.asset_symbol) != normalized_asset {
                continue;
            }
            if !transfer.status.is_pending() {
                continue;
            }
            match transfer.amount_raw.parse::<U256>() {
                Ok(amount) => {
                    let entry = reserved
                        .entry(transfer.source_chain_id)
                        .or_insert(U256::ZERO);
                    *entry += amount;
                }
                Err(err) => {
                    warn!(
                        "Ignoring invalid inflight transfer amount '{}' for {}: {}",
                        transfer.amount_raw, transfer.id, err
                    );
                }
            }
        }

        reserved
    }

    pub fn active_deficit_chains(&self, asset_symbol: &str) -> BTreeSet<u64> {
        self.state
            .active_deficit_chains
            .get(&normalize_asset_key(asset_symbol))
            .map(|chains| chains.iter().copied().collect())
            .unwrap_or_default()
    }

    pub fn set_active_deficit_chains(&mut self, asset_symbol: &str, active_chains: &BTreeSet<u64>) {
        let key = normalize_asset_key(asset_symbol);
        let next: Vec<u64> = active_chains.iter().copied().collect();
        let current = self.state.active_deficit_chains.get(&key);
        if current != Some(&next) {
            self.state.active_deficit_chains.insert(key, next);
            self.dirty = true;
        }
    }

    pub fn route_last_execution_for_asset(&self, asset_symbol: &str) -> BTreeMap<(u64, u64), u64> {
        let mut values = BTreeMap::new();
        let key = normalize_asset_key(asset_symbol);
        if let Some(by_source) = self.state.route_last_execution_unix.get(&key) {
            for (source_chain_id, by_destination) in by_source {
                for (destination_chain_id, timestamp) in by_destination {
                    values.insert((*source_chain_id, *destination_chain_id), *timestamp);
                }
            }
        }
        values
    }

    pub fn set_route_last_execution(
        &mut self,
        asset_symbol: &str,
        source_chain_id: u64,
        destination_chain_id: u64,
        now_unix_seconds: u64,
    ) {
        let key = normalize_asset_key(asset_symbol);
        let by_source = self.state.route_last_execution_unix.entry(key).or_default();
        let by_destination = by_source.entry(source_chain_id).or_default();
        if by_destination.get(&destination_chain_id) != Some(&now_unix_seconds) {
            by_destination.insert(destination_chain_id, now_unix_seconds);
            self.dirty = true;
        }
    }

    pub fn inflight_pending_count(&self) -> usize {
        self.state
            .inflight_transfers
            .iter()
            .filter(|transfer| transfer.status.is_pending())
            .count()
    }

    pub fn has_pending_route(
        &self,
        asset_symbol: &str,
        source_chain_id: u64,
        destination_chain_id: u64,
    ) -> bool {
        let normalized = normalize_asset_key(asset_symbol);
        self.state.inflight_transfers.iter().any(|transfer| {
            normalize_asset_key(&transfer.asset_symbol) == normalized
                && transfer.source_chain_id == source_chain_id
                && transfer.destination_chain_id == destination_chain_id
                && transfer.status.is_pending()
        })
    }

    pub fn pending_submitted_transfers(&self) -> Vec<InFlightTransfer> {
        self.state
            .inflight_transfers
            .iter()
            .filter(|transfer| transfer.status == TransferStatus::Submitted)
            .cloned()
            .collect()
    }

    pub fn pending_planned_transfers(&self) -> Vec<InFlightTransfer> {
        self.state
            .inflight_transfers
            .iter()
            .filter(|transfer| transfer.status == TransferStatus::Planned)
            .cloned()
            .collect()
    }

    pub fn create_planned_transfer(
        &mut self,
        asset_symbol: &str,
        source_chain_id: u64,
        destination_chain_id: u64,
        amount_raw: U256,
        now_unix_seconds: u64,
    ) -> String {
        let normalized_asset = normalize_asset_key(asset_symbol);
        let id = format!(
            "{}-{}-{}-{}-{}",
            normalized_asset,
            source_chain_id,
            destination_chain_id,
            now_unix_seconds,
            self.state.inflight_transfers.len() + 1
        );
        self.state.inflight_transfers.push(InFlightTransfer {
            id: id.clone(),
            asset_symbol: normalized_asset,
            source_chain_id,
            destination_chain_id,
            amount_raw: amount_raw.to_string(),
            status: TransferStatus::Planned,
            created_at_unix_seconds: now_unix_seconds,
            updated_at_unix_seconds: now_unix_seconds,
            message_id: None,
            source_tx_hash: None,
            destination_tx_hash: None,
            error: None,
        });
        self.dirty = true;
        id
    }

    pub fn mark_submitted(
        &mut self,
        transfer_id: &str,
        source_tx_hash: &str,
        message_id: Option<&str>,
        now_unix_seconds: u64,
    ) -> Result<()> {
        let transfer = self
            .find_transfer_mut(transfer_id)
            .ok_or_else(|| anyhow::anyhow!("Unknown transfer id {}", transfer_id))?;
        transfer.status = TransferStatus::Submitted;
        transfer.source_tx_hash = Some(source_tx_hash.to_string());
        transfer.message_id = message_id.map(ToOwned::to_owned);
        transfer.updated_at_unix_seconds = now_unix_seconds;
        transfer.error = None;
        self.dirty = true;
        Ok(())
    }

    pub fn mark_delivered(
        &mut self,
        transfer_id: &str,
        destination_tx_hash: Option<&str>,
        now_unix_seconds: u64,
    ) -> Result<()> {
        let transfer = self
            .find_transfer_mut(transfer_id)
            .ok_or_else(|| anyhow::anyhow!("Unknown transfer id {}", transfer_id))?;
        transfer.status = TransferStatus::Delivered;
        transfer.destination_tx_hash = destination_tx_hash.map(ToOwned::to_owned);
        transfer.updated_at_unix_seconds = now_unix_seconds;
        transfer.error = None;
        self.dirty = true;
        Ok(())
    }

    pub fn mark_failed(
        &mut self,
        transfer_id: &str,
        error: impl Into<String>,
        now_unix_seconds: u64,
    ) -> Result<()> {
        let transfer = self
            .find_transfer_mut(transfer_id)
            .ok_or_else(|| anyhow::anyhow!("Unknown transfer id {}", transfer_id))?;
        transfer.status = TransferStatus::Failed;
        transfer.updated_at_unix_seconds = now_unix_seconds;
        transfer.error = Some(error.into());
        self.dirty = true;
        Ok(())
    }

    pub fn mark_timed_out(&mut self, transfer_id: &str, now_unix_seconds: u64) -> Result<()> {
        let transfer = self
            .find_transfer_mut(transfer_id)
            .ok_or_else(|| anyhow::anyhow!("Unknown transfer id {}", transfer_id))?;
        transfer.status = TransferStatus::TimedOut;
        transfer.updated_at_unix_seconds = now_unix_seconds;
        if transfer.error.is_none() {
            transfer.error = Some("timed out while waiting for source transaction receipt".into());
        }
        self.dirty = true;
        Ok(())
    }

    pub fn save_if_dirty(&mut self) -> Result<()> {
        if !self.dirty {
            return Ok(());
        }
        self.save()
    }

    pub fn save(&mut self) -> Result<()> {
        if let Some(parent) = self.state_path.parent() {
            std::fs::create_dir_all(parent).with_context(|| {
                format!("Failed to create state directory: {}", parent.display())
            })?;
        }

        let data =
            serde_json::to_string_pretty(&self.state).context("Failed to serialize state")?;
        std::fs::write(&self.state_path, data).with_context(|| {
            format!("Failed to write state file: {}", self.state_path.display())
        })?;

        debug!("Saved rebalancer state to {}", self.state_path.display());
        self.dirty = false;
        Ok(())
    }

    fn find_transfer_mut(&mut self, transfer_id: &str) -> Option<&mut InFlightTransfer> {
        self.state
            .inflight_transfers
            .iter_mut()
            .find(|transfer| transfer.id == transfer_id)
    }
}

fn normalize_asset_key(symbol: &str) -> String {
    symbol.trim().to_ascii_uppercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "rebalancer-state-{}-{}-{}",
            label,
            std::process::id(),
            nanos
        ));
        std::fs::create_dir_all(&dir).expect("should create temp directory");
        dir
    }

    #[test]
    fn persists_active_deficits_and_route_timestamps() {
        let temp_dir = unique_temp_dir("persist");
        let mut manager = StateManager::new(&temp_dir).expect("state manager should initialize");
        let mut active = BTreeSet::new();
        active.insert(1234);
        active.insert(11155111);

        manager.set_active_deficit_chains("USDC", &active);
        manager.set_route_last_execution("USDC", 1234, 11155111, 42);
        manager
            .save_if_dirty()
            .expect("save_if_dirty should persist state");

        let reloaded = StateManager::new(&temp_dir).expect("state manager should reload");
        assert_eq!(
            reloaded.active_deficit_chains("usdc"),
            active,
            "asset key should be case-insensitive"
        );
        assert_eq!(
            reloaded
                .route_last_execution_for_asset("USDC")
                .get(&(1234, 11155111)),
            Some(&42)
        );

        std::fs::remove_dir_all(temp_dir).expect("temp directory should be removable");
    }

    #[test]
    fn computes_reserved_outgoing_from_pending_inflight() {
        let temp_dir = unique_temp_dir("reserved");
        let mut manager = StateManager::new(&temp_dir).expect("state manager should initialize");

        manager.state.inflight_transfers = vec![
            InFlightTransfer {
                id: "a".to_string(),
                asset_symbol: "USDC".to_string(),
                source_chain_id: 1234,
                destination_chain_id: 11155111,
                amount_raw: "1000".to_string(),
                status: TransferStatus::Submitted,
                created_at_unix_seconds: 1,
                updated_at_unix_seconds: 1,
                message_id: None,
                source_tx_hash: None,
                destination_tx_hash: None,
                error: None,
            },
            InFlightTransfer {
                id: "b".to_string(),
                asset_symbol: "USDC".to_string(),
                source_chain_id: 1234,
                destination_chain_id: 84532,
                amount_raw: "500".to_string(),
                status: TransferStatus::Delivered,
                created_at_unix_seconds: 1,
                updated_at_unix_seconds: 1,
                message_id: None,
                source_tx_hash: None,
                destination_tx_hash: None,
                error: None,
            },
        ];

        let reserved = manager.reserved_outgoing_by_chain("usdc");
        assert_eq!(reserved.get(&1234), Some(&U256::from(1000u64)));

        std::fs::remove_dir_all(temp_dir).expect("temp directory should be removable");
    }
}
