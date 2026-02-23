# Adding Sepolia to a Running anvil1 + anvil2 System

This guide walks through connecting Sepolia testnet to an already-running local setup (anvil1 + anvil2 + Celestia). No Hyperlane changes are needed — Sepolia plugs straight into OIF.

**Prerequisites:**
- `make start && make setup` completed successfully
- Solver and oracle operator running (`make solver`, `make operator`)
- A wallet with Sepolia ETH (get some from [sepoliafaucet.com](https://sepoliafaucet.com))
- Foundry installed (`forge`, `cast`)

---

## Step 1: Add Sepolia to .env

Append to your `.env`:

```bash
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
SEPOLIA_PK=<your-funded-sepolia-key-without-0x>
SEPOLIA_CHAIN_ID=11155111
```

The CLI auto-detects chains by scanning for `{CHAIN}_RPC` + `{CHAIN}_PK` pairs. Adding these three lines is enough for `sepolia` to appear as a configured chain.

> **Key security note:** `SEPOLIA_PK` is just the **deployer key** for Sepolia — the account paying gas for contract deployment. The solver itself uses `SOLVER_PRIVATE_KEY` on all chains.

---

## Step 2: Deploy OIF contracts to Sepolia

```bash
make deploy CHAINS=sepolia
```

This deploys three contracts to Sepolia:
- `CentralizedOracle` — stores fill attestations
- `InputSettlerEscrow` — holds user funds on the origin chain
- `OutputSettlerSimple` — where the solver delivers on the destination chain

The operator address baked into `CentralizedOracle` is derived from `ORACLE_OPERATOR_PK` (same as on anvil1/anvil2). Verify the addresses were saved:

```bash
cat .config/state.json | jq '.chains | to_entries[] | select(.value.name == "sepolia")'
```

---

## Step 3: Deploy MockERC20 USDC on Sepolia

OIF contract deployment does not deploy a token. You need to do this separately.

```bash
. ./.env

forge create oif/oif-contracts/src/MockERC20.sol:MockERC20 \
  --private-key $SEPOLIA_PK \
  --rpc-url $SEPOLIA_RPC \
  --broadcast \
  --constructor-args "USD Coin" "USDC" 6
```

> `--constructor-args` must come **last** — it's variadic and swallows any flags that follow it.

Note the deployed address from the output:

```bash
export SEPOLIA_USDC=0x...   # "Deployed to:" address from forge output
```

**Alternative:** Use Circle's pre-deployed testnet USDC at `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`. You won't be able to `mint()` it, so skip Step 5 and acquire USDC another way (e.g., a Sepolia USDC faucet).

---

## Step 4: Register the token in state

```bash
make token-add CHAIN=sepolia SYMBOL=USDC ADDRESS=$SEPOLIA_USDC DECIMALS=6
```

Verify:

```bash
make token-list CHAIN=sepolia
```

---

## Step 5: Mint tokens to solver and user

This only works with MockERC20 (which has a public `mint()` function).

```bash
# Mint 100 USDC to solver (inventory for filling orders on Sepolia)
make mint CHAIN=sepolia SYMBOL=USDC TO=solver AMOUNT=100000000

# Mint 10 USDC to user (for submitting test intents)
make mint CHAIN=sepolia SYMBOL=USDC TO=user AMOUNT=10000000
```

---

## Step 6: Fund solver with Sepolia ETH

The solver needs native ETH on Sepolia to pay gas when filling orders there.

```bash
. ./.env
SOLVER_ADDR=$(cast wallet address --private-key $SOLVER_PRIVATE_KEY)
echo "Solver address: $SOLVER_ADDR"

cast send \
  --rpc-url $SEPOLIA_RPC \
  --private-key $SEPOLIA_PK \
  --value 0.1ether \
  $SOLVER_ADDR
```

---

## Step 7: Fund oracle operator with Sepolia ETH

The oracle operator submits attestations to the **origin chain's** oracle. For intents originating on Sepolia (fill on anvil1), the operator needs ETH on Sepolia.

```bash
. ./.env
OPERATOR_ADDR=$(grep 'operator_address' .config/oracle.toml | cut -d'"' -f2)
echo "Operator address: $OPERATOR_ADDR"

cast send \
  --rpc-url $SEPOLIA_RPC \
  --private-key $SEPOLIA_PK \
  --value 0.1ether \
  $OPERATOR_ADDR
```

> For intents originating on anvil1 (fill on Sepolia), the operator needs ETH on **anvil1** — already covered by `make setup`.

---

## Step 8: Regenerate configs

```bash
make configure
```

This rewrites `.config/solver.toml` and `.config/oracle.toml` to include Sepolia with all-to-all routes:
- anvil1 ↔ sepolia
- anvil2 ↔ sepolia
- (existing) anvil1 ↔ anvil2

Verify the new routes were added:

```bash
grep 'dest_chain' .config/solver.toml | sort -u
```

---

## Step 9: Restart solver and oracle operator

The solver and operator must reload their configs to pick up the new chain.

```bash
# In the solver terminal: Ctrl+C, then:
make solver

# In the operator terminal: Ctrl+C, then:
make operator
```

---

## Step 10: Verify and test

Check all balances:

```bash
make balances
```

Expected output (Sepolia should now appear):

```
  Chain    │ Account │ Balance
  ─────────┼─────────┼────────
  anvil1   │ User    │ 10 USDC
  anvil1   │ Solver  │ 100 USDC
  anvil2   │ User    │ 10 USDC
  anvil2   │ Solver  │ 100 USDC
  sepolia  │ User    │ 10 USDC
  sepolia  │ Solver  │ 100 USDC
```

Submit a test intent:

```bash
# anvil1 → Sepolia
make intent FROM=anvil1 TO=sepolia AMOUNT=1000000

# Sepolia → anvil1
make intent FROM=sepolia TO=anvil1 AMOUNT=1000000
```

---

## Solver inventory management

The solver needs token inventory on every chain it fills orders on. How you replenish that inventory differs between the local chains and Sepolia.

### anvil1 ↔ anvil2: Hyperlane bridge via Celestia

The two local Anvil chains are isolated — they can only exchange tokens through the Hyperlane warp route deployed during `make start`. USDC on anvil1 is a `HypCollateral` (wraps the MockERC20), and on anvil2 it's a `HypSynthetic`. They're bridged through Celestia.

After the solver spends USDC filling orders on anvil2, rebalance from anvil1:

```bash
make rebalance          # anvil1 → Celestia → anvil2
make rebalance-back     # anvil2 → Celestia → anvil1
```

Sepolia has no role in this flow. The bridge is a closed circuit: anvil1 ↔ Celestia ↔ anvil2.

### Sepolia: mint directly

Sepolia's USDC is an independent MockERC20 with no bridge to the local chains. Replenish it by minting:

```bash
make mint CHAIN=sepolia SYMBOL=USDC TO=solver AMOUNT=100000000
```

There's no equivalent of `make rebalance` for Sepolia — inventory on Sepolia is completely separate from inventory on anvil1/anvil2.

---

## What just happened

Adding Sepolia required no Hyperlane changes. The OIF oracle flow works entirely through the `CentralizedOracle` contracts:

1. User locks USDC in `InputSettlerEscrow` on the origin chain
2. Solver detects the intent and fills from its own USDC inventory on the destination chain
3. Oracle operator sees the `OutputFilled` event, queries all chains to find the origin, signs an attestation with `ORACLE_OPERATOR_PK`, and submits it to the origin chain's `CentralizedOracle`
4. Solver polls `isProven()` on the origin chain and claims the escrowed funds

The Hyperlane bridge (anvil1 ↔ Celestia ↔ anvil2) is only used to **rebalance the solver's token inventory** between the two local chains. Sepolia is funded independently — no bridging required.

---

## Removing Sepolia

To undo:

```bash
make chain-remove CHAIN=sepolia
make configure
# Restart solver and operator
```

Remove the three lines from `.env`:

```bash
# Remove these:
SEPOLIA_RPC=...
SEPOLIA_PK=...
SEPOLIA_CHAIN_ID=...
```
