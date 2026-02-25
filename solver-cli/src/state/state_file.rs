use anyhow::{Context, Result};
use chrono::Utc;
use std::path::{Path, PathBuf};
use tokio::fs;

use super::types::SolverState;

const STATE_DIR: &str = ".config";
const STATE_FILE: &str = "state.json";

/// Manages the solver state file
pub struct StateManager {
    state_path: PathBuf,
}

impl StateManager {
    /// Create a new state manager for the given project directory
    pub fn new(project_dir: &Path) -> Self {
        Self {
            state_path: project_dir.join(STATE_DIR).join(STATE_FILE),
        }
    }

    /// Get the state directory path
    pub fn state_dir(&self) -> PathBuf {
        self.state_path.parent().unwrap().to_path_buf()
    }

    /// Check if state file exists
    pub async fn exists(&self) -> bool {
        self.state_path.exists()
    }

    /// Load state from file, returns None if file doesn't exist
    pub async fn load(&self) -> Result<Option<SolverState>> {
        if !self.state_path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&self.state_path)
            .await
            .context("Failed to read state file")?;

        let state: SolverState =
            serde_json::from_str(&content).context("Failed to parse state file")?;

        Ok(Some(state))
    }

    /// Load state, returning error if not found
    pub async fn load_or_error(&self) -> Result<SolverState> {
        self.load()
            .await?
            .ok_or_else(|| anyhow::anyhow!("State file not found. Run 'solver-cli init' first."))
    }

    /// Save state to file
    pub async fn save(&self, state: &SolverState) -> Result<()> {
        // Ensure directory exists
        if let Some(parent) = self.state_path.parent() {
            fs::create_dir_all(parent)
                .await
                .context("Failed to create state directory")?;
        }

        // Update timestamp
        let mut state = state.clone();
        state.last_updated = Utc::now();

        let content = serde_json::to_string_pretty(&state).context("Failed to serialize state")?;

        fs::write(&self.state_path, content)
            .await
            .context("Failed to write state file")?;

        Ok(())
    }

    /// Initialize a new state file
    pub async fn init(&self, env: super::types::Environment) -> Result<SolverState> {
        let state = SolverState {
            env,
            last_updated: Utc::now(),
            ..Default::default()
        };

        self.save(&state).await?;
        Ok(state)
    }

}
