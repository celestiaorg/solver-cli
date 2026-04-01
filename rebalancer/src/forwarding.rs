use alloy::primitives::{Address, FixedBytes};
use anyhow::{Context, Result};
use bech32::{Bech32, Hrp};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const FORWARD_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize)]
pub(crate) struct CreateForwardingRequest {
    pub(crate) forward_addr: String,
    pub(crate) dest_domain: u32,
    pub(crate) dest_recipient: String,
    pub(crate) token_id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct ForwardingRequest {
    pub(crate) id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ForwardAddress {
    bytes: [u8; 20],
}

impl ForwardAddress {
    pub fn derive(
        dest_domain: u32,
        dest_recipient: FixedBytes<32>,
        token_id: &[u8],
    ) -> Result<Self> {
        let mut domain_bytes = [0u8; 32];
        domain_bytes[28..32].copy_from_slice(&dest_domain.to_be_bytes());

        let mut hasher = Sha256::new();
        hasher.update(domain_bytes);
        hasher.update(dest_recipient.as_slice());
        hasher.update(token_id);
        let call_digest = hasher.finalize();

        let mut hasher = Sha256::new();
        hasher.update([FORWARD_VERSION]);
        hasher.update(call_digest);
        let salt = hasher.finalize();

        let mut hasher = Sha256::new();
        hasher.update(b"module");
        let th = hasher.finalize();

        let mut hasher = Sha256::new();
        hasher.update(th);
        hasher.update(b"forwarding");
        hasher.update([0x00]);
        hasher.update(salt);
        let addr_hash = hasher.finalize();

        let mut bytes20 = [0u8; 20];
        bytes20.copy_from_slice(&addr_hash[..20]);
        Ok(Self { bytes: bytes20 })
    }

    pub fn to_bech32(&self) -> Result<String> {
        let hrp = Hrp::parse("celestia").context("Invalid bech32 HRP")?;
        bech32::encode::<Bech32>(hrp, &self.bytes).context("Failed to encode forwarding address")
    }

    pub fn to_bytes32(&self) -> FixedBytes<32> {
        let mut out = [0u8; 32];
        out[12..32].copy_from_slice(&self.bytes);
        FixedBytes::from(out)
    }

    pub fn to_address(&self) -> Address {
        Address::from_slice(&self.bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_is_deterministic_and_token_id_sensitive() {
        let dest_domain = 31338u32;
        let dest_recipient: FixedBytes<32> =
            "0x000000000000000000000000d5e85e86fc692cedad6d6992f1f0ccf273e39913"
                .parse()
                .unwrap();
        let token_a =
            hex::decode("000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
                .unwrap();
        let token_b =
            hex::decode("000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7")
                .unwrap();

        let fwd_a1 = ForwardAddress::derive(dest_domain, dest_recipient, &token_a).unwrap();
        let fwd_a2 = ForwardAddress::derive(dest_domain, dest_recipient, &token_a).unwrap();
        let fwd_b = ForwardAddress::derive(dest_domain, dest_recipient, &token_b).unwrap();

        // Same inputs → same address
        assert_eq!(fwd_a1.to_bytes32(), fwd_a2.to_bytes32());
        // Different token_id → different address
        assert_ne!(fwd_a1.to_bytes32(), fwd_b.to_bytes32());
        assert!(fwd_a1.to_bech32().unwrap().starts_with("celestia1"));
    }

    #[test]
    fn bytes32_is_left_padded_20_byte_address() {
        let dest_recipient: FixedBytes<32> =
            "0x00000000000000000000000000000000000000000000000000000000000000aa"
                .parse()
                .unwrap();
        let forward = ForwardAddress::derive(1u32, dest_recipient, b"test-token").unwrap();

        let bytes32_hex = forward.to_bytes32().to_string();
        assert_eq!(bytes32_hex.len(), 66);
        assert!(bytes32_hex.starts_with("0x"));
    }

    #[test]
    fn bech32_has_celestia_prefix() {
        let dest_recipient: FixedBytes<32> =
            "0x00000000000000000000000000000000000000000000000000000000000000bb"
                .parse()
                .unwrap();
        let forward = ForwardAddress::derive(2u32, dest_recipient, b"test-token").unwrap();
        assert!(forward.to_bech32().unwrap().starts_with("celestia1"));
    }

    #[test]
    fn address_conversion_matches_bytes32_tail() {
        let dest_recipient: FixedBytes<32> =
            "0x00000000000000000000000000000000000000000000000000000000000000cc"
                .parse()
                .unwrap();
        let forward = ForwardAddress::derive(3u32, dest_recipient, b"test-token").unwrap();
        let expected = format!("{:?}", forward.to_address());
        let bytes32 = forward.to_bytes32();
        assert_eq!(
            expected,
            format!("0x{}", hex::encode(&bytes32.as_slice()[12..]))
        );
    }
}
