import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { defineChain, type AppKitNetwork } from '@reown/appkit/networks'

// WalletConnect projectId — get a free one at https://cloud.reown.com
// Using a placeholder; replace with your own for production use
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'PLACEHOLDER_PROJECT_ID'

// Fallback chain used only if backend config fetch fails
const fallbackChain = defineChain({
  id: 1234,
  caipNetworkId: 'eip155:1234',
  chainNamespace: 'eip155',
  name: 'Evolve Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
})

export let wagmiAdapter: WagmiAdapter
export let wagmiConfig: WagmiAdapter['wagmiConfig']

/**
 * Fetch chain configs from the backend and initialise AppKit + wagmi.
 * Must be called (and awaited) before React renders.
 */
export async function initWallet() {
  let networks: [AppKitNetwork, ...AppKitNetwork[]] = [fallbackChain]

  try {
    const res = await fetch('/api/config')
    if (res.ok) {
      const cfg = await res.json()
      const chains: AppKitNetwork[] = Object.values(cfg.chains).map((c: any) =>
        defineChain({
          id: c.chainId,
          caipNetworkId: `eip155:${c.chainId}`,
          chainNamespace: 'eip155',
          name: c.name,
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: { default: { http: [c.rpc] } },
        }),
      )
      if (chains.length > 0) {
        networks = chains as [AppKitNetwork, ...AppKitNetwork[]]
      }
    }
  } catch {
    // Backend not reachable yet — use fallback chain
  }

  wagmiAdapter = new WagmiAdapter({
    projectId,
    networks,
  })

  wagmiConfig = wagmiAdapter.wagmiConfig

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
}
