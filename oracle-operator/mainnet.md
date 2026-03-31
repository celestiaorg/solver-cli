# Oracle Operator — Setup Guide

Run the oracle operator after a fresh clone of `solver-cli`.

## Prerequisites

- Rust toolchain (`rustup` + stable)
- The private key whose address is `0x461A79EC89A8c1d103B40073e79a5E609Ef7D070`

This is the same key that deployed the OIF contracts to Ethereum mainnet and Eden mainnet. It is the authorized operator on both CentralizedOracle instances.

## Config

The config file is already at `.config/oracle.toml`. It points to:

| Chain    | Chain ID | RPC                          |
|----------|----------|------------------------------|
| Ethereum | 1        | https://eth.llamarpc.com     |
| Eden     | 714      | https://rpc.eden.gateway.fm/ |

All three contract addresses are identical on both chains:

| Contract             | Address                                      |
|----------------------|----------------------------------------------|
| CentralizedOracle    | `0x4F3563A5C10599cBd7FDED37806A4FF2ed34D439` |
| OutputSettlerSimple  | `0xAC622a465b1EF149eC03439D119e0cc9cf550C67` |
| InputSettlerEscrow   | `0x12501B98442a6EF21d00230648f0Ee14E5eB7B86` |

## Steps

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd solver-cli

# 2. Set the operator private key
export ORACLE_OPERATOR_PK=0x<your-private-key>

# 3. Run the oracle operator
make operator
```

This runs:
```bash
ORACLE_CONFIG=.config/oracle.toml RUST_LOG=info cargo run -p oracle-operator --release
```

The operator will:
1. Load the signer from `ORACLE_OPERATOR_PK`
2. Verify the derived address matches `operator_address` in the config
3. Poll both chains for `OutputFilled` events
4. Sign attestations and submit them to the CentralizedOracle on the origin chain
5. Persist progress to `.config/oracle-state.json`

## Notes

- The operator needs ETH on both chains to submit attestation transactions (gas).
- Logs go to `./logs/oracle/` and stdout.
- To change the RPC endpoints, edit `.config/oracle.toml`.
- For production, switch `[signer]` type from `"env"` to `"aws_kms"` — see `docs/aws-kms-key-import.md`.
