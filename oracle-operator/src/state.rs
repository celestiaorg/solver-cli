use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use tracing::{debug, info, warn};

/// Persistent state for the oracle operator
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OperatorState {
    /// Last processed block per chain
    pub last_processed_block: HashMap<u64, u64>,

    /// Processed fill order IDs (to avoid duplicates)
    /// Stored as hex strings for JSON compatibility
    pub processed_fills: HashSet<String>,

    /// Version for future migrations
    #[serde(default = "default_version")]
    pub version: u32,
}

fn default_version() -> u32 {
    1
}

impl OperatorState {
    /// Check if an order has been processed
    pub fn is_processed(&self, order_id: &[u8; 32]) -> bool {
        self.processed_fills.contains(&hex::encode(order_id))
    }

    /// Mark an order as processed
    pub fn mark_processed(&mut self, order_id: &[u8; 32]) {
        self.processed_fills.insert(hex::encode(order_id));
    }

    /// Get the starting block for a chain
    pub fn get_start_block(
        &self,
        chain_id: u64,
        config_start: Option<u64>,
        current_block: u64,
    ) -> u64 {
        // Priority:
        // 1. Last processed block from state (+ 1 to avoid reprocessing)
        // 2. Config start_block
        // 3. Current block - 100 (fallback)
        if let Some(&last) = self.last_processed_block.get(&chain_id) {
            // Start from the next block after last processed
            last.saturating_add(1)
        } else if let Some(start) = config_start {
            start
        } else {
            current_block.saturating_sub(100)
        }
    }

    /// Update the last processed block for a chain
    pub fn set_last_block(&mut self, chain_id: u64, block: u64) {
        self.last_processed_block.insert(chain_id, block);
    }

    /// Prune old processed fills to prevent unbounded growth
    /// Keeps the most recent entries (by insertion order isn't tracked, so we just cap size)
    pub fn prune_if_needed(&mut self, max_entries: usize) {
        if self.processed_fills.len() > max_entries {
            warn!(
                "Processed fills exceeded {} entries, pruning oldest half",
                max_entries
            );
            // HashSet doesn't preserve order, so we just keep a random half
            // In production, consider using a proper LRU or time-based eviction
            let to_remove: Vec<_> = self
                .processed_fills
                .iter()
                .take(self.processed_fills.len() / 2)
                .cloned()
                .collect();
            for id in to_remove {
                self.processed_fills.remove(&id);
            }
        }
    }
}

/// Manages persistent state for the oracle operator
pub struct StateManager {
    state_path: PathBuf,
    state: OperatorState,
    dirty: bool,
}

impl StateManager {
    /// Create a new state manager, loading existing state if present
    pub fn new(state_dir: &Path) -> Result<Self> {
        let state_path = state_dir.join("oracle-state.json");

        let state = if state_path.exists() {
            let content = std::fs::read_to_string(&state_path)
                .with_context(|| format!("Failed to read state file: {:?}", state_path))?;

            match serde_json::from_str::<OperatorState>(&content) {
                Ok(s) => {
                    info!(
                        "Loaded operator state: {} chains tracked, {} processed fills",
                        s.last_processed_block.len(),
                        s.processed_fills.len()
                    );
                    s
                }
                Err(e) => {
                    warn!("Failed to parse state file, starting fresh: {}", e);
                    OperatorState::default()
                }
            }
        } else {
            info!("No existing state file, starting fresh");
            OperatorState::default()
        };

        Ok(Self {
            state_path,
            state,
            dirty: false,
        })
    }

    /// Get the current state
    pub fn state(&self) -> &OperatorState {
        &self.state
    }

    /// Check if an order has been processed
    pub fn is_processed(&self, order_id: &[u8; 32]) -> bool {
        self.state.is_processed(order_id)
    }

    /// Mark an order as processed
    pub fn mark_processed(&mut self, order_id: &[u8; 32]) {
        self.state.mark_processed(order_id);
        self.dirty = true;
    }

    /// Get the starting block for a chain
    pub fn get_start_block(
        &self,
        chain_id: u64,
        config_start: Option<u64>,
        current_block: u64,
    ) -> u64 {
        self.state
            .get_start_block(chain_id, config_start, current_block)
    }

    /// Update the last processed block for a chain
    pub fn set_last_block(&mut self, chain_id: u64, block: u64) {
        self.state.set_last_block(chain_id, block);
        self.dirty = true;
    }

    /// Save state to disk if dirty
    pub fn save_if_dirty(&mut self) -> Result<()> {
        if !self.dirty {
            return Ok(());
        }
        self.save()
    }

    /// Force save state to disk
    pub fn save(&mut self) -> Result<()> {
        // Prune if too many entries
        self.state.prune_if_needed(10_000);

        // Ensure directory exists
        if let Some(parent) = self.state_path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create state directory: {:?}", parent))?;
        }

        let content =
            serde_json::to_string_pretty(&self.state).context("Failed to serialize state")?;

        std::fs::write(&self.state_path, &content)
            .with_context(|| format!("Failed to write state file: {:?}", self.state_path))?;

        debug!("Saved operator state to {:?}", self.state_path);
        self.dirty = false;
        Ok(())
    }
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
            "oracle-operator-{}-{}-{}",
            label,
            std::process::id(),
            nanos
        ));
        std::fs::create_dir_all(&dir).expect("should create temp directory");
        dir
    }

    #[test]
    fn mark_processed_sets_dirty_and_persists_on_save_if_dirty() {
        let temp_dir = unique_temp_dir("mark-processed");
        let mut manager = StateManager::new(&temp_dir).expect("state manager should initialize");
        let order_id = [7u8; 32];

        manager.mark_processed(&order_id);
        assert!(manager.dirty, "dirty should be set after mark_processed");

        manager
            .save_if_dirty()
            .expect("save_if_dirty should persist dirty state");
        assert!(!manager.dirty, "dirty should be cleared after save");

        let state_path = temp_dir.join("oracle-state.json");
        let raw = std::fs::read_to_string(&state_path).expect("state file should exist");
        let on_disk: OperatorState =
            serde_json::from_str(&raw).expect("state file should parse as OperatorState");

        assert!(
            on_disk.processed_fills.contains(&hex::encode(order_id)),
            "processed order should be persisted"
        );

        std::fs::remove_dir_all(&temp_dir).expect("temp directory should be removable");
    }

    #[test]
    fn set_last_block_sets_dirty_and_persists_on_save_if_dirty() {
        let temp_dir = unique_temp_dir("set-last-block");
        let mut manager = StateManager::new(&temp_dir).expect("state manager should initialize");

        manager.set_last_block(11155111, 42);
        assert!(manager.dirty, "dirty should be set after set_last_block");

        manager
            .save_if_dirty()
            .expect("save_if_dirty should persist dirty state");
        assert!(!manager.dirty, "dirty should be cleared after save");

        let state_path = temp_dir.join("oracle-state.json");
        let raw = std::fs::read_to_string(&state_path).expect("state file should exist");
        let on_disk: OperatorState =
            serde_json::from_str(&raw).expect("state file should parse as OperatorState");

        assert_eq!(on_disk.last_processed_block.get(&11155111), Some(&42));

        std::fs::remove_dir_all(&temp_dir).expect("temp directory should be removable");
    }

    #[test]
    fn save_if_dirty_is_noop_when_clean() {
        let temp_dir = unique_temp_dir("save-clean");
        let mut manager = StateManager::new(&temp_dir).expect("state manager should initialize");

        manager
            .save_if_dirty()
            .expect("save_if_dirty should not fail for clean state");

        let state_path = temp_dir.join("oracle-state.json");
        assert!(
            !state_path.exists(),
            "no state file should be written when state is clean"
        );

        std::fs::remove_dir_all(&temp_dir).expect("temp directory should be removable");
    }
}
