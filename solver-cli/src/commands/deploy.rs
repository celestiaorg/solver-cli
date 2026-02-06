use anyhow::Result;
use clap::Args;
use std::env;
use std::path::PathBuf;

use crate::deployment::Deployer;
use crate::state::StateManager;
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

    /// Chains to deploy to (comma-separated, e.g., "evolve,sepolia")
    /// If not specified, uses all chains from CHAINS env var
    #[arg(long)]
    pub chains: Option<String>,
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
        let env_config = EnvConfig::from_env()?;

        // Determine which chains to deploy to
        let chain_names: Vec<String> = if let Some(chains_arg) = &self.chains {
            chains_arg.split(',').map(|s| s.trim().to_string()).collect()
        } else {
            env_config.chain_names()
        };

        if chain_names.is_empty() {
            anyhow::bail!(
                "No chains configured. Use --chains flag or set chain env vars.\n\
                Example: --chains evolve,sepolia\n\
                Required env vars: EVOLVE_RPC, EVOLVE_PK, SEPOLIA_RPC, SEPOLIA_PK"
            );
        }

        // Gather chain configs (load dynamically for chains specified via --chains)
        let mut loaded_chains: Vec<ChainEnvConfig> = Vec::new();
        for name in &chain_names {
            let chain = env_config.load_chain(name).ok_or_else(|| {
                anyhow::anyhow!(
                    "Chain '{}' not found in environment. \
                    Make sure {}_RPC and {}_PK are set.",
                    name,
                    name.to_uppercase(),
                    name.to_uppercase()
                )
            })?;
            loaded_chains.push(chain);
        }
        let chain_configs: Vec<&ChainEnvConfig> = loaded_chains.iter().collect();

        print_kv("Chains to deploy", chain_names.join(", "));
        print_kv("Token", &self.token);

        // Check if already deployed (only if not forcing)
        if !self.force && state.deployment_version.is_some() && state.all_chains_deployed() {
            print_warning("Contracts already deployed. Use --force to redeploy.");
            Self::print_deployment_summary(&state, &out)?;
            return Ok(());
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

        // Deploy to all specified chains
        print_header("Deploying to Chains");
        for chain in &chain_configs {
            print_info(&format!("  {} -> {}", chain.name, chain.rpc_url));
        }

        deployer
            .deploy_to_chains(
                &mut state,
                &chain_configs,
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

        // Show operator address at the top
        if let Some(operator) = &state.solver.operator_address {
            print_header("Oracle Configuration");
            print_address("Operator", operator);
        }

        // Sort chains by ID for consistent output
        let mut chain_ids: Vec<u64> = state.chains.keys().copied().collect();
        chain_ids.sort();

        for chain_id in chain_ids {
            let chain = state.chains.get(&chain_id).unwrap();
            print_header(&format!("{} (Chain ID: {})", chain.name, chain.chain_id));
            if let Some(addr) = &chain.deployer {
                print_address("Deployer", addr);
            }
            if let Some(addr) = &chain.contracts.input_settler_escrow {
                print_address("InputSettlerEscrow", addr);
            }
            if let Some(addr) = &chain.contracts.output_settler_simple {
                print_address("OutputSettlerSimple", addr);
            }
            if let Some(addr) = &chain.contracts.oracle {
                print_address("CentralizedOracle", addr);
            }
            for (symbol, token) in &chain.tokens {
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
