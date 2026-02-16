# Multi-Chain Setup Guide

This guide explains how to run the solver with multiple chains, including 2 local Anvil chains + Sepolia.

## Architecture Overview

The OIF solver system is designed to support **N chains** with **all-to-all routing**:
- Oracle operator watches **all chains** for OutputFilled events
- Solver watches **all chains** for intents
- Intents can be created from **any chain** to **any other chain**
- Each chain maintains its own contracts but shares the same solver/operator

## 3-Chain Setup (2 Local + 1 Testnet)

### Chain Configuration

| Chain    | Chain ID | RPC URL                 | Type    |
|----------|----------|-------------------------|---------|
| evolve   | 1234     | http://127.0.0.1:8545   | Local   |
| evolve2  | 5678     | http://127.0.0.1:8546   | Local   |
| sepolia  | 11155111 | https://...             | Testnet |

### Prerequisites

1. **Foundry** - For Anvil local chains
2. **Solver CLI** - Built with `cargo build --release --features solver-runtime`
3. **Sepolia ETH** - For gas on Sepolia testnet
4. **Private Keys** - Solver key with funds on all chains

### Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
# =============================================================================
# RPC ENDPOINTS
# =============================================================================
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
EVOLVE_RPC=http://127.0.0.1:8545
EVOLVE2_RPC=http://127.0.0.1:8546

# =============================================================================
# CHAIN IDS
# =============================================================================
SEPOLIA_CHAIN_ID=11155111
EVOLVE_CHAIN_ID=1234
EVOLVE2_CHAIN_ID=5678

# =============================================================================
# PRIVATE KEYS
# =============================================================================

# Solver key (needs Sepolia ETH for gas on testnet)
SEPOLIA_PK=your_private_key_here

# Local chain deployers (Anvil default keys are fine)
EVOLVE_PK=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
EVOLVE2_PK=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# User key (creates intents)
USER_PK=59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

# =============================================================================
# TOKEN CONFIGURATION
# =============================================================================
TOKEN_SYMBOL=USDC
TRANSFER_AMOUNT=1000000
```

### Quick Start

```bash
# 1. Start local chains (both Anvil instances)
make start

# 2. Build CLI
make build

# 3. Deploy contracts to all 3 chains
make deploy

# 4. Generate solver & oracle configs
make configure

# 5. Fund solver with tokens on all chains
make fund

# 6. Fund oracle operator with ETH on all chains
make fund-operator

# 7. Mint test tokens to user
make mint-user

# 8. Start solver (in separate terminal)
make solver-start

# 9. Start oracle operator (in another terminal)
make operator-start

# 10. Submit test intents between any chains
make intent FROM=evolve TO=sepolia
make intent FROM=sepolia TO=evolve2
make intent FROM=evolve2 TO=evolve

# 11. Check balances on all chains
make balances
```

Or use the all-in-one setup command:

```bash
make setup  # Runs init + deploy + configure + fund + fund-operator + mint-user
```

## How It Works

### 1. Deployment

`make deploy` deploys contracts to **all configured chains**:
- InputSettlerEscrow (receives intents)
- OutputSettlerSimple (fills orders)
- CentralizedOracle (tracks attestations)
- MockERC20 tokens (USDC by default)

The CLI auto-detects chains from `.env` by looking for `{CHAIN}_RPC` + `{CHAIN}_PK` pairs.

### 2. Config Generation

`make configure` generates two config files:

**config/solver.toml** - Solver configuration with all-to-all routes:
```toml
[solver]
private_key = "0x..."
solver_id = "solver-001"

[networks.1234]  # evolve
input_settler_address = "0x..."
output_settler_address = "0x..."
...

[networks.5678]  # evolve2
input_settler_address = "0x..."
output_settler_address = "0x..."
...

[networks.11155111]  # sepolia
input_settler_address = "0x..."
output_settler_address = "0x..."
...

[routes]
1234 = [5678, 11155111]      # evolve can send to evolve2 or sepolia
5678 = [1234, 11155111]      # evolve2 can send to evolve or sepolia
11155111 = [1234, 5678]      # sepolia can send to evolve or evolve2
```

**config/oracle.toml** - Oracle operator configuration:
```toml
operator_private_key = "0x..."
operator_address = "0x..."
poll_interval_seconds = 3

[[chains]]
chain_id = 1234
rpc_url = "http://127.0.0.1:8545"
oracle_address = "0x..."
output_settler_address = "0x..."
input_settler_address = "0x..."

[[chains]]
chain_id = 5678
rpc_url = "http://127.0.0.1:8546"
oracle_address = "0x..."
output_settler_address = "0x..."
input_settler_address = "0x..."

[[chains]]
chain_id = 11155111
rpc_url = "https://..."
oracle_address = "0x..."
output_settler_address = "0x..."
input_settler_address = "0x..."
```

### 3. Solver Operation

The solver (from `oif/oif-solver/`) watches **all chains** simultaneously:

1. **Discovery**: Polls InputSettlerEscrow on all chains for new intents
2. **Profitability Check**: Calculates gas costs vs spread for each intent
3. **Execution**: If profitable, fills the order on the destination chain
4. **Claiming**: Waits for oracle attestation, then claims escrowed funds

### 4. Oracle Operator Flow

The oracle operator is a **separate service** that:

1. **Watches all chains** for OutputFilled events
2. **Discovers origin chain**: When a fill is detected, queries each chain's InputSettlerEscrow to find where the order originated
3. **Signs attestation**: Creates cryptographic proof of the fill using operator key
4. **Submits to origin chain**: Sends attestation to CentralizedOracle on the chain where the order was created

**Critical**: The operator uses a **different key** than the solver to prevent self-attestation.

### 5. Example Intent Flow

Intent from evolve → sepolia:

```
1. User submits intent on evolve (chain 1234)
   - Escrows 1 USDC in InputSettlerEscrow

2. Solver detects intent on evolve
   - Checks profitability
   - Fills order on sepolia (chain 11155111)
   - OutputSettlerSimple emits OutputFilled event

3. Oracle operator detects fill on sepolia
   - Queries all chains to find origin
   - Finds orderId in evolve's InputSettlerEscrow
   - Signs attestation with operator key
   - Submits to CentralizedOracle on evolve

4. Solver polls CentralizedOracle on evolve
   - Waits for isProven() to return true
   - Claims escrowed 1 USDC on evolve

Result: User receives 1 USDC on sepolia, solver recoups 1 USDC on evolve
```

## Testing Multiple Routes

Test all possible routes between your 3 chains:

```bash
# evolve → sepolia
make intent FROM=evolve TO=sepolia AMOUNT=1000000

# sepolia → evolve2
make intent FROM=sepolia TO=evolve2 AMOUNT=1000000

# evolve2 → evolve
make intent FROM=evolve2 TO=evolve AMOUNT=1000000

# Check balances after each transfer
make balances
```

## Adding More Chains

To add a 4th, 5th, or Nth chain:

1. **Update `.env`** with chain config:
   ```bash
   ARBITRUM_RPC=https://arb-sepolia.g.alchemy.com/v2/KEY
   ARBITRUM_PK=your_key
   ARBITRUM_CHAIN_ID=421614
   ```

2. **Deploy to new chain**:
   ```bash
   make deploy CHAINS=arbitrum
   ```

3. **Regenerate configs**:
   ```bash
   make configure
   ```

4. **Fund solver on new chain**:
   ```bash
   make fund CHAIN=arbitrum
   ```

5. **Restart solver and operator** to pick up new configs

The solver automatically generates all-to-all routes for any number of chains!

## Chain Management Commands

```bash
# List all configured chains
make chain-list

# Add a chain with existing contracts (no deployment)
make chain-add NAME=arbitrum RPC=... \
    INPUT_SETTLER=0x... \
    OUTPUT_SETTLER=0x... \
    ORACLE=0x...

# Remove a chain from config
make chain-remove CHAIN=arbitrum

# Check balances on specific chain
make balances CHAIN=sepolia
```

## Token Management

```bash
# List all tokens across chains
make token-list

# Add a token to a chain
make token-add CHAIN=evolve SYMBOL=DAI \
    ADDRESS=0x... DECIMALS=18

# Remove a token
make token-remove CHAIN=evolve SYMBOL=DAI

# Mint tokens for testing
make mint CHAIN=evolve SYMBOL=USDC TO=user AMOUNT=10000000
```

## Troubleshooting

### Solver not detecting intents

1. Check solver is watching all chains:
   ```bash
   # Look for "Watching chain..." logs for each chain
   tail -f .solver/solver.log
   ```

2. Verify chain configs in `config/solver.toml`

### Oracle operator not submitting attestations

1. Check operator is watching all chains:
   ```bash
   # Should see output like:
   # "Watching chain 1234 for fills..."
   # "Watching chain 5678 for fills..."
   # "Watching chain 11155111 for fills..."
   ```

2. Verify operator has ETH for gas on all chains:
   ```bash
   make fund-operator
   ```

3. Check oracle addresses in `config/oracle.toml` match deployed contracts

### Intent fails with "insufficient balance"

Mint tokens to user:
```bash
make mint-user  # Mints 10 USDC to user on all chains
```

### Local chain stopped

Restart local chains:
```bash
make stop
make start
```

## Performance Tips

- **Local chains**: Set `--block-time 1` for fast testing (default in Makefile)
- **Parallel fills**: Solver can fill multiple intents simultaneously
- **Gas optimization**: Solver rejects unprofitable orders automatically
- **Polling intervals**: Adjust `poll_interval_seconds` in oracle config for faster/slower attestations

## Architecture Notes

### Why Separate Solver and Oracle Operator?

This prevents the **self-attestation problem**:

❌ **Wrong**: Solver attests to its own fills
```
Solver (key A): "I filled the order"
Solver (key A): "I confirm I filled the order"  ← Same key!
Solver (key A): "Pay me"
```

✅ **Correct**: Independent oracle operator verifies fills
```
Solver (key A): Fills order
Oracle Operator (key B): Watches chain, verifies fill, signs attestation
Solver (key A): Claims funds once oracle confirms
```

For **testing**, you can use the same key for both (simpler), but understand this defeats the trust model.

For **production**, solver and operator MUST use different keys and ideally run as separate services.

### All-to-All Routing

The config generator automatically creates routes between every pair of chains:
- 2 chains = 2 routes (A→B, B→A)
- 3 chains = 6 routes (A→B, A→C, B→A, B→C, C→A, C→B)
- N chains = N×(N-1) routes

No hardcoded chain names in the core logic - everything is data-driven via chain IDs.
