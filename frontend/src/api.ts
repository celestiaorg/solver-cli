// ── Types ────────────────────────────────────────────────────────────────────

export interface TokenInfo {
  address: string
  symbol: string
  decimals: number
}

export interface ChainInfo {
  name: string
  chainId: number
  rpc: string
  tokens: Record<string, TokenInfo>
}

export interface Config {
  chains: Record<string, ChainInfo>
  userAddress: string
  solverAddress: string
}

export interface BalanceEntry {
  raw: string
  formatted: string
}

export interface ChainBalances {
  name: string
  balances: {
    user: Record<string, BalanceEntry>
    solver: Record<string, BalanceEntry>
  }
}

export type AllBalances = Record<string, ChainBalances>

export interface QuotePreview {
  inputs: Array<{ asset: string; amount: string }>
  outputs: Array<{ asset: string; amount: string }>
}

export interface Quote {
  quoteId: string
  order: {
    type: string
    payload: unknown
  }
  validUntil: number
  eta: number
  provider: string
  partialFill: boolean
  preview: QuotePreview
}

export interface QuoteResponse {
  quotes: Quote[]
  total_quotes: number
  metadata: {
    total_duration_ms: number
    solvers_queried: number
    solvers_responded_success: number
  }
}

export interface OrderResponse {
  orderId: string
  status: string
  message: string
}

export interface OrderStatus {
  id: string
  status: 'pending' | 'accepted' | 'finalized' | 'failed'
  createdAt: number
  updatedAt: number
  settlement?: {
    status: string
    fillTransaction?: { hash: string; chainId: number }
    claimTransaction?: { hash: string; chainId: number }
  }
}

export interface HealthStatus {
  backend: string
  aggregator: string
}

// ── API Calls ────────────────────────────────────────────────────────────────

const BASE = '/api'

async function json<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`)
  return data as T
}

export const api = {
  health: () => json<HealthStatus>(`${BASE}/health`),

  config: () => json<Config>(`${BASE}/config`),

  balances: (address?: string) =>
    json<AllBalances>(`${BASE}/balances${address ? `?address=${address}` : ''}`),

  quote: (fromChainId: number, toChainId: number, amount: string, asset = 'USDC') =>
    json<QuoteResponse>(`${BASE}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromChainId, toChainId, amount, asset }),
    }),

  submitOrder: (quote: Quote, fromChainId: number, asset = 'USDC') =>
    json<OrderResponse>(`${BASE}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quote, fromChainId, asset }),
    }),

  orderStatus: (id: string) => json<OrderStatus>(`${BASE}/order/${id}`),

  faucet: (chainName: string, type: 'gas' | 'usdc', address?: string) =>
    json<{ success: boolean; hash: string; amount: string }>(`${BASE}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainName, type, ...(address ? { address } : {}) }),
    }),
}
