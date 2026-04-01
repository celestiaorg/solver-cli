import type { Chain } from 'viem';
import { createConfig, http } from 'wagmi';

import { CHAIN_CONFIG } from '@/lib/constants/tokens';

const chains: Chain[] = Object.values(CHAIN_CONFIG).map(c => ({
  id: c.chainId,
  name: c.name,
  testnet: true,
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [c.rpc] },
    public: { http: [c.rpc] },
  },
}));

export const supportedEVMChains: ReadonlyArray<Chain> = chains;

export const defaultWagmiConfig = createConfig({
  chains: chains as any,
  transports: Object.fromEntries(chains.map(c => [c.id, http(c.rpcUrls.default.http[0])])),
});
