use alloy::{
    network::TransactionBuilder,
    primitives::{Address, Bytes, U256},
    providers::{Provider, ProviderBuilder},
    signers::local::PrivateKeySigner,
    sol_types::SolCall,
};
use anyhow::{Context, Result};

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

/// Client for interacting with an EVM chain
pub struct ChainClient {
    pub chain_id: u64,
    provider: HttpProvider,
}

impl ChainClient {
    /// Create a new chain client
    pub async fn new(_name: &str, rpc_url: &str) -> Result<Self> {
        let url: reqwest::Url = rpc_url.parse().context("Invalid RPC URL")?;
        let provider = ProviderBuilder::new().connect_http(url);

        let chain_id = provider.get_chain_id().await.context(format!(
            "Failed to get chain ID from {} (is the RPC node running?)",
            rpc_url
        ))?;

        Ok(Self { chain_id, provider })
    }

    /// Get ERC20 token balance
    pub async fn get_token_balance(&self, token: Address, account: Address) -> Result<U256> {
        use alloy::sol;

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
            .context("Failed to call balanceOf")?;

        let balance = U256::from_be_slice(&result);
        Ok(balance)
    }

    /// Derive address from private key
    pub fn address_from_pk(private_key: &str) -> Result<Address> {
        let pk = private_key.strip_prefix("0x").unwrap_or(private_key);
        let signer: PrivateKeySigner = pk.parse().context("Invalid private key")?;
        Ok(signer.address())
    }
}

/// Format a U256 as a human-readable string with decimals
pub fn format_token_amount(amount: U256, decimals: u8) -> String {
    let divisor = U256::from(10u64).pow(U256::from(decimals));
    let whole = amount / divisor;
    let frac = amount % divisor;

    if frac.is_zero() {
        whole.to_string()
    } else {
        let frac_str = format!("{:0>width$}", frac, width = decimals as usize);
        let trimmed = frac_str.trim_end_matches('0');
        format!("{}.{}", whole, trimmed)
    }
}

