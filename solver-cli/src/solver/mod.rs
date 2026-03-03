#[cfg(feature = "solver-runtime")]
mod centralized;
mod config_gen;
mod engine;
mod runner;

pub use config_gen::ConfigGenerator;
pub use engine::run_solver_from_config;
pub use runner::SolverRunner;
