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
    pub name: String,
    pub chain_id: u64,
    pub rpc_url: String,
    provider: HttpProvider,
    signer: Option<PrivateKeySigner>,
}

impl ChainClient {
    /// Create a new chain client
    pub async fn new(name: &str, rpc_url: &str) -> Result<Self> {
        let url: reqwest::Url = rpc_url.parse().context("Invalid RPC URL")?;
        let provider = ProviderBuilder::new().connect_http(url);

        let chain_id = provider
            .get_chain_id()
            .await
            .context("Failed to get chain ID")?;

        Ok(Self {
            name: name.to_string(),
            chain_id,
            rpc_url: rpc_url.to_string(),
            provider,
            signer: None,
        })
    }

    /// Create a new chain client with a signer
    pub async fn new_with_signer(name: &str, rpc_url: &str, private_key: &str) -> Result<Self> {
        let mut client = Self::new(name, rpc_url).await?;
        client.set_signer(private_key)?;
        Ok(client)
    }

    /// Set the signer for this client
    pub fn set_signer(&mut self, private_key: &str) -> Result<()> {
        let pk = private_key.strip_prefix("0x").unwrap_or(private_key);
        let signer: PrivateKeySigner = pk.parse().context("Invalid private key")?;
        self.signer = Some(signer);
        Ok(())
    }

    /// Get the signer's address
    pub fn signer_address(&self) -> Result<Address> {
        self.signer
            .as_ref()
            .map(|s| s.address())
            .ok_or_else(|| anyhow::anyhow!("No signer configured"))
    }

    /// Get native balance of an address
    pub async fn get_balance(&self, address: Address) -> Result<U256> {
        self.provider
            .get_balance(address)
            .await
            .context("Failed to get balance")
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

    /// Get ERC20 token decimals
    pub async fn get_token_decimals(&self, token: Address) -> Result<u8> {
        use alloy::sol;

        sol! {
            function decimals() external view returns (uint8);
        }

        let call = decimalsCall {};
        let call_data: Bytes = call.abi_encode().into();

        let tx = alloy::rpc::types::TransactionRequest::default()
            .with_to(token)
            .with_input(call_data);

        let result = self
            .provider
            .call(tx)
            .await
            .context("Failed to call decimals")?;

        // Last byte is the decimals
        let decimals = result.last().copied().unwrap_or(18);
        Ok(decimals)
    }

    /// Check if RPC is reachable
    pub async fn health_check(&self) -> Result<()> {
        self.provider
            .get_chain_id()
            .await
            .context("RPC health check failed")?;
        Ok(())
    }

    /// Get the current block number
    pub async fn block_number(&self) -> Result<u64> {
        self.provider
            .get_block_number()
            .await
            .context("Failed to get block number")
    }

    /// Derive address from private key
    pub fn address_from_pk(private_key: &str) -> Result<Address> {
        let pk = private_key.strip_prefix("0x").unwrap_or(private_key);
        let signer: PrivateKeySigner = pk.parse().context("Invalid private key")?;
        Ok(signer.address())
    }

    /// Get signer reference
    pub fn signer(&self) -> Option<&PrivateKeySigner> {
        self.signer.as_ref()
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

/// Parse a human-readable amount to U256 with decimals
pub fn parse_token_amount(amount: &str, decimals: u8) -> Result<U256> {
    let parts: Vec<&str> = amount.split('.').collect();

    match parts.as_slice() {
        [whole] => {
            let whole: U256 = whole.parse().context("Invalid amount")?;
            let multiplier = U256::from(10u64).pow(U256::from(decimals));
            Ok(whole * multiplier)
        }
        [whole, frac] => {
            let whole: U256 = whole.parse().context("Invalid whole part")?;
            let frac_len = frac.len();
            if frac_len > decimals as usize {
                anyhow::bail!("Too many decimal places");
            }
            let frac_padded = format!("{:0<width$}", frac, width = decimals as usize);
            let frac: U256 = frac_padded.parse().context("Invalid fractional part")?;
            let multiplier = U256::from(10u64).pow(U256::from(decimals));
            Ok(whole * multiplier + frac)
        }
        _ => anyhow::bail!("Invalid amount format"),
    }
}
