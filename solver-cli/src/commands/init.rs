use anyhow::Result;
use clap::Args;
use std::env;
use std::path::PathBuf;

use crate::state::{Environment, StateManager};
use crate::utils::*;
use crate::OutputFormat;

#[derive(Args)]
pub struct InitCommand {
    /// Environment to initialize (local, sepolia)
    #[arg(long, short, default_value = "local")]
    pub env: String,

    /// Project directory (defaults to current directory)
    #[arg(long)]
    pub dir: Option<PathBuf>,

    /// Force re-initialization
    #[arg(long, short)]
    pub force: bool,
}

impl InitCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        let out = OutputFormatter::new(output);

        let project_dir = self.dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Initializing Solver Project");

        // Check if already initialized
        if state_mgr.exists().await && !self.force {
            out.error("Project already initialized. Use --force to reinitialize.");
            anyhow::bail!("Already initialized");
        }

        // Parse environment
        let env: Environment = self.env.parse()?;
        print_kv("Environment", &env);

        // Create state file
        let _state = state_mgr.init(env.clone()).await?;
        print_success(&format!(
            "State file created at {:?}",
            state_mgr.state_dir()
        ));

        // Check .env file
        let env_file = project_dir.join(".env");
        if !env_file.exists() {
            print_warning(".env file not found. Create one with required variables.");
        } else {
            print_success(".env file found");
        }

        // Validate wallet keys if available
        load_dotenv(&project_dir).ok();

        // Check for chain configuration
        match EnvConfig::from_env() {
            Ok(env_config) => {
                if env_config.chains.is_empty() {
                    print_warning("No chains configured in environment.");
                    print_info("Set {CHAIN}_RPC and {CHAIN}_PK for each chain.");
                    print_info("Example: EVOLVE_RPC, EVOLVE_PK, SEPOLIA_RPC, SEPOLIA_PK");
                } else {
                    print_success(&format!(
                        "Found {} chain(s): {}",
                        env_config.chains.len(),
                        env_config.chain_names().join(", ")
                    ));
                }
            }
            Err(_) => {
                print_warning("Unable to load environment configuration.");
            }
        }

        print_summary_start();
        print_kv("Project directory", project_dir.display());
        print_kv("Environment", &env);
        print_kv(
            "State file",
            state_mgr.state_dir().join("state.json").display(),
        );
        print_summary_end();

        print_success("Initialization complete!");
        print_info("Next step: solver-cli deploy");

        if out.is_json() {
            out.json(&serde_json::json!({
                "status": "initialized",
                "environment": env.to_string(),
                "project_dir": project_dir.to_string_lossy(),
            }))?;
        }

        Ok(())
    }
}
