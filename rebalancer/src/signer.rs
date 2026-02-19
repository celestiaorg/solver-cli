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

    #[tokio::test]
    async fn env_signer_uses_global_fallback() {
        std::env::remove_var("REBALANCER_EVOLVE_PK");
        std::env::set_var(
            "REBALANCER_PRIVATE_KEY",
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        );

        let chain = sample_chain("evolve", SignerConfig::Env);
        let signer = TxSigner::new(&chain).await.unwrap();
        assert_eq!(
            signer.address,
            "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
                .parse::<Address>()
                .unwrap()
        );
    }

    #[tokio::test]
    async fn file_signer_reads_key_field() {
        let chain = sample_chain(
            "evolve",
            SignerConfig::File {
                key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
                    .to_string(),
            },
        );
        let signer = TxSigner::new(&chain).await.unwrap();
        assert_eq!(
            signer.address,
            "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
                .parse::<Address>()
                .unwrap()
        );
    }
}
