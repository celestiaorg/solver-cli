mod chain;
mod commands;
mod deployment;
mod solver;
mod state;
mod utils;

use clap::{Parser, Subcommand};
use tracing::Level;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

use commands::{
    configure::ConfigureCommand, deploy::DeployCommand, fund::FundCommand, init::InitCommand,
    intent::IntentCommand, solver::SolverCommand, verify::VerifyCommand,
};

#[derive(Parser)]
#[command(name = "solver-cli")]
#[command(version = "0.1.0")]
#[command(about = "CLI for OIF cross-chain solver")]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Log level (error, warn, info, debug, trace)
    #[arg(long, global = true, default_value = "info", env = "SOLVER_LOG_LEVEL")]
    log_level: String,

    /// Output format (human, json)
    #[arg(long, global = true, default_value = "human")]
    output: OutputFormat,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, clap::ValueEnum)]
pub enum OutputFormat {
    Human,
    Json,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize project state
    Init(InitCommand),

    /// Deploy contracts to both chains
    Deploy(DeployCommand),

    /// Generate solver configuration
    Configure(ConfigureCommand),

    /// Fund solver with tokens
    Fund(FundCommand),

    /// Solver management (start/stop)
    #[command(subcommand)]
    Solver(SolverCommand),

    /// Intent submission
    #[command(subcommand)]
    Intent(IntentCommand),

    /// Verify balances
    Verify(VerifyCommand),
}

fn setup_logging(level: &str) -> anyhow::Result<()> {
    let level = level.parse::<Level>().unwrap_or(Level::INFO);

    let filter = EnvFilter::builder()
        .with_default_directive(level.into())
        .from_env_lossy();

    tracing_subscriber::registry()
        .with(fmt::layer().with_target(true).with_thread_ids(false))
        .with(filter)
        .init();

    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    setup_logging(&cli.log_level)?;

    let result = match cli.command {
        Commands::Init(cmd) => cmd.run(cli.output).await,
        Commands::Deploy(cmd) => cmd.run(cli.output).await,
        Commands::Configure(cmd) => cmd.run(cli.output).await,
        Commands::Fund(cmd) => cmd.run(cli.output).await,
        Commands::Solver(cmd) => cmd.run(cli.output).await,
        Commands::Intent(cmd) => cmd.run(cli.output).await,
        Commands::Verify(cmd) => cmd.run(cli.output).await,
    };

    if let Err(e) = result {
        tracing::error!("Command failed: {}", e);
        std::process::exit(1);
    }

    Ok(())
}
