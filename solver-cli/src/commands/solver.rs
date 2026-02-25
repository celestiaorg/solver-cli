use anyhow::Result;
use clap::Subcommand;
use std::env;
use std::path::PathBuf;

use crate::solver::{run_solver_from_config, SolverRunner};
use crate::state::StateManager;
use crate::utils::*;
use crate::OutputFormat;

#[derive(Subcommand)]
pub enum SolverCommand {
    /// Start the solver (in-process; no separate binary)
    Start {
        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,

        /// Run in background
        #[arg(long, short)]
        background: bool,
    },

    /// Run the solver engine (used internally for background; or run with explicit config path)
    Run {
        /// Path to the solver TOML config file
        #[arg(long)]
        config: PathBuf,
    },

    /// Stop the solver
    Stop {
        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,
    },

    /// Check solver status
    Status {
        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,
    },

    /// Tail solver logs
    Logs {
        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,

        /// Number of lines to show
        #[arg(long, short, default_value = "50")]
        lines: usize,

        /// Follow log output
        #[arg(long, short)]
        follow: bool,
    },
}

impl SolverCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        match self {
            SolverCommand::Start { dir, background } => Self::start(dir, background, output).await,
            SolverCommand::Run { config } => Self::run_engine(&config).await,
            SolverCommand::Stop { dir } => Self::stop(dir, output).await,
            SolverCommand::Status { dir } => Self::status(dir, output).await,
            SolverCommand::Logs { dir, lines, follow } => {
                Self::logs(dir, lines, follow, output).await
            }
        }
    }

    /// Run the solver engine in-process (used by `solver start` foreground and `solver run`)
    async fn run_engine(config_path: &std::path::Path) -> Result<()> {
        run_solver_from_config(config_path).await
    }

    async fn start(dir: Option<PathBuf>, background: bool, output: OutputFormat) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let state_mgr = StateManager::new(&project_dir);

        out.header("Starting Solver");

        // Load state
        let state = state_mgr.load_or_error().await?;

        if !state.solver.configured {
            anyhow::bail!("Solver not configured. Run 'solver-cli configure' first.");
        }

        // Load environment for solver private key
        load_dotenv(&project_dir)?;

        let runner = SolverRunner::new(&project_dir);
        let config_path = runner.config_path().to_path_buf();

        if background {
            // Spawn solver-cli itself with "solver run --config ..."
            let pid = runner.start_background_in_process(&config_path).await?;
            print_success(&format!("Solver started in background (PID: {})", pid));
            print_kv("Log file", runner.log_file().display());

            if out.is_json() {
                out.json(&serde_json::json!({
                    "status": "started",
                    "pid": pid,
                    "background": true,
                    "log_file": runner.log_file().to_string_lossy(),
                }))?;
            }
        } else {
            print_info("Starting solver in foreground (Ctrl+C to stop)...");
            print_divider();
            runner.ensure_config_exists().await?;
            run_solver_from_config(&config_path).await?;
        }

        Ok(())
    }

    async fn stop(dir: Option<PathBuf>, output: OutputFormat) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());

        out.header("Stopping Solver");

        let runner = SolverRunner::new(&project_dir);
        runner.stop().await?;

        print_success("Solver stopped");

        if out.is_json() {
            out.json(&serde_json::json!({
                "status": "stopped",
            }))?;
        }

        Ok(())
    }

    async fn status(dir: Option<PathBuf>, output: OutputFormat) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());

        out.header("Solver Status");

        let runner = SolverRunner::new(&project_dir);
        let status = runner.status().await?;

        print_kv("Status", &status);
        print_kv("Config", runner.config_path().display());
        print_kv("Log file", runner.log_file().display());

        if out.is_json() {
            out.json(&serde_json::json!({
                "status": status.to_string(),
                "config_path": runner.config_path().to_string_lossy(),
                "log_file": runner.log_file().to_string_lossy(),
            }))?;
        }

        Ok(())
    }

    async fn logs(
        dir: Option<PathBuf>,
        lines: usize,
        follow: bool,
        _output: OutputFormat,
    ) -> Result<()> {
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let runner = SolverRunner::new(&project_dir);

        let log_file = runner.log_file();
        if !log_file.exists() {
            anyhow::bail!("Log file not found at {:?}", log_file);
        }

        // Use tail command for simplicity
        let mut cmd = tokio::process::Command::new("tail");
        cmd.arg("-n").arg(lines.to_string());

        if follow {
            cmd.arg("-f");
        }

        cmd.arg(log_file);

        let status = cmd.status().await?;
        if !status.success() {
            anyhow::bail!("Failed to tail logs");
        }

        Ok(())
    }
}
