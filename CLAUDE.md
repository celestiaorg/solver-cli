# E2E Solver Setup: Evolve (ev-reth) ↔ Ethereum Sepolia

This is an implementation plan to build a dead-simple end-to-end workflow:
1) start local Evolve, 2) deploy OIF contracts fresh to Evolve+Sepolia, 3) run solver (both directions), 4) trigger transfers (either direction), 5) print balances + addresses for verification.

---

## 0) Non-negotiables

- Ignore Celestia DA properties; they can run in the background.
- Focus only on EVM interop between local Evolve (ev-reth) and Ethereum Sepolia.
- `make deploy` ALWAYS redeploys contracts fresh to BOTH chains.
- Use ONE funded private key per chain (deployer/solver operator), plus ONE user key (can be same if you want, but keep it configurable).
- Start with ONE token: USDC. Make adding/switching tokens trivial (data-driven, not code edits).
- After transfers, print:
  - USDC balance of solver on source (should increase)
  - USDC balance of user on source (should decrease)
  - USDC balance of user on destination (should increase)
  - show those 3 addresses too

---

## 1) Repository layout

```
.
├── Makefile
├── .env
├── solver-cli/              # Rust CLI for deployment & intents
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── commands/
│       ├── chain/
│       ├── deployment/
│       ├── state/
│       └── utils/
├── oracle-operator/         # Independent oracle operator service
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── config.rs
│       └── operator.rs
├── oif/
│   ├── oif-contracts/       # Solidity contracts (foundry)
│   │   ├── src/
│   │   ├── script/
│   │   └── broadcast/       # Deployment artifacts
│   └── oif-solver/          # Core solver engine
│       ├── config/demo/     # Generated solver config
│       └── crates/
└── config/                  # Generated configs (gitignored)
    ├── solver.toml          # Solver configuration
    └── oracle.toml          # Oracle operator configuration
```

Notes:
- `oif/oif-contracts/broadcast/` contains deployment receipts
- `oif/oif-solver/config/demo/` has generated solver config (networks.toml, gas.toml)
- `.solver/state.json` tracks CLI state

---

## 2) Environment (.env)

Create `.env` (never commit):

SEPOLIA_RPC=https://sepolia.infura.io/v3/KEY
EVOLVE_RPC=http://127.0.0.1:8545

SEPOLIA_CHAIN_ID=11155111
EVOLVE_CHAIN_ID=<fill with local chain id>

SEPOLIA_PK=0x...
EVOLVE_PK=0x...

USER_PK=0x...

ORACLE_OPERATOR_PK=0x...  # Separate key for oracle operator

TOKEN_SYMBOL=USDC
TRANSFER_AMOUNT=1000000

Implementation requirements:
- scripts MUST `source .env` and fail fast if required vars are missing.
- `TRANSFER_AMOUNT` is in token base units (USDC: 6 decimals => 1 USDC = 1000000).

---

## 3) Token Handling

- MockERC20 (USDC, 6 decimals) deployed to both chains via Deploy.s.sol
- Token addresses stored in deployment broadcast JSON
- CLI reads addresses from forge broadcast output
- For testing: CLI auto-mints tokens to user if balance insufficient

---

## 4) Oracle Operator Architecture

**CRITICAL: Solver and Oracle Operator are SEPARATE services with DIFFERENT keys.**

### Why Separate?

The solver cannot attest to its own fills. That would be:
```
Solver: "I filled the order"
Solver: "I confirm I filled the order" ← Same entity!
Solver: "Pay me"
```

This is "trust me, I did the work" with no verification.

### Correct Architecture

```
┌──────────────┐         ┌──────────────────┐
│   Solver     │         │ Oracle Operator  │
│   (key A)    │         │    (key B)       │
└──────────────┘         └──────────────────┘
       │                          │
       │ 1. Fill order            │
       │     (key A)              │
       │                          │
       │                  2. Watch fills
       │                  3. Verify happened
       │                  4. Sign attestation
       │                     (key B) ← Different key!
       │                  5. Submit to oracle
       │                          │
       │ 6. Poll oracle           │
       │ 7. Claim (key A)         │
```

### Services

1. **Solver** (`oif-solver/`):
   - Fills orders on destination chain
   - Polls CentralizedOracle.isProven()
   - Claims escrowed funds once oracle confirms

2. **Oracle Operator** (`oracle-operator/`):
   - Watches both chains for OutputFilled events
   - Verifies fills occurred
   - Signs attestations with operator key
   - Submits to CentralizedOracle contracts
   - **Independent process, separate key**

### For Testing

For local E2E testing, you CAN use the same key for both (simpler setup), but understand this defeats the trust model. For production, these MUST be separate entities.

---

## 5) Tooling

- **Rust CLI** (`solver-cli/`): Handles deployment, state management, intent submission, balance verification
- **Foundry**: Contract compilation and deployment via forge scripts
- **OIF Solver**: Core solver engine from `oif/oif-solver/`
- **Oracle Operator**: Independent service that signs attestations

Hard requirements:
- Everything runnable via Make targets
- CLI outputs deterministic, copy-pasteable addresses

---

## 6) Makefile targets (top-level UX)

make start
- starts local evolve node (ev-reth)

make deploy
- runs `solver-cli deploy`
- deploys OIF contracts to Evolve and Sepolia (including CentralizedOracle)
- generates solver config and oracle operator config
- prints deployed addresses summary

make solver-start (or just: make solver)
- starts OIF solver service using generated config
- watches both chains for intents
- fills orders on destination chain
- waits for oracle attestations before claiming

make operator-start (or just: make operator)
- starts oracle operator service (SEPARATE process)
- watches both chains for OutputFilled events
- signs attestations with operator key
- submits to CentralizedOracle contracts

make intent
- runs `solver-cli intent` to submit Evolve → Sepolia USDC intent
- mints tokens to user if needed (testnet)
- prints intent ID and tx hash

make verify
- runs `solver-cli verify` to print balances on both chains
- shows user + solver balances for configured token

---

## 6) Rust CLI (solver-cli/)

The CLI handles all deployment and intent operations.

### Commands

```bash
solver-cli init              # Initialize project state
solver-cli deploy            # Deploy contracts to both chains
solver-cli intent            # Submit cross-chain intent
solver-cli verify            # Check balances on both chains
```

### Architecture

```
solver-cli/src/
├── main.rs                  # CLI entry point (clap)
├── commands/
│   ├── init.rs              # Project initialization
│   ├── deploy.rs            # Contract deployment orchestration
│   ├── intent.rs            # Intent submission
│   └── verify.rs            # Balance verification
├── chain/
│   ├── client.rs            # EVM chain client (alloy)
│   └── contracts.rs         # Contract ABIs and interactions
├── deployment/
│   ├── deployer.rs          # Multi-chain deployment logic
│   └── forge.rs             # Forge script runner
├── state/
│   ├── state_file.rs        # State persistence (.solver/state.json)
│   └── types.rs             # State data structures
└── utils/
    ├── env.rs               # Environment loading
    └── output.rs            # Formatted output helpers
```

### State Management

State stored in `.solver/state.json`:
- Deployed contract addresses per chain
- Token configurations
- Solver address

### Config Generation

After deployment, generates OIF solver config:
- `config/networks.toml` - Chain RPCs and contract addresses
- `config/gas.toml` - Gas estimation settings

---

## 7) OIF Solver Integration

The solver runs from `oif/oif-solver/` using generated config.

### Flow
1. Solver watches InputSettlerEscrow on source chain
2. When intent detected, calculates profitability (gas costs vs spread)
3. If profitable (or within configured loss threshold), fills on destination
4. **Waits for oracle operator to submit attestation**
5. Polls CentralizedOracle.isProven() on source chain
6. Claims escrowed funds once oracle confirms fill

### Oracle Operator Flow (Separate Service)
1. Watches OutputSettlerSimple on both chains for OutputFilled events
2. Extracts fill details (solver, timestamp, orderId, output)
3. Computes attestation payload hash
4. Signs attestation: `sign(keccak256(chainId, oracle, application, payloadHash))`
5. Submits to CentralizedOracle contract on destination chain
6. Oracle stores attestation, making it available via `isProven()`

### Cost/Profit Analysis
Solver automatically:
- Simulates fill transaction for gas estimate
- Fetches current gas prices
- Converts to USD value
- Accepts/rejects based on `min_profit_margin` config

---

## 8) Output Formatting

CLI outputs formatted summaries:

```
═══ SUMMARY ═══
  Chain   │ Account │ Balance
  ────────┼─────────┼────────
  evolve  │ User    │ 0 USDC
  evolve  │ Solver  │ 10 USDC
  sepolia │ User    │ 1 USDC
  sepolia │ Solver  │ 9 USDC
═══════════════
```

---

## 9) Quick Start

```bash
# 1. Start local Evolve node
make start

# 2. Deploy contracts to both chains
make deploy

# 3. Start solver (in separate terminal)
make solver-start

# 4. Start oracle operator (in another terminal)
make operator-start

# 5. Submit intent
make intent

# 6. Verify balances
make verify
```

**Note**: Both solver and oracle operator must be running for the full flow to work. The solver fills orders, the oracle operator signs attestations, and the solver claims funds once attested.

**Aliases**: You can use `make solver` instead of `make solver-start` and `make operator` instead of `make operator-start` for convenience.

---

## 10) Acceptance Checklist

- [x] `make deploy`: deploys fresh contracts (including CentralizedOracle), prints addresses
- [x] `make solver-start`: starts solver watching both chains
- [x] `make operator-start`: starts oracle operator (separate service)
- [x] `make intent`: submits intent
  - Solver fills on destination
  - Oracle operator signs attestation
  - Solver claims on source after oracle confirms
- [x] `make verify`: shows correct balance changes
  - User: source decreased, destination increased
  - Solver: source increased, destination decreased
