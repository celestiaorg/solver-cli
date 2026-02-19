use alloy::{
    eips::BlockNumberOrTag,
    network::TransactionBuilder,
    primitives::{Address, Bytes, U256},
    providers::{Provider, ProviderBuilder},
    rpc::types::eth::BlockId,
    sol,
    sol_types::SolCall,
};
use anyhow::{Context, Result};

use crate::config::ChainConfig;

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

pub struct ChainBalanceClient {
    provider: HttpProvider,
}

impl ChainBalanceClient {
    pub fn new(chain: &ChainConfig) -> Result<Self> {
        let url: reqwest::Url = chain.rpc_url.parse().with_context(|| {
            format!(
                "Invalid RPC URL for chain {}: {}",
                chain.name, chain.rpc_url
            )
        })?;
        let provider = ProviderBuilder::new().connect_http(url);
        Ok(Self { provider })
    }

    pub async fn token_balance(&self, token: Address, account: Address) -> Result<U256> {
        sol! {
            function balanceOf(address account) external view returns (uint256);
        }

        let call = balanceOfCall { account };
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
}
