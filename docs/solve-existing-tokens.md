# Solve Existing Tokens Guide

This guide is for **solver operators** who want to fill cross-chain intents using existing OIF deployments and real tokens.

**Not deploying fresh contracts?** This is the right guide. You'll add existing chain contracts and configure the solver to watch for and fill orders.

## Prerequisites

- [Rust](https://rustup.rs/) - Build the CLI
- **Native tokens for gas** on each chain you're solving
- **Token balances** on destination chains to fill orders
- **OIF contract addresses** for each chain (InputSettler, OutputSettler, Oracle)

## Overview

Instead of deploying new contracts, you'll:
1. Add existing chains with their deployed contract addresses
2. Add the tokens you want to solve
3. Configure and run the solver

## Quick Start

```bash
# 1. Initialize project
solver-cli init

# 2. Add chains with existing contracts
solver-cli chain add \
  --name ethereum \
  --rpc "https://eth-mainnet.g.alchemy.com/v2/..." \
  --input-settler 0x1234... \
  --output-settler 0x5678... \
  --oracle 0x9abc...

solver-cli chain add \
  --name arbitrum \
  --rpc "https://arb-mainnet.g.alchemy.com/v2/..." \
  --input-settler 0xdef0... \
  --output-settler 0x1111... \
  --oracle 0x2222...

# 3. Add tokens to solve
solver-cli token add --chain ethereum --symbol USDC --address 0xa0b8... --decimals 6
solver-cli token add --chain arbitrum --symbol USDC --address 0xaf88... --decimals 6

# 4. Generate configs
solver-cli configure

# 5. Start solver (separate terminal)
make solver

# 6. Start oracle operator (another terminal)
make operator
```

## Adding Chains

Use `chain add` for chains with existing OIF contracts:

```bash
solver-cli chain add \
  --name <chain-name> \
  --rpc "<rpc-url>" \
  --input-settler <address> \
  --output-settler <address> \
  --oracle <address> \
  --token USDC=<address>:6
```

### Required Addresses

You need these contract addresses for each chain:

| Contract | Description |
|----------|-------------|
| `--input-settler` | InputSettlerEscrow - where users lock tokens |
| `--output-settler` | OutputSettlerSimple - where solver delivers |
| `--oracle` | CentralizedOracle - attestation verification |

### Optional: Add Token During Chain Add

```bash
solver-cli chain add \
  --name optimism \
  --rpc "https://opt-mainnet.g.alchemy.com/v2/..." \
  --input-settler 0x... \
  --output-settler 0x... \
  --oracle 0x... \
  --token USDC=0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85:6
```

## Managing Tokens

### Add Tokens

```bash
# Add a token to a chain
solver-cli token add --chain ethereum --symbol USDC --address 0xa0b8... --decimals 6
solver-cli token add --chain ethereum --symbol USDT --address 0xdAC1... --decimals 6
solver-cli token add --chain ethereum --symbol DAI --address 0x6B17... --decimals 18
```

### List Tokens

```bash
# List all tokens
solver-cli token list

# List tokens on specific chain
solver-cli token list --chain ethereum
```

### Remove Tokens

```bash
solver-cli token remove --chain ethereum --symbol DAI
```

## Managing Chains

### List Chains

```bash
solver-cli chain list
```

### Remove Chain

```bash
solver-cli chain remove --chain optimism
```

## Environment Setup

Create `.env` with your keys:

```bash
# Solver private key (used on ALL chains for filling orders)
SOLVER_PRIVATE_KEY=<your-solver-key>

# Oracle operator key (signs attestations on ALL chains)
ORACLE_OPERATOR_PK=<your-operator-key>
```

**Important**: Both keys need:
- **Native tokens for gas** on every chain you're solving
- The solver key also needs **token balances** to fill orders on destination chains

The solver and oracle operator use a single key across all chains. Make sure your keys are funded on each chain before starting.

## Generate Configuration

After adding chains and tokens, generate configs:

```bash
solver-cli configure
```

This creates:
- `config/solver.toml` - Solver configuration with all chains and tokens
- `config/oracle.toml` - Oracle operator configuration

**Verify the configs** look correct before starting:
```bash
cat config/solver.toml   # Check RPC URLs, contract addresses, tokens
cat config/oracle.toml   # Check oracle addresses
```

## Running the Solver

```bash
# Terminal 1: Start solver
make solver

# Terminal 2: Start oracle operator
make operator
```

## Verifying Setup

```bash
# Check configured chains
solver-cli chain list

# Check tokens
solver-cli token list

# Check balances (requires USER_PK in .env)
make balances
```

## Common Token Addresses

### USDC
| Chain | Address | Decimals |
|-------|---------|----------|
| Ethereum | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 6 |
| Arbitrum | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 6 |
| Optimism | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` | 6 |
| Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |

### USDT
| Chain | Address | Decimals |
|-------|---------|----------|
| Ethereum | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | 6 |
| Arbitrum | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | 6 |

## Troubleshooting

### "Chain not found"
Make sure you've added the chain:
```bash
solver-cli chain list
```

### "Token not found"
Add the token to the chain:
```bash
solver-cli token add --chain <name> --symbol <SYM> --address <addr> --decimals <n>
```

### "No provider for chain"
After adding chains, regenerate configs:
```bash
solver-cli configure
```
Then restart the solver and operator.

### Solver not filling orders
1. Check solver has token balance on destination chain
2. Check solver has gas on destination chain
3. Check oracle operator is running
4. Check order profitability (solver may skip unprofitable orders)
