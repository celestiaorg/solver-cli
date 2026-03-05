use alloy::{
    network::EthereumWallet,
    primitives::Address,
    signers::aws::AwsSigner,
    signers::{local::PrivateKeySigner, Signer},
};
use anyhow::{bail, Context, Result};
use aws_config::BehaviorVersion;
use aws_sdk_kms::{self, config::Region};

use crate::config::SignerConfig;

#[derive(Debug, Clone)]
pub struct TxSigner {
    pub address: Address,
    pub wallet: EthereumWallet,
    backend: SigningBackend,
}

#[derive(Debug, Clone)]
enum SigningBackend {
    Local(PrivateKeySigner),
    AwsKms(AwsSigner),
}

impl TxSigner {
    pub async fn new(config: &SignerConfig) -> Result<Self> {
        match config {
            SignerConfig::Env => Self::from_env(),
            SignerConfig::File { key } => Self::from_file(key, "signer.key"),
            SignerConfig::AwsKms { key_id, region } => {
                let backend = AwsKmsRemoteSignerBackend {
                    key_id: key_id.clone(),
                    region: region.clone(),
                };
                backend.load_signer().await
            }
        }
    }

    fn from_env() -> Result<Self> {
        let raw = read_env_key("ORACLE_OPERATOR_PK")?.ok_or_else(|| {
            anyhow::anyhow!("No key found. Expected environment variable ORACLE_OPERATOR_PK")
        })?;
        Self::from_file(&raw, "ORACLE_OPERATOR_PK")
    }

    fn from_file(raw: &str, source: &str) -> Result<Self> {
        let signer = parse_signer_key(raw, source)?;
        Ok(Self {
            address: signer.address(),
            wallet: EthereumWallet::from(signer.clone()),
            backend: SigningBackend::Local(signer),
        })
    }

    pub async fn sign_message(&self, message: &[u8]) -> Result<Vec<u8>> {
        let signature = match &self.backend {
            SigningBackend::Local(signer) => signer.sign_message(message).await?,
            SigningBackend::AwsKms(signer) => signer.sign_message(message).await?,
        };
        Ok(signature.as_bytes().to_vec())
    }
}

#[derive(Debug, Clone)]
pub struct AwsKmsRemoteSignerBackend {
    key_id: String,
    region: String,
}

impl AwsKmsRemoteSignerBackend {
    async fn load_signer(&self) -> Result<TxSigner> {
        let sdk_config = aws_config::defaults(BehaviorVersion::latest())
            .region(Region::new(self.region.clone()))
            .load()
            .await;
        let kms_client = aws_sdk_kms::Client::new(&sdk_config);
        let signer = AwsSigner::new(kms_client, self.key_id.clone(), None)
            .await
            .context("Failed to initialize aws_kms signer")?;
        let address = signer.address();

        Ok(TxSigner {
            address,
            wallet: EthereumWallet::from(signer.clone()),
            backend: SigningBackend::AwsKms(signer),
        })
    }
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
    use std::sync::{LazyLock, Mutex};

    static ENV_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

    const KEY_ONE: &str = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const ADDR_ONE: &str = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    fn parse_address(raw: &str) -> Address {
        raw.parse::<Address>().unwrap()
    }

    fn lock_env() -> std::sync::MutexGuard<'static, ()> {
        ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn clear_signer_env() {
        std::env::remove_var("ORACLE_OPERATOR_PK");
    }

    struct EnvCleanup;

    impl Drop for EnvCleanup {
        fn drop(&mut self) {
            clear_signer_env();
        }
    }

    #[test]
    fn env_signer_uses_oracle_operator_pk() {
        let _env_lock = lock_env();
        let _cleanup = EnvCleanup;
        clear_signer_env();
        std::env::set_var("ORACLE_OPERATOR_PK", KEY_ONE);

        let signer = TxSigner::from_env().unwrap();
        assert_eq!(signer.address, parse_address(ADDR_ONE));
    }

    #[test]
    fn env_signer_errors_when_missing() {
        let _env_lock = lock_env();
        let _cleanup = EnvCleanup;
        clear_signer_env();

        let err = TxSigner::from_env().unwrap_err().to_string();
        assert!(err.contains("No key found. Expected environment variable ORACLE_OPERATOR_PK"));
    }

    #[test]
    fn env_signer_errors_when_empty() {
        let _env_lock = lock_env();
        let _cleanup = EnvCleanup;
        clear_signer_env();
        std::env::set_var("ORACLE_OPERATOR_PK", "   ");

        let err = TxSigner::from_env().unwrap_err().to_string();
        assert!(err.contains("Environment variable ORACLE_OPERATOR_PK is set but empty"));
    }

    #[test]
    fn file_signer_reads_key_field() {
        let signer = TxSigner::from_file(KEY_ONE, "signer.key").unwrap();
        assert_eq!(signer.address, parse_address(ADDR_ONE));
    }

    #[test]
    fn file_signer_accepts_key_without_0x_prefix() {
        let signer = TxSigner::from_file(&KEY_ONE[2..], "signer.key").unwrap();
        assert_eq!(signer.address, parse_address(ADDR_ONE));
    }

    #[test]
    fn file_signer_rejects_invalid_key() {
        let err = TxSigner::from_file("not-a-private-key", "signer.key")
            .unwrap_err()
            .to_string();
        assert!(err.contains("Invalid private key format from signer.key"));
    }
}
