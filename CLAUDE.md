# E2E Solver Setup: Multi-Chain EVM Interop

This is an implementation for a dead-simple end-to-end cross-chain solver workflow supporting **any number of EVM chains**.

Default setup: local Evolve ↔ Ethereum Sepolia, but easily extensible to N chains.

---

## 0) Key Features

- **Multi-chain support**: Configure any number of EVM chains (not limited to 2)
- **Bidirectional**: Solver works in all directions between configured chains
- **All-to-all routing**: Every chain can send to every other chain
- **Chain-agnostic**: Core logic uses chain IDs, not hardcoded names
- `make deploy` deploys contracts to ALL configured chains
- Use ONE funded private key per chain, plus ONE user key
- Start with ONE token: USDC. Make adding/switching tokens trivial (data-driven, not code edits)
- After transfers, print balances on all chains

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

Create `.env` (never commit). Two configuration formats supported:

### Option 1: Legacy format (2 chains)

```bash
# Chain configs
EVOLVE_RPC=http://127.0.0.1:8545
EVOLVE_PK=0x...
EVOLVE_CHAIN_ID=1234

SEPOLIA_RPC=https://sepolia.infura.io/v3/KEY
SEPOLIA_PK=0x...
SEPOLIA_CHAIN_ID=11155111

# Solver/operator keys (default to SEPOLIA_PK)
SOLVER_PRIVATE_KEY=0x...
ORACLE_OPERATOR_PK=0x...

# User key
USER_PK=0x...

# Token config
TOKEN_SYMBOL=USDC
TRANSFER_AMOUNT=1000000
```

### Option 2: Explicit chain list (N chains)

```bash
# Explicit chain list
CHAINS=evolve,sepolia,arbitrum

# Per-chain config
EVOLVE_RPC=http://127.0.0.1:8545
EVOLVE_PK=0x...

SEPOLIA_RPC=https://sepolia.infura.io/v3/KEY
SEPOLIA_PK=0x...

ARBITRUM_RPC=https://sepolia-rollup.arbitrum.io/rpc
ARBITRUM_PK=0x...

# ... rest same as above
```

Implementation requirements:
- CLI auto-detects configuration format
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
   - Watches ALL configured chains for OutputFilled events
   - Verifies fills occurred
   - Signs attestations with operator key
   - **N-chain routing**: When a fill is detected, the operator queries each chain's
     InputSettlerEscrow.orderStatus(orderId) to find where the order originated.
     The attestation is then submitted to the correct origin chain.
   - Submits to CentralizedOracle contracts on the origin chain
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

## 5) Makefile targets (top-level UX)

make start
- starts local evolve node (ev-reth)

make deploy
- runs `solver-cli deploy`
- deploys OIF contracts to ALL configured chains (including CentralizedOracle)
- generates solver config and oracle operator config
- prints deployed addresses summary

make solver-start (or just: make solver)
- starts OIF solver service using generated config
- watches ALL chains for intents
- fills orders on any destination chain
- waits for oracle attestations before claiming

make operator-start (or just: make operator)
- starts oracle operator service (SEPARATE process)
- watches ALL chains for OutputFilled events
- signs attestations with operator key
- submits to CentralizedOracle contracts on source chains

make intent
- runs `solver-cli intent submit` (defaults to first two chains)
- use `make intent FROM=sepolia TO=evolve` for reverse direction
- mints tokens to user if needed (testnet)
- prints intent ID and tx hash

make balances
- runs `solver-cli balances` to print balances on ALL chains
- shows user + solver balances for configured token

---

## 6) Rust CLI (solver-cli/)

The CLI handles all deployment and intent operations.

### Commands

```bash
solver-cli init              # Initialize project state
solver-cli deploy            # Deploy contracts to all configured chains
solver-cli deploy --chains evolve,sepolia  # Deploy to specific chains only
solver-cli configure         # Generate solver and oracle configs
solver-cli fund              # Fund solver on all chains
solver-cli fund --chain sepolia  # Fund solver on specific chain

solver-cli intent submit --amount 1000000 --from evolve --to sepolia
solver-cli intent submit --amount 1000000  # Uses first two chains by default
solver-cli intent list       # List all intents
solver-cli intent status --id <id>

solver-cli balances            # Check balances on all chains
solver-cli balances --chain sepolia  # Check balances on specific chain
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
- Deployed contract addresses per chain (indexed by chain ID)
- Token configurations per chain
- Solver address and operator address
- Intent history

Chain configs use `HashMap<u64, ChainConfig>` structure:
```rust
pub type ChainConfigs = HashMap<u64, ChainConfig>;

pub struct ChainConfig {
    pub name: String,
    pub chain_id: u64,
    pub rpc: String,
    pub contracts: ContractAddresses,
    pub tokens: HashMap<String, TokenInfo>,
    pub deployer: Option<String>,
}
```

### Config Generation

After deployment, generates configs for all chains:
- `config/solver.toml` - Solver configuration with all chains and all-to-all routes
- `config/oracle.toml` - Oracle operator configuration for all chains

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

## 8) OIF Aggregator Integration

The system includes an **OIF Aggregator** service that provides:
- Quote aggregation from multiple solvers
- Unified HTTP API for quotes and orders
- Solver health monitoring and circuit breakers
- Automatic asset discovery

### Architecture

```
User/Client → Aggregator (port 4000) → Solver(s) (port 3000+)
```

### Aggregator Configuration

Generated at `config/aggregator.json`:
- Server settings (host, port)
- Registered solver endpoints
- Aggregation settings (timeouts, retries)
- Circuit breaker configuration
- Metrics and monitoring

### Running with Aggregator

```bash
# Terminal 1: Start aggregator
make aggregator

# Terminal 2: Start solver
make solver

# Terminal 3: Start oracle operator
make operator

# Terminal 4: Submit intents (via CLI or aggregator API)
make intent
```

See [AGGREGATOR_INTEGRATION.md](AGGREGATOR_INTEGRATION.md) for detailed integration guide.

---

## 9) Output Formatting

CLI outputs formatted summaries (for any number of chains):

```
═══ SUMMARY ═══
  Chain    │ Account │ Balance
  ─────────┼─────────┼────────
  evolve   │ User    │ 0 USDC
  evolve   │ Solver  │ 10 USDC
  sepolia  │ User    │ 1 USDC
  sepolia  │ Solver  │ 9 USDC
  arbitrum │ User    │ 0 USDC
  arbitrum │ Solver  │ 0 USDC
═══════════════
```

---

## 10) Quick Start

### Standard Setup (Direct to Chain)

```bash
# 1. Start local chains
make start

# 2. Deploy contracts
make deploy

# 3. Start solver (in separate terminal)
make solver

# 4. Start oracle operator (in another terminal)
make operator

# 5. Submit intent
make intent

# 6. Verify balances
make balances
```

### With Aggregator (Recommended)

```bash
# 1. Start local chains
make start

# 2. Deploy contracts
make deploy

# 3. Start aggregator (Terminal 1)
make aggregator

# 4. Start solver (Terminal 2)
make solver

# 5. Start oracle operator (Terminal 3)
make operator

# 6. Submit intent
make intent

# 7. Verify balances
make balances
```

**Note**: All services must be running for the full flow to work:
- **Solver**: Fills orders on destination chain
- **Oracle Operator**: Signs attestations
- **Aggregator** (optional): Aggregates quotes from multiple solvers

---

## 11) Acceptance Checklist

- [x] `make deploy`: deploys fresh contracts (including CentralizedOracle), prints addresses
- [x] `make aggregator`: starts OIF aggregator on port 4000
- [x] `make solver`: starts solver watching all chains (with HTTP API on port 3000)
- [x] `make operator`: starts oracle operator (separate service)
- [x] `make intent`: submits intent
  - Solver fills on destination
  - Oracle operator signs attestation
  - Solver claims on source after oracle confirms
- [x] `make balances`: shows correct balance changes
  - User: source decreased, destination increased
  - Solver: source increased, destination decreased

### Aggregator Features

- [x] Quote aggregation from multiple solvers
- [x] Automatic solver health monitoring
- [x] Circuit breaker for failing solvers
- [x] Asset discovery and caching
- [x] Unified REST API
