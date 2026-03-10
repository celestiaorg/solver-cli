use anyhow::{Context, Result};
use clap::Subcommand;
use std::env;
use std::path::PathBuf;

use crate::utils::{load_dotenv, SolverSignerConfig};

#[derive(Subcommand)]
pub enum AccountCommand {
    /// Print the EVM address of the configured solver signing key.
    ///
    /// Set SOLVER_SIGNER_TYPE in .env to select the backend:
    ///   - "env" (default): derives address from SOLVER_PRIVATE_KEY
    ///   - "aws_kms": fetches address from AWS KMS public key
    ///     (also set SOLVER_KMS_KEY_ID and SOLVER_KMS_REGION)
    Address {
        /// Project directory (for .env loading)
        #[arg(long)]
        dir: Option<PathBuf>,
    },
}

impl AccountCommand {
    pub async fn run(self) -> Result<()> {
        match self {
            AccountCommand::Address { dir } => {
                let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
                load_dotenv(&project_dir)?;
                print_solver_address().await
            }
        }
    }
}

async fn print_solver_address() -> Result<()> {
    match SolverSignerConfig::from_env()? {
        SolverSignerConfig::AwsKms {
            key_id,
            region,
            endpoint,
        } => {
            use alloy::signers::aws::AwsSigner;
            use alloy::signers::Signer;
            use aws_sdk_kms::config::Region;

            let mut loader = aws_config::defaults(aws_config::BehaviorVersion::latest())
                .region(Region::new(region));
            if let Some(ep) = endpoint {
                loader = loader.endpoint_url(ep);
            }
            let sdk_config = loader.load().await;
            let client = aws_sdk_kms::Client::new(&sdk_config);
            let signer = AwsSigner::new(client, key_id, None)
                .await
                .map_err(|e| anyhow::anyhow!("KMS initialization failed: {e}"))?;
            println!("{:?}", Signer::address(&signer));
        }
        SolverSignerConfig::Env => {
            use crate::chain::ChainClient;

            let raw = env::var("SOLVER_PRIVATE_KEY")
                .context("Missing required environment variable: SOLVER_PRIVATE_KEY")?;
            let pk = if raw.starts_with("0x") {
                raw
            } else {
                format!("0x{raw}")
            };
            let addr = ChainClient::address_from_pk(&pk)?;
            println!("{addr:?}");
        }
    }
    Ok(())
}
