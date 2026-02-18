use anyhow::{bail, Result};
use async_trait::async_trait;

use super::{
    BridgeAdapter, BridgeQuote, BridgeTransferHandle, BridgeTransferRequest, BridgeTransferStatus,
};
use crate::config::HyperlaneWarpConfig;

pub struct HyperlaneWarpAdapter {
    #[allow(dead_code)]
    config: HyperlaneWarpConfig,
}

impl HyperlaneWarpAdapter {
    pub fn new(config: HyperlaneWarpConfig) -> Self {
        Self { config }
    }
}

#[async_trait]
impl BridgeAdapter for HyperlaneWarpAdapter {
    async fn quote(&self, _req: BridgeTransferRequest) -> Result<BridgeQuote> {
        bail!("Hyperlane Warp adapter is not implemented in Phase 1")
    }

    async fn transfer(&self, _req: BridgeTransferRequest) -> Result<BridgeTransferHandle> {
        bail!("Hyperlane Warp adapter is not implemented in Phase 1")
    }

    async fn status(&self, _handle: &BridgeTransferHandle) -> Result<BridgeTransferStatus> {
        bail!("Hyperlane Warp adapter is not implemented in Phase 1")
    }
}
