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
  contracts: Record<string, string>
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
  orderId: string
  status: 'created' | 'pending' | 'executing' | 'executed' | 'settling' | 'settled' | 'finalized' | 'failed' | 'refunded' | string
  createdAt: string
  updatedAt: string
  fillTransaction?: { hash: string; chainId: number } | Record<string, unknown>
  settlement?: {
    settlementType?: string
    sourceChainId?: string
    destinationChainId?: string
    recipient?: string
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

  quote: (fromChainId: number, toChainId: number, amount: string, asset: string, address?: string) =>
    json<QuoteResponse>(`${BASE}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromChainId, toChainId, amount, asset, ...(address ? { address } : {}) }),
    }),

  submitOrder: (quote: Quote, fromChainId: number, asset: string, address?: string) =>
    json<OrderResponse>(`${BASE}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quote, fromChainId, asset, ...(address ? { address } : {}) }),
    }),

  submitSignedOrder: (quote: Quote, signature: string) =>
    json<OrderResponse>(`${BASE}/order/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quote, signature }),
    }),

  orderStatus: (id: string) => json<OrderStatus>(`${BASE}/order/${id}`),

  bridgePrepare: (from: string, to: string, token: string, address: string, amount: string) =>
    json<{
      warpToken: string
      underlyingToken: string | null
      celestiaDomainId: number
      forwardingAddressBytes32: string
      needsApproval: boolean
    }>(`${BASE}/bridge/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, token, address, amount }),
    }),

  bridge: (from: string, to: string, amount: string, token?: string) =>
    json<{ success: boolean; message: string; txHash?: string }>(`${BASE}/bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, amount, ...(token ? { token } : {}) }),
    }),
}
