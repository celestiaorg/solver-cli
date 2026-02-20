# Deploy a New Token

This guide walks through adding a new ERC20 token (e.g. USDT) to the local solver stack alongside the existing USDC. Tokens always route through **Celestia** (anvil1 ↔ Celestia ↔ anvil2), never direct 2-chain.

## Prerequisites

- Local stack running (`./mvp.sh`)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed (`forge`, `cast`)
- The deployer private key (default Anvil account 0):
  ```
  PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  ```

**Important**: `--constructor-args` must always come **last** in `forge create` commands — it's variadic and swallows any flags after it.

---

## 1. Deploy MockERC20 on anvil1

```bash
forge create hyperlane/contracts/MockERC20.sol:MockERC20 \
  --private-key $PK \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --constructor-args "USDT" "USDT" 6
```

Note the `Deployed to:` address — this is your **MOCK_USDT** address. Example: `0xf5059a5D33d5853360D16C683c16e67980206f36`.

## 2. Create a warp config for USDT

Create `hyperlane/configs/warp-config-usdt.yaml`:

```yaml
anvil1:
  type: collateral
  token: "<MOCK_USDT_ADDRESS_FROM_STEP_1>"
  owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  name: "USDT"
  symbol: "USDT"
  decimals: 6

anvil2:
  type: synthetic
  owner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  name: "USDT"
  symbol: "USDT"
  decimals: 6
```

## 3. Deploy the EVM warp route via Docker

The `hyperlane-init` image has the Hyperlane CLI. Run it against the existing registry (which already has core contracts deployed):

```bash
docker run --rm \
  --network solver-cli_solver-net \
  --entrypoint bash \
  -v "$(pwd)/hyperlane:/home/hyperlane" \
  -w /home/hyperlane \
  ghcr.io/celestiaorg/hyperlane-init:local \
  -c "hyperlane warp deploy \
    --config ./configs/warp-config-usdt.yaml \
    --registry ./registry \
    --key $PK \
    --yes"
```

This deploys:
- **HypCollateral** on anvil1 (wraps the MockERC20 USDT)
- **HypSynthetic** on anvil2 (mint/burn synthetic)

The deployment artifact is written to `hyperlane/registry/deployments/warp_routes/USDT/`.

## 4. Read the deployed warp addresses

```bash
cat hyperlane/registry/deployments/warp_routes/USDT/warp-config-usdt-config.yaml
```

**Important**: The Hyperlane CLI writes entries in **non-deterministic order**. Do NOT assume the first entry is anvil1. Instead, match by `chainName`:

```yaml
tokens:
  - addressOrDenom: "0x..."     # ← look at chainName below, not position!
    chainName: anvil2            # ← this is the HypSynthetic
    standard: EvmHypSynthetic
  - addressOrDenom: "0x..."
    chainName: anvil1            # ← this is the HypCollateral
    collateralAddressOrDenom: "0x..."
    standard: EvmHypCollateral
```

Note both addresses:
- **HypCollateral** (anvil1) — the `addressOrDenom` where `chainName: anvil1`
- **HypSynthetic** (anvil2) — the `addressOrDenom` where `chainName: anvil2`

## 5. Enroll Celestia routers (3-chain bridging)

This enrolls the new USDT warp tokens with the existing Celestia synthetic token, enabling the anvil1 ↔ Celestia ↔ anvil2 routing.

Read the Celestia synthetic token address from the existing deployment:

```bash
CEL_TOKEN=$(node -e "const c=JSON.parse(require('fs').readFileSync('.config/hyperlane-cosmosnative.json','utf8')); console.log(c.synthetic_token_id)")
echo "Celestia synthetic: $CEL_TOKEN"
```

Set the warp addresses from step 4:

```bash
ANVIL1_WARP=<HypCollateral_address_from_step_4>
ANVIL2_WARP=<HypSynthetic_address_from_step_4>
```

Enroll anvil1 HypCollateral ↔ Celestia:

```bash
# EVM side: anvil1 warp → celestia
cast send $ANVIL1_WARP \
  "enrollRemoteRouter(uint32,bytes32)" \
  69420 $CEL_TOKEN \
  --private-key $PK \
  --rpc-url http://127.0.0.1:8545

# Celestia side: celestia → anvil1 warp
ANVIL1_WARP_LOWER=$(echo $ANVIL1_WARP | tr '[:upper:]' '[:lower:]' | cut -c 3-)
docker run --rm \
  --network solver-cli_solver-net \
  --entrypoint bash \
  -v "$(pwd)/hyperlane:/home/hyperlane" \
  -w /home/hyperlane \
  ghcr.io/celestiaorg/hyperlane-init:local \
  -c "hyp enroll-remote-router http://celestia-validator:26657 $CEL_TOKEN 131337 0x000000000000000000000000$ANVIL1_WARP_LOWER"
```

Enroll anvil2 HypSynthetic ↔ Celestia:

```bash
# EVM side: anvil2 warp → celestia
cast send $ANVIL2_WARP \
  "enrollRemoteRouter(uint32,bytes32)" \
  69420 $CEL_TOKEN \
  --private-key $PK \
  --rpc-url http://127.0.0.1:8546

# Celestia side: celestia → anvil2 warp
ANVIL2_WARP_LOWER=$(echo $ANVIL2_WARP | tr '[:upper:]' '[:lower:]' | cut -c 3-)
docker run --rm \
  --network solver-cli_solver-net \
  --entrypoint bash \
  -v "$(pwd)/hyperlane:/home/hyperlane" \
  -w /home/hyperlane \
  ghcr.io/celestiaorg/hyperlane-init:local \
  -c "hyp enroll-remote-router http://celestia-validator:26657 $CEL_TOKEN 31338 0x000000000000000000000000$ANVIL2_WARP_LOWER"
```

**Note**: Domain IDs are `131337` (anvil1) and `31338` (anvil2) — NOT the EVM chain IDs. See MEMORY.md for details on the domain ID mapping.

## 6. Register tokens in state

The solver trades the **underlying ERC20**, not the Hyperlane wrapper:
- **anvil1**: use the **MockERC20** address from step 1
- **anvil2**: use the **HypSynthetic** address from step 4

```bash
# anvil1: the MockERC20 address
make token-add CHAIN=anvil1 SYMBOL=USDT ADDRESS=<MOCK_USDT_ADDRESS_FROM_STEP_1> DECIMALS=6

# anvil2: the HypSynthetic address
make token-add CHAIN=anvil2 SYMBOL=USDT ADDRESS=<HYP_SYNTHETIC_ADDRESS_FROM_STEP_4> DECIMALS=6
```

## 7. Create warp route config for frontend bridging

The frontend rebalance/bridge feature reads warp route addresses from `.config/warp-routes/<SYMBOL>.json`. USDC is built-in (read from `hyperlane-addresses.json`), but other tokens need this file.

```bash
mkdir -p .config/warp-routes

cat > .config/warp-routes/USDT.json << 'EOF'
{
  "anvil1": {
    "underlying": "<MOCK_USDT_ADDRESS_FROM_STEP_1>",
    "warpToken": "<HypCollateral_ADDRESS_FROM_STEP_4>"
  },
  "anvil2": {
    "warpToken": "<HypSynthetic_ADDRESS_FROM_STEP_4>"
  }
}
EOF
```

This enables the Bridge panel in the UI to move USDT between chains via Celestia.

## 8. Configure, fund, restart

```bash
# Regenerate solver config (picks up new token)
make configure

# Fund solver on anvil1
make mint SYMBOL=USDT TO=solver

# Fund user on anvil1
make mint SYMBOL=USDT TO=user

# Bridge some USDT to anvil2 for the solver (via UI Bridge panel or make rebalance)
# The solver needs tokens on both chains to fill orders

# Restart services (Ctrl+C on mvp.sh, then:)
./mvp.sh --skip-setup
```

---

## `make mint` reference

```bash
make mint SYMBOL=USDT TO=solver                    # 10 USDT to solver on anvil1
make mint SYMBOL=USDT TO=user                      # 10 USDT to user on anvil1
make mint SYMBOL=USDT TO=solver AMOUNT=5000000     # 5 USDT (custom amount, raw units)
```

**Note**: You can only mint on anvil1 (the origin/collateral chain). Tokens reach anvil2 via bridging through Celestia.

---

## How it works

The system is data-driven — no code changes needed to add tokens:

| Component | What happens |
|-----------|-------------|
| `state.json` | `make token-add` writes the token entry per chain |
| `config_gen.rs` | `make configure` auto-generates mock prices and routes for all tokens in state |
| `server.js` | Backend iterates `chain.tokens` — new tokens appear automatically in balances and faucet |
| `server.js` | Bridge reads `.config/warp-routes/<SYMBOL>.json` for warp addresses |
| `App.tsx` | Frontend computes available tokens from config, shows them in dropdowns |
| Solver | Reads tokens from config TOML, routes any matching symbol across chains |
