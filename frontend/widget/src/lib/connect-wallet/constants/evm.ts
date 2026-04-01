import type { Chain } from "viem";
import * as viemChains from "viem/chains";
import { createConfig, fallback, http } from "wagmi";
import type { Config } from "wagmi";
import { mainnet } from "wagmi/chains";

const rpcUrlConfig = {
  batch: {
    batchSize: 5,
  },
};

const formaChain: Chain = {
  id: 984_122,
  name: "Forma",
  testnet: false,
  nativeCurrency: {
    name: "TIA",
    symbol: "TIA",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.forma.art"],
    },
    public: {
      http: ["https://rpc.forma.art"],
    },
  },
  blockExplorers: {
    default: {
      name: "Forma Explorer",
      url: "https://explorer.forma.art",
    },
  },
  contracts: {
    multicall3: {
      address: "0xd53C6FFB123F7349A32980F87faeD8FfDc9ef079",
      blockCreated: 252_705,
    },
  },
};

// https://chainlist.org/?search=evmos
const evmosChain: Chain = {
  id: 9001,
  name: "Evmos",
  testnet: false,
  nativeCurrency: {
    name: "Evmos",
    symbol: "EVMOS",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://evmos.lava.build"],
    },
    public: {
      http: ["https://evmos.lava.build"],
    },
  },
  blockExplorers: {
    default: {
      name: "Escan",
      url: "https://escan.live",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
};

// https://chainlist.org/?search=inj
const injectiveChain: Chain = {
  id: 2525,
  name: "inEVM",
  testnet: false,
  nativeCurrency: {
    name: "Injective",
    symbol: "INJ",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://mainnet.rpc.inevm.com/http"],
    },
    public: {
      http: ["https://mainnet.rpc.inevm.com/http"],
    },
  },
  blockExplorers: {
    default: {
      name: "inEVM Explorer",
      url: "https://explorer.inevm.com/",
    },
  },
};

export const supportedEVMChains: ReadonlyArray<Chain> = [
  formaChain,
  evmosChain,
  injectiveChain,
  ...Object.values(viemChains),
];

export const defaultWagmiConfig: Config = createConfig({
  chains: [mainnet, ...supportedEVMChains],
  transports: {
    ...Object.fromEntries(
      supportedEVMChains.map((chain) => [chain.id, http()]),
    ),
    [mainnet.id]: fallback([
      http("https://eth.llamarpc.com", rpcUrlConfig),
      http("https://ethereum.blockpi.network/v1/rpc/public", rpcUrlConfig),
      http("https://eth-mainnet.public.blastapi.io", rpcUrlConfig),
      http("https://1rpc.io/eth", rpcUrlConfig),
    ]),
  },
});
