# Deploy a New Token

This guide walks through adding a new ERC20 token (e.g. USDT) to the local solver stack alongside the existing USDC.

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

Note the `Deployed to:` address — e.g. `0xf5059a5D33d5853360D16C683c16e67980206f36`.

## 2. Create a warp config for USDT

Create `hyperlane/configs/warp-config-usdt.yaml`:

```yaml
anvil1:
  type: collateral
  token: "<USDT_ADDRESS_FROM_STEP_1>"
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

## 3. Deploy the warp route via Docker

The `hyperlane-init` image has the Hyperlane CLI. Run it against the existing registry (which already has core contracts deployed):

```bash
docker run --rm \
  --network solver-cli_solver-net \
  -v "$(pwd)/hyperlane:/home/hyperlane" \
  -w /home/hyperlane \
  ghcr.io/celestiaorg/hyperlane-init:local \
  bash -c "hyperlane warp deploy --config ./configs/warp-config-usdt.yaml --registry ./registry --yes"
```

This deploys:
- **HypCollateral** on anvil1 (wraps the MockERC20 USDT)
- **HypSynthetic** on anvil2 (mint/burn synthetic)
- Automatically enrolls remote routers between the two EVM chains

The deployment artifact is written to `hyperlane/registry/deployments/warp_routes/USDT/`.

## 4. Read the deployed addresses

```bash
cat hyperlane/registry/deployments/warp_routes/USDT/warp-config-usdt-config.yaml
```

Look for `addressOrDenom` values:
- First entry = HypCollateral address on anvil1
- Second entry = HypSynthetic address on anvil2

## 5. Register tokens in state

For the solver, register the tokens it actually trades:
- On anvil1: use the **MockERC20** address (the underlying token, not HypCollateral)
- On anvil2: use the **HypSynthetic** address (that's the ERC20 on anvil2)

```bash
make token-add CHAIN=anvil1 SYMBOL=USDT ADDRESS=<MOCK_USDT_ADDRESS> DECIMALS=6
make token-add CHAIN=anvil2 SYMBOL=USDT ADDRESS=<HYP_SYNTHETIC_USDT_ADDRESS> DECIMALS=6
```

## 6. (Optional) Enroll Celestia routers for 3-chain bridging

If you want USDT to also route through Celestia (for `make rebalance`), you need to:

1. Deploy a second Celestia synthetic token for USDT
2. Enroll the EVM warp tokens ↔ Celestia synthetic

This mirrors what the USDC entrypoint does in steps 4-5 of `hyperlane/scripts/docker-entrypoint.sh`. For just solver testing (anvil1 ↔ anvil2), this isn't required — the solver holds tokens on both sides.

## 7. Configure, fund, restart

```bash
# Regenerate solver config
make configure

# Fund solver on anvil1 (anvil2 can get tokens via bridging, or mint directly)
make mint SYMBOL=USDT TO=solver
make mint SYMBOL=USDT TO=user

# If HypSynthetic on anvil2: mint on anvil1 and bridge, or fund solver separately
# For testing, you can also mint directly if the solver needs tokens on anvil2

# Restart services
# Ctrl+C on mvp.sh, then:
./mvp.sh --skip-setup
```

---

## `make mint` reference

```bash
make mint SYMBOL=USDT TO=solver                    # 10 USDT to solver on anvil1
make mint SYMBOL=USDT TO=solver CHAIN=anvil2       # 10 USDT to solver on anvil2
make mint SYMBOL=USDT TO=user                      # 10 USDT to user on anvil1
make mint SYMBOL=USDT TO=user CHAIN=anvil2         # 10 USDT to user on anvil2
make mint SYMBOL=USDT TO=solver AMOUNT=5000000     # 5 USDT (custom amount, raw units)
```

**Note**: Minting on anvil2 only works for standalone MockERC20 tokens (Option A). For HypSynthetic tokens (Option B), tokens arrive on anvil2 via bridging from anvil1.

---

## How it works

The system is data-driven — no code changes needed to add tokens:

| Component | What happens |
|-----------|-------------|
| `state.json` | `solver-cli token add` (or `make token-add`) writes the token entry |
| `config_gen.rs` | `make configure` auto-generates mock prices and routes for all tokens in state |
| `server.js` | Backend iterates `chain.tokens` — new tokens appear automatically in balances and faucet |
| `App.tsx` | Frontend computes available tokens from config, shows them in a dropdown |
| Solver | Reads tokens from config TOML, routes any matching symbol across chains |
