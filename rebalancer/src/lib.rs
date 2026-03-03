pub mod client;
pub mod config;
pub mod forwarding;
pub mod planner;
pub mod service;
pub mod signer;

use anyhow::Result;
use std::path::Path;
use std::sync::Once;

use config::RebalancerConfig;
use service::RebalancerService;

static RUSTLS_PROVIDER_INIT: Once = Once::new();

fn install_rustls_crypto_provider() {
    RUSTLS_PROVIDER_INIT.call_once(|| {
        // This crate can pull both `ring` and `aws-lc-rs`; pick one explicitly.
        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
    });
}

pub async fn run_from_config(config_path: &Path, once: bool) -> Result<()> {
    install_rustls_crypto_provider();

    let config = RebalancerConfig::load(config_path)?;
    let mut service = RebalancerService::new(config).await?;

    if once {
        service.run_once().await?;
    } else {
        service.run().await?;
    }

    Ok(())
}
