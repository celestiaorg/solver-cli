# 3-Chain Quick Start

Run a solver with 2 local Anvil chains + Sepolia testnet.

## Prerequisites

- Foundry (`anvil`, `forge`, `cast`)
- Rust toolchain
- Sepolia ETH on your solver key

## Setup Steps

### 1. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and set your Sepolia private key:

```bash
# Your solver key - MUST have Sepolia ETH for gas
SEPOLIA_PK=your_private_key_here_without_0x_prefix

# Local chain keys (Anvil defaults - OK to leave as-is)
EVOLVE_PK=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
EVOLVE2_PK=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# User key (Anvil account #1 - OK to leave as-is)
USER_PK=59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

Your `.env` should have these chains:

| Chain   | RPC                         | Chain ID |
|---------|-----------------------------|----------|
| evolve  | http://127.0.0.1:8545       | 1234     |
| evolve2 | http://127.0.0.1:8546       | 5678     |
| sepolia | https://...publicnode.com   | 11155111 |

### 2. Start Local Chains

```bash
make start
```

This starts:
- **Anvil 1** on port 8545 (chain ID 1234) → evolve
- **Anvil 2** on port 8546 (chain ID 5678) → evolve2

Output:
```
Starting Anvil 1 (evolve) on port 8545, chain-id 1234...
Anvil 1 started (PID: 12345)
Starting Anvil 2 (evolve2) on port 8546, chain-id 5678...
Anvil 2 started (PID: 12346)
Local chains ready!
```

### 3. Full Setup

Run the all-in-one setup command:

```bash
make setup
```

This runs (in order):
1. `make init` - Initialize state
2. `make deploy` - Deploy contracts to all 3 chains
3. `make configure` - Generate solver & oracle configs
4. `make fund` - Fund solver with tokens on all chains
5. `make fund-operator` - Fund oracle operator with ETH
6. `make mint-user` - Mint test tokens to user

**Expected output:**

```
═══ DEPLOYMENT SUMMARY ═══
  3 chains configured

Chain: evolve (1234)
  InputSettlerEscrow: 0x...
  OutputSettlerSimple: 0x...
  CentralizedOracle: 0x...
  USDC: 0x...

Chain: evolve2 (5678)
  InputSettlerEscrow: 0x...
  OutputSettlerSimple: 0x...
  CentralizedOracle: 0x...
  USDC: 0x...

Chain: sepolia (11155111)
  InputSettlerEscrow: 0x...
  OutputSettlerSimple: 0x...
  CentralizedOracle: 0x...
  USDC: 0x...

Config written to config/solver.toml
Oracle config written to config/oracle.toml
Setup complete!
```

### 4. Start Solver (Terminal 1)

```bash
make solver
```

Expected output:
```
[INFO] Starting solver with 3 chains
[INFO] Watching chain 1234 (evolve)
[INFO] Watching chain 5678 (evolve2)
[INFO] Watching chain 11155111 (sepolia)
[INFO] All-to-all routes configured: 6 routes
[INFO] Solver ready
```

Leave this running.

### 5. Start Oracle Operator (Terminal 2)

Open a new terminal:

```bash
make operator
```

Expected output:
```
[INFO] Oracle operator starting
[INFO] Operator address: 0x...
[INFO] Watching chain 1234 for fills...
[INFO] Watching chain 5678 for fills...
[INFO] Watching chain 11155111 for fills...
[INFO] Oracle operator ready
```

Leave this running.

## Testing

### Check Initial Balances

In a third terminal:

```bash
make balances
```

Expected output:
```
═══ BALANCES ═══
  Chain    │ Account │ Balance
  ─────────┼─────────┼────────
  evolve   │ User    │ 10 USDC
  evolve   │ Solver  │ 10 USDC
  evolve2  │ User    │ 10 USDC
  evolve2  │ Solver  │ 10 USDC
  sepolia  │ User    │ 10 USDC
  sepolia  │ Solver  │ 10 USDC
═══════════════
```

### Submit Test Intents

Test all possible routes:

#### Test 1: evolve → sepolia

```bash
make intent FROM=evolve TO=sepolia AMOUNT=1000000
```

What happens:
1. User locks 1 USDC in evolve's InputSettlerEscrow
2. Solver detects intent on evolve
3. Solver fills 1 USDC on sepolia (pays from solver balance)
4. Oracle operator sees OutputFilled on sepolia
5. Oracle operator queries all chains, finds order originated on evolve
6. Oracle operator submits attestation to evolve's CentralizedOracle
7. Solver polls oracle on evolve, sees attestation
8. Solver claims 1 USDC from escrow on evolve

**Expected logs:**

Solver terminal:
```
[INFO] Detected intent on chain 1234 (evolve)
[INFO] Intent: 1 USDC to chain 11155111 (sepolia)
[INFO] Profitability check: profitable
[INFO] Filling order on sepolia...
[INFO] Fill tx: 0x...
[INFO] Waiting for oracle attestation on evolve...
[INFO] Oracle confirmed! Claiming funds...
[INFO] Claim tx: 0x...
[INFO] Fill complete!
```

Oracle operator terminal:
```
[INFO] OutputFilled detected on chain 11155111 (sepolia)
[INFO] OrderId: 0x...
[INFO] Querying all chains for origin...
[INFO] Found order on chain 1234 (evolve)
[INFO] Signing attestation...
[INFO] Submitting attestation to chain 1234 oracle...
[INFO] Attestation tx: 0x...
[INFO] Attestation submitted successfully
```

Check balances:
```bash
make balances
```

Expected change:
```
  Chain    │ Account │ Balance
  ─────────┼─────────┼────────
  evolve   │ User    │ 9 USDC    ← decreased
  evolve   │ Solver  │ 11 USDC   ← increased (claimed from escrow)
  sepolia  │ User    │ 11 USDC   ← increased (received fill)
  sepolia  │ Solver  │ 9 USDC    ← decreased (paid for fill)
```

#### Test 2: sepolia → evolve2

```bash
make intent FROM=sepolia TO=evolve2 AMOUNT=500000
```

Flow:
1. User escrows 0.5 USDC on sepolia
2. Solver fills on evolve2
3. Oracle operator attests to sepolia
4. Solver claims on sepolia

#### Test 3: evolve2 → evolve

```bash
make intent FROM=evolve2 TO=evolve AMOUNT=250000
```

Flow:
1. User escrows 0.25 USDC on evolve2
2. Solver fills on evolve
3. Oracle operator attests to evolve2
4. Solver claims on evolve2

### Final Balances

```bash
make balances
```

All 6 routes work:
- evolve ↔ sepolia
- evolve ↔ evolve2
- sepolia ↔ evolve2

## Stopping

Stop all services:

```bash
# Stop solver (Ctrl+C in solver terminal, or:)
solver-cli/target/release/solver-cli solver stop

# Stop oracle operator (Ctrl+C in operator terminal)

# Stop local chains
make stop
```

## Cleaning Up

To reset everything:

```bash
make clean  # Removes state, configs, and pid files
```

Then re-run `make setup` to start fresh.

## Troubleshooting

### "No chains configured" error

Run `make deploy` first to deploy contracts.

### Solver not detecting intents

1. Check solver logs for "Watching chain..." messages
2. Verify `.env` has all 3 chain configs
3. Try restarting: `solver-cli solver stop && make solver`

### Oracle operator not submitting

1. Check operator has ETH on all chains: `make fund-operator`
2. Verify oracle addresses match in `config/oracle.toml` and deployment state
3. Check operator logs for errors

### Intent submitted but not filled

1. **Check solver profitability**: Solver may reject unprofitable orders
2. **Check solver balance**: Solver needs tokens on destination chain
3. **Check gas**: Solver needs ETH for gas on destination chain

### Local chain connection refused

Restart local chains:
```bash
make stop
make start
```

## Next Steps

- [Multi-Chain Setup Guide](./multi-chain-setup.md) - Detailed architecture explanation
- [Adding More Chains](./multi-chain-setup.md#adding-more-chains) - Scale to 4+ chains
- [Token Management](./multi-chain-setup.md#token-management) - Add DAI, USDT, etc.
- [Solve Existing Tokens](./solve-existing-tokens.md) - Use already-deployed tokens

## Key Concepts

### All-to-All Routing

With 3 chains, the system automatically creates **6 routes**:

```
     evolve (1234)
      /     \
     /       \
    /         \
sepolia    evolve2
(11155111) (5678)
    \         /
     \       /
      \     /
   All connected!
```

Config automatically generated:
```toml
[routes]
1234 = [5678, 11155111]      # evolve → {evolve2, sepolia}
5678 = [1234, 11155111]      # evolve2 → {evolve, sepolia}
11155111 = [1234, 5678]      # sepolia → {evolve, evolve2}
```

### Chain Auto-Detection

The CLI auto-detects chains from `.env` by looking for the pattern:
- `{CHAIN}_RPC`
- `{CHAIN}_PK`
- `{CHAIN}_CHAIN_ID` (optional)

Works with any chain name: `ARBITRUM_RPC`, `OPTIMISM_RPC`, `BASE_RPC`, etc.

### Separate Keys for Security

**Production setup requires:**
- **Solver key** (`SEPOLIA_PK` or `SOLVER_PRIVATE_KEY`) - Fills orders and claims funds
- **Oracle operator key** (`ORACLE_OPERATOR_PK`) - Signs attestations only

**Why?** Prevents self-attestation (solver can't verify its own work).

**Testing shortcut:** For local testing, both can use the same key (simpler setup, but defeats trust model).
