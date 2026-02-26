use alloy::primitives::{Address, FixedBytes};
use anyhow::{Context, Result};
use bech32::{Bech32, Hrp};
use sha2::{Digest, Sha256};

const FORWARD_VERSION: u8 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ForwardAddress {
    bytes: [u8; 20],
}

impl ForwardAddress {
    pub fn derive(dest_domain: u32, dest_recipient: FixedBytes<32>) -> Result<Self> {
        let mut domain_bytes = [0u8; 32];
        domain_bytes[28..32].copy_from_slice(&dest_domain.to_be_bytes());

        let mut hasher = Sha256::new();
        hasher.update(domain_bytes);
        hasher.update(dest_recipient.as_slice());
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
    fn derive_forward_address_matches_expected_vector() {
        let dest_domain = 31338u32;
        let dest_recipient: FixedBytes<32> =
            "0x000000000000000000000000d5e85e86fc692cedad6d6992f1f0ccf273e39913"
                .parse()
                .unwrap();

        let forward = ForwardAddress::derive(dest_domain, dest_recipient).unwrap();

        assert_eq!(
            forward.to_bytes32().to_string(),
            "0x000000000000000000000000dade7778d258d5aaab4e350cc4f631c2e7b5d504"
        );
        assert_eq!(
            forward.to_bech32().unwrap(),
            "celestia1mt08w7xjtr26426wx5xvfa33ctnmt4gyxfqytj"
        );
    }

    #[test]
    fn bytes32_is_left_padded_20_byte_address() {
        let dest_recipient: FixedBytes<32> =
            "0x00000000000000000000000000000000000000000000000000000000000000aa"
                .parse()
                .unwrap();
        let forward = ForwardAddress::derive(1u32, dest_recipient).unwrap();

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
        let forward = ForwardAddress::derive(2u32, dest_recipient).unwrap();
        assert!(forward.to_bech32().unwrap().starts_with("celestia1"));
    }

    #[test]
    fn address_conversion_matches_bytes32_tail() {
        let dest_recipient: FixedBytes<32> =
            "0x00000000000000000000000000000000000000000000000000000000000000cc"
                .parse()
                .unwrap();
        let forward = ForwardAddress::derive(3u32, dest_recipient).unwrap();
        let expected = format!("{:?}", forward.to_address());
        let bytes32 = forward.to_bytes32();
        assert_eq!(
            expected,
            format!("0x{}", hex::encode(&bytes32.as_slice()[12..]))
        );
    }
}
