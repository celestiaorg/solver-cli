# OIF E2E Solver

Cross-chain intent solver for **EVM (local)** <-> **Ethereum Sepolia**.

This CLI deploys OIF contracts, runs a solver, and executes cross-chain USDC transfers.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) - Local EVM chain
- [Foundry](https://book.getfoundry.sh/getting-started/installation) - `forge` and `cast`
- [Rust](https://rustup.rs/) - Build the CLI
- **Sepolia ETH** - Get testnet ETH from a [faucet](https://sepoliafaucet.com)

## Quick Start

```bash
# 1. Start local EVM chain
make start

# 2. Configure environment
cp .env.example .env
# Edit .env with your SEPOLIA_PK (must have Sepolia ETH for gas!)

# 3. Full setup (build, deploy, configure, fund)
make clean && make setup

# 4. Start solver (in separate terminal)
# Note: wait a few seconds after make setup or else you might
# get a pending TX error.
make solver-start
# or use the alias:
make solver

# 5. Start oracle operator (in another separate terminal)
# CRITICAL: This must be running for the full flow to work
make operator-start
# or use the alias:
make operator

# 6. Submit intent and verify (in original terminal)
make intent
make verify
```

To stop everything:
```bash
make stop
```

## Environment Setup (.env)

```bash
# RPC Endpoints
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
EVM_RPC=http://127.0.0.1:8545

# Chain IDs
SEPOLIA_CHAIN_ID=11155111
EVM_CHAIN_ID=1234

# Private Keys (without 0x prefix)
# IMPORTANT: SEPOLIA_PK is used as the SOLVER key on BOTH chains
# This key must have Sepolia ETH for gas!
SEPOLIA_PK=<your-private-key-with-sepolia-eth>

# Deployer for local EVM (Anvil default key is fine here)
EVM_PK=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# User account (creates intents)
USER_PK=59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

# Token
TOKEN_SYMBOL=USDC
```

### Critical: Solver Private Key

The solver uses **SEPOLIA_PK** (not EVM_PK) for transactions on both chains.

**Why?** The default Anvil key (`0xac0974...`) is publicly known. Bots monitor this address on public networks and instantly drain any funds. Your SEPOLIA_PK should be a private key that only you know.

Check your solver address:
```bash
cast wallet address --private-key 0x$SEPOLIA_PK
```

This address needs:
1. **Sepolia ETH** for gas (~0.1 ETH is plenty)
2. **USDC tokens** (the `fund` command mints these)

## Make Commands

| Command | Description |
|---------|-------------|
| `make start` | Start local EVM chain (Anvil) |
| `make stop` | Stop Anvil and solver |
| `make setup` | Full setup: build + init + deploy + configure + fund |
| `make solver-start` | Start the solver service |
| `make solver` | Alias for `make solver-start` |
| `make operator-start` | Start the oracle operator service |
| `make operator` | Alias for `make operator-start` |
| `make intent` | Submit a test intent (1 USDC) |
| `make verify` | Check balances |
| `make clean` | Remove generated files |
| `make reset` | Clean and reinitialize everything |

Use `FORCE=1` to reinitialize or redeploy: `make setup FORCE=1`

Run `make help` to see all available commands.

## CLI Commands

For more control, use the CLI directly:

| Command | Description |
|---------|-------------|
| `solver-cli init` | Initialize project state |
| `solver-cli deploy --force` | Deploy contracts to both chains |
| `solver-cli configure` | Generate solver config |
| `solver-cli fund --amount N` | Mint N USDC tokens to solver (raw units) |
| `solver-cli solver start` | Start the solver |
| `solver-cli intent submit --amount N` | Submit intent for N tokens (raw units) |
| `solver-cli verify` | Check balances |

## Token Amounts

The USDC token has **6 decimals**:

| Raw Units | Human Readable |
|-----------|----------------|
| 1,000,000 | 1 USDC |
| 10,000,000 | 10 USDC |

All CLI commands use **raw units**:
```bash
# Fund solver with 10 USDC
solver-cli fund --amount 10000000

# Submit intent for 1 USDC
solver-cli intent submit --amount 1000000 --direction forward
```

## How It Works

```
┌─────────────────┐                      ┌─────────────────┐
│     EVM      │                      │     SEPOLIA     │
│   (Chain 1234)  │                      │ (Chain 11155111)│
├─────────────────┤                      ├─────────────────┤
│ InputSettler    │◄──── Solver ────────►│ OutputSettler   │
│ (escrow tokens) │      monitors        │ (deliver tokens)│
├─────────────────┤      both chains     ├─────────────────┤
│ Oracle          │◄── Oracle Operator ─►│ Oracle          │
│ (Centralized)   │    (separate service)│ (Centralized)   │
├─────────────────┤                      ├─────────────────┤
│ USDC Token      │                      │ USDC Token      │
│ (MockERC20)     │                      │ (MockERC20)     │
└─────────────────┘                      └─────────────────┘
```

### Intent Flow (EVM -> Sepolia)

1. **User submits intent** on EVM
   - Tokens escrowed in InputSettler
2. **Solver detects** intent via on-chain polling
3. **Solver delivers** tokens to user on Sepolia
4. **Oracle attests** the fulfillment (AlwaysYesOracle auto-approves)
5. **Solver claims** escrowed tokens as reward on EVM


Start the oracle operator in a separate terminal:
```bash
make operator-start
```

### Wrong solver address funded
The solver uses SEPOLIA_PK, not EVM_PK. Verify:
```bash
# This should match the address shown in solver logs
cast wallet address --private-key 0x$SEPOLIA_PK
```


## Contracts Deployed

- **MockERC20** - Mintable test USDC token
- **InputSettlerEscrow** - Escrows user tokens on origin chain
- **OutputSettlerSimple** - Handles delivery on destination chain
- **CentralizedOracle** - Oracle that verifies attestations from authorized operator

## Development

```bash
# Build CLI
cd solver-cli && cargo build --release

# Run tests
cd solver-cli && cargo test

# Build contracts
cd oif/oif-contracts && forge build
```
