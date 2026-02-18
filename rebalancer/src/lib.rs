pub mod balance;
pub mod config;
pub mod hyperlane;
pub mod planner;
pub mod service;
pub mod state;

use anyhow::Result;
use std::path::Path;

use config::RebalancerConfig;
use service::RebalancerService;

pub async fn run_from_config(config_path: &Path, once: bool) -> Result<()> {
    let config = RebalancerConfig::load(config_path)?;
    let project_root = std::env::current_dir()?;
    let mut service = RebalancerService::new(config, &project_root).await?;

    if once {
        service.run_once().await?;
    } else {
        service.run().await?;
    }

    Ok(())
}
