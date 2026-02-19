use alloy::{
    eips::BlockNumberOrTag,
    network::TransactionBuilder,
    primitives::{Address, Bytes, FixedBytes, TxHash, U256},
    providers::{Provider, ProviderBuilder},
    rpc::types::eth::BlockId,
    sol,
    sol_types::SolCall,
};
use anyhow::{bail, Context, Result};

use crate::config::ChainConfig;
use crate::signer::resolve_signer_for_chain;

type HttpProvider = alloy::providers::fillers::FillProvider<
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
    alloy::providers::RootProvider,
>;

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
    function balanceOf(address account) external view returns (uint256);

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

pub struct ChainClient {
    read_provider: HttpProvider,
    wallet_provider: Option<WalletHttpProvider>,
}

impl ChainClient {
    pub async fn new(chain: &ChainConfig, enable_writes: bool) -> Result<Self> {
        let rpc_url: reqwest::Url = chain.rpc_url.parse().with_context(|| {
            format!(
                "Invalid RPC URL for chain {}: {}",
                chain.name, chain.rpc_url
            )
        })?;

        let read_provider = ProviderBuilder::new().connect_http(rpc_url.clone());
        let wallet_provider = if enable_writes {
            let signer = resolve_signer_for_chain(chain)
                .await
                .with_context(|| format!("Failed to load signer for chain {}", chain.name))?;

            if signer.address != chain.account_address {
                bail!(
                    "Signer/account mismatch for chain {} ({}): signer={} config_account={}",
                    chain.name,
                    chain.chain_id,
                    signer.address,
                    chain.account_address
                );
            }

            Some(
                ProviderBuilder::new()
                    .wallet(signer.wallet)
                    .connect_http(rpc_url),
            )
        } else {
            None
        };

        Ok(Self {
            read_provider,
            wallet_provider,
        })
    }

    pub async fn token_balance(&self, token: Address, account: Address) -> Result<U256> {
        let call = balanceOfCall { account };
        let call_data: Bytes = call.abi_encode().into();

        let tx = alloy::rpc::types::TransactionRequest::default()
            .with_to(token)
            .with_input(call_data);

        let result = self
            .read_provider
            .call(tx)
            .await
            .context("Failed to call ERC20 balanceOf")?;

        Ok(U256::from_be_slice(&result))
    }

    pub async fn transaction_count_latest(&self, account: Address) -> Result<u64> {
        self.read_provider
            .get_transaction_count(account)
            .block_id(BlockId::latest())
            .await
            .context("Failed to query latest account nonce")
    }

    pub async fn transaction_count_pending(&self, account: Address) -> Result<u64> {
        self.read_provider
            .get_transaction_count(account)
            .block_id(BlockId::Number(BlockNumberOrTag::Pending))
            .await
            .context("Failed to query pending account nonce")
    }

    pub async fn quote_transfer_remote(
        &self,
        source_router: Address,
        destination_chain_id: u64,
        destination_recipient: Address,
        amount: U256,
    ) -> Result<HyperlaneQuote> {
        let destination = u32::try_from(destination_chain_id).with_context(|| {
            format!(
                "destination chain_id {} does not fit uint32 Hyperlane domain",
                destination_chain_id
            )
        })?;
        let recipient = address_to_bytes32(destination_recipient);

        let router_token = self.token(source_router).await?;

        let call = ITokenRouter::quoteTransferRemoteCall {
            _destination: destination,
            _recipient: recipient,
            _amount: amount,
        };
        let tx = alloy::rpc::types::TransactionRequest::default()
            .to(source_router)
            .input(Bytes::from(call.abi_encode()).into());
        let raw = self.read_provider.call(tx).await.with_context(|| {
            format!(
                "quoteTransferRemote call failed on router {}",
                source_router
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

    pub async fn submit_transfer_remote(
        &self,
        source_router: Address,
        destination_chain_id: u64,
        destination_recipient: Address,
        amount: U256,
        msg_value: U256,
    ) -> Result<SubmittedTransfer> {
        let wallet_provider = self.wallet_provider()?;
        let destination = u32::try_from(destination_chain_id).with_context(|| {
            format!(
                "destination chain_id {} does not fit uint32 Hyperlane domain",
                destination_chain_id
            )
        })?;
        let recipient = address_to_bytes32(destination_recipient);

        let call = ITokenRouter::transferRemoteCall {
            _destination: destination,
            _recipient: recipient,
            _amount: amount,
        };
        let call_data = Bytes::from(call.abi_encode());

        let preview_tx = alloy::rpc::types::TransactionRequest::default()
            .to(source_router)
            .input(call_data.clone().into())
            .value(msg_value);
        let message_id = match wallet_provider.call(preview_tx).await {
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
            .to(source_router)
            .input(call_data.into())
            .value(msg_value);
        let pending = wallet_provider
            .send_transaction(tx)
            .await
            .with_context(|| {
                format!(
                    "Failed to submit transferRemote tx on router {}",
                    source_router
                )
            })?;

        Ok(SubmittedTransfer {
            source_tx_hash: *pending.tx_hash(),
            message_id,
        })
    }

    async fn token(&self, router: Address) -> Result<Address> {
        let call = ITokenRouter::tokenCall {};
        let tx = alloy::rpc::types::TransactionRequest::default()
            .to(router)
            .input(Bytes::from(call.abi_encode()).into());
        let raw = self
            .read_provider
            .call(tx)
            .await
            .with_context(|| format!("token() call failed on router {}", router))?;
        if raw.len() < 32 {
            bail!(
                "token() return payload too short on router {}: {} bytes",
                router,
                raw.len()
            );
        }
        Ok(Address::from_slice(&raw[raw.len() - 20..]))
    }

    fn wallet_provider(&self) -> Result<&WalletHttpProvider> {
        self.wallet_provider
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Missing wallet provider for writable operation"))
    }
}

fn address_to_bytes32(address: Address) -> FixedBytes<32> {
    let mut out = [0u8; 32];
    out[12..].copy_from_slice(address.as_slice());
    FixedBytes::from(out)
}
