//! Centralized oracle settlement implementation for OIF solver.
//!
//! This crate provides:
//! - [`CentralizedSettlement`]: An implementation of [`solver_settlement::SettlementInterface`]
//!   that polls a [`CentralizedOracle`] contract on-chain. The oracle is attested by a
//!   separate operator service (see `oracle-operator/`), maintaining the trust model where
//!   the solver cannot self-attest its own fills.
//! - [`build_solver_with_centralized`]: Builds a full [`solver_core::SolverEngine`] using
//!   the upstream OIF solver components plus the centralized settlement implementation.

pub mod centralized;

pub use centralized::{
	create_settlement, CentralizedSettlement, CentralizedSettlementSchema, Registry,
};

use solver_config::Config;
use solver_core::{SolverEngine, SolverFactories};
use std::collections::HashMap;

/// Build a solver engine with the centralized settlement implementation included.
///
/// This bypasses the global `OnceLock`-based registry in `solver-service` and instead
/// constructs `SolverFactories` directly, adding our centralized settlement factory
/// alongside all upstream implementations.
pub async fn build_solver_with_centralized(
	config: &Config,
) -> Result<SolverEngine, Box<dyn std::error::Error + Send + Sync>> {
	let mut storage_factories = HashMap::new();
	for (name, factory) in solver_storage::get_all_implementations() {
		storage_factories.insert(name.to_string(), factory);
	}

	let mut account_factories = HashMap::new();
	for (name, factory) in solver_account::get_all_implementations() {
		account_factories.insert(name.to_string(), factory);
	}

	let mut delivery_factories = HashMap::new();
	for (name, factory) in solver_delivery::get_all_implementations() {
		delivery_factories.insert(name.to_string(), factory);
	}

	let mut discovery_factories = HashMap::new();
	for (name, factory) in solver_discovery::get_all_implementations() {
		discovery_factories.insert(name.to_string(), factory);
	}

	let mut order_factories = HashMap::new();
	for (name, factory) in solver_order::get_all_order_implementations() {
		order_factories.insert(name.to_string(), factory);
	}

	let mut pricing_factories = HashMap::new();
	for (name, factory) in solver_pricing::get_all_implementations() {
		pricing_factories.insert(name.to_string(), factory);
	}

	// Settlement: all upstream implementations (direct, hyperlane) + centralized
	let mut settlement_factories: HashMap<String, solver_settlement::SettlementFactory> =
		HashMap::new();
	for (name, factory) in solver_settlement::get_all_implementations() {
		settlement_factories.insert(name.to_string(), factory);
	}
	settlement_factories
		.insert("centralized".to_string(), create_settlement as solver_settlement::SettlementFactory);

	let mut strategy_factories = HashMap::new();
	for (name, factory) in solver_order::get_all_strategy_implementations() {
		strategy_factories.insert(name.to_string(), factory);
	}

	let factories = SolverFactories {
		storage_factories,
		account_factories,
		delivery_factories,
		discovery_factories,
		order_factories,
		pricing_factories,
		settlement_factories,
		strategy_factories,
	};

	let solver = solver_core::SolverBuilder::new(config.clone())
		.build(factories)
		.await?;
	Ok(solver)
}
