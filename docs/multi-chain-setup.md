# Multi-Chain Solver Setup Guide

This guide covers setting up the OIF solver with multiple chains, starting with 2 local Anvil chains + Sepolia testnet.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Quick Start (3 Chains)](#quick-start-3-chains)
- [Testing All Routes](#testing-all-routes)
- [Adding More Chains](#adding-more-chains)
- [Token Management](#token-management)
- [Troubleshooting](#troubleshooting)
- [Architecture Deep Dive](#architecture-deep-dive)

## Architecture Overview

The OIF solver system supports **N chains** with **all-to-all routing**:

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

**Key Features:**
- **N-chain support**: Add any number of EVM chains
- **All-to-all routing**: Every chain can send to every other chain
- **Single solver**: One solver instance monitors all chains
- **Separate oracle operator**: Independent attestation service prevents self-verification

**Components:**
- **Solver**: Watches all chains, fills orders, claims rewards
- **Oracle Operator**: Watches fills, discovers origin chains, submits attestations
- **Contracts per chain**: InputSettlerEscrow, OutputSettlerSimple, CentralizedOracle

## Quick Start (3 Chains)

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) - `forge`, `cast`, `anvil`
- [Rust toolchain](https://rustup.rs/)
- **Sepolia ETH** - Get from [faucet](https://sepoliafaucet.com)

### Chain Configuration

| Chain    | Chain ID | RPC URL                         | Type    |
|----------|----------|---------------------------------|---------|
| evolve   | 1234     | http://127.0.0.1:8545           | Local   |
| evolve2  | 5678     | http://127.0.0.1:8546           | Local   |
| sepolia  | 11155111 | https://...publicnode.com       | Testnet |

### 1. Configure Environment

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

### 2. Start Local Chains

```bash
make start
```

**Output:**
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
  InputSettlerEscrow: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
  OutputSettlerSimple: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
  CentralizedOracle: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
  USDC: 0x5FbDB2315678afecb367f032d93F642f64180aa3

Chain: evolve2 (5678)
  [... similar output ...]

Chain: sepolia (11155111)
  [... similar output ...]

Solver config written to .config/solver.toml
Oracle config written to .config/oracle.toml
Setup complete!
```

### 4. Start Services

**Terminal 1 - Solver:**
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

**Terminal 2 - Oracle Operator:**
```bash
make operator
```

Expected output:
```
[INFO] Oracle operator starting
[INFO] Operator address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
[INFO] Watching chain 1234 for fills...
[INFO] Watching chain 5678 for fills...
[INFO] Watching chain 11155111 for fills...
[INFO] Oracle operator ready
```

**Terminal 3 - Commands:**
Use this terminal for submitting intents and checking balances.

## Testing All Routes

### Check Initial Balances

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

### Test 1: evolve → sepolia

```bash
make intent FROM=evolve TO=sepolia AMOUNT=1000000
```

**Flow:**
1. User locks 1 USDC in evolve's InputSettlerEscrow
2. Solver detects intent on evolve
3. Solver fills 1 USDC on sepolia (pays from solver balance)
4. Oracle operator sees OutputFilled on sepolia
5. Oracle operator queries all chains, finds order originated on evolve
6. Oracle operator submits attestation to evolve's CentralizedOracle
7. Solver polls oracle on evolve, sees attestation
8. Solver claims 1 USDC from escrow on evolve

**Solver logs:**
```
[INFO] Detected intent on chain 1234 (evolve)
[INFO] Intent: 1 USDC to chain 11155111 (sepolia)
[INFO] Profitability check: profitable
[INFO] Filling order on sepolia...
[INFO] Fill tx: 0xabc123...
[INFO] Waiting for oracle attestation on evolve...
[INFO] Oracle confirmed! Claiming funds...
[INFO] Claim tx: 0xdef456...
[INFO] Fill complete!
```

**Oracle logs:**
```
[INFO] OutputFilled detected on chain 11155111 (sepolia)
[INFO] OrderId: 0x789...
[INFO] Querying all chains for origin...
[INFO] Found order on chain 1234 (evolve)
[INFO] Signing attestation...
[INFO] Submitting attestation to chain 1234 oracle...
[INFO] Attestation tx: 0xghi789...
[INFO] Attestation submitted successfully
```

Check balances:
```bash
make balances
```

Expected changes:
```
  Chain    │ Account │ Balance
  ─────────┼─────────┼────────
  evolve   │ User    │ 9 USDC    ← decreased
  evolve   │ Solver  │ 11 USDC   ← increased (claimed from escrow)
  sepolia  │ User    │ 11 USDC   ← increased (received fill)
  sepolia  │ Solver  │ 9 USDC    ← decreased (paid for fill)
```

### Test 2: sepolia → evolve2

```bash
make intent FROM=sepolia TO=evolve2 AMOUNT=500000
```

Transfer 0.5 USDC from Sepolia to evolve2.

### Test 3: evolve2 → evolve

```bash
make intent FROM=evolve2 TO=evolve AMOUNT=250000
```

Transfer 0.25 USDC between local chains.

### All 6 Routes Work

With 3 chains, you get **6 bidirectional routes**:
- evolve ↔ sepolia (2 routes)
- evolve ↔ evolve2 (2 routes)
- sepolia ↔ evolve2 (2 routes)

## Adding More Chains

The system automatically scales to N chains.

### Step 1: Add Chain to `.env`

```bash
# Add your new chain
ARBITRUM_RPC=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_PK=your_deployer_key
ARBITRUM_CHAIN_ID=421614
```

The CLI auto-detects chains from the pattern:
- `{CHAIN}_RPC`
- `{CHAIN}_PK`
- `{CHAIN}_CHAIN_ID` (optional)

### Step 2: Deploy to New Chain

```bash
# Deploy only to the new chain
make deploy CHAINS=arbitrum

# Or redeploy everything
make deploy
```

### Step 3: Regenerate Configs

```bash
make configure
```

This updates:
- `.config/solver.toml` - Adds new chain with all-to-all routes
- `.config/oracle.toml` - Adds new chain for attestation monitoring

### Step 4: Fund Solver

```bash
make fund CHAIN=arbitrum
```

### Step 5: Restart Services

Restart solver and oracle operator to pick up new configs:

```bash
# In solver terminal: Ctrl+C, then:
make solver

# In operator terminal: Ctrl+C, then:
make operator
```

### N-Chain Routing

Routes grow quadratically:
- **2 chains** = 2 routes (A↔B)
- **3 chains** = 6 routes (A↔B, A↔C, B↔C)
- **4 chains** = 12 routes
- **N chains** = N×(N-1) routes

All routes are automatically generated - no manual configuration needed!

## Token Management

### List Tokens

```bash
# All tokens across all chains
make token-list

# Tokens on specific chain
make token-list CHAIN=sepolia
```

### Add a Token

```bash
make token-add CHAIN=evolve SYMBOL=DAI \
    ADDRESS=0x6B175474E89094C44Da98b954EedeAC495271d0F \
    DECIMALS=18
```

### Remove a Token

```bash
make token-remove CHAIN=evolve SYMBOL=DAI
```

### Mint Test Tokens

```bash
# Mint to user on specific chain
make mint CHAIN=evolve SYMBOL=USDC TO=user AMOUNT=10000000

# Mint to user on all chains
make mint-user
```

**Note:** Minting only works with MockERC20 tokens deployed by this system.

## Chain Management

### List Chains

```bash
make chain-list
```

### Add Chain with Existing Contracts

If you have contracts already deployed:

```bash
make chain-add NAME=arbitrum RPC=https://... \
    CHAIN_ID=421614 \
    INPUT_SETTLER=0x... \
    OUTPUT_SETTLER=0x... \
    ORACLE=0x... \
    TOKEN_ADDR=USDC=0x...
```

### Remove Chain

```bash
make chain-remove CHAIN=arbitrum
```

## Troubleshooting

### Solver not detecting intents

**Check solver is watching all chains:**
```bash
# Look for "Watching chain..." logs
tail -f .config/solver.log
```

**Verify config:**
```bash
cat .config/solver.toml | grep -A 5 "\[networks"
```

**Restart solver:**
```bash
solver-cli solver stop
make solver
```

### Oracle operator not submitting

**Check operator has ETH for gas:**
```bash
make fund-operator
```

**Verify operator address:**
```bash
grep operator_address .config/oracle.toml
cast balance --rpc-url $SEPOLIA_RPC <operator_address>
```

**Check oracle addresses match:**
```bash
# Compare deployed oracle addresses with config
cat .config/state.json | jq '.chains[].contracts.oracle'
cat .config/oracle.toml | grep oracle_address
```

### Intent not filled

**Check solver profitability:**
- Solver may reject unprofitable orders
- Check logs for "unprofitable" messages

**Check solver balance:**
```bash
make balances
```
Solver needs tokens on destination chain to fill orders.

**Check solver gas:**
Solver needs ETH for gas on all chains:
```bash
cast balance --rpc-url $SEPOLIA_RPC <solver_address>
```

### User insufficient balance

```bash
make mint-user  # Mints 10 USDC to user on all chains
```

### Local chain connection refused

```bash
make stop
make start
```

### Configuration validation failed

```bash
# Clean and reinitialize
make clean
make setup FORCE=1
```

## Architecture Deep Dive

### Why Separate Solver and Oracle Operator?

This prevents the **self-attestation problem**.

**Wrong approach:**
```
Solver (key A): "I filled the order"
Solver (key A): "I confirm I filled the order"  ← Same key!
Solver (key A): "Pay me"
```

This is "trust me, I did the work" with no verification.

**Correct approach:**
```
Solver (key A): Fills order on destination chain
  ↓
Oracle Operator (key B): Watches chain, verifies fill happened
  ↓
Oracle Operator (key B): Signs attestation with independent key
  ↓
Solver (key A): Claims funds once oracle confirms
```

**For testing:** You can use the same key for both (simpler setup), but understand this defeats the trust model.

**For production:** Solver and operator MUST use different keys and ideally run as separate services/entities.

### Intent Flow (Chain A → Chain B)

```
┌────────────────────────────────────────────────────────────────┐
│ 1. User submits intent on Chain A                             │
│    → Tokens escrowed in InputSettlerEscrow                     │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ 2. Solver detects intent (polling InputSettlerEscrow)         │
│    → Checks profitability (gas costs vs spread)                │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ 3. Solver fills order on Chain B                              │
│    → Calls OutputSettlerSimple.fillOrder()                     │
│    → Emits OutputFilled event                                  │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ 4. Oracle operator detects OutputFilled on Chain B            │
│    → Queries all chains to find origin                         │
│    → Finds orderId in Chain A's InputSettlerEscrow             │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ 5. Oracle operator signs attestation                          │
│    → sign(keccak256(chainId, oracle, app, payloadHash))       │
│    → Submits to CentralizedOracle on Chain A                   │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ 6. Solver polls CentralizedOracle.isProven() on Chain A       │
│    → Waits for attestation confirmation                        │
│    → Claims escrowed funds from InputSettlerEscrow             │
└────────────────────────────────────────────────────────────────┘
```

### N-Chain Discovery Algorithm

When the oracle operator sees an `OutputFilled` event:

1. **Capture fill details**: Extract orderId, solver, output amount
2. **Query all chains**: For each chain, call `InputSettlerEscrow.orderStatus(orderId)`
3. **Find origin**: The chain that returns non-zero order data is the origin
4. **Sign attestation**: Use operator key to sign proof
5. **Submit to origin**: Send attestation to CentralizedOracle on origin chain

This scales to N chains without hardcoded routing tables!

### Config Generation

The CLI automatically generates configs from deployment state:

**solver.toml** includes:
- All deployed contract addresses per chain
- All-to-all routes: `[routes]` section with `chainId = [destChain1, destChain2, ...]`
- Gas settings and profitability thresholds

**oracle.toml** includes:
- List of all chains to monitor
- Contract addresses per chain
- Operator key and polling interval

### Performance Considerations

- **Local chains**: Use `--block-time 1` for fast testing (default in Makefile)
- **Parallel fills**: Solver can handle multiple intents simultaneously
- **Gas optimization**: Solver automatically rejects unprofitable orders
- **Polling intervals**: Adjust in configs for faster/slower operation
  - `poll_interval_seconds` in oracle.toml
  - Solver polling is configured in solver.toml

## Stopping Services

```bash
# Stop solver
solver-cli solver stop

# Stop oracle operator
Ctrl+C in operator terminal

# Stop local chains
make stop
```

## Clean Slate

To completely reset:

```bash
make clean  # Removes state, configs, and pid files
make setup  # Re-run setup from scratch
```

## Next Steps

- [Deploy New Token](./deploy-new-token.md) - Deploy fresh contracts and tokens
- [Solve Existing Tokens](./solve-existing-tokens.md) - Use already-deployed tokens
- [OIF Aggregator Integration](../AGGREGATOR_INTEGRATION.md) - Multi-solver quote aggregation

## Summary

**3-chain setup** creates:
- 6 bidirectional routes
- Automatic all-to-all routing
- Single solver watching all chains
- Independent oracle operator for attestations

**Scaling to N chains**:
- Add chain to `.env`
- Run `make deploy CHAINS=newchain`
- Regenerate configs with `make configure`
- Restart services

**Key concepts**:
- Chain configs are data-driven (no hardcoded names)
- Routes auto-generated for any N chains
- Solver and oracle must use different keys (production)
- All chains share the same solver instance
