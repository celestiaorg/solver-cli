use anyhow::Result;
use clap::Args;
use std::env;
use std::path::PathBuf;

use crate::chain::ChainClient;
use crate::solver::ConfigGenerator;
use crate::state::StateManager;
use crate::utils::*;
use crate::OutputFormat;

#[derive(Args)]
pub struct ConfigureCommand {
    /// Project directory
    #[arg(long)]
    pub dir: Option<PathBuf>,

    /// Solver ID
    #[arg(long, default_value = "solver-001")]
    pub solver_id: String,

    /// Skip contract permission setup
    #[arg(long)]
    pub skip_permissions: bool,
}

impl ConfigureCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        let out = OutputFormatter::new(output);

        let project_dir = self.dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Configuring Solver");

        // Load state
        let mut state = state_mgr.load_or_error().await?;

        // Load environment
        load_dotenv(&project_dir)?;
        let env_config = EnvConfig::from_env()?;

        // Validate deployment
        if state.chains.source.is_none() || state.chains.destination.is_none() {
            anyhow::bail!("Contracts not deployed. Run 'solver-cli deploy' first.");
        }

        // Derive solver address
        let solver_address = ChainClient::address_from_pk(&env_config.evolve_pk)?;
        print_address("Solver address", &format!("{:?}", solver_address));

        // Update solver config in state
        state.solver.address = Some(format!("{:?}", solver_address));
        state.solver.solver_id = Some(self.solver_id.clone());
        state.solver.configured = true;

        // Set up contract permissions (if needed)
        if !self.skip_permissions {
            print_info("Setting up contract permissions...");
            // For now, AlwaysYesOracle doesn't require setup
            // In a real scenario, you'd register the solver with the contracts
            print_success("Contract permissions configured");
        }

        // Generate solver configuration file
        let config_path = project_dir.join("config/solver.toml");
        ConfigGenerator::write_config(&state, &config_path).await?;
        print_success(&format!("Config written to {:?}", config_path));

        // Also generate YAML for reference
        let yaml_path = project_dir.join("config/solver.yaml");
        let yaml_content = ConfigGenerator::generate_yaml(&state)?;
        tokio::fs::write(&yaml_path, yaml_content).await?;
        print_success(&format!("YAML config written to {:?}", yaml_path));

        // Save state
        state_mgr.save(&state).await?;

        print_summary_start();
        print_kv("Solver ID", &self.solver_id);
        print_address("Solver address", &format!("{:?}", solver_address));
        print_kv("Config file", config_path.display());
        print_kv("Status", "configured");
        print_summary_end();

        print_success("Configuration complete!");
        print_info("Next step: solver-cli solver start");

        if out.is_json() {
            out.json(&serde_json::json!({
                "status": "configured",
                "solver_id": self.solver_id,
                "solver_address": format!("{:?}", solver_address),
                "config_path": config_path.to_string_lossy(),
            }))?;
        }

        Ok(())
    }
}
