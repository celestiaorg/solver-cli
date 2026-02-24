use alloy::{
    network::EthereumWallet,
    primitives::Address,
    signers::aws::{
        aws_config::{self, BehaviorVersion},
        aws_sdk_kms::{self, config::Region},
        AwsSigner,
    },
    signers::{local::PrivateKeySigner, Signer},
};
use anyhow::{bail, Context, Result};

use crate::config::{ChainConfig, SignerConfig};

#[derive(Debug, Clone)]
pub struct TxSigner {
    pub address: Address,
    pub wallet: EthereumWallet,
}

impl TxSigner {
    pub async fn new(chain: &ChainConfig) -> Result<Self> {
        let signer_config = &chain.signer;

        match signer_config {
            SignerConfig::Env => Self::from_env(chain),
            SignerConfig::File { key } => Self::from_file(key, "chains.signer.key"),
            SignerConfig::AwsKms { key_id, region } => {
                let backend = AwsKmsRemoteSignerBackend {
                    key_id: key_id.clone(),
                    region: region.clone(),
                };
                backend.new(chain).await
            }
        }
    }

    fn from_env(chain: &ChainConfig) -> Result<Self> {
        let chain_env = normalize_env_key(&chain.name);
        let chain_key = format!("REBALANCER_{}_PK", chain_env);

        if let Some(raw) = read_env_key(&chain_key)? {
            return Self::from_file(&raw, &chain_key);
        }
        if let Some(raw) = read_env_key("REBALANCER_PRIVATE_KEY")? {
            return Self::from_file(&raw, "REBALANCER_PRIVATE_KEY");
        }

        bail!(
            "No key found for chain {}. Tried {} then REBALANCER_PRIVATE_KEY",
            chain.name,
            chain_key
        )
    }

    fn from_file(raw: &str, source: &str) -> Result<Self> {
        let signer = parse_signer_key(raw, source)?;
        Ok(Self {
            address: signer.address(),
            wallet: EthereumWallet::from(signer),
        })
    }
}

#[derive(Debug, Clone)]
pub struct AwsKmsRemoteSignerBackend {
    key_id: String,
    region: String,
}

impl AwsKmsRemoteSignerBackend {
    async fn new(&self, chain: &ChainConfig) -> Result<TxSigner> {
        let sdk_config = aws_config::defaults(BehaviorVersion::latest())
            .region(Region::new(self.region.clone()))
            .load()
            .await;
        let kms_client = aws_sdk_kms::Client::new(&sdk_config);
        let signer = AwsSigner::new(kms_client, self.key_id.clone(), None)
            .await
            .with_context(|| {
                format!(
                    "Failed to initialize aws_kms signer for chain {}",
                    chain.name
                )
            })?;
        let address = signer.address();

        Ok(TxSigner {
            address,
            wallet: EthereumWallet::from(signer),
        })
    }
}

fn normalize_env_key(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_uppercase()
            } else {
                '_'
            }
        })
        .collect()
}

fn parse_signer_key(raw: &str, source: &str) -> Result<PrivateKeySigner> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        bail!("Signer key from {} is empty", source);
    }
    let pk = trimmed.strip_prefix("0x").unwrap_or(trimmed);
    pk.parse()
        .with_context(|| format!("Invalid private key format from {}", source))
}

fn read_env_key(name: &str) -> Result<Option<String>> {
    match std::env::var(name) {
        Ok(value) => {
            if value.trim().is_empty() {
                bail!("Environment variable {} is set but empty", name);
            }
            Ok(Some(value))
        }
        Err(std::env::VarError::NotPresent) => Ok(None),
        Err(std::env::VarError::NotUnicode(_)) => {
            bail!("Environment variable {} contains invalid unicode", name)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::SignerConfig;
    use std::sync::{LazyLock, Mutex};

    static ENV_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

    const KEY_ONE: &str =
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const ADDR_ONE: &str = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const KEY_TWO: &str =
        "0x59c6995e998f97a5a0044966f0945387dc9e86dae88c7a8412f4603b6b78690d";
    const ADDR_TWO: &str = "0x1f73f05F1C220E57e4D43c5D9B55063B92E5758E";

    fn parse_address(raw: &str) -> Address {
        raw.parse::<Address>().unwrap()
    }

    fn clear_signer_env() {
        std::env::remove_var("REBALANCER_PRIVATE_KEY");
        std::env::remove_var("REBALANCER_EVOLVE_PK");
        std::env::remove_var("REBALANCER_ARB_SEPOLIA_PK");
    }

    fn lock_env() -> std::sync::MutexGuard<'static, ()> {
        ENV_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    struct EnvCleanup;

    impl Drop for EnvCleanup {
        fn drop(&mut self) {
            clear_signer_env();
        }
    }

    fn sample_chain(name: &str, signer: SignerConfig) -> ChainConfig {
        ChainConfig {
            name: name.to_string(),
            chain_id: 1,
            rpc_url: "http://127.0.0.1:8545".to_string(),
            account: "0x0000000000000000000000000000000000000001".to_string(),
            account_address: "0x0000000000000000000000000000000000000001"
                .parse()
                .unwrap(),
            signer,
        }
    }

    #[test]
    fn normalizes_chain_name_for_env_key_lookup() {
        assert_eq!(normalize_env_key("arb-sepolia"), "ARB_SEPOLIA");
        assert_eq!(normalize_env_key("base.sepolia"), "BASE_SEPOLIA");
    }

    #[test]
    fn env_signer_uses_global_fallback() {
        let _env_lock = lock_env();
        let _cleanup = EnvCleanup;
        clear_signer_env();
        std::env::set_var("REBALANCER_PRIVATE_KEY", KEY_ONE);
        let chain = sample_chain("evolve", SignerConfig::Env);
        let signer = TxSigner::from_env(&chain).unwrap();
        assert_eq!(signer.address, parse_address(ADDR_ONE));
    }

    #[test]
    fn env_signer_prefers_chain_specific_key_over_global_fallback() {
        let _env_lock = lock_env();
        let _cleanup = EnvCleanup;
        clear_signer_env();
        std::env::set_var("REBALANCER_EVOLVE_PK", KEY_TWO);
        std::env::set_var("REBALANCER_PRIVATE_KEY", KEY_ONE);

        let chain = sample_chain("evolve", SignerConfig::Env);
        let signer = TxSigner::from_env(&chain).unwrap();
        assert_eq!(signer.address, parse_address(ADDR_TWO));
    }

    #[test]
    fn env_signer_errors_when_no_key_available() {
        let _env_lock = lock_env();
        let _cleanup = EnvCleanup;
        clear_signer_env();

        let chain = sample_chain("evolve", SignerConfig::Env);
        let err = TxSigner::from_env(&chain).unwrap_err();
        assert!(
            err.to_string().contains(
                "No key found for chain evolve. Tried REBALANCER_EVOLVE_PK then REBALANCER_PRIVATE_KEY"
            )
        );
    }

    #[test]
    fn env_signer_errors_when_chain_key_is_empty() {
        let _env_lock = lock_env();
        let _cleanup = EnvCleanup;
        clear_signer_env();
        std::env::set_var("REBALANCER_EVOLVE_PK", "   ");
        std::env::set_var("REBALANCER_PRIVATE_KEY", KEY_ONE);

        let chain = sample_chain("evolve", SignerConfig::Env);
        let err = TxSigner::from_env(&chain).unwrap_err();
        assert!(
            err.to_string()
                .contains("Environment variable REBALANCER_EVOLVE_PK is set but empty")
        );
    }

    #[test]
    fn file_signer_reads_key_field() {
        let signer = TxSigner::from_file(KEY_ONE, "chains.signer.key").unwrap();
        assert_eq!(signer.address, parse_address(ADDR_ONE));
    }

    #[test]
    fn file_signer_accepts_key_without_0x_prefix() {
        let signer = TxSigner::from_file(&KEY_ONE[2..], "chains.signer.key").unwrap();
        assert_eq!(signer.address, parse_address(ADDR_ONE));
    }

    #[test]
    fn file_signer_rejects_invalid_key() {
        let err = TxSigner::from_file("not-a-private-key", "chains.signer.key")
            .unwrap_err()
            .to_string();
        assert!(err.contains("Invalid private key format from chains.signer.key"));
    }
}
