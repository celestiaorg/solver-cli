import type { Chain } from 'viem';
import { createConfig, http } from 'wagmi';

const anvil1Chain: Chain = {
  id: 31337,
  name: 'Anvil1',
  testnet: true,
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public: { http: ['http://127.0.0.1:8545'] },
  },
};

const anvil2Chain: Chain = {
  id: 31338,
  name: 'Anvil2',
  testnet: true,
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8546'] },
    public: { http: ['http://127.0.0.1:8546'] },
  },
};

export const supportedEVMChains: ReadonlyArray<Chain> = [
  anvil1Chain,
  anvil2Chain,
];

export const defaultWagmiConfig = createConfig({
  chains: [anvil1Chain, anvil2Chain],
  transports: {
    [anvil1Chain.id]: http('http://127.0.0.1:8545'),
    [anvil2Chain.id]: http('http://127.0.0.1:8546'),
  },
});
