# Rebalancer Service Spec

## 1) Purpose

The solver naturally moves inventory across chains:
- It spends tokens on output/destination chains to fill orders.
- It claims tokens on input/source chains after oracle proof.

Over time this can skew inventory distribution and starve some destination chains. This service continuously monitors balances and executes cross-chain rebalancing transfers to maintain configured target distribution.

## 2) Goals

1. Maintain per-asset inventory distribution across configured chains near target weights.
2. Trigger rebalances when a chain falls below configured lower bounds.
3. Execute transfers directly through Hyperlane Warp.
4. Be safe and idempotent without local persisted control state.
5. Provide clear observability and deterministic behavior.

## 3) Non-goals (v1)

1. Price optimization across multiple transport routes.
2. Protocol abstraction layer in v1.
3. Automatic fee token top-ups.
4. Predictive inventory optimization based on future order flow.
5. Partial fills across multiple intermediate hops.

## 4) Service Model

The rebalancer is an independent long-running service (similar operationally to solver and oracle operator).
Runtime entrypoint should be integrated into `solver-cli` so operators can run:
- `solver-cli rebalancer start`
- `solver-cli rebalancer start --once`

High-level loop:
1. Poll balances per chain and asset.
2. Compute global distribution per asset.
3. Detect deficits based on thresholds.
4. Build a rebalance plan (source -> destination transfers).
5. Execute Hyperlane Warp transfers.
6. Apply per-source nonce guard before submission (`pending` vs `latest` nonce).
7. Repeat.

## 5) Core Concepts

For a given asset `A` across chains `C`:

- `balance[A][c]`: on-chain token balance owned by rebalancer wallet on chain `c`.
- `total[A] = sum(balance[A][c])`.
- `current_weight[A][c] = balance[A][c] / total[A]` (if total > 0).
- `target_weight[A][c]`: configured desired weight.
- `min_weight[A][c]`: configured lower-bound trigger threshold.

Deficit condition:
- Chain `c` is deficit for asset `A` if `current_weight[A][c] < min_weight[A][c]`.

Transfer sizing target:
- Move toward `target_weight`, not only `min_weight`, to reduce churn.
- v1 keeps sizing chain-agnostic and simple: no USD pricing feeds, only per-asset percentage bounds on total inventory.

## 6) Configuration

File path (proposed): `config/rebalancer.toml`

Example:

```toml
poll_interval_seconds = 15
max_parallel_transfers = 2
dry_run = false

[execution]
min_transfer_bps = 50
max_transfer_bps = 5000

[[chains]]
name = "evolve"
chain_id = 1234
rpc_url = "http://127.0.0.1:8545"
account = "rebalancer"

[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://ethereum-sepolia-rpc.publicnode.com"
account = "rebalancer"

[[assets]]
symbol = "USDC"
decimals = 6

  [[assets.tokens]]
  chain_id = 1234
  address = "0x..."

  [[assets.tokens]]
  chain_id = 11155111
  address = "0x..."

  [assets.weights]
  "1234" = 0.50
  "11155111" = 0.50

  [assets.min_weights]
  "1234" = 0.40
  "11155111" = 0.40

[hyperlane]
default_timeout_seconds = 1800
```

Validation rules:
1. `weights` must sum to `1.0` per asset (tolerance: `1e-6`).
2. Every chain in `weights` must exist in `chains`.
3. `0 <= min_weight[c] <= target_weight[c] <= 1`.
4. Token address must be present for every `(asset, chain)` pair used in weights.
5. At least 2 chains per asset.
6. `0 <= min_transfer_bps <= max_transfer_bps <= 10000`.

## 7) Rebalance Algorithm

Per asset:
1. Fetch balances on all configured chains.
2. Compute `current_weight`.
3. Build deficits:
   - `deficit_amount[c] = max(0, target_balance[c] - current_balance[c])`
   - where `target_balance[c] = target_weight[c] * total`.
4. Build surpluses:
   - `surplus_amount[c] = max(0, current_balance[c] - target_balance[c])`.
5. If no deficit chain violates `min_weight`, do nothing.
6. Match surplus chains to deficit chains greedily:
   - largest deficit first
   - source from largest surplus
   - split if needed.
7. Apply execution constraints:
   - min/max transfer size as % of total inventory for that asset
   - max transfers submitted per cycle (`max_parallel_transfers`)
   - per-source nonce guard (`pending_nonce <= latest_nonce`) before submission.
8. Emit transfer intents and execute via Hyperlane Warp integration.

Transfer size bounds (per asset, per cycle):
- `total_balance = sum(observed_balance)`.
- `min_transfer_raw = ceil(total_balance * min_transfer_bps / 10000)`.
- `max_transfer_raw = floor(total_balance * max_transfer_bps / 10000)`.
- Candidate transfers below `min_transfer_raw` are skipped.
- Candidate transfers above `max_transfer_raw` are capped to `max_transfer_raw`.

Concrete example (applies per candidate route transfer):
- `total_balance = 20 USDC`, `min_transfer_bps = 50`, `max_transfer_bps = 5000`.
- `min_transfer = 0.1 USDC` and `max_transfer = 10 USDC`.
- Planned `0.04 USDC` transfer: skipped (below min).
- Planned `3 USDC` transfer: unchanged.
- Planned `14 USDC` transfer: capped to `10 USDC`.

Design choice (v1 simplicity):
- No USD conversion and no per-asset price dependency.
- No slippage guard parameter in v1; keep route safety to existing quote/submit error handling.

Recommended anti-flap controls:
1. Deficit trigger strictly at `current_weight < min_weight`.
2. Per-cycle transfer cap via `max_parallel_transfers`.
3. Nonce guard on source account to avoid re-submitting while source tx is still pending.

## 8) Hyperlane Warp Integration (v1)

v1 executes rebalances directly through Hyperlane Warp code paths.

Execution flow:
1. Build a Hyperlane Warp transfer request from `(asset, source_chain, destination_chain, amount, recipient)`.
2. Quote fees with `quoteTransferRemote(...)`.
3. Submit source-chain transaction via `transferRemote(...)` with required `msg.value`.
4. Log submission results (tx hash + optional message id) for operator visibility.

Required Rust ABI bindings (Alloy `sol!`) for Phase 3:

```rust
use alloy::sol;

sol! {
    struct Quote {
        address token;
        uint256 amount;
    }

    #[sol(rpc)]
    interface ITokenRouter {
        function token() external view returns (address);

        function quoteTransferRemote(
            uint32 _destination,
            bytes32 _recipient,
            uint256 _amount
        ) external view returns (Quote[] memory quotes);

        function transferRemote(
            uint32 _destination,
            bytes32 _recipient,
            uint256 _amount
        ) external payable returns (bytes32 messageId);
    }
}
```

Phase 3 integration notes:
1. `quoteTransferRemote` returns multiple quotes; v1 should at minimum use the native-fee quote for `msg.value` and log all quote entries.
2. Recipient passed to router is `bytes32` (address must be converted to bytes32 format expected by Hyperlane).
3. `token()` should be called to validate expected route token semantics and improve diagnostics.

Design note:
- We intentionally defer protocol abstraction until we have a second real transport integration and concrete integration pressure.

## 9) Stateless Operation

The rebalancer does not persist local control state. There is no `.rebalancer/state.json` dependency.

Control behavior is derived from live chain reads each cycle:
1. Balances determine planning and transfer sizing.
2. Source-account nonces (`latest` and `pending`) gate submissions.
3. If `pending_nonce > latest_nonce`, skip submissions from that source chain in the current cycle.
4. If pending nonce lookup fails, skip submissions from that source chain in the current cycle (fail closed).

## 10) Error Handling

1. RPC failures:
   - mark snapshot as partial
   - skip execution for affected asset this cycle
   - retry next poll.
2. Hyperlane submission failure:
   - log failed attempt with reason
   - retry in a later cycle based on fresh balances and nonce guard.
3. Nonce guard lookup failure:
   - skip submissions for that source chain in this cycle.
4. Insufficient source balance at execution time:
   - recalculate plan next cycle.

## 11) Observability

Logs:
1. Snapshot summary per asset: balances, current weights, target weights.
2. Trigger decisions: why rebalance fired or skipped.
3. Transfer submission events: quoted, submitted, failed.
4. Nonce guard decisions per source chain (allowed/blocked/error).

Metrics:
1. `rebalancer_asset_weight{asset,chain}`
2. `rebalancer_deficit_trigger_total{asset,chain}`
3. `rebalancer_transfer_submitted_total{asset,src,dst}`
4. `rebalancer_transfer_failed_total{asset,src,dst}`
5. `rebalancer_nonce_guard_block_total{chain}`

## 12) Security and Key Management

1. Prefer dedicated rebalancer keys per chain.
2. Keep keys in env/config references, not committed files.
3. Validate destination recipient and token addresses from config only.
4. Enforce allowlisted chain pairs.

## 13) Proposed Project Layout

```text
rebalancer/
  Cargo.toml
  SPEC.md
  src/
    main.rs
    config.rs
    service.rs
    planner.rs
    balance.rs
    hyperlane.rs
```

## 14) Integration Points

1. Add Make target:
   - `make rebalancer-start` (or alias `make rebalancer`)
2. Add CLI entrypoint in `solver-cli`:
   - `solver-cli rebalancer start [--config config/rebalancer.toml]`
   - This should call the rebalancer service directly (not shelling out to an external process wrapper).
3. Add config generation hook (optional phase 2):
   - generate `config/rebalancer.toml` from existing chain/token state.
4. Reuse existing chain/token metadata from `solver-cli` state where possible.

## 15) Implementation Plan

### Phase 1: Skeleton + Config + Polling
1. Create `rebalancer/` crate scaffold.
2. Implement config parser + validation.
3. Implement balance polling per asset/chain.
4. Implement dry-run planning logs only (no transfers).
5. Add `solver-cli rebalancer start` command and wire `make rebalancer`.

Deliverable:
- Service prints deterministic rebalance plans from live balances.
- Service is invocable from top-level UX (`solver-cli` and `make`).

### Phase 2: Stateless Planner + Submission Controls
1. Implement deficit/surplus planner with constraints.
2. Keep planner stateless: no in-flight reservation/hysteresis persistence.
3. Add per-cycle caps and nonce-guard submission gating.

Deliverable:
- Stable stateless plan generation from live balances and nonce data.

### Phase 3: Hyperlane Warp Execution
1. Add Alloy `sol!` bindings for `token()`, `quoteTransferRemote(...)`, and `transferRemote(...)`.
2. Implement direct Hyperlane Warp quote + transfer submission.
3. Execute one transfer at a time per asset route with idempotency guards.
4. Log source tx hash / message id on submission (no local persistence).

Deliverable:
- End-to-end rebalance transfer execution.

### Phase 4: Hardening + Ops
1. Add retries/backoff around quote/submit failures.
2. Add metrics and structured logs.
3. Add Make target and operator runbook docs.

Deliverable:
- Production-usable rebalancer service with operational visibility.

### Phase 5 (Optional): Protocol Abstraction Extraction
1. If/when a second transport integration is added, extract a protocol interface from the proven Hyperlane implementation.
2. Keep Hyperlane as the reference implementation and migrate behavior behind the new interface incrementally.

## 16) Acceptance Criteria

1. For configured assets, service detects weight breaches and plans transfers correctly.
2. When below thresholds, service submits Hyperlane transfers with nonce-guarded source-chain idempotency.
3. Service restart remains safe without local state; pending nonce gap blocks duplicate source submissions.
4. Distribution converges toward configured target weights over time.
5. Dry-run mode emits plans with zero on-chain writes.

## 17) Open Decisions

1. Key strategy:
   - reuse solver keys initially vs dedicated rebalancer keys immediately.
2. Hyperlane confirmation semantics:
   - source tx finality only vs destination receipt proof required before closure.
