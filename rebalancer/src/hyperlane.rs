use alloy::{
    network::EthereumWallet,
    primitives::{Address, Bytes, FixedBytes, TxHash, U256},
    providers::{Provider, ProviderBuilder},
    signers::local::PrivateKeySigner,
    sol,
    sol_types::SolCall,
};
use anyhow::{bail, Context, Result};
use std::collections::HashMap;

use crate::config::{ChainConfig, HyperlaneConfig};

type WalletHttpProvider = alloy::providers::fillers::FillProvider<
    alloy::providers::fillers::JoinFill<
        alloy::providers::fillers::JoinFill<
            alloy::providers::Identity,
            alloy::providers::fillers::JoinFill<
                alloy::providers::fillers::GasFiller,
                alloy::providers::fillers::JoinFill<
                    alloy::providers::fillers::BlobGasFiller,
                    alloy::providers::fillers::JoinFill<
                        alloy::providers::fillers::NonceFiller,
                        alloy::providers::fillers::ChainIdFiller,
                    >,
                >,
            >,
        >,
        alloy::providers::fillers::WalletFiller<alloy::network::EthereumWallet>,
    >,
    alloy::providers::RootProvider,
>;

sol! {
    struct Quote {
        address token;
        uint256 amount;
    }

    #[sol(rpc)]
    interface ITokenRouter {
        function token() external view returns (address);

        function quoteTransferRemote(
            uint32 _destination,
            bytes32 _recipient,
            uint256 _amount
        ) external view returns (Quote[] memory quotes);

        function transferRemote(
            uint32 _destination,
            bytes32 _recipient,
            uint256 _amount
        ) external payable returns (bytes32 messageId);
    }
}

#[derive(Debug, Clone)]
pub struct HyperlaneTransferRequest {
    pub source_chain_id: u64,
    pub destination_chain_id: u64,
    pub source_router: Address,
    pub destination_recipient: Address,
    pub amount: U256,
}

#[derive(Debug, Clone)]
pub struct HyperlaneQuoteItem {
    pub token: Address,
    pub amount: U256,
}

#[derive(Debug, Clone)]
pub struct HyperlaneQuote {
    pub router_token: Address,
    pub entries: Vec<HyperlaneQuoteItem>,
    pub native_fee: U256,
}

#[derive(Debug, Clone)]
pub struct SubmittedTransfer {
    pub source_tx_hash: TxHash,
    pub message_id: Option<FixedBytes<32>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SourceTxStatus {
    Pending,
    Success,
    Reverted,
}

pub struct HyperlaneWarpClient {
    #[allow(dead_code)]
    config: HyperlaneConfig,
    providers: HashMap<u64, WalletHttpProvider>,
}

impl HyperlaneWarpClient {
    pub fn new(config: HyperlaneConfig, chains: &[ChainConfig]) -> Result<Self> {
        let mut providers = HashMap::new();
        for chain in chains {
            let signer = signer_for_chain(chain)
                .with_context(|| format!("Failed to load signer for chain {}", chain.name))?;
            let signer_address = signer.address();
            if signer_address != chain.account_address {
                bail!(
                    "Signer/account mismatch for chain {} ({}): signer={} config_account={}",
                    chain.name,
                    chain.chain_id,
                    signer_address,
                    chain.account_address
                );
            }

            let wallet = EthereumWallet::from(signer);
            let rpc_url: reqwest::Url = chain.rpc_url.parse().with_context(|| {
                format!(
                    "Invalid RPC URL for chain {}: {}",
                    chain.name, chain.rpc_url
                )
            })?;
            let provider = ProviderBuilder::new().wallet(wallet).connect_http(rpc_url);
            providers.insert(chain.chain_id, provider);
        }

        Ok(Self { config, providers })
    }

    pub async fn quote_transfer(&self, req: &HyperlaneTransferRequest) -> Result<HyperlaneQuote> {
        let provider = self.provider(req.source_chain_id)?;
        let destination = u32::try_from(req.destination_chain_id).with_context(|| {
            format!(
                "destination chain_id {} does not fit uint32 Hyperlane domain",
                req.destination_chain_id
            )
        })?;
        let recipient = address_to_bytes32(req.destination_recipient);

        let router_token = self.token(req.source_chain_id, req.source_router).await?;

        let call = ITokenRouter::quoteTransferRemoteCall {
            _destination: destination,
            _recipient: recipient,
            _amount: req.amount,
        };
        let tx = alloy::rpc::types::TransactionRequest::default()
            .to(req.source_router)
            .input(Bytes::from(call.abi_encode()).into());
        let raw = provider.call(tx).await.with_context(|| {
            format!(
                "quoteTransferRemote call failed on chain {} router {}",
                req.source_chain_id, req.source_router
            )
        })?;
        let decoded = ITokenRouter::quoteTransferRemoteCall::abi_decode_returns(&raw)
            .context("Failed to decode quoteTransferRemote return payload")?;

        let entries: Vec<HyperlaneQuoteItem> = decoded
            .into_iter()
            .map(|quote| HyperlaneQuoteItem {
                token: quote.token,
                amount: quote.amount,
            })
            .collect();
        let native_fee = entries
            .iter()
            .find(|entry| entry.token == Address::ZERO)
            .map(|entry| entry.amount)
            .unwrap_or(U256::ZERO);

        Ok(HyperlaneQuote {
            router_token,
            entries,
            native_fee,
        })
    }

    pub async fn submit_transfer(
        &self,
        req: &HyperlaneTransferRequest,
        msg_value: U256,
    ) -> Result<SubmittedTransfer> {
        let provider = self.provider(req.source_chain_id)?;
        let destination = u32::try_from(req.destination_chain_id).with_context(|| {
            format!(
                "destination chain_id {} does not fit uint32 Hyperlane domain",
                req.destination_chain_id
            )
        })?;
        let recipient = address_to_bytes32(req.destination_recipient);

        let call = ITokenRouter::transferRemoteCall {
            _destination: destination,
            _recipient: recipient,
            _amount: req.amount,
        };
        let call_data = Bytes::from(call.abi_encode());

        let preview_tx = alloy::rpc::types::TransactionRequest::default()
            .to(req.source_router)
            .input(call_data.clone().into())
            .value(msg_value);
        let message_id = match provider.call(preview_tx).await {
            Ok(raw) => {
                if raw.len() >= 32 {
                    Some(FixedBytes::<32>::from_slice(&raw[raw.len() - 32..]))
                } else {
                    None
                }
            }
            Err(_) => None,
        };

        let tx = alloy::rpc::types::TransactionRequest::default()
            .to(req.source_router)
            .input(call_data.into())
            .value(msg_value);
        let pending = provider.send_transaction(tx).await.with_context(|| {
            format!(
                "Failed to submit transferRemote tx on chain {} router {}",
                req.source_chain_id, req.source_router
            )
        })?;

        Ok(SubmittedTransfer {
            source_tx_hash: *pending.tx_hash(),
            message_id,
        })
    }

    pub async fn source_tx_status(
        &self,
        source_chain_id: u64,
        tx_hash: TxHash,
    ) -> Result<SourceTxStatus> {
        let provider = self.provider(source_chain_id)?;
        let maybe_receipt = provider
            .get_transaction_receipt(tx_hash)
            .await
            .with_context(|| {
                format!(
                    "Failed to fetch transaction receipt on chain {} tx={}",
                    source_chain_id, tx_hash
                )
            })?;

        match maybe_receipt {
            Some(receipt) => {
                if receipt.status() {
                    Ok(SourceTxStatus::Success)
                } else {
                    Ok(SourceTxStatus::Reverted)
                }
            }
            None => Ok(SourceTxStatus::Pending),
        }
    }

    async fn token(&self, chain_id: u64, router: Address) -> Result<Address> {
        let provider = self.provider(chain_id)?;
        let call = ITokenRouter::tokenCall {};
        let tx = alloy::rpc::types::TransactionRequest::default()
            .to(router)
            .input(Bytes::from(call.abi_encode()).into());
        let raw = provider.call(tx).await.with_context(|| {
            format!(
                "token() call failed on chain {} router {}",
                chain_id, router
            )
        })?;
        if raw.len() < 32 {
            bail!(
                "token() return payload too short on chain {} router {}: {} bytes",
                chain_id,
                router,
                raw.len()
            );
        }
        Ok(Address::from_slice(&raw[raw.len() - 20..]))
    }

    fn provider(&self, chain_id: u64) -> Result<&WalletHttpProvider> {
        self.providers
            .get(&chain_id)
            .ok_or_else(|| anyhow::anyhow!("No provider configured for chain {}", chain_id))
    }
}

fn address_to_bytes32(address: Address) -> FixedBytes<32> {
    let mut out = [0u8; 32];
    out[12..].copy_from_slice(address.as_slice());
    FixedBytes::from(out)
}

fn signer_for_chain(chain: &ChainConfig) -> Result<PrivateKeySigner> {
    let chain_env = normalize_env_key(&chain.name);
    let key_names = [
        format!("REBALANCER_{}_PK", chain_env),
        format!("{}_PK", chain_env),
        "REBALANCER_PRIVATE_KEY".to_string(),
        "SOLVER_PRIVATE_KEY".to_string(),
        "SEPOLIA_PK".to_string(),
    ];

    for key_name in key_names {
        if let Ok(raw) = std::env::var(&key_name) {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                continue;
            }
            let pk = trimmed.strip_prefix("0x").unwrap_or(trimmed);
            let signer = pk.parse().with_context(|| {
                format!("Invalid private key in environment variable {}", key_name)
            })?;
            return Ok(signer);
        }
    }

    bail!(
        "Missing private key for chain {} (tried REBALANCER_{}_PK, {}_PK, REBALANCER_PRIVATE_KEY, SOLVER_PRIVATE_KEY, SEPOLIA_PK)",
        chain.name,
        chain_env,
        chain_env
    );
}

fn normalize_env_key(value: &str) -> String {
    value
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_uppercase()
            } else {
                '_'
            }
        })
        .collect()
}
