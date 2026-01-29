use anyhow::Result;
use clap::Args;
use std::env;
use std::path::PathBuf;

use crate::deployment::Deployer;
use crate::state::{Environment, StateManager};
use crate::utils::*;
use crate::OutputFormat;

#[derive(Args)]
pub struct DeployCommand {
    /// Project directory
    #[arg(long)]
    pub dir: Option<PathBuf>,

    /// Token symbol to deploy
    #[arg(long, default_value = "USDC")]
    pub token: String,

    /// Token decimals
    #[arg(long, default_value = "6")]
    pub decimals: u8,

    /// Force redeploy even if contracts exist
    #[arg(long, short)]
    pub force: bool,

    /// Skip building contracts
    #[arg(long)]
    pub skip_build: bool,
}

impl DeployCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        let out = OutputFormatter::new(output);

        let project_dir = self.dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Deploying Contracts");

        // Load state
        let mut state = state_mgr.load_or_error().await?;
        print_kv("Environment", &state.env);

        // Load environment
        load_dotenv(&project_dir)?;
        check_required_vars(REQUIRED_DEPLOY_VARS)?;

        let env_config = EnvConfig::from_env()?;

        // Determine chain names based on environment
        let (source_name, dest_name) = match state.env {
            Environment::Local => ("evolve", "sepolia"),
            Environment::Sepolia => ("sepolia", "mainnet"),
            Environment::Mainnet => ("mainnet", "arbitrum"),
        };

        print_kv("Source chain", source_name);
        print_kv("Destination chain", dest_name);
        print_kv("Token", &self.token);

        // Check if already deployed
        if !self.force && state.deployment_version.is_some() {
            let source_complete = state
                .chains
                .source
                .as_ref()
                .map(|c| c.contracts.is_complete())
                .unwrap_or(false);
            let dest_complete = state
                .chains
                .destination
                .as_ref()
                .map(|c| c.contracts.is_complete())
                .unwrap_or(false);

            if source_complete && dest_complete {
                print_warning("Contracts already deployed. Use --force to redeploy.");
                Self::print_deployment_summary(&state, &out)?;
                return Ok(());
            }
        }

        // Find contracts directory
        let contracts_path = project_dir.join("oif/oif-contracts");
        if !contracts_path.exists() {
            anyhow::bail!(
                "Contracts directory not found at {:?}. Expected oif/oif-contracts",
                contracts_path
            );
        }

        let deployer = Deployer::new(&contracts_path);

        // Deploy to both chains
        print_header("Deploying to Source Chain");
        print_info(&format!("RPC: {}", env_config.evolve_rpc));

        deployer
            .deploy_all(
                &mut state,
                &env_config.evolve_rpc,
                &env_config.evolve_pk,
                source_name,
                &env_config.sepolia_rpc,
                &env_config.sepolia_pk,
                dest_name,
                &self.token,
                self.decimals,
                self.skip_build,
            )
            .await?;

        // Save state
        state_mgr.save(&state).await?;
        print_success("State saved");

        // Print summary
        Self::print_deployment_summary(&state, &out)?;

        print_success("Deployment complete!");
        print_info("Next step: solver-cli configure");

        if out.is_json() {
            out.json(&state)?;
        }

        Ok(())
    }

    fn print_deployment_summary(
        state: &crate::state::SolverState,
        _out: &OutputFormatter,
    ) -> Result<()> {
        print_summary_start();

        if let Some(source) = &state.chains.source {
            print_header(&format!("{} (Chain ID: {})", source.name, source.chain_id));
            if let Some(addr) = &source.deployer {
                print_address("Deployer", addr);
            }
            if let Some(addr) = &source.contracts.input_settler_escrow {
                print_address("InputSettlerEscrow", addr);
            }
            if let Some(addr) = &source.contracts.output_settler_simple {
                print_address("OutputSettlerSimple", addr);
            }
            if let Some(addr) = &source.contracts.oracle {
                print_address("Oracle", addr);
            }
            for (symbol, token) in &source.tokens {
                print_address(&format!("Token ({})", symbol), &token.address);
            }
        }

        if let Some(dest) = &state.chains.destination {
            print_header(&format!("{} (Chain ID: {})", dest.name, dest.chain_id));
            if let Some(addr) = &dest.deployer {
                print_address("Deployer", addr);
            }
            if let Some(addr) = &dest.contracts.input_settler_escrow {
                print_address("InputSettlerEscrow", addr);
            }
            if let Some(addr) = &dest.contracts.output_settler_simple {
                print_address("OutputSettlerSimple", addr);
            }
            if let Some(addr) = &dest.contracts.oracle {
                print_address("Oracle", addr);
            }
            for (symbol, token) in &dest.tokens {
                print_address(&format!("Token ({})", symbol), &token.address);
            }
        }

        if let Some(version) = &state.deployment_version {
            print_kv("Deployment version", version);
        }

        print_summary_end();

        Ok(())
    }
}
