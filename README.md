# OIF E2E Solver

Cross-chain intent solver supporting **any number of EVM chains**.

This CLI deploys OIF contracts, runs a solver, and executes cross-chain token transfers.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) - Local EVM chain
- [Foundry](https://book.getfoundry.sh/getting-started/installation) - `forge` and `cast`
- [Rust](https://rustup.rs/) - Build the CLI
- **Testnet ETH** - Get testnet ETH from a [faucet](https://sepoliafaucet.com)

## Quick Start: E2E Test

```bash
# 1. Start local EVM chain
make start

# 2. Configure environment
cp .env.example .env
# Edit .env with your SEPOLIA_PK (must have Sepolia ETH for gas!)

# 3. Full setup (build, deploy, configure, fund)
make clean && make setup

# 4. Start solver
make solver

# 5. Submit intent and check balances (in separate terminal)
make balances
## Optional, accounts are pre-funded in E2E
make mint
make balances
make intent
make balances
```
