use anyhow::Result;
use clap::Subcommand;
use std::env;
use std::path::PathBuf;

use crate::solver::SolverRunner;
use crate::state::StateManager;
use crate::utils::*;
use crate::OutputFormat;

#[derive(Subcommand)]
pub enum SolverCommand {
    /// Start the solver
    Start {
        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,

        /// Run in background
        #[arg(long, short)]
        background: bool,
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
            SolverCommand::Stop { dir } => Self::stop(dir, output).await,
            SolverCommand::Status { dir } => Self::status(dir, output).await,
            SolverCommand::Logs { dir, lines, follow } => {
                Self::logs(dir, lines, follow, output).await
            }
        }
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

        // Find solver binary
        let solver_runner_dir = project_dir.join("solver-runner");
        let solver_binary = if solver_runner_dir.exists() {
            // Build and use local solver-runner
            print_info("Building solver-runner...");
            let status = tokio::process::Command::new("cargo")
                .current_dir(&solver_runner_dir)
                .args(["build", "--release"])
                .status()
                .await?;

            if !status.success() {
                anyhow::bail!("Failed to build solver-runner");
            }

            solver_runner_dir.join("target/release/solver-runner")
        } else {
            // Try to find global solver binary
            which::which("solver").unwrap_or_else(|_| PathBuf::from("solver"))
        };

        print_kv("Solver binary", solver_binary.display());

        let runner = SolverRunner::new(&project_dir);

        if background {
            let pid = runner.start_background(&solver_binary).await?;
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
            runner.start_foreground(&solver_binary).await?;
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
