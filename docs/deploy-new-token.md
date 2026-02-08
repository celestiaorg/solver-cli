# Deploy New Token Guide

This guide walks you through deploying fresh OIF contracts and a new token to test cross-chain transfers.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) - For local EVM chain
- [Foundry](https://book.getfoundry.sh/getting-started/installation) - `forge` and `cast`
- [Rust](https://rustup.rs/) - Build the CLI
- **Testnet ETH** - Get from a [faucet](https://sepoliafaucet.com)

## Quick Start

```bash
# 1. Start local EVM chain
make start

# 2. Configure environment
cp .env.example .env
# Edit .env with your SEPOLIA_PK (must have Sepolia ETH!)

# 3. Full setup (deploy contracts + mock USDC token)
make setup

# 4. Start solver (separate terminal)
make solver

# 5. Start oracle operator (another terminal)
make operator

# 6. Test it
make intent
make balances
```

## What Gets Deployed

When you run `make deploy` (or `make setup`), these contracts are deployed to **each chain**:

| Contract | Purpose |
|----------|---------|
| `CentralizedOracle` | Verifies cross-chain attestations |
| `InputSettlerEscrow` | Escrows tokens on source chain |
| `OutputSettlerSimple` | Delivers tokens on destination chain |
| `MockERC20` | Test token (USDC by default) |

## Environment Configuration

Set up your `.env` file:

```bash
# Local chain (Anvil)
EVOLVE_RPC=http://127.0.0.1:8545
EVOLVE_CHAIN_ID=1234
EVOLVE_PK=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Testnet (Sepolia)
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
SEPOLIA_CHAIN_ID=11155111
SEPOLIA_PK=<your-private-key-with-sepolia-eth>

# User account (submits intents)
USER_PK=59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

## Deploying to Specific Chains

```bash
# Deploy to all configured chains
solver-cli deploy

# Deploy to specific chains only
solver-cli deploy --chains evolve,sepolia

# Force redeploy (overwrites existing)
solver-cli deploy --force
```

## Custom Token Configuration

Deploy a token with custom settings:

```bash
# Deploy with custom token
solver-cli deploy --token USDT --decimals 6

# Deploy with 18 decimals (like DAI)
solver-cli deploy --token DAI --decimals 18
```

## Adding More Chains

To deploy to a third chain (e.g., Arbitrum Sepolia):

```bash
# 1. Add to .env
ARBITRUM_RPC=https://sepolia-rollup.arbitrum.io/rpc
ARBITRUM_PK=<your-private-key>
ARBITRUM_CHAIN_ID=421614

# 2. Deploy to the new chain (merges with existing)
solver-cli deploy --chains arbitrum

# 3. Regenerate configs
solver-cli configure

# 4. Restart solver and oracle operator so they pick up the new chain
# (Stop with Ctrl+C, then run make solver and make operator again.)

# 5. Fund solver on new chain
solver-cli fund --chain arbitrum
```

## Adding More Tokens

After initial deployment, add more tokens:

```bash
# Deploy another token to all chains
solver-cli deploy --token USDT --decimals 6

# Or add tokens individually
solver-cli token add --chain sepolia --symbol DAI --address 0x... --decimals 18
```

## Minting Test Tokens

For testing, you need mock tokens. `make setup` automatically mints tokens to the user, but you can mint more:

```bash
# Mint 10 USDC to user on evolve
make mint CHAIN=evolve SYMBOL=USDC TO=user AMOUNT=10000000

# Mint to a specific address
make mint CHAIN=evolve SYMBOL=USDC TO=0x1234... AMOUNT=10000000

# Mint to solver (for filling orders)
make mint CHAIN=sepolia SYMBOL=USDC TO=solver AMOUNT=10000000
```

**Note**: This only works with MockERC20 contracts deployed by `make deploy`. Real tokens cannot be minted.

## Testing Cross-Chain Transfers

```bash
# Submit intent (evolve -> sepolia, 1 USDC by default)
make intent

# Specify direction and amount
make intent FROM=sepolia TO=evolve AMOUNT=5000000

# Use a different token
make intent ASSET=USDT AMOUNT=1000000

# Or use the CLI directly
solver-cli intent submit --amount 1000000 --asset USDC --from evolve --to sepolia

# Check balances
make balances
```

### Available Options

| Variable | Description | Default |
|----------|-------------|---------|
| `FROM` | Source chain (name or ID) | First configured chain |
| `TO` | Destination chain (name or ID) | Second configured chain |
| `AMOUNT` | Amount in raw units | `1000000` (1 token with 6 decimals) |
| `ASSET` | Token symbol | `USDC` |

## Troubleshooting

### "Insufficient balance"
The user needs tokens to create intents:
```bash
# Mint test tokens to user
make mint CHAIN=evolve SYMBOL=USDC TO=user AMOUNT=10000000
```

### "Insufficient gas"
Your solver address needs native tokens on all chains:
```bash
# Check solver address
cast wallet address --private-key 0x$SEPOLIA_PK

# Fund on local chain (automatic)
solver-cli fund --chain evolve

# For testnets, use faucets
```

### "Oracle operator not running"
The full flow requires the oracle operator:
```bash
make operator
```

### "Contracts already deployed"
Use `--force` to redeploy:
```bash
solver-cli deploy --force
```

### Intent expired / Funds stuck
If an intent expires before being filled, you can reclaim your tokens:
```bash
# Check intent status
solver-cli intent list

# Get refund instructions
solver-cli intent refund --tx-hash 0x...
```

The default expiry is 30 minutes. For testing, you can use a shorter expiry:
```bash
solver-cli intent submit --amount 1000000 --expiry 300  # 5 minute expiry
```
