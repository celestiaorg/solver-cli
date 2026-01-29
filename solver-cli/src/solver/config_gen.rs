use anyhow::{Context, Result};
use std::path::Path;
use tokio::fs;

use crate::state::SolverState;

/// Generates solver configuration files
pub struct ConfigGenerator;

impl ConfigGenerator {
    /// Generate solver TOML configuration from state
    pub fn generate_toml(state: &SolverState) -> Result<String> {
        // Read private key from environment at generation time
        // IMPORTANT: Use SEPOLIA_PK since EVOLVE_PK is the well-known Anvil key
        // which gets drained by bots on public testnets
        let solver_private_key = std::env::var("SOLVER_PRIVATE_KEY")
            .or_else(|_| std::env::var("SEPOLIA_PK"))
            .map_err(|_| anyhow::anyhow!("SOLVER_PRIVATE_KEY or SEPOLIA_PK must be set"))?;

        // Ensure the key has 0x prefix
        let solver_private_key = if solver_private_key.starts_with("0x") {
            solver_private_key
        } else {
            format!("0x{}", solver_private_key)
        };
        let source = state
            .chains
            .source
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Source chain not configured"))?;

        let dest = state
            .chains
            .destination
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Destination chain not configured"))?;

        // Get token info from source chain (assuming same token on both)
        let token_symbol = source
            .tokens
            .keys()
            .next()
            .ok_or_else(|| anyhow::anyhow!("No tokens configured"))?;

        let source_token = source
            .tokens
            .get(token_symbol)
            .ok_or_else(|| anyhow::anyhow!("Token {} not found on source chain", token_symbol))?;

        let dest_token = dest
            .tokens
            .get(token_symbol)
            .ok_or_else(|| anyhow::anyhow!("Token {} not found on dest chain", token_symbol))?;

        // Generate TOML matching solver-runner expected format
        let config = format!(
            r#"# Auto-generated solver configuration
# DO NOT EDIT MANUALLY - regenerate with 'solver-cli configure'

[solver]
id = "{solver_id}"
min_profitability_pct = -100.0  # Allow losses for testing
monitoring_timeout_seconds = 28800

# ============================================================================
# STORAGE
# ============================================================================
[storage]
primary = "memory"
cleanup_interval_seconds = 60

[storage.implementations.memory]
# Memory storage has no configuration

# ============================================================================
# ACCOUNT
# ============================================================================
[account]
primary = "local"

[account.implementations.local]
private_key = "{solver_private_key}"

# ============================================================================
# NETWORKS
# ============================================================================
[networks.{source_chain_id}]
input_settler_address = "{source_input_settler}"
output_settler_address = "{source_output_settler}"

[[networks.{source_chain_id}.rpc_urls]]
http = "{source_rpc}"

[[networks.{source_chain_id}.tokens]]
symbol = "{token_symbol}"
address = "{source_token_addr}"
decimals = {token_decimals}

[networks.{dest_chain_id}]
input_settler_address = "{dest_input_settler}"
output_settler_address = "{dest_output_settler}"

[[networks.{dest_chain_id}.rpc_urls]]
http = "{dest_rpc}"

[[networks.{dest_chain_id}.tokens]]
symbol = "{token_symbol}"
address = "{dest_token_addr}"
decimals = {token_decimals}

# ============================================================================
# DELIVERY
# ============================================================================
[delivery]
min_confirmations = 1

[delivery.implementations.evm_alloy]
network_ids = [{source_chain_id}, {dest_chain_id}]

# ============================================================================
# DISCOVERY
# ============================================================================
[discovery]

[discovery.implementations.onchain_eip7683]
network_ids = [{source_chain_id}, {dest_chain_id}]
polling_interval_secs = 2

# ============================================================================
# ORDER
# ============================================================================
[order]
simulate_callbacks = false

[order.implementations.eip7683]

[order.strategy]
primary = "simple"

[order.strategy.implementations.simple]
max_gas_price_gwei = 100

# ============================================================================
# PRICING
# ============================================================================
[pricing]
primary = "mock"

[pricing.implementations.mock]
# Uses default prices

# ============================================================================
# SETTLEMENT
# ============================================================================
[settlement]
settlement_poll_interval_seconds = 3

[settlement.implementations.direct]
order = "eip7683"
network_ids = [{source_chain_id}, {dest_chain_id}]
dispute_period_seconds = 1
oracle_selection_strategy = "First"

# Oracle configuration
[settlement.implementations.direct.oracles]
input = {{ {source_chain_id} = ["{source_oracle}"], {dest_chain_id} = ["{dest_oracle}"] }}
output = {{ {source_chain_id} = ["{source_oracle}"], {dest_chain_id} = ["{dest_oracle}"] }}

# Valid routes
[settlement.implementations.direct.routes]
{source_chain_id} = [{dest_chain_id}]
{dest_chain_id} = [{source_chain_id}]
"#,
            solver_id = state.solver.solver_id.as_deref().unwrap_or("solver-001"),
            solver_private_key = solver_private_key,
            source_chain_id = source.chain_id,
            source_rpc = source.rpc,
            source_input_settler = source.contracts.input_settler_escrow.as_deref().unwrap_or(""),
            source_output_settler = source.contracts.output_settler_simple.as_deref().unwrap_or(""),
            source_oracle = source.contracts.oracle.as_deref().unwrap_or(""),
            source_token_addr = source_token.address,
            token_symbol = token_symbol,
            token_decimals = source_token.decimals,
            dest_chain_id = dest.chain_id,
            dest_rpc = dest.rpc,
            dest_input_settler = dest.contracts.input_settler_escrow.as_deref().unwrap_or(""),
            dest_output_settler = dest.contracts.output_settler_simple.as_deref().unwrap_or(""),
            dest_oracle = dest.contracts.oracle.as_deref().unwrap_or(""),
            dest_token_addr = dest_token.address,
        );

        Ok(config)
    }

    /// Write configuration to a file
    pub async fn write_config(state: &SolverState, path: &Path) -> Result<()> {
        let content = Self::generate_toml(state)?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .await
                .context("Failed to create config directory")?;
        }

        fs::write(path, &content)
            .await
            .context("Failed to write config file")?;

        Ok(())
    }

    /// Generate YAML configuration (alternative format)
    pub fn generate_yaml(state: &SolverState) -> Result<String> {
        let source = state
            .chains
            .source
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Source chain not configured"))?;

        let dest = state
            .chains
            .destination
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Destination chain not configured"))?;

        let token_symbol = source
            .tokens
            .keys()
            .next()
            .ok_or_else(|| anyhow::anyhow!("No tokens configured"))?;

        let source_token = source.tokens.get(token_symbol).unwrap();
        let dest_token = dest.tokens.get(token_symbol).unwrap();

        let config = format!(
            r#"# Auto-generated solver configuration
# DO NOT EDIT MANUALLY

solver:
  id: "{solver_id}"
  min_profitability_pct: 0.0
  monitoring_timeout_seconds: 28800

storage:
  primary: memory
  cleanup_interval_seconds: 60
  implementations:
    memory: {{}}

account:
  primary: env
  implementations:
    env:
      env_var: SOLVER_PRIVATE_KEY

networks:
  - chain_id: {source_chain_id}
    rpc_url: "{source_rpc}"
    tokens:
      - symbol: {token_symbol}
        address: "{source_token_addr}"
        decimals: {token_decimals}

  - chain_id: {dest_chain_id}
    rpc_url: "{dest_rpc}"
    tokens:
      - symbol: {token_symbol}
        address: "{dest_token_addr}"
        decimals: {token_decimals}

delivery:
  min_confirmations: 1
  implementations:
    evm_alloy:
      network_ids: [{source_chain_id}, {dest_chain_id}]

discovery:
  implementations:
    onchain_eip7683:
      network_ids: [{source_chain_id}, {dest_chain_id}]
      polling_interval_secs: 2

order:
  simulate_callbacks: false
  implementations:
    eip7683: {{}}
  strategy:
    primary: simple
    implementations:
      simple:
        max_gas_price_gwei: 100

pricing:
  primary: mock
  implementations:
    mock: {{}}

settlement:
  settlement_poll_interval_seconds: 3
  implementations:
    direct:
      order: eip7683
      network_ids: [{source_chain_id}, {dest_chain_id}]
      dispute_period_seconds: 1
      oracle_selection_strategy: First
      oracles:
        input:
          {source_chain_id}: ["{source_oracle}"]
          {dest_chain_id}: ["{dest_oracle}"]
        output:
          {source_chain_id}: ["{source_oracle}"]
          {dest_chain_id}: ["{dest_oracle}"]
      routes:
        {source_chain_id}: [{dest_chain_id}]
        {dest_chain_id}: [{source_chain_id}]
"#,
            solver_id = state.solver.solver_id.as_deref().unwrap_or("solver-001"),
            source_chain_id = source.chain_id,
            source_rpc = source.rpc,
            source_oracle = source.contracts.oracle.as_deref().unwrap_or(""),
            source_token_addr = source_token.address,
            token_symbol = token_symbol,
            token_decimals = source_token.decimals,
            dest_chain_id = dest.chain_id,
            dest_rpc = dest.rpc,
            dest_oracle = dest.contracts.oracle.as_deref().unwrap_or(""),
            dest_token_addr = dest_token.address,
        );

        Ok(config)
    }
}
