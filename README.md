# OIF E2E Solver

Cross-chain intent solver for **Evolve (local)** <-> **Ethereum Sepolia**.

This CLI deploys OIF contracts, runs a solver, and executes cross-chain USDC transfers.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) - Local Evolve chain
- [Foundry](https://book.getfoundry.sh/getting-started/installation) - `forge` and `cast`
- [Rust](https://rustup.rs/) - Build the CLI
- **Sepolia ETH** - Get testnet ETH from a [faucet](https://sepoliafaucet.com)

## Quick Start

```bash
# 1. Start local Evolve chain
make start

# 2. Configure environment
cp .env.example .env
# Edit .env with your SEPOLIA_PK (must have Sepolia ETH for gas!)

# 3. Build CLI
cd solver-cli && cargo build --release && cd ..

# 4. Deploy contracts (both chains)
./solver-cli/target/release/solver-cli init
./solver-cli/target/release/solver-cli deploy --force

# 5. Configure solver
./solver-cli/target/release/solver-cli configure

# 6. Fund solver with USDC tokens
./solver-cli/target/release/solver-cli fund --amount 10000000

# 7. Start solver (in separate terminal)
./solver-cli/target/release/solver-cli solver start

# 8. Submit intent (in original terminal)
./solver-cli/target/release/solver-cli intent submit --amount 1000000 --direction forward
```

## Environment Setup (.env)

```bash
# RPC Endpoints
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
EVOLVE_RPC=http://127.0.0.1:8545

# Chain IDs
SEPOLIA_CHAIN_ID=11155111
EVOLVE_CHAIN_ID=1234

# Private Keys (without 0x prefix)
# IMPORTANT: SEPOLIA_PK is used as the SOLVER key on BOTH chains
# This key must have Sepolia ETH for gas!
SEPOLIA_PK=<your-private-key-with-sepolia-eth>

# Deployer for local Evolve (Anvil default key is fine here)
EVOLVE_PK=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# User account (creates intents)
USER_PK=59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

# Token
TOKEN_SYMBOL=USDC
```

### Critical: Solver Private Key

The solver uses **SEPOLIA_PK** (not EVOLVE_PK) for transactions on both chains.

**Why?** The default Anvil key (`0xac0974...`) is publicly known. Bots monitor this address on public networks and instantly drain any funds. Your SEPOLIA_PK should be a private key that only you know.

Check your solver address:
```bash
cast wallet address --private-key 0x$SEPOLIA_PK
```

This address needs:
1. **Sepolia ETH** for gas (~0.1 ETH is plenty)
2. **USDC tokens** (the `fund` command mints these)

## CLI Commands

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
│     EVOLVE      │                      │     SEPOLIA     │
│   (Chain 1234)  │                      │ (Chain 11155111)│
├─────────────────┤                      ├─────────────────┤
│ InputSettler    │◄──── Solver ────────►│ OutputSettler   │
│ (escrow tokens) │      monitors        │ (deliver tokens)│
├─────────────────┤      both chains     ├─────────────────┤
│ Oracle          │◄────────────────────►│ Oracle          │
│ (AlwaysYes)     │                      │ (AlwaysYes)     │
├─────────────────┤                      ├─────────────────┤
│ USDC Token      │                      │ USDC Token      │
│ (MockERC20)     │                      │ (MockERC20)     │
└─────────────────┘                      └─────────────────┘
```

### Intent Flow (Evolve -> Sepolia)

1. **User submits intent** on Evolve
   - Tokens escrowed in InputSettler
2. **Solver detects** intent via on-chain polling
3. **Solver delivers** tokens to user on Sepolia
4. **Oracle attests** the fulfillment (AlwaysYesOracle auto-approves)
5. **Solver claims** escrowed tokens as reward on Evolve

### Expected Balance Changes

After a successful 1 USDC transfer (Evolve -> Sepolia):

| Location | Account | Change |
|----------|---------|--------|
| Evolve | User | -1 USDC (escrowed, released to solver) |
| Evolve | Solver | +1 USDC (reward) |
| Sepolia | User | +1 USDC (received) |
| Sepolia | Solver | -1 USDC (delivered) |

## Troubleshooting

### "insufficient funds for gas"
The solver needs native ETH on Sepolia. Fund your solver address:
```bash
# Check solver address
cast wallet address --private-key 0x$SEPOLIA_PK

# Send ETH to this address from a faucet or another wallet
```

### "replacement transaction underpriced"
A previous transaction is pending. Wait 30 seconds and retry.

### "Order rejected - insufficient margin"
The solver config has `min_profitability_pct = 0.0` but gas costs make the trade unprofitable. The generated config uses `-100.0` to allow losses for testing.

### Solver not picking up intents
1. Ensure solver is running: `ps aux | grep solver-runner`
2. Check solver has tokens: `solver-cli verify`
3. Check solver logs: `tail -f /tmp/solver.log`

### Wrong solver address funded
The solver uses SEPOLIA_PK, not EVOLVE_PK. Verify:
```bash
# This should match the address shown in solver logs
cast wallet address --private-key 0x$SEPOLIA_PK
```

## Project Structure

```
.
├── solver-cli/           # Rust CLI
│   └── src/
│       ├── commands/     # init, deploy, configure, fund, solver, intent, verify
│       ├── chain/        # Blockchain client
│       ├── deployment/   # Contract deployment
│       └── solver/       # Config generation
├── solver-runner/        # OIF solver binary wrapper
├── config/
│   └── solver.toml       # Generated solver config
├── .solver/
│   └── state.json        # Deployed addresses
├── oif/
│   ├── oif-contracts/    # Smart contracts
│   └── oif-solver/       # Solver implementation
└── .env                  # Your configuration
```

## Contracts Deployed

- **MockERC20** - Mintable test USDC token
- **InputSettlerEscrow** - Escrows user tokens on origin chain
- **OutputSettlerSimple** - Handles delivery on destination chain
- **AlwaysYesOracle** - Mock oracle that approves all proofs (testing only)

## Development

```bash
# Build CLI
cd solver-cli && cargo build --release

# Run tests
cd solver-cli && cargo test

# Build contracts
cd oif/oif-contracts && forge build
```
