# Deploy a New Token

Adding a new ERC20 token (e.g. USDT) alongside USDC. Tokens route through **Celestia** (anvil1 ↔ Celestia ↔ anvil2).

## Prerequisites

- Local stack running (`./mvp.sh`)
- Foundry installed (`forge`, `cast`)
- Deployer key:
  ```bash
  PK=52d441beb407f47811a09ed9d330320b2d336482512f26e9a5c5d3dacddc7b1e
  ```

---

## Step 1: Deploy MockERC20 on anvil1

```bash
forge create hyperlane/contracts/MockERC20.sol:MockERC20 \
  --private-key $PK \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --constructor-args "USDT" "USDT" 6
```

> `--constructor-args` must come **last** — it's variadic and swallows any flags after it.

```bash
export MOCK_USDT=0x...   # ← Deployed to: address
```

## Step 2: Deploy EVM warp route

Create `hyperlane/configs/warp-config-usdt.yaml`:

```yaml
anvil1:
  type: collateral
  token: "<MOCK_USDT>"
  owner: "0x9f2CD91d150236BA9796124F3Dcda305C3a2086C"
  name: "USDT"
  symbol: "USDT"
  decimals: 6

anvil2:
  type: synthetic
  owner: "0x9f2CD91d150236BA9796124F3Dcda305C3a2086C"
  name: "USDT"
  symbol: "USDT"
  decimals: 6
```

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

Read the deployed addresses (match by `chainName`, not position — order is non-deterministic):

```bash
cat hyperlane/registry/deployments/warp_routes/USDT/*-config.yaml
```

```bash
export HYP_COLLATERAL=0x...   # ← addressOrDenom where chainName: anvil1
export HYP_SYNTHETIC=0x...    # ← addressOrDenom where chainName: anvil2
```

## Step 3: Create Celestia synthetic token

```bash
MAILBOX_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('hyperlane/hyperlane-cosmosnative.json','utf8')).mailbox_id)")
ISM_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('hyperlane/hyperlane-cosmosnative.json','utf8')).ism_id)")
```

```bash
docker run --rm \
  --network solver-cli_solver-net \
  --entrypoint bash \
  -v "$(pwd)/hyperlane:/home/hyperlane" \
  -w /home/hyperlane \
  ghcr.io/celestiaorg/hyperlane-init:local \
  -c "hyp create-synthetic-token http://celestia-validator:26657 $MAILBOX_ID $ISM_ID"
```

```bash
export CEL_USDT_TOKEN=0x...   # ← printed by the command
```

## Step 4: Enroll routers

### anvil1 ↔ Celestia

```bash
cast send $HYP_COLLATERAL \
  "enrollRemoteRouter(uint32,bytes32)" \
  69420 0x726f757465725f61707000000000000000000000000000020000000000000001 \
  --private-key $PK \
  --rpc-url http://127.0.0.1:8545

HYP_COLLATERAL_LOWER=$(echo $HYP_COLLATERAL | tr '[:upper:]' '[:lower:]' | cut -c 3-)
docker run --rm \
  --network solver-cli_solver-net \
  --entrypoint bash \
  -v "$(pwd)/hyperlane:/home/hyperlane" \
  -w /home/hyperlane \
  ghcr.io/celestiaorg/hyperlane-init:local \
  -c "hyp enroll-remote-router http://celestia-validator:26657 $CEL_USDT_TOKEN 131337 0x000000000000000000000000$HYP_COLLATERAL_LOWER"
```

### anvil2 ↔ Celestia

```bash
cast send $HYP_ANVIL \
  "enrollRemoteRouter(uint32,bytes32)" \
  69420 $CEL_USDT_TOKEN \
  --private-key $PK \
  --rpc-url http://127.0.0.1:8546

HYP_ANVIL_LOWER=$(echo $HYP_ANVIL | tr '[:upper:]' '[:lower:]' | cut -c 3-)
docker run --rm \
  --network solver-cli_solver-net \
  --entrypoint bash \
  -v "$(pwd)/hyperlane:/home/hyperlane" \
  -w /home/hyperlane \
  ghcr.io/celestiaorg/hyperlane-init:local \
  -c "hyp enroll-remote-router http://celestia-validator:26657 $CEL_USDT_TOKEN 31338 0x000000000000000000000000$HYP_ANVIL_LOWER"
```


```bash
cast send $HYP_SEPOLIA \
  "enrollRemoteRouter(uint32,bytes32)" \
  69420 $CEL_USDT_TOKEN \
  --private-key $PK \
  --rpc-url $SEPOLIA_RPC

HYP_SEPOLIA_LOWER=$(echo $HYP_SEPOLIA | tr '[:upper:]' '[:lower:]' | cut -c 3-)
docker run --rm \
  --network solver-cli_solver-net \
  --entrypoint bash \
  -v "$(pwd)/hyperlane:/home/hyperlane" \
  -w /home/hyperlane \
  ghcr.io/celestiaorg/hyperlane-init:local \
  -c "hyp enroll-remote-router http://celestia-validator:26657 $CEL_USDT_TOKEN 11155111 0x000000000000000000000000$HYP_SEPOLIA_LOWER"
```

> Domain IDs: `131337` = anvil1, `31338` = anvil2, `69420` = Celestia.

## Step 5: Register tokens in state

```bash
make token-add CHAIN=anvil1 SYMBOL=USDT ADDRESS=$MOCK_USDT DECIMALS=6
make token-add CHAIN=anvil2 SYMBOL=USDT ADDRESS=$HYP_ANVIL DECIMALS=6
make token-add CHAIN=sepolia SYMBOL=USDT ADDRESS=$HYP_SEPOLIA DECIMALS=6

```

## Step 6: Configure and fund

```bash
make configure
make mint SYMBOL=USDT TO=solver
make mint SYMBOL=USDT TO=solver
make mint SYMBOL=USDT TO=solver
make mint SYMBOL=USDT TO=0x02120571E5804E46592f29B64fD01b1013f8fC18
```

## Step 7: Restart services (not the chains)

Kill only the solver, operator, and aggregator — **not** the Docker stack:

```bash
pkill -f "solver-cli solver start" || true
pkill -f oracle-operator || true
pkill -f oif-aggregator || true
pkill -f "node server.js" || true
pkill -f vite || true
```

Then restart them:

```bash
./scripts/start-services.sh
./scripts/start-frontend.sh
```

> Do **not** run `make stop` — that tears down the Anvil chains and destroys all deployed contracts.

Use the **Bridge** panel in the UI to move USDT to anvil2 for the solver.
