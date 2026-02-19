# Deploy a New Token

This guide walks through adding a new ERC20 token (e.g. USDT) to the local solver stack alongside the existing USDC.

## Prerequisites

- Local stack running (`./mvp.sh` or `make setup && make solver` etc.)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed (`forge`, `cast`)
- The deployer private key (default Anvil account 0):
  ```
  PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  ```

## 1. Deploy MockERC20 on anvil1 (origin chain)

```bash
forge create hyperlane/contracts/MockERC20.sol:MockERC20 \
  --constructor-args "USDT" "USDT" 6 \
  --rpc-url http://127.0.0.1:8545 \
  --private-key $PK \
  --broadcast
```

Note the `Deployed to:` address — this is your USDT address on anvil1.

## 2. Register the token in state

```bash
solver-cli token add \
  --chain anvil1 \
  --symbol USDT \
  --address <USDT_ADDRESS_FROM_STEP_1> \
  --decimals 6
```

On anvil2, the token will be bridged via Hyperlane (synthetic), so you'll need to deploy a warp route for it. For a simple local test without Hyperlane bridging, you can also deploy a separate MockERC20 on anvil2:

```bash
# Option A: Deploy independent MockERC20 on anvil2
forge create hyperlane/contracts/MockERC20.sol:MockERC20 \
  --constructor-args "USDT" "USDT" 6 \
  --rpc-url http://127.0.0.1:8546 \
  --private-key $PK \
  --broadcast

solver-cli token add \
  --chain anvil2 \
  --symbol USDT \
  --address <USDT_ADDRESS_ON_ANVIL2> \
  --decimals 6
```

## 3. Regenerate solver config

```bash
make configure
```

This auto-generates:
- Mock price entries (`USDT/USD = 1.0`) for any token found in state
- All-to-all routes for tokens present on both chains

## 4. Fund the solver with the new token

Mint USDT to the solver on both chains so it can fill orders:

```bash
# Solver address (from .config/state.json)
SOLVER=$(jq -r '.solver.address' .config/state.json)

# Mint on anvil1
cast send <USDT_ADDRESS_ANVIL1> "mint(address,uint256)" $SOLVER 10000000 \
  --rpc-url http://127.0.0.1:8545 --private-key $PK

# Mint on anvil2
cast send <USDT_ADDRESS_ANVIL2> "mint(address,uint256)" $SOLVER 10000000 \
  --rpc-url http://127.0.0.1:8546 --private-key $PK
```

## 5. Deploy Permit2 (if not already done)

The solver uses Permit2 for token approvals. If you haven't already:

```bash
make deploy-permit2
```

Then approve Permit2 for the new token on both chains:

```bash
PERMIT2=0x000000000022D473030F116dDEE9F6B43aC78BA3

# Approve for solver on anvil1
cast send <USDT_ADDRESS_ANVIL1> "approve(address,uint256)" $PERMIT2 \
  $(cast max-uint) \
  --rpc-url http://127.0.0.1:8545 --private-key $PK

# Approve for solver on anvil2
cast send <USDT_ADDRESS_ANVIL2> "approve(address,uint256)" $PERMIT2 \
  $(cast max-uint) \
  --rpc-url http://127.0.0.1:8546 --private-key $PK
```

## 6. Restart the solver

```bash
# Stop the running solver (Ctrl+C), then:
make solver
```

The solver picks up the new token from the regenerated config.

## 7. Use the frontend

1. Refresh the UI (http://localhost:3456)
2. The token dropdown now shows **USDT** alongside USDC
3. Use the faucet to mint USDT to your wallet
4. Select USDT, enter an amount, get a quote, and bridge

## How it works

The system is data-driven — no code changes needed to add tokens:

| Component | What happens |
|-----------|-------------|
| `state.json` | `solver-cli token add` writes the token entry |
| `config_gen.rs` | `make configure` auto-generates mock prices and routes for all tokens in state |
| `server.js` | Backend iterates `chain.tokens` — new tokens appear automatically in balances and faucet |
| `App.tsx` | Frontend computes available tokens from config, shows them in a dropdown |
| Solver | Reads tokens from config TOML, routes any matching symbol across chains |

## Hyperlane warp routes (optional)

For proper cross-chain bridging (not just independent tokens), you'd set up Hyperlane warp routes:

1. Deploy `HypCollateral` on anvil1 (wraps the native USDT)
2. Deploy `HypSynthetic` on anvil2 (mints/burns bridged USDT)
3. Enroll remote routers on both
4. Add the warp token addresses to `hyperlane-addresses.json`
5. Configure the Hyperlane relayer to relay for the new route

This is the same setup used for USDC — see `hyperlane/` directory for reference configs.
