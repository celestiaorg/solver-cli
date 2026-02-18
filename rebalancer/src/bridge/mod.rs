pub mod hyperlane_warp;

use anyhow::Result;
use async_trait::async_trait;

#[derive(Debug, Clone)]
pub struct BridgeTransferRequest {
    pub asset_symbol: String,
    pub source_chain_id: u64,
    pub destination_chain_id: u64,
    pub token_address_source: String,
    pub token_address_destination: String,
    pub amount: String,
    pub recipient: String,
}

#[derive(Debug, Clone)]
pub struct BridgeQuote {
    pub estimated_fee_native: String,
    pub estimated_eta_seconds: u64,
}

#[derive(Debug, Clone)]
pub struct BridgeTransferHandle {
    pub transfer_id: String,
    pub source_tx_hash: String,
}

#[derive(Debug, Clone)]
pub enum BridgeTransferStatus {
    Pending,
    Delivered,
    Failed { reason: String },
    TimedOut,
}

#[async_trait]
pub trait BridgeAdapter: Send + Sync {
    async fn quote(&self, req: BridgeTransferRequest) -> Result<BridgeQuote>;
    async fn transfer(&self, req: BridgeTransferRequest) -> Result<BridgeTransferHandle>;
    async fn status(&self, handle: &BridgeTransferHandle) -> Result<BridgeTransferStatus>;
}
