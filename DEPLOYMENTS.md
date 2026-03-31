# OIF Contract Deployments

Deployer / Oracle Operator: `0x461A79EC89A8c1d103B40073e79a5E609Ef7D070`

Contracts from: [openintentsframework/oif-contracts](https://github.com/openintentsframework/oif-contracts) (main branch)

## Ethereum Mainnet (Chain ID: 1)

| Contract | Address | Tx Hash |
|----------|---------|---------|
| InputSettlerEscrow | `0x51d00adCb0B96c7Ad1d8dFFa4E63fd45eA02F238` | `0xdee6f8d16d99ba1e28f5b0a3d377da2e955ca8bdf5b7cf91960b70a535f7f307` |
| OutputSettlerSimple | `0xB35f13B25F683A6E2398BD070AA6e53B29e59C64` | `0xbdc6c249830e1048dcfbc42fd4d98d9a5a14da4a1e09013ddfa278f3896a64fd` |
| CentralizedOracle | `0x1C66923beF1dA6C605599202eE43294e6304Ee5F` | `0xd6857ada43c3c269ce85f8f0a4b187d3b77e624c6b9550fa979170f14c40002f` |

RPC: `https://ethereum-rpc.publicnode.com`

## Eden Mainnet (Chain ID: 714)

| Contract | Address | Tx Hash |
|----------|---------|---------|
| InputSettlerEscrow | `0x51d00adCb0B96c7Ad1d8dFFa4E63fd45eA02F238` | `0x4af9dd761b91894a9a93c3f1763827f7f2f8e917547923cde2e402b53ed657eb` |
| OutputSettlerSimple | `0xB35f13B25F683A6E2398BD070AA6e53B29e59C64` | `0x7dca6fa6c61fe5ee064d6864b0459afa95e8069d22c9204a115d478610c428f2` |
| CentralizedOracle | `0x1C66923beF1dA6C605599202eE43294e6304Ee5F` | `0x44cd22f7cac319a148b5663713a10542fa7cb7dbda9031b411645dcafbe3e8ff` |

RPC: `https://rpc.eden.gateway.fm/`

## Notes

- Permit2 is already deployed at `0x000000000022D473030F116dDEE9F6B43aC78BA3` on both chains (canonical address)
- CentralizedOracle operator is set to `0x461A79EC89A8c1d103B40073e79a5E609Ef7D070`
- Contracts are identical on both chains (same deployer nonce → same CREATE addresses)
- These contracts are compatible with oif-solver `jonas/freeze-v0.2.0` and oif-aggregator `jonas/freeze-v0.2.0`
