# Adding Sepolia to a Running anvil1 + anvil2 System

This guide adds Sepolia testnet as a third chain. After completing it, users can bridge USDC between any pair of chains and the solver will fill intents in all directions.

**Prerequisites:**
- `make start && make setup` completed successfully
- Solver and oracle operator running (`make solver`, `make operator`)
- A funded Sepolia wallet — get ETH from [sepoliafaucet.com](https://sepoliafaucet.com)
- Foundry installed (`forge`, `cast`)

---

## Step 1: Add Sepolia to .env

Append to your `.env`:

```bash
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
SEPOLIA_PK=<your-funded-sepolia-key>
SEPOLIA_CHAIN_ID=11155111
```

The CLI auto-detects chains by scanning for `{CHAIN}_RPC` + `{CHAIN}_PK` pairs — no other config needed.

> `SEPOLIA_PK` is the **deployer key** for paying gas on Sepolia. The solver itself uses `SOLVER_PRIVATE_KEY` on all chains.

---

## Step 2: Deploy OIF contracts to Sepolia

```bash
make deploy CHAINS=sepolia
```

Deploys three contracts to Sepolia:
- **CentralizedOracle** — stores fill attestations from the oracle operator
- **InputSettlerEscrow** — holds user funds when Sepolia is the origin chain
- **OutputSettlerSimple** — where the solver delivers when Sepolia is the destination

Verify the addresses were saved:

```bash
cat .config/state.json | jq '.chains | to_entries[] | select(.value.name == "sepolia")'
```

---

## Step 3: Deploy Hyperlane core contracts to Sepolia

Create the chain metadata file so the Hyperlane CLI knows about Sepolia:

```bash
mkdir -p hyperlane/registry/chains/sepolia

cat > hyperlane/registry/chains/sepolia/metadata.yaml <<EOF
chainId: 11155111
displayName: Sepolia
domainId: 11155111
isTestnet: true
name: sepolia
nativeToken:
  decimals: 18
  name: Ether
  symbol: ETH
protocol: ethereum
rpcUrls:
  - http: $SEPOLIA_RPC
technicalStack: other
EOF
```

Deploy Hyperlane core contracts (Mailbox, ISM, hooks) to Sepolia:

```bash
docker run --rm \
  -v "$(pwd)/hyperlane:/home/hyperlane" \
  -w /home/hyperlane \
  --entrypoint hyperlane \
  ghcr.io/celestiaorg/hyperlane-init:local \
  core deploy \
    --chain sepolia \
    --registry ./registry \
    --key $SEPOLIA_PK \
    --yes \
  2>/dev/null
```

Verify the addresses were written:

```bash
cat hyperlane/registry/chains/sepolia/addresses.yaml
```

---

## Step 4: Deploy USDC bridge token on Sepolia

The token on Sepolia is a **HypSynthetic** — a bridge endpoint that represents USDC locked on anvil1 and routed through Celestia. You're not deploying a new token; you're deploying the Sepolia side of the bridge.

Create the config:

```bash
. ./.env
SEPOLIA_DEPLOYER=$(cast wallet address --private-key $SEPOLIA_PK)

cat > hyperlane/configs/warp-config-sepolia.yaml <<EOF
sepolia:
  type: synthetic
  owner: "$SEPOLIA_DEPLOYER"
  name: "USDC"
  symbol: "USDC"
  decimals: 6
EOF
```

Deploy:

```bash
docker run --rm \
  -v "$(pwd)/hyperlane:/home/hyperlane" \
  -w /home/hyperlane \
  --entrypoint hyperlane \
  ghcr.io/celestiaorg/hyperlane-init:local \
  warp deploy \
    --config ./configs/warp-config-sepolia.yaml \
    --registry ./registry \
    --key $SEPOLIA_PK \
    --yes \
  2>/dev/null
```

> Etherscan verification errors are suppressed — they're non-fatal and the deployment succeeds regardless.

The output ends with the deployed contract address:

```
    tokens:
      - chainName: sepolia
        ...
        addressOrDenom: "0x3FECb5509689C514da6f65CC547b5407E731978b"
```

Copy the `addressOrDenom` value and export it:

```bash
export HYP_SYNTHETIC_SEPOLIA=0x...   # paste from deploy output above
```

---

## Step 5: Connect Sepolia into the Celestia warp route

The warp route currently connects anvil1 ↔ Celestia ↔ anvil2. You need to enroll Sepolia as a spoke on Celestia — this is a two-sided handshake: Sepolia must know about Celestia, and Celestia must know about Sepolia.

Get the Celestia token address:

```bash
cat hyperlane/hyperlane-addresses.json | jq -r '.celestiadev.synthetic_token'
export CEL_TOKEN=0x...   # paste from above
```

**Enroll Celestia on Sepolia** — tells Sepolia's bridge contract that Celestia (domain 69420) is a valid route:

```bash
cast send $HYP_SYNTHETIC_SEPOLIA \
  "enrollRemoteRouter(uint32,bytes32)" \
  69420 $CEL_TOKEN \
  --private-key $SEPOLIA_PK \
  --rpc-url $SEPOLIA_RPC
```

**Enroll Sepolia on Celestia** — tells Celestia's token that Sepolia (domain 11155111) is a valid route:

```bash
# Celestia expects the address lowercase, without 0x, padded to 32 bytes
HYP_SYNTHETIC_LOWER=$(echo $HYP_SYNTHETIC_SEPOLIA | tr '[:upper:]' '[:lower:]' | cut -c 3-)

docker run --rm \
  --network solver-cli_solver-net \
  --entrypoint bash \
  -v "$(pwd)/hyperlane:/home/hyperlane" \
  -w /home/hyperlane \
  ghcr.io/celestiaorg/hyperlane-init:local \
  -c "hyp enroll-remote-router http://celestia-validator:26657 $CEL_TOKEN 11155111 0x000000000000000000000000$HYP_SYNTHETIC_LOWER"
```

After this step the warp route topology is:

```
anvil1 (HypCollateral) ↔ Celestia (native synthetic) ↔ anvil2 (HypSynthetic)
                                   ↕
                              Sepolia (HypSynthetic)
```

> Domain IDs: `131337` = anvil1, `31338` = anvil2, `69420` = Celestia, `11155111` = Sepolia.

---

## Step 6: Add Sepolia to the Hyperlane relayer

The relayer passes messages between chains. Add Sepolia to `hyperlane/relayer-config.json`:

```bash
# Read the Sepolia mailbox address from the registry file downloaded in Step 3
SEPOLIA_MAILBOX=$(grep "^mailbox:" hyperlane/registry/chains/sepolia/addresses.yaml | awk '{print $2}' | tr -d '"')
echo "Sepolia mailbox: $SEPOLIA_MAILBOX"

node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('hyperlane/relayer-config.json', 'utf8'));
cfg.chains.sepolia = {
  blocks: { confirmations: 1, estimateBlockTime: 12, reorgPeriod: 5 },
  chainId: 11155111,
  displayName: 'Sepolia',
  domainId: 11155111,
  isTestnet: true,
  name: 'sepolia',
  nativeToken: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  protocol: 'ethereum',
  rpcUrls: [{ http: '$SEPOLIA_RPC' }],
  signer: { type: 'hexKey', key: '0x$SEPOLIA_PK' },
  mailbox: '$SEPOLIA_MAILBOX'
};
const chains = cfg.relayChains.split(',').filter(Boolean);
if (!chains.includes('sepolia')) chains.push('sepolia');
cfg.relayChains = chains.join(',');
fs.writeFileSync('hyperlane/relayer-config.json', JSON.stringify(cfg, null, 4) + '\n');
console.log('Done — relayer-config.json updated');
"
```

Restart the relayer to pick up the new config:

```bash
docker compose restart relayer
```

---

## Step 7: Register USDC token address for Sepolia

Tell the solver CLI which contract is USDC on Sepolia:

```bash
make token-add CHAIN=sepolia SYMBOL=USDC ADDRESS=$HYP_SYNTHETIC_SEPOLIA DECIMALS=6
```

Verify:

```bash
make token-list CHAIN=sepolia
```

---

## Step 8: Fund the solver and oracle operator

**Solver** — needs ETH on Sepolia to pay gas when filling orders there:

```bash
SOLVER_ADDR=$(cast wallet address --private-key $SOLVER_PRIVATE_KEY)
echo "Funding solver: $SOLVER_ADDR"

cast send $SOLVER_ADDR \
  --rpc-url $SEPOLIA_RPC \
  --private-key $SEPOLIA_PK \
  --value 0.1ether
```

**Oracle operator** — needs ETH on Sepolia to submit attestations when Sepolia is the origin chain:

```bash
OPERATOR_ADDR=$(cat .config/oracle.toml | grep 'operator_address' | cut -d'"' -f2)
echo "Funding operator: $OPERATOR_ADDR"

cast send $OPERATOR_ADDR \
  --rpc-url $SEPOLIA_RPC \
  --private-key $SEPOLIA_PK \
  --value 0.1ether
```

> For intents originating on anvil1 (fill on Sepolia), the operator needs ETH on **anvil1** — already covered by `make setup`.

---

## Step 9: Regenerate solver and oracle configs

```bash
make configure
```

This rewrites `.config/solver.toml` and `.config/oracle.toml` to include Sepolia with all-to-all routes:
- anvil1 ↔ sepolia
- anvil2 ↔ sepolia
- anvil1 ↔ anvil2 (unchanged)

Verify Sepolia is included in the routes:

```bash
grep -A3 'centralized.routes' .config/solver.toml
```

## Step 10: Restart services and verify

The solver, oracle operator, and frontend must reload their configs to pick up the new chain. Kill only the services — **not** the Docker stack (that would destroy your deployed contracts):

```bash
pkill -f "solver-cli solver start" || true
pkill -f oracle-operator || true
pkill -f oif-aggregator || true
pkill -f "node server.js" || true
pkill -f vite || true
```

Restart:

```bash
./scripts/start-services.sh
./scripts/start-frontend.sh
```

Check all balances (Sepolia should now appear):

```bash
make balances
```

Expected output (exact amounts depend on prior activity):

```
  Chain    │ Account │ Balance
  ─────────┼─────────┼────────
  anvil1   │ User    │ 10 USDC
  anvil1   │ Solver  │ 100 USDC
  anvil2   │ User    │ 0 USDC
  anvil2   │ Solver  │ 0 USDC
  sepolia  │ User    │ 0 USDC
  sepolia  │ Solver  │ 10 USDC
```

Test an intent in each direction:

```bash
make intent FROM=anvil1 TO=sepolia AMOUNT=1000000
make intent FROM=sepolia TO=anvil1 AMOUNT=1000000
```

---

## Rebalancing solver inventory

All inventory flows through the Celestia hub. Faucet (`mint`) is only available on anvil1.

```bash
make rebalance TO=sepolia     # bridge: anvil1 → Celestia → Sepolia
make rebalance TO=anvil2      # bridge: anvil1 → Celestia → anvil2
make rebalance-back           # bridge: anvil2 → Celestia → anvil1

make mint CHAIN=anvil1 SYMBOL=USDC TO=solver AMOUNT=100000000   # mint on anvil1 only
```

---

## Removing Sepolia

```bash
make chain-remove CHAIN=sepolia
make configure
# Restart all services (same as Step 11)
```

Remove Sepolia from `hyperlane/relayer-config.json` (delete `chains.sepolia` and remove `sepolia` from `relayChains`), then restart the relayer:

```bash
docker compose restart relayer
```

Remove the three lines from `.env`:

```bash
# Remove these:
SEPOLIA_RPC=...
SEPOLIA_PK=...
SEPOLIA_CHAIN_ID=...
```
