import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { initWallet, wagmiConfig } from './wallet'
import './index.css'
import App from './App'

const queryClient = new QueryClient()

// Fetch chain configs from backend before initialising wagmi / AppKit,
// so that MetaMask sees the correct anvil chains from the start.
initWallet().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <App />
        </WagmiProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
})
