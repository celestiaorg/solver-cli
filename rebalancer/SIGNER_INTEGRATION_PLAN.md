# Rebalancer Signer Integration Plan

## Summary
- Add explicit signer configuration for the rebalancer so writes can be enabled safely and predictably.
- Support both local signer sources:
  - private key from environment variable
  - private key directly in `rebalancer.toml` via `type = "file"`
- Support remote signing via AWS KMS (and keep extension points for other remote signers later).
- After signer integration is stable, simplify client internals by collapsing read/write provider split where practical.
- Use strict startup validation in non-dry mode: any signer init mismatch/failure aborts startup.

## Current State
- Rebalancer is stateless for control logic and can run in `dry_run` without write keys.
- `ChainClient` currently uses:
  - `read_provider` for reads/quotes/nonces
  - optional `wallet_provider` for submits
- Signer resolution is implicit via env fallbacks in code.

## Goals
1. Make signer source explicit and deterministic per chain.
2. Keep `dry_run` behavior unchanged (no write signer required).
3. Support production-safe remote signing (AWS KMS).
4. Preserve account/signer address verification before sending transactions.

## Non-goals
1. Hardware wallet support in v1.
2. Full HSM abstraction for every cloud provider in first pass.
3. Multi-sig orchestration.

## Proposed Configuration Changes

### 1) Add signer block to chain config
Each chain gets an explicit signer config.

```toml
[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://..."
account = "0x..."

  [chains.signer]
  type = "env" # "env" | "file" | "aws_kms"
```

```toml
[[chains]]
name = "evolve"
chain_id = 1234
rpc_url = "http://127.0.0.1:8545"
account = "0x..."

  [chains.signer]
  type = "file"
  key = "0x..."
```

```toml
[[chains]]
name = "sepolia"
chain_id = 11155111
rpc_url = "https://..."
account = "0x..."

  [chains.signer]
  type = "aws_kms"
  key_id = "arn:aws:kms:us-east-1:123456789012:key/..."
  region = "us-east-1"
```

### 2) Config structs and validation
- Extend `ChainConfig` with `signer: Option<SignerConfig>`.
- Add:
  - `SignerConfig::Env`
  - `SignerConfig::File { key }`
  - `SignerConfig::AwsKms { key_id, region }`
- Validation:
  - In non-dry mode, every chain must have signer config.
  - Resolve signer address and enforce `signer_address == chain.account_address`.
  - In dry-run mode, signer config may be omitted.
  - For `type = "env"`, do not accept `env_var` in TOML; resolve from a fixed convention only.
  - If chain-specific env var is missing for `type = "env"`, allow fallback to `REBALANCER_PRIVATE_KEY`.
  - Any signer initialization failure in non-dry mode fails whole service startup (no partial mode).

## Signing Architecture

### 1) Introduce signer backend abstraction
- Add a generic remote signer abstraction and two initial implementations:
  - `LocalPrivateKeySignerBackend` (env/file)
  - `AwsKmsSignerBackend` (first remote backend)
- Backend responsibilities:
  - expose signer address
  - sign/send transaction payloads needed by `transferRemote`

### 2) Local signer backend
- `env`: read from a hardcoded naming convention only.
  - Exact convention: `REBALANCER_<CHAIN_NAME_NORMALIZED>_PK`, where normalization is uppercase and non-alphanumeric chars replaced with `_`.
  - Example: `arb-sepolia` -> `REBALANCER_ARB_SEPOLIA_PK`.
  - If missing, fallback to `REBALANCER_PRIVATE_KEY`.
- `file`: parse `chains.signer.key`.
- Normalize with `0x` support and strict key format validation.

### 3) AWS KMS backend
- Use KMS `Sign` API with `ECDSA_SHA_256` over Keccak-derived digest flow required by Ethereum tx signing.
- Derive Ethereum address from KMS public key and verify against `chain.account`.
- Add robust retry/backoff for transient AWS errors.
- Fail closed if KMS signing is unavailable.
- AWS auth source/profile customization is deferred for a later iteration.

## ChainClient Refactor Plan

### Phase A (first)
- Keep current split provider internals (`read_provider` + optional wallet/signer path).
- Replace implicit env-based signer lookup with explicit `SignerConfig` path.
- Use signer backend for `submit_transfer_remote`.

### Phase B (after key integration lands)
- Collapse provider split where possible:
  - In write mode, use one configured provider/signing path for both reads and writes.
  - In dry-run mode, use read-only provider path.
- Keep external `ChainClient` API stable during this internal cleanup.

## Implementation Steps
1. Extend config parser/types for `chains.signer`.
2. Add signer backend module (`rebalancer/src/signer.rs`).
3. Implement local signer source resolution (`env` and `file`).
4. Add AWS KMS signer backend.
5. Wire signer backend into `ChainClient::new(...)`.
6. Enforce signer/account match at startup in non-dry mode.
7. Update `solver-cli configure` to emit signer stanzas in generated `config/rebalancer.toml`.
   - Default emission should use `type = "env"` without `env_var`.
8. Add signer log redaction rules (never log key material; log only chain, signer type, and resolved address where safe).
9. Add docs/examples for local and AWS KMS configuration.
10. Perform Phase B provider simplification.

## Test Plan

### Unit tests
1. Config parsing:
- Parses `env`, `file`, and `aws_kms` signer blocks.
- Rejects invalid/missing required signer fields.
- Rejects `env_var` under `type = "env"`.

2. Signer resolution:
- Chain-specific env var missing + no `REBALANCER_PRIVATE_KEY` fallback -> error.
- `file.key` invalid format -> error.
- Signer/account mismatch -> startup error.
- Chain-name normalization for env var lookup matches spec.

3. Dry-run behavior:
- No signer config required in `dry_run=true`.
- Submit path remains disabled in dry-run.

4. AWS KMS adapter:
- Address derivation from KMS pubkey is correct.
- Signature format and `v/r/s` assembly are correct.

### Integration tests
1. Non-dry startup succeeds with valid local signer config.
2. Non-dry startup fails with mismatched signer/account.
3. Rebalancer can submit `transferRemote` with env-configured key.
4. Non-dry startup fails if any chain signer init fails (global fail-fast behavior).
5. `solver-cli configure` emits `type = "env"` signer stanzas for all chains by default.

## Security Notes
1. `file` key support is for local/dev convenience and should not be used in production.
2. Prefer `env` or `aws_kms` for production.
3. Never log private keys or full signer material.
4. Redact signer config values in error and startup logs.

## Acceptance Criteria
1. Operator can choose signer source per chain: env, file, or AWS KMS.
2. Rebalancer non-dry startup validates signer/account match and fails fast on mismatch.
3. Dry-run remains keyless and functional.
4. ChainClient internals are simplified further after signer integration, without behavior regression.
