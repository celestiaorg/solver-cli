//! Protocol registry — thin wrapper around the canonical Permit2 address.
//!
//! Permit2 is deployed at the same address on every supported chain.
//! EIP-3009 support is detected at runtime via RPC (see custody.rs).

use alloy_primitives::Address;
use once_cell::sync::Lazy;

/// Canonical Permit2 address — identical on every chain that has it deployed.
const PERMIT2_CANONICAL: &str = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/// Global protocol registry instance.
pub static PROTOCOL_REGISTRY: Lazy<ProtocolRegistry> = Lazy::new(ProtocolRegistry::new);

pub struct ProtocolRegistry {
    permit2_address: Address,
}

impl ProtocolRegistry {
    fn new() -> Self {
        Self {
            permit2_address: PERMIT2_CANONICAL
                .parse()
                .expect("valid Permit2 canonical address"),
        }
    }

    /// Returns the Permit2 address. Permit2 is deployed at the canonical address
    /// on all supported chains, so this always succeeds.
    pub fn get_permit2_address(&self, _chain_id: u64) -> Option<Address> {
        Some(self.permit2_address)
    }
}
