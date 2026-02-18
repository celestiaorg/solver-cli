pub mod balance;
pub mod bridge;
pub mod config;
pub mod planner;
pub mod service;
pub mod state;

use anyhow::Result;
use std::path::Path;

use config::RebalancerConfig;
use service::RebalancerService;

pub async fn run_from_config(config_path: &Path, once: bool) -> Result<()> {
    let config = RebalancerConfig::load(config_path)?;
    let mut service = RebalancerService::new(config).await?;

    if once {
        service.run_once().await?;
    } else {
        service.run().await?;
    }

    Ok(())
}
