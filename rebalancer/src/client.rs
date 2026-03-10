use alloy::{
    eips::BlockNumberOrTag,
    network::TransactionBuilder,
    primitives::{Address, Bytes, FixedBytes, TxHash, U256},
    providers::{Provider, ProviderBuilder},
    rpc::types::{eth::BlockId, TransactionRequest},
    sol,
    sol_types::SolCall,
};
use anyhow::{bail, Context, Result};

use crate::config::ChainConfig;
use crate::signer::TxSigner;

type DefaultProvider = alloy::providers::fillers::FillProvider<
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
    interface IERC20 {
        function balanceOf(address account) external view returns (uint256);
        function approve(address spender, uint256 amount) external returns (bool);
    }

    #[sol(rpc)]
    interface ITokenRouter {
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
    pub entries: Vec<HyperlaneQuoteItem>,
    pub native_fee: U256,
}

#[derive(Debug, Clone)]
pub struct SubmittedTransfer {
    pub source_tx_hash: TxHash,
    pub message_id: Option<FixedBytes<32>>,
}

pub struct ChainClient {
    provider: DefaultProvider,
    account: Address,
}

impl ChainClient {
    pub async fn new(chain: &ChainConfig) -> Result<Self> {
        let rpc_url: reqwest::Url = chain.rpc_url.parse().with_context(|| {
            format!(
                "Invalid RPC URL for chain {}: {}",
                chain.name, chain.rpc_url
            )
        })?;

        let signer = TxSigner::new(chain)
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

        let account = signer.address;
        let provider = ProviderBuilder::new()
            .wallet(signer.wallet)
            .connect_http(rpc_url);

        Ok(Self { provider, account })
    }

    pub async fn token_balance(&self, token: Address, account: Address) -> Result<U256> {
        let call = IERC20::balanceOfCall { account };
        let call_data: Bytes = call.abi_encode().into();

        let tx = alloy::rpc::types::TransactionRequest::default()
            .with_to(token)
            .with_input(call_data);

        let result = self
            .provider
            .call(tx)
            .await
            .context("Failed to call ERC20 balanceOf")?;

        Ok(U256::from_be_slice(&result))
    }

    pub async fn native_balance(&self, account: Address) -> Result<U256> {
        self.provider
            .get_balance(account)
            .await
            .context("Failed to get native balance")
    }

    pub async fn transaction_count_latest(&self, account: Address) -> Result<u64> {
        self.provider
            .get_transaction_count(account)
            .block_id(BlockId::latest())
            .await
            .context("Failed to query latest account nonce")
    }

    pub async fn transaction_count_pending(&self, account: Address) -> Result<u64> {
        self.provider
            .get_transaction_count(account)
            .block_id(BlockId::Number(BlockNumberOrTag::Pending))
            .await
            .context("Failed to query pending account nonce")
    }

    async fn pending_nonce(&self) -> Result<u64> {
        self.provider
            .get_transaction_count(self.account)
            .block_id(BlockId::Number(BlockNumberOrTag::Pending))
            .await
            .context("Failed to fetch pending nonce")
    }

    pub async fn approve_erc20(
        &self,
        token: Address,
        spender: Address,
        amount: U256,
    ) -> Result<TxHash> {
        let nonce = self.pending_nonce().await?;
        let call = IERC20::approveCall { spender, amount };
        let call_data = Bytes::from(call.abi_encode());

        let tx = TransactionRequest::default()
            .to(token)
            .input(call_data.into())
            .nonce(nonce);

        let pending = self.provider.send_transaction(tx).await.with_context(|| {
            format!(
                "Failed to send ERC20 approve tx: token={} spender={} amount={}",
                token, spender, amount
            )
        })?;

        Ok(*pending.tx_hash())
    }

    pub async fn quote_transfer_remote(
        &self,
        source_router: Address,
        destination_domain_id: u32,
        destination_recipient: Address,
        amount: U256,
    ) -> Result<HyperlaneQuote> {
        let recipient = address_to_bytes32(destination_recipient);
        let call = ITokenRouter::quoteTransferRemoteCall {
            _destination: destination_domain_id,
            _recipient: recipient,
            _amount: amount,
        };

        let tx = TransactionRequest::default()
            .to(source_router)
            .input(Bytes::from(call.abi_encode()).into());

        let raw = self.provider.call(tx).await.with_context(|| {
            format!(
                "quoteTransferRemote call failed on router {} (address may be plain ERC20, not a Hyperlane token router)",
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
            entries,
            native_fee,
        })
    }

    pub async fn submit_transfer_remote(
        &self,
        source_router: Address,
        destination_domain_id: u32,
        destination_recipient: Address,
        amount: U256,
        msg_value: U256,
    ) -> Result<SubmittedTransfer> {
        let nonce = self.pending_nonce().await?;
        let recipient = address_to_bytes32(destination_recipient);
        let call = ITokenRouter::transferRemoteCall {
            _destination: destination_domain_id,
            _recipient: recipient,
            _amount: amount,
        };
        let call_data = Bytes::from(call.abi_encode());

        let tx = TransactionRequest::default()
            .to(source_router)
            .input(call_data.into())
            .value(msg_value)
            .nonce(nonce);

        let (message_id, preview_error) = match self.provider.call(tx.clone()).await {
            Ok(raw) => {
                if raw.len() >= 32 {
                    (
                        Some(FixedBytes::<32>::from_slice(&raw[raw.len() - 32..])),
                        None,
                    )
                } else {
                    (None, None)
                }
            }
            Err(err) => (None, Some(err)),
        };

        let pending = self.provider.send_transaction(tx).await.with_context(|| {
            let preview = preview_error
                .as_ref()
                .map(|err| format!("; preview_call_err={}", err))
                .unwrap_or_default();
            format!(
                "Failed to submit transferRemote tx on router {} destination_domain={} recipient={} amount={} msg_value={}{}",
                source_router,
                destination_domain_id,
                destination_recipient,
                amount,
                msg_value,
                preview
            )
        })?;

        Ok(SubmittedTransfer {
            source_tx_hash: *pending.tx_hash(),
            message_id,
        })
    }
}

fn address_to_bytes32(address: Address) -> FixedBytes<32> {
    let mut out = [0u8; 32];
    out[12..].copy_from_slice(address.as_slice());
    FixedBytes::from(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn address_to_bytes32_matches_expected_left_padding() {
        let address: Address = "0xd5e85e86fc692cedad6d6992f1f0ccf273e39913"
            .parse()
            .unwrap();
        assert_eq!(
            address_to_bytes32(address).to_string(),
            "0x000000000000000000000000d5e85e86fc692cedad6d6992f1f0ccf273e39913"
        );
    }

    #[test]
    fn bytes32_log_format_matches_address_variant() {
        let address: Address = "0xd5e85e86fc692cedad6d6992f1f0ccf273e39913"
            .parse()
            .unwrap();
        assert!(format!("{}", address)
            .eq_ignore_ascii_case("0xd5e85e86fc692cedad6d6992f1f0ccf273e39913"));
    }
}
