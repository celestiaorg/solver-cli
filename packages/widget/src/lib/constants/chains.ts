import {
  eclipsemainnet,
  eclipsemainnetAddresses,
  edentestnet,
  solanamainnet,
  solanamainnetAddresses,
} from "@hyperlane-xyz/registry";
import { ChainMap, ChainMetadata } from "@hyperlane-xyz/sdk";
import { Address } from "@hyperlane-xyz/utils";

import { RelayChainId } from "../relay-api";

// A map of chain names to ChainMetadata
// Chains can be defined here, in chains.json, or in chains.yaml
// Chains already in the SDK need not be included here unless you want to override some fields
// Schema here: https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/metadata/chainMetadataTypes.ts
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  solanamainnet: {
    ...solanamainnet,
    // SVM chains require mailbox addresses for the token adapters
    mailbox: solanamainnetAddresses.mailbox,
    rpcUrls: [
      {
        http: "https://sly-wider-valley.solana-mainnet.quiknode.pro/9017f727c4fc429840553a9222ee33471f855e14",
      },
    ],
  },
  eclipsemainnet: {
    ...eclipsemainnet,
    mailbox: eclipsemainnetAddresses.mailbox,
  },
  edentestnet: {
    ...edentestnet,
    domainId: 2147483647,
    rpcUrls: [
      {
        http: "https://eden-rpc-proxy-production.up.railway.app/rpc",
      },
    ],
  },
};
export const enabledCosmosChainIds = ["celestia", "neutron-1", "stride-1"];

export const ChainsToDisplay = [
  "1",
  "1399811149",
  "8453",
  "42161",
  "2741",
  "1408864445",
  "celestia",
  "9286185", // eclipse from relay
  "solana",
  RelayChainId.solana,
  "11124",
  "84532",
  "arabica-11",
  "mocha-4",
  "421614",
  "1399811151",
  "239092742",
  "3735928814",
];

// rent account payment for (mostly for) SVM chains added on top of IGP,
// not exact but should be pretty close to actual payment
export const chainsRentEstimate: ChainMap<bigint> = {
  eclipsemainnet: BigInt(Math.round(0.00004019 * 10 ** 9)),
  solanamainnet: BigInt(Math.round(0.00411336 * 10 ** 9)),
  sonicsvm: BigInt(Math.round(0.00411336 * 10 ** 9)),
  soon: BigInt(Math.round(0.00000355 * 10 ** 9)),
};
