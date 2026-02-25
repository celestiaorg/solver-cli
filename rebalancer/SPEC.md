# Rebalancer Service Spec

## 1) Purpose

The solver naturally moves inventory across chains:
- it spends tokens on destination chains to fill orders
- it claims tokens on source chains after oracle proof

Over time this can skew inventory distribution and starve some destination chains. The rebalancer continuously monitors balances and executes cross-chain transfers to maintain configured target distribution.

## 2) Goals

1. Maintain per-asset inventory distribution across configured chains near target weights.
2. Trigger rebalances when a chain falls below configured lower bounds.
3. Execute transfers directly through Hyperlane Warp.
4. Be safe and idempotent without local persisted control state.
5. Provide clear observability and deterministic behavior.

## 3) Non-goals (current)

1. Price optimization across multiple transport routes.
2. Protocol abstraction layer.
3. Automatic fee token top-ups.
4. Predictive inventory optimization based on future order flow.
5. Persistent in-flight transfer reservation state.

## 4) Service Model

The rebalancer is an independent long-running service integrated into `solver-cli`.

Runtime entrypoints:
- `solver-cli rebalancer start`
- `solver-cli rebalancer start --once`

High-level loop:
1. Startup: create per-chain clients and compute startup `total_balance` per asset from chain reads.
2. Poll live balances per chain and asset each cycle.
3. Detect deficits based on `min_weight`.
4. Build a rebalance plan (source -> destination transfers).
5. Apply size bounds and per-cycle parallel cap.
6. Apply per-source nonce guard (`pending <= latest`) before submission.
7. Quote and submit Hyperlane Warp transfers (unless `dry_run = true`).
8. Repeat.

## 5) Core Concepts

For asset `A` across chains `C`:

- `balance[A][c]`: on-chain balance for rebalancer account on chain `c`.
- `observed_total[A] = sum(balance[A][c])` from current cycle (diagnostics).
- `total_balance[A]`: startup canonical total computed once per process run.
- `current_weight[A][c] = balance[A][c] / total_balance[A]` when `total_balance[A] > 0`.
- `target_weight[A][c]`: configured desired weight.
- `min_weight[A][c]`: configured lower-bound trigger threshold.

Deficit condition:
- chain `c` is deficit if `current_weight + 1e-9 < min_weight`.

Sizing target:
- move toward target weights (not only min weights).

## 6) Configuration

File path: `config/rebalancer.toml`

Example:

```toml
poll_interval_seconds = 30
max_parallel_transfers = 2
dry_run = false

[execution]
min_transfer_bps = 50
max_transfer_bps = 5000

[accounts]
rebalancer = "0xD5E85E86FC692CEdaD6D6992F1f0ccf273e39913"

[[chains]]
name = "sepolia"
chain_id = 11155111
domain_id = 11155111 # optional; defaults to chain_id
rpc_url = "https://ethereum-sepolia-rpc.publicnode.com"
account = "rebalancer"
  [chains.signer]
  type = "env" # env | file | aws_kms

[[chains]]
name = "eden"
chain_id = 3735928814
domain_id = 2147483647
rpc_url = "https://ev-reth-eden-testnet.binarybuilders.services:8545/"
account = "rebalancer"
  [chains.signer]
  type = "env"

[[assets]]
symbol = "USDC"
decimals = 6

  [[assets.tokens]]
  chain_id = 11155111
  type = "erc20" # optional, defaults to erc20
  address = "0xf77764d1E232Ec088150a3E434678768f8774f21"
  collateral_token = "0x22cCd0e1efc2beF46143eA00e3868A35ebA16113" # optional for erc20; defaults to address

  [[assets.tokens]]
  chain_id = 3735928814
  type = "erc20"
  address = "0x0C1c5a78669ea6cb269883ad1B65334319Aacfd7"

  [assets.weights]
  "11155111" = 0.50
  "3735928814" = 0.50

  [assets.min_weights]
  "11155111" = 0.40
  "3735928814" = 0.40

[hyperlane]
default_timeout_seconds = 1800
```

Native asset token entry:

```toml
[[assets.tokens]]
chain_id = 11155111
type = "native"
collateral_token = "0x..."
```

Validation rules:
1. `weights` must sum to `1.0` per asset (tolerance `1e-6`).
2. Every chain in `weights` must exist in `chains`.
3. `0 <= min_weight[c] <= target_weight[c] <= 1`.
4. Every weighted chain must have a token entry.
5. At least 2 chains per asset.
6. `0 <= min_transfer_bps <= max_transfer_bps <= 10000`.
7. `domain_id` defaults to `chain_id`, must fit `uint32`, and must be unique across chains.
8. `chains.signer` is required.
9. `poll_interval_seconds >= 30`.

Token rules:
1. `type = "erc20"`:
   - `address` required and non-zero
   - `collateral_token` optional; defaults to `address` when omitted
2. `type = "native"`:
   - `address` must be omitted
   - `collateral_token` required and non-zero
3. `router_address` is not supported and fails parsing.

Signer rules:
1. `type = "env"` supports only `type`.
2. `type = "file"` requires `key`.
3. `type = "aws_kms"` requires `key_id` and `region`.

`env` signer runtime key lookup order:
1. `REBALANCER_<NORMALIZED_CHAIN_NAME>_PK`
2. `REBALANCER_PRIVATE_KEY`

## 7) Rebalance Algorithm

Per asset each cycle:
1. Fetch balances on all weighted chains.
2. If any balance read fails for that asset, skip planning/execution for that asset this cycle.
3. Compute `observed_total` for diagnostics.
4. Use startup `total_balance` as planning denominator.
5. Compute deficits:
   - `target_balance[c] = target_weight[c] * total_balance`
   - `deficit_amount[c] = max(0, target_balance[c] - current_balance[c])`
6. Compute surpluses:
   - `surplus_amount[c] = max(0, current_balance[c] - target_balance[c])`
7. If no chain is below `min_weight`, do nothing.
8. Greedy match largest deficits with largest surpluses.
9. Apply transfer-size bounds:
   - `min_transfer_raw = ceil(total_balance * min_transfer_bps / 10000)`
   - `max_transfer_raw = floor(total_balance * max_transfer_bps / 10000)`
   - below min: skip
   - above max: cap
10. Apply per-cycle transfer cap (`max_parallel_transfers`), blocking tail transfers.
11. If not dry-run, execute emitted transfers with nonce guard and quote/submit flow.

## 8) Hyperlane Warp Integration

Execution flow per transfer:
1. Resolve source `collateral_token` for quote/submit.
2. Call `quoteTransferRemote(...)` on source `collateral_token`.
3. Use destination chain `domain_id` (not `chain_id`).
4. Extract native fee from quote entries where `token == zero address`; use as `msg.value`.
5. Call `transferRemote(...)` on source `collateral_token`.
6. Log tx hash and optional message id.

Notes:
1. Balance polling uses asset `address` for ERC20 and native balance for `type = native`.
2. Quote/submit always target `collateral_token`.
3. Current implementation does not call `token()` for diagnostics.

## 9) Stateless Operation

The rebalancer does not persist local control state.

Behavior:
1. Startup computes per-asset `total_balance`; startup fails if incomplete.
2. Per-cycle live balances determine distribution and deficits.
3. Nonce guard blocks source submissions when pending nonce is ahead of latest.
4. If nonce lookup fails, skip that source chain for the cycle.
5. Resync policy is restart to recompute startup totals.

## 10) Error Handling

1. Startup balance-read failures:
   - fail service startup.
2. Per-cycle balance-read failures:
   - skip that asset for the cycle.
3. Quote failure:
   - log warning and continue with other transfers.
4. Submission failure:
   - log warning and continue with other transfers.
5. Nonce guard lookup failure:
   - skip submissions from that source chain for the cycle.

## 11) Observability

Structured logs include:
1. Startup config summary.
2. Per-asset chain config (`type`, `address`, `collateral_token`).
3. Startup totals.
4. Per-cycle snapshot (`total_balance`, `observed_total`, available slots).
5. Trigger decisions and planned transfers.
6. Min/max transfer-size blocks and caps.
7. Nonce guard allow/block decisions.
8. Quote summary and quote entries (debug).
9. Transfer submission success/failure.
10. Inventory drift (`observed_total` vs startup `total_balance`).

Metrics are not yet implemented in this crate.

## 12) Security and Key Management

1. Prefer dedicated rebalancer keys per chain.
2. Keep private keys out of committed files.
3. Validate signer/account address match at startup.
4. Use config-driven token/router addresses only.

## 13) Project Layout

```text
rebalancer/
  Cargo.toml
  SPEC.md
  src/
    main.rs
    config.rs
    service.rs
    planner.rs
    client.rs
    signer.rs
```

## 14) Integration Points

1. Make target:
   - `make rebalancer-start` (alias `make rebalancer`)
2. CLI:
   - `solver-cli rebalancer start [--config config/rebalancer.toml] [--once]`
3. Config generation:
   - `solver-cli configure` generates `config/rebalancer.toml`.

## 15) Implementation Status

Implemented:
1. Config parser/validation for chain, signer, domain, asset type, and token semantics.
2. Stateless planner and execution loop.
3. Native + ERC20 balance polling.
4. Hyperlane quote/submit execution via `collateral_token`.
5. Transfer bounds, per-cycle parallel cap, and nonce guard.
6. `dry_run` planning mode.

Current gaps:
1. No retry/backoff strategy beyond next-cycle retry.
2. No metrics export yet.
3. `hyperlane.default_timeout_seconds` is parsed/logged but not yet enforced in transfer control logic.

## 16) Acceptance Criteria

1. For configured assets, service detects weight breaches and plans transfers correctly.
2. When below thresholds and not dry-run, service submits Hyperlane transfers to configured domain IDs.
3. Quote/submit targets use `collateral_token`; ERC20 balances use `address`; native balances use `eth_getBalance`.
4. Service restart remains safe without local state; nonce guard blocks duplicate source submissions when pending is ahead.
5. Dry-run mode emits plans with zero on-chain writes.

## 17) Open Decisions

1. Whether to enforce per-transfer timeout semantics using `hyperlane.default_timeout_seconds`.
2. Whether to add retry/backoff and/or circuit breaking around repeated route failures.
3. Whether to introduce protocol abstraction once a second transport is added.
