# OIF E2E Solver

Cross-chain intent solver supporting **any number of EVM chains**.

This CLI deploys OIF contracts, runs a solver, and executes cross-chain token transfers.

## Choose Your Path

| Guide                                                  | Use Case                                            |
| ------------------------------------------------------ | --------------------------------------------------- |
| [Multi-Chain Setup](docs/multi-chain-setup.md)         | **START HERE** - Complete N-chain guide with 3-chain quickstart |
| [OIF Aggregator](docs/aggregator.md)                   | Multi-solver quote aggregation with REST API        |
| [Deploy New Token](docs/deploy-new-token.md)           | Fresh deployment with new contracts and mock tokens |
| [Solve Existing Tokens](docs/solve-existing-tokens.md) | Add existing chains and real tokens to solve        |


## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) - Local EVM chain
- [Foundry](https://book.getfoundry.sh/getting-started/installation) - `forge` and `cast`
- [Rust](https://rustup.rs/) - Build the CLI
- **Testnet ETH** - Get testnet ETH from a [faucet](https://sepoliafaucet.com)

## Quick Start: E2E Test

### Option 1: Direct to Chain (Simpler)

```bash
# 1. Start local EVM chain
make start

# 2. Configure environment
cp .env.example .env
# Edit .env with your SEPOLIA_PK (must have Sepolia ETH for gas!)

# 3. Full setup (build, deploy, configure, fund)
make clean && make setup

# 4. Start solver (in separate terminal)
make solver

# 5. Start oracle operator (in another separate terminal)
make operator

# 6. Submit intent and check balances (in original terminal)
make balances
make mint
make balances
make intent
make balances
```

### Option 2: With Aggregator (Recommended for Multi-Solver)

```bash
# 1-3. Same as above (start chain, configure, setup)

# 4. Start aggregator (Terminal 1)
make aggregator

# 5. Start solver (Terminal 2)
make solver

# 6. Start oracle operator (Terminal 3)
make operator

# 7. Use aggregator API or CLI
curl http://localhost:4000/api/v1/solvers
make intent
```

## Environment Setup

Chains are configured with the pattern `{CHAIN}_RPC` and `{CHAIN}_PK`:

```bash
cp .env.example .env
# Edit with your keys
```

See [Deploy New Token](docs/deploy-new-token.md) for detailed environment setup.

## Make Commands


| Command           | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `make start`      | Start local EVM chain (Anvil)                            |
| `make stop`       | Stop Anvil, solver, operator, and aggregator             |
| `make setup`      | Full setup: deploy + configure + fund + mint to user     |
| `make deploy`     | Deploy contracts (use `CHAINS=a,b` to limit)             |
| `make aggregator` | Start the OIF aggregator service (port 4000)             |
| `make solver`     | Start the solver service                                 |
| `make operator`   | Start the oracle operator service                        |
| `make mint`       | Mint mock tokens (`CHAIN=`, `SYMBOL=`, `TO=`, `AMOUNT=`) |
| `make intent`     | Submit intent (`FROM=`, `TO=`, `AMOUNT=`, `ASSET=`)      |
| `make balances`   | Check balances (use `CHAIN=name` to filter)              |
| `make chain-list` | List configured chains                                   |
| `make token-list` | List tokens across chains                                |
| `make clean`      | Remove generated files                                   |


Use `FORCE=1` to reinitialize or redeploy: `make setup FORCE=1`

Run `make help` to see all available commands.

## CLI Commands


| Command                                    | Description                           |
| ------------------------------------------ | ------------------------------------- |
| `solver-cli init`                          | Initialize project state              |
| `solver-cli deploy`                        | Deploy contracts to all chains        |
| `solver-cli deploy --chains a,b`           | Deploy to specific chains             |
| `solver-cli configure`                     | Generate solver config                |
| `solver-cli fund`                          | Fund solver with tokens on all chains |
| `solver-cli fund --chain X`                | Fund solver on specific chain         |
| `solver-cli chain add`                     | Add a chain with existing contracts   |
| `solver-cli chain list`                    | List configured chains                |
| `solver-cli token add`                     | Add a token to a chain                |
| `solver-cli token list`                    | List all tokens                       |
| `solver-cli token mint`                    | Mint mock tokens (MockERC20 only)     |
| `solver-cli solver start`                  | Start the solver                      |
| `solver-cli intent submit`                 | Submit a cross-chain intent           |
| `solver-cli intent submit --from a --to b` | Specify direction                     |
| `solver-cli balances`                      | Check balances on all chains              |


## Submitting Intents

```bash
# Default: 1 USDC from first chain to second
make intent

# Customize chain, token, amount
make intent FROM=sepolia TO=arbitrum ASSET=USDT AMOUNT=5000000

# Or use CLI directly
solver-cli intent submit --amount 1000000 --asset USDC --from evolve --to sepolia
```

**Token amounts use raw units** (e.g., USDC has 6 decimals: `1000000` = 1 USDC)

## OIF Aggregator

The aggregator provides multi-solver quote aggregation and order routing via a REST API.

**Quick Start:**
```bash
# Terminal 1
make aggregator

# Terminal 2
make solver

# Terminal 3
make operator
```

**Key Features:**
- Aggregate quotes from multiple solvers
- Best price selection
- Health monitoring with circuit breakers
- Per-solver order routing

**See the [OIF Aggregator Guide](docs/aggregator.md) for complete API documentation and examples.**

## How It Works

```
┌─────────────────┐                      ┌─────────────────┐
│     Chain A     │                      │     Chain B     │
├─────────────────┤                      ├─────────────────┤
│ InputSettler    │◄──── Solver ────────►│ OutputSettler   │
│ (escrow tokens) │      monitors        │ (deliver tokens)│
├─────────────────┤      all chains      ├─────────────────┤
│ Oracle          │◄── Oracle Operator ─►│ Oracle          │
│ (Centralized)   │    (separate service)│ (Centralized)   │
├─────────────────┤                      ├─────────────────┤
│ Tokens          │                      │ Tokens          │
│ (USDC, USDT...) │                      │ (USDC, USDT...) │
└─────────────────┘                      └─────────────────┘
```

### Intent Flow (Chain A -> Chain B)

1. **User submits intent** on Chain A
  - Tokens escrowed in InputSettler
2. **Solver detects** intent via on-chain polling
3. **Solver delivers** tokens to user on Chain B
4. **Oracle operator attests** the fulfillment
5. **Solver claims** escrowed tokens as reward on Chain A

## Contracts Deployed

- **MockERC20** - Mintable test token (USDC, etc.)
- **InputSettlerEscrow** - Escrows user tokens on origin chain
- **OutputSettlerSimple** - Handles delivery on destination chain
- **CentralizedOracle** - Verifies attestations from authorized operator

## Troubleshooting

### Oracle operator not running

The full flow requires the oracle operator to be running:

```bash
make operator
```

### Wrong solver address funded

The solver uses `SOLVER_PRIVATE_KEY` (falls back to `SEPOLIA_PK`). Verify:

```bash
cast wallet address --private-key 0x$SEPOLIA_PK
```

### Insufficient gas

Ensure your solver address has native tokens on all chains for gas.

## Development

```bash
# Build CLI
cd solver-cli && cargo build --release

# Run tests
cd solver-cli && cargo test

# Build contracts
cd oif/oif-contracts && forge build
```

