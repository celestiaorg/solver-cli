# Connect to Existing Testnet Deployments

This guide covers connecting solver-cli to chains where OIF contracts, Hyperlane warp routes, and the Celestia forwarding layer are **already deployed and running**. No contract deployment is needed — just register your existing addresses and start the services.

**Assumed already in place:**
- OIF contracts (InputSettlerEscrow, OutputSettlerSimple, CentralizedOracle) deployed on each EVM chain
- Hyperlane warp routes deployed and enrolled between EVM chains and Celestia
- Celestia synthetic tokens deployed and enrolled
- Hyperlane relayer running and connected to all chains
- Forwarding relayer running and accessible at a known URL

---

## Step 1: Configure .env

Copy `.env.example` to `.env` and fill in the values for your setup.

### Signing keys

Choose one approach per service. All three services (solver, oracle, rebalancer) can use different keys independently.

**Option A — Local private keys:**
```bash
SOLVER_PRIVATE_KEY=0x<your-solver-key>
ORACLE_OPERATOR_PK=0x<your-oracle-key>
REBALANCER_PRIVATE_KEY=0x<your-rebalancer-key>
```

**Option B — AWS KMS (recommended for production):**
```bash
# Solver
SOLVER_SIGNER_TYPE=aws_kms
SOLVER_KMS_KEY_ID=<key-uuid>
SOLVER_KMS_REGION=us-east-1

# Oracle operator
ORACLE_SIGNER_TYPE=aws_kms
ORACLE_KMS_KEY_ID=<key-uuid>
ORACLE_KMS_REGION=us-east-1

# Rebalancer
REBALANCER_SIGNER_TYPE=aws_kms
REBALANCER_KMS_KEY_ID=<key-uuid>
REBALANCER_KMS_REGION=us-east-1
```

All three can share the same KMS key or use separate keys — just set the same UUID for each.

> KMS keys must be asymmetric secp256k1 signing keys. See [aws-kms-key-import.md](aws-kms-key-import.md) for setup instructions.

**Frontend bridge signer (always a local key — Node.js cannot use KMS):**
```bash
BRIDGE_SIGNER_PK=0x<hot-wallet-key>
```

### Celestia / forwarding

```bash
CELESTIA_DOMAIN=<domain-id-of-your-celestia-chain>
FORWARDING_BACKEND=http://<forwarding-relayer-host>:<port>
```

### Aggregator integrity secret

```bash
INTEGRITY_SECRET=<min-32-char-random-string>
```

---

## Step 2: Initialize state

```bash
solver-cli init
```

This creates `.config/state.json` to track chain registrations and generated config paths.

---

## Step 3: Register chains

Register each EVM chain with its deployed contract addresses.

### HypCollateral chains

On chains where the warp token is a **HypERC20Collateral** (wraps an existing ERC20), pass both the underlying ERC20 address via `--token` and the collateral router via `--warp-token`:

```bash
solver-cli chain add \
  --name chain-a \
  --rpc https://rpc.chain-a.example \
  --chain-id 12345 \
  --input-settler  0x<InputSettlerEscrow-on-chain-a> \
  --output-settler 0x<OutputSettlerSimple-on-chain-a> \
  --oracle         0x<CentralizedOracle-on-chain-a> \
  --token          USDC=0x<underlying-USDC-ERC20-on-chain-a>:6 \
  --token          USDT=0x<underlying-USDT-ERC20-on-chain-a>:6 \
  --warp-token     0x<HypERC20Collateral-router-on-chain-a>
```

> `--warp-token` is the address the rebalancer calls `transferRemote` on. It must be the collateral router, not the underlying ERC20. The rebalancer will automatically `approve` the router to spend the ERC20 before each transfer.

> If different tokens have different collateral routers, register them separately using `solver-cli token add` after chain registration (see below).

### HypSynthetic chains

On chains where the warp token is a **HypERC20Synthetic** (mints/burns bridged tokens), the synthetic contract IS the token — pass it as the `--token` address and omit `--warp-token`:

```bash
solver-cli chain add \
  --name chain-b \
  --rpc https://rpc.chain-b.example \
  --chain-id 67890 \
  --input-settler  0x<InputSettlerEscrow-on-chain-b> \
  --output-settler 0x<OutputSettlerSimple-on-chain-b> \
  --oracle         0x<CentralizedOracle-on-chain-b> \
  --token          USDC=0x<HypERC20Synthetic-USDC-on-chain-b>:6 \
  --token          USDT=0x<HypERC20Synthetic-USDT-on-chain-b>:6
```

### Adding more tokens to an already-registered chain

```bash
solver-cli token add --chain chain-a --symbol DAI --address 0x<DAI-on-chain-a> --decimals 18
```

### Verify registrations

```bash
solver-cli chain list
solver-cli token list
```

---

## Step 4: Generate configs

```bash
solver-cli configure
```

This reads your registered chains, derives the solver address from your signing key (local or KMS), and writes:

| File | Purpose |
|---|---|
| `.config/solver.toml` | Solver engine config with all-to-all routes |
| `.config/oracle.toml` | Oracle operator config for all chains |
| `.config/rebalancer.toml` | Rebalancer config with equal-weight distribution |
| `.config/hyperlane-relayer.json` | Hyperlane relayer signer config |
| `oif/oif-aggregator/config/config.json` | Aggregator config |

Forwarding section in `rebalancer.toml` is populated from `CELESTIA_DOMAIN` and `FORWARDING_BACKEND`.

---

## Step 5: Verify solver and oracle addresses

Confirm the addresses that will be used on-chain before funding them.

```bash
solver-cli account address
```

For the oracle operator address, check the generated config:

```bash
grep operator_address .config/oracle.toml
```

---

## Step 6: Fund accounts

The solver needs gas (native token) on every chain where it will fill orders. The oracle operator needs gas on every chain where it will submit attestations (i.e. every origin chain). The rebalancer needs gas on every source chain it will initiate transfers from.

```bash
# Example using cast — repeat for each chain
cast send <SOLVER_ADDRESS> \
  --rpc-url https://rpc.chain-a.example \
  --private-key <FUNDER_KEY> \
  --value 0.1ether

cast send <ORACLE_OPERATOR_ADDRESS> \
  --rpc-url https://rpc.chain-a.example \
  --private-key <FUNDER_KEY> \
  --value 0.05ether
```

The solver also needs token inventory on destination chains to fill orders. Fund it with the relevant tokens on each chain.

---

## Step 7: Start services

Each service reads from the generated configs in `.config/`. Start them in separate terminals or as background processes:

```bash
# Aggregator (quote aggregation API on port 4000)
make aggregator

# Solver (fills orders, claims on oracle confirmation)
make solver

# Oracle operator (signs and submits fill attestations)
make operator

# Rebalancer (maintains token distribution across chains)
make rebalancer

# Frontend (bridge UI + API on ports 3001 / 5173)
./scripts/start-frontend.sh
```

Or use the convenience script that starts all backend services together:

```bash
./scripts/start-services.sh
```

---

## Rebalancer behavior

The rebalancer polls each chain's solver token balance every 30 seconds and transfers from over-weight chains to under-weight chains when any chain falls below its `min_weight` threshold.

By default, `solver-cli configure` sets equal weights across all chains (50/50 for two chains, 33/33/33 for three, etc.) with a ±20% tolerance before triggering a rebalance.

Transfers route through Celestia: the rebalancer calls `transferRemote` on the source chain's warp router toward the Celestia forwarding domain, and the forwarding relayer delivers the tokens to the destination chain.

**For HypCollateral chains**, the rebalancer sends an `approve` transaction to the underlying ERC20 before each `transferRemote`. This is handled automatically — no manual approval is needed.

To run a single rebalance cycle manually:

```bash
solver-cli rebalancer start --once
```

---

## Updating a registered chain

If you need to update contract addresses or add a warp token to an existing chain registration, re-run `chain add` with the same `--name` — it will overwrite the existing entry:

```bash
solver-cli chain add --name chain-a --rpc ... --input-settler ... --output-settler ... --oracle ... --warp-token 0x<new-router>
```

Then regenerate configs:

```bash
solver-cli configure
```

And restart the affected services.

---

## Removing a chain

```bash
solver-cli chain remove --chain chain-b
solver-cli configure
# Restart services
```
