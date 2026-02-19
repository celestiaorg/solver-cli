use anyhow::{Context, Result};
use std::env;
use std::path::Path;
use std::process::Stdio;
use tokio::fs;
use tokio::process::Command;
use tracing::info;

/// Manages the solver process lifecycle
pub struct SolverRunner {
    config_path: std::path::PathBuf,
    pid_file: std::path::PathBuf,
    log_file: std::path::PathBuf,
}

impl SolverRunner {
    pub fn new(project_dir: &Path) -> Self {
        Self {
            config_path: project_dir.join(".config/solver.toml"),
            pid_file: project_dir.join(".config/solver.pid"),
            log_file: project_dir.join(".config/solver.log"),
        }
    }

    /// Start the solver in background by spawning solver-cli with `solver run --config ...`
    pub async fn start_background_in_process(&self, config_path: &Path) -> Result<u32> {
        self.ensure_config_exists().await?;

        // Check if already running
        if let Some(pid) = self.get_pid().await? {
            if self.is_process_running(pid).await {
                anyhow::bail!("Solver already running with PID {}", pid);
            }
        }

        info!("Starting solver in background mode...");

        let log_file = fs::File::create(&self.log_file)
            .await
            .context("Failed to create log file")?;

        let exe = env::current_exe().context("Failed to get current executable")?;

        let child = Command::new(&exe)
            .args(["solver", "run", "--config"])
            .arg(config_path)
            .env("RUST_LOG", "info")
            .stdout(Stdio::from(log_file.try_clone().await?.into_std().await))
            .stderr(Stdio::from(log_file.into_std().await))
            .spawn()
            .context("Failed to spawn solver process")?;

        let pid = child
            .id()
            .ok_or_else(|| anyhow::anyhow!("Failed to get PID"))?;

        // Write PID file
        fs::write(&self.pid_file, pid.to_string())
            .await
            .context("Failed to write PID file")?;

        info!("Solver started with PID {}", pid);
        info!("Logs: {:?}", self.log_file);

        Ok(pid)
    }

    /// Stop the solver
    pub async fn stop(&self) -> Result<()> {
        let pid = self
            .get_pid()
            .await?
            .ok_or_else(|| anyhow::anyhow!("No PID file found"))?;

        info!("Stopping solver with PID {}...", pid);

        #[cfg(unix)]
        {
            use nix::sys::signal::{kill, Signal};
            use nix::unistd::Pid;

            let pid = Pid::from_raw(pid as i32);
            kill(pid, Signal::SIGTERM).context("Failed to send SIGTERM")?;

            // Wait for process to exit
            for _ in 0..30 {
                if !self.is_process_running(pid.as_raw() as u32).await {
                    break;
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        }

        #[cfg(not(unix))]
        {
            // On non-Unix, try to kill via taskkill or similar
            Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/F"])
                .status()
                .await?;
        }

        // Remove PID file
        if self.pid_file.exists() {
            fs::remove_file(&self.pid_file).await?;
        }

        info!("Solver stopped");
        Ok(())
    }

    /// Check solver status
    pub async fn status(&self) -> Result<SolverStatus> {
        if !self.config_path.exists() {
            return Ok(SolverStatus::NotConfigured);
        }

        match self.get_pid().await? {
            Some(pid) if self.is_process_running(pid).await => Ok(SolverStatus::Running { pid }),
            Some(_) => {
                // Stale PID file
                fs::remove_file(&self.pid_file).await.ok();
                Ok(SolverStatus::Stopped)
            }
            None => Ok(SolverStatus::Stopped),
        }
    }

    /// Get the current PID if any
    async fn get_pid(&self) -> Result<Option<u32>> {
        if !self.pid_file.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&self.pid_file)
            .await
            .context("Failed to read PID file")?;

        let pid: u32 = content.trim().parse().context("Invalid PID in file")?;

        Ok(Some(pid))
    }

    /// Check if a process is running
    async fn is_process_running(&self, pid: u32) -> bool {
        #[cfg(unix)]
        {
            use nix::sys::signal::kill;
            use nix::unistd::Pid;

            kill(Pid::from_raw(pid as i32), None).is_ok()
        }

        #[cfg(not(unix))]
        {
            // On Windows, try to open the process
            false
        }
    }

    /// Ensure config file exists
    pub async fn ensure_config_exists(&self) -> Result<()> {
        if !self.config_path.exists() {
            anyhow::bail!(
                "Solver config not found at {:?}. Run 'solver-cli configure' first.",
                self.config_path
            );
        }
        Ok(())
    }

    /// Get log file path
    pub fn log_file(&self) -> &Path {
        &self.log_file
    }

    /// Get config path
    pub fn config_path(&self) -> &Path {
        &self.config_path
    }
}

#[derive(Debug, Clone)]
pub enum SolverStatus {
    NotConfigured,
    Stopped,
    Running { pid: u32 },
}

impl std::fmt::Display for SolverStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SolverStatus::NotConfigured => write!(f, "not configured"),
            SolverStatus::Stopped => write!(f, "stopped"),
            SolverStatus::Running { pid } => write!(f, "running (PID: {})", pid),
        }
    }
}
