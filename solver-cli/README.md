# Solver CLI

Unified command-line interface for OIF (Open Intents Framework) solver deployment, configuration, and execution.

## Overview

The `solver-cli` replaces manual configuration and scripting with a single, automated tool that:

- Fully automates deployment, configuration, and execution
- Eliminates all manual config editing
- Automatically manages contract addresses and environments
- Supports local + Sepolia by default
- Provides end-to-end solver workflows

## Installation

Build the CLI:

```bash
cd solver-cli
cargo build --release --no-default-features
```

The binary will be at `target/release/solver-cli`.

## Quick Start

### 1. Initialize Project

```bash
solver-cli init --env local
```

This creates the project structure and state file at `.solver/state.json`.

### 2. Deploy Contracts

```bash
solver-cli deploy
```

Deploys OIF contracts to both the local Evolve chain and Sepolia. Automatically:
- Builds contracts with `forge build`
- Deploys to both chains
- Saves addresses to state

### 3. Configure Solver

```bash
solver-cli configure
```

Generates the solver configuration file from deployed addresses.

### 4. Start Solver

```bash
# Foreground
solver-cli solver start

# Background
solver-cli solver start --background
```

### 5. Submit Intent

```bash
solver-cli intent submit --amount 10 --asset ETH --wait
```

### 6. Verify Balances

```bash
solver-cli verify
```

## Commands

### Environment Management

| Command | Description |
|---------|-------------|
| `init` | Initialize project structure and state file |
| `doctor` | Health checks and diagnostics |
| `status` | Show current status |

### Deployment

| Command | Description |
|---------|-------------|
| `deploy` | Deploy all required contracts |
| `configure` | Configure solver and contract permissions |

### Solver Lifecycle

| Command | Description |
|---------|-------------|
| `solver start` | Start the solver |
| `solver stop` | Stop the solver |
| `solver status` | Check solver status |
| `solver logs` | Tail solver logs |

### Intent Management

| Command | Description |
|---------|-------------|
| `intent submit` | Submit a new intent |
| `intent status` | Check intent status |
| `intent list` | List all intents |

### Settlement & Verification

| Command | Description |
|---------|-------------|
| `settle` | Settlement and reward claiming |
| `verify` | Verify balances and positions |

## State Management

The CLI maintains state in `.solver/state.json`:

```json
{
  "env": "local",
  "chains": {
    "source": { ... },
    "destination": { ... }
  },
  "solver": {
    "address": "0x...",
    "configured": true
  },
  "intents": [ ... ],
  "deployment_version": "abc123",
  "last_updated": "2024-01-01T00:00:00Z"
}
```

**State is auto-managed. Do not edit manually.**

## Environment Variables

Required in `.env`:

```bash
EVOLVE_RPC=http://127.0.0.1:8545
SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_KEY
EVOLVE_PK=0x...
SEPOLIA_PK=0x...
USER_PK=0x...  # For transfers
```

## Example Workflow

```bash
# Run diagnostics
solver-cli doctor

# Initialize
solver-cli init --env local

# Deploy contracts (requires local chain running)
solver-cli deploy

# Configure solver
solver-cli configure

# Start solver
solver-cli solver start --background

# Submit intent and wait for fulfillment
solver-cli intent submit --amount 1 --asset ETH --wait

# Verify final balances
solver-cli verify
```

## Output Formats

Use `--output json` for machine-readable output:

```bash
solver-cli status --output json
```

## Logging

Set log level with `--log-level`:

```bash
solver-cli solver start --log-level debug
```

Levels: `error`, `warn`, `info`, `debug`, `trace`

## Integration with Makefile

The project Makefile includes CLI commands with `cli-` prefix:

```bash
make cli-init        # Initialize
make cli-deploy      # Deploy
make cli-configure   # Configure
make cli-solver-start    # Start solver
make cli-verify      # Verify balances
make cli-doctor      # Run diagnostics
make cli-workflow    # Run full workflow
```

## Development

Run without building:

```bash
cargo run --no-default-features -- doctor
```

Build with solver runtime (requires OIF solver dependencies):

```bash
cargo build --release
```

## License

MIT
