import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { defineChain } from '@reown/appkit/networks'

// WalletConnect projectId — get a free one at https://cloud.reown.com
// Using a placeholder; replace with your own for production use
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'PLACEHOLDER_PROJECT_ID'

// Define a default local chain so wagmi has at least one chain at init time.
// The actual chains come from the backend config at runtime.
const localChain = defineChain({
  id: 1234,
  caipNetworkId: 'eip155:1234',
  chainNamespace: 'eip155',
  name: 'Evolve Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
})

const networks = [localChain] as [typeof localChain]

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: 'OIF Solver',
    description: 'Cross-chain solver UI',
    url: 'http://localhost:5173',
    icons: [],
  },
  themeMode: 'dark',
})
