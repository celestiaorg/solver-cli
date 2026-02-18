use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RebalancerState {
    pub last_cycle_at_unix_seconds: Option<u64>,
}
