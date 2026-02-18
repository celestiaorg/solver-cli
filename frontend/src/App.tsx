import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppKit } from '@reown/appkit/react'
import { useAccount, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useSignTypedData } from 'wagmi'
import { parseAbi } from 'viem'
import { api, Config, AllBalances, Quote, OrderStatus } from './api'

// ── Utility ──────────────────────────────────────────────────────────────────

function truncAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—'
}

function formatUSDC(val: string) {
  const n = parseFloat(val)
  if (isNaN(n)) return '0.00'
  return n.toFixed(2)
}

function formatETH(val: string) {
  const n = parseFloat(val)
  if (isNaN(n)) return '0.0000'
  return n.toFixed(4)
}

type Step = 'idle' | 'quoting' | 'quoted' | 'signing' | 'submitted' | 'polling' | 'done' | 'error'

/** Normalize status that may be a string or an object like {"failed": "reason"} */
function normalizeStatus(status: unknown): string {
  if (typeof status === 'string') return status
  if (status && typeof status === 'object') {
    const keys = Object.keys(status)
    if (keys.length > 0) return keys[0]
  }
  return 'unknown'
}

// ── Status Dot ───────────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
  )
}

// ── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin-slow" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="32" strokeDashoffset="12" opacity="0.6" />
    </svg>
  )
}

// ── Chain Badge ──────────────────────────────────────────────────────────────

const CHAIN_COLORS: Record<string, string> = {
  evolve: 'from-violet-500 to-purple-600',
  evolve2: 'from-cyan-500 to-blue-600',
  sepolia: 'from-amber-500 to-orange-600',
  arbitrum: 'from-sky-400 to-blue-500',
}

function ChainBadge({ name }: { name: string }) {
  const gradient = CHAIN_COLORS[name] || 'from-gray-500 to-gray-600'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold
      bg-gradient-to-r ${gradient} text-white`}>
      {name}
    </span>
  )
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // Wallet
  const { open } = useAppKit()
  const { address: connectedAddress, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { writeContractAsync } = useWriteContract()
  const { signTypedDataAsync } = useSignTypedData()

  // State
  const [config, setConfig] = useState<Config | null>(null)
  const [balances, setBalances] = useState<AllBalances | null>(null)
  const [health, setHealth] = useState({ backend: 'down', aggregator: 'down' })
  const [loading, setLoading] = useState(true)

  // Swap state
  const [fromChain, setFromChain] = useState('')
  const [toChain, setToChain] = useState('')
  const [amount, setAmount] = useState('1')
  const [asset] = useState('USDC')

  // Flow state
  const [step, setStep] = useState<Step>('idle')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [orderId, setOrderId] = useState('')
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null)
  const [error, setError] = useState('')

  // Faucet state
  const [faucetLoading, setFaucetLoading] = useState<string | null>(null)
  const [faucetMsg, setFaucetMsg] = useState('')

  // Polling ref
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  // ── Load config + health on mount ────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await api.config()
      setConfig(cfg)
      // Default chain selection
      const chainIds = Object.keys(cfg.chains)
      if (chainIds.length >= 2) {
        setFromChain(chainIds[0])
        setToChain(chainIds[1])
      }
    } catch (err) {
      console.error('Failed to load config:', err)
    }
  }, [])

  const loadBalances = useCallback(async () => {
    try {
      const bal = await api.balances(isConnected ? connectedAddress : undefined)
      setBalances(bal)
    } catch (err) {
      console.error('Failed to load balances:', err)
    }
  }, [isConnected, connectedAddress])

  const checkHealth = useCallback(async () => {
    try {
      const h = await api.health()
      setHealth(h)
    } catch {
      setHealth({ backend: 'down', aggregator: 'down' })
    }
  }, [])

  useEffect(() => {
    Promise.all([loadConfig(), loadBalances(), checkHealth()]).finally(() => setLoading(false))
    const interval = setInterval(() => {
      loadBalances()
      checkHealth()
    }, 8000)
    return () => clearInterval(interval)
  }, [loadConfig, loadBalances, checkHealth])

  // ── Quote flow ───────────────────────────────────────────────────────────

  const handleGetQuote = async () => {
    if (!fromChain || !toChain || !amount) return
    setStep('quoting')
    setError('')
    setQuote(null)
    setOrderId('')
    setOrderStatus(null)

    try {
      const fromId = config!.chains[fromChain].chainId
      const toId = config!.chains[toChain].chainId
      const rawAmount = Math.round(parseFloat(amount) * 1_000_000).toString() // USDC 6 decimals
      const resp = await api.quote(fromId, toId, rawAmount, asset, isConnected ? connectedAddress : undefined)
      if (!resp.quotes?.length) throw new Error('No quotes returned. Is the solver running?')
      setQuote(resp.quotes[0])
      setStep('quoted')
    } catch (err: any) {
      setError(err.message)
      setStep('error')
    }
  }

  const handleAcceptQuote = async () => {
    if (!quote) return
    setStep('signing')
    setError('')

    try {
      const fromId = config!.chains[fromChain].chainId

      if (isConnected && connectedAddress) {
        // MetaMask flow: approve + sign client-side
        const chainInfo = config!.chains[fromChain]
        const token = chainInfo.tokens['USDC']
        const inputSettler = chainInfo.contracts?.input_settler_escrow

        // Step 1: Approve token spending
        if (token && inputSettler) {
          await writeContractAsync({
            address: token.address as `0x${string}`,
            abi: parseAbi(['function approve(address, uint256) returns (bool)']),
            functionName: 'approve',
            args: [inputSettler as `0x${string}`, 100000000n],
            chainId: fromId,
          })
        }

        // Step 2: Sign EIP-712 typed data via MetaMask
        const payload = quote.order.payload as any
        const types = { ...payload.types }
        delete types.EIP712Domain

        const domain = { ...payload.domain }
        if (typeof domain.chainId === 'string') {
          domain.chainId = Number(domain.chainId)
        }

        const rawSignature = await signTypedDataAsync({
          domain,
          types,
          primaryType: payload.primaryType,
          message: payload.message,
        })

        // Step 3: Prepend ERC-3009 signature type byte (0x01)
        const signature = '0x01' + rawSignature.slice(2)

        // Step 4: Submit pre-signed order to backend → aggregator
        const resp = await api.submitSignedOrder(quote, signature)
        setOrderId(resp.orderId)
        setStep('polling')
        startPolling(resp.orderId)
      } else {
        // Backend signing flow (no MetaMask)
        const resp = await api.submitOrder(quote, fromId, asset)
        setOrderId(resp.orderId)
        setStep('polling')
        startPolling(resp.orderId)
      }
    } catch (err: any) {
      setError(err.message)
      setStep('error')
    }
  }

  const startPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.orderStatus(id)
        setOrderStatus(status)
        const normalized = normalizeStatus(status.status)
        if (normalized === 'finalized' || normalized === 'failed') {
          clearInterval(pollRef.current)
          setStep('done')
          loadBalances() // Refresh balances after completion
        }
      } catch {
        // Keep polling
      }
    }, 3000)
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // ── Faucet ───────────────────────────────────────────────────────────────

  const handleFaucet = async (chainName: string, type: 'gas' | 'usdc') => {
    const key = `${chainName}-${type}`
    setFaucetLoading(key)
    setFaucetMsg('')
    try {
      const resp = await api.faucet(chainName, type, isConnected ? connectedAddress : undefined)
      setFaucetMsg(`Sent ${resp.amount} on ${chainName}`)
      loadBalances()
    } catch (err: any) {
      setFaucetMsg(`Error: ${err.message}`)
    } finally {
      setFaucetLoading(null)
    }
  }

  // ── Swap chains ──────────────────────────────────────────────────────────

  const swapChains = () => {
    setFromChain(toChain)
    setToChain(fromChain)
    setStep('idle')
    setQuote(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Spinner size={24} />
          <span>Connecting to solver...</span>
        </div>
      </div>
    )
  }

  const chainEntries = config ? Object.entries(config.chains) : []

  // Parse output amount from quote preview
  let outputAmount = ''
  if (quote?.preview?.outputs?.[0]?.amount) {
    outputAmount = (parseInt(quote.preview.outputs[0].amount) / 1_000_000).toFixed(2)
  }

  const isServicesUp = health.backend === 'ok' && health.aggregator === 'ok'

  return (
    <div className="min-h-screen bg-surface-0">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-purple-400 flex items-center justify-center text-white font-bold text-sm">
              O
            </div>
            <h1 className="text-lg font-semibold text-white">OIF Solver</h1>
            <span className="text-xs text-gray-500 bg-surface-2 px-2 py-0.5 rounded-full">MVP</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <StatusDot ok={health.backend === 'ok'} />
              <span>Backend</span>
              <StatusDot ok={health.aggregator === 'ok'} />
              <span>Aggregator</span>
            </div>
            {isConnected ? (
              <div className="flex items-center gap-2">
                <div className="bg-surface-2 border border-brand/40 rounded-lg px-3 py-1.5 text-xs font-mono text-brand">
                  {truncAddr(connectedAddress!)}
                </div>
                <button
                  onClick={() => disconnect()}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => open()}
                className="bg-brand hover:bg-brand-light text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Swap Card (left, spans 2 cols) ─────────────────────── */}
          <div className="lg:col-span-2">
            <div className="bg-surface-1 border border-border rounded-2xl p-6 animate-pulse-glow">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
                Cross-Chain Transfer
              </h2>

              {/* From */}
              <div className="bg-surface-2 border border-border rounded-xl p-4 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-500 font-medium">From</label>
                  {balances && fromChain && balances[fromChain] && (
                    <span className="text-xs text-gray-500">
                      Balance: {formatUSDC(balances[fromChain].balances.user['USDC']?.formatted ?? '0')} {asset}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={fromChain}
                    onChange={e => { setFromChain(e.target.value); setStep('idle'); setQuote(null) }}
                    className="bg-surface-3 border border-border-light rounded-lg px-3 py-2 text-white text-sm
                      font-medium outline-none focus:border-brand transition-colors cursor-pointer min-w-[140px]"
                  >
                    {chainEntries.map(([id, c]) => (
                      <option key={id} value={id} disabled={id === toChain}>{c.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => { setAmount(e.target.value); setStep('idle'); setQuote(null) }}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="flex-1 bg-transparent text-2xl font-semibold text-white outline-none
                      text-right placeholder-gray-600"
                  />
                  <div className="flex items-center gap-1.5 bg-surface-3 border border-border-light
                    rounded-lg px-3 py-2 text-sm font-semibold text-white min-w-[80px] justify-center">
                    <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-bold">$</div>
                    {asset}
                  </div>
                </div>
              </div>

              {/* Swap button */}
              <div className="flex justify-center -my-1 relative z-10">
                <button
                  onClick={swapChains}
                  className="bg-surface-2 border border-border hover:border-brand rounded-xl p-2
                    transition-all hover:bg-surface-3 group"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                    className="text-gray-400 group-hover:text-brand transition-colors">
                    <path d="M4 6L8 2L12 6M4 10L8 14L12 10" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {/* To */}
              <div className="bg-surface-2 border border-border rounded-xl p-4 mt-2 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-500 font-medium">To</label>
                  {balances && toChain && balances[toChain] && (
                    <span className="text-xs text-gray-500">
                      Balance: {formatUSDC(balances[toChain].balances.user['USDC']?.formatted ?? '0')} {asset}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={toChain}
                    onChange={e => { setToChain(e.target.value); setStep('idle'); setQuote(null) }}
                    className="bg-surface-3 border border-border-light rounded-lg px-3 py-2 text-white text-sm
                      font-medium outline-none focus:border-brand transition-colors cursor-pointer min-w-[140px]"
                  >
                    {chainEntries.map(([id, c]) => (
                      <option key={id} value={id} disabled={id === fromChain}>{c.name}</option>
                    ))}
                  </select>
                  <div className="flex-1 text-2xl font-semibold text-right text-gray-500">
                    {step === 'quoting' ? (
                      <span className="flex items-center justify-end gap-2 text-gray-500 text-lg">
                        <Spinner /> Fetching...
                      </span>
                    ) : outputAmount ? (
                      <span className="text-white">{outputAmount}</span>
                    ) : (
                      '—'
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 bg-surface-3 border border-border-light
                    rounded-lg px-3 py-2 text-sm font-semibold text-white min-w-[80px] justify-center">
                    <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-bold">$</div>
                    {asset}
                  </div>
                </div>
              </div>

              {/* Quote details */}
              {quote && step !== 'idle' && (
                <div className="bg-surface-0 border border-border rounded-xl p-3 mb-4 text-xs text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Provider</span>
                    <span className="text-gray-300">{quote.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ETA</span>
                    <span className="text-gray-300">{quote.eta}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valid until</span>
                    <span className="text-gray-300">{new Date(quote.validUntil * 1000).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Type</span>
                    <span className="text-gray-300">{quote.order.type}</span>
                  </div>
                </div>
              )}

              {/* Order tracking */}
              {(step === 'polling' || step === 'done') && orderStatus && (() => {
                const status = normalizeStatus(orderStatus.status)
                return (
                <div className={`border rounded-xl p-3 mb-4 text-xs space-y-1 ${
                  status === 'finalized'
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : status === 'failed'
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-surface-0 border-border'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Order Status</span>
                    <span className={`font-semibold uppercase tracking-wider ${
                      status === 'finalized' ? 'text-emerald-400'
                      : status === 'failed' ? 'text-red-400'
                      : 'text-amber-400'
                    }`}>
                      {status === 'finalized' ? 'Completed' : status}
                      {step === 'polling' && status !== 'finalized' && status !== 'failed' && (
                        <Spinner size={12} />
                      )}
                    </span>
                  </div>
                  {orderId && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Order ID</span>
                      <span className="text-gray-300 font-mono">{truncAddr(orderId)}</span>
                    </div>
                  )}
                  {orderStatus.settlement?.fillTransaction && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Fill Tx</span>
                      <span className="text-gray-300 font-mono">
                        {truncAddr(orderStatus.settlement.fillTransaction.hash)}
                      </span>
                    </div>
                  )}
                  {orderStatus.settlement?.claimTransaction && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Claim Tx</span>
                      <span className="text-gray-300 font-mono">
                        {truncAddr(orderStatus.settlement.claimTransaction.hash)}
                      </span>
                    </div>
                  )}
                </div>
                )
              })()}

              {/* Error display */}
              {error && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 mb-4 text-xs text-red-400">
                  {error}
                </div>
              )}

              {/* Action button */}
              {step === 'idle' || step === 'error' ? (
                <button
                  onClick={handleGetQuote}
                  disabled={!isServicesUp || !fromChain || !toChain || !amount || fromChain === toChain}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all
                    bg-gradient-to-r from-brand to-purple-500 hover:from-brand-light hover:to-purple-400
                    text-white disabled:opacity-30 disabled:cursor-not-allowed
                    hover:shadow-lg hover:shadow-brand/20"
                >
                  {!isServicesUp ? 'Services Offline' : 'Get Quote'}
                </button>
              ) : step === 'quoting' ? (
                <button disabled className="w-full py-3.5 rounded-xl font-semibold text-sm bg-surface-3 text-gray-400
                  flex items-center justify-center gap-2">
                  <Spinner /> Getting quote...
                </button>
              ) : step === 'quoted' ? (
                <button
                  onClick={handleAcceptQuote}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all
                    bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400
                    text-white hover:shadow-lg hover:shadow-emerald-500/20"
                >
                  Accept & Send
                </button>
              ) : step === 'signing' ? (
                <button disabled className="w-full py-3.5 rounded-xl font-semibold text-sm bg-surface-3 text-gray-400
                  flex items-center justify-center gap-2">
                  <Spinner /> Signing & submitting...
                </button>
              ) : step === 'polling' ? (
                <button disabled className="w-full py-3.5 rounded-xl font-semibold text-sm bg-surface-3 text-amber-400/80
                  flex items-center justify-center gap-2">
                  <Spinner /> Waiting for settlement...
                </button>
              ) : step === 'done' ? (
                <button
                  onClick={() => { setStep('idle'); setQuote(null); setOrderStatus(null); setOrderId(''); setError('') }}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all
                    bg-gradient-to-r from-brand to-purple-500 hover:from-brand-light hover:to-purple-400
                    text-white"
                >
                  New Transfer
                </button>
              ) : null}
            </div>
          </div>

          {/* ── Right Sidebar ──────────────────────────────────────── */}
          <div className="space-y-6">

            {/* ── Balances ──────────────────────────────────────────── */}
            <div className="bg-surface-1 border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Balances</h2>
                <button onClick={loadBalances} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  Refresh
                </button>
              </div>

              {balances ? (
                <div className="space-y-4">
                  {Object.entries(balances).map(([chainId, cb]) => (
                    <div key={chainId}>
                      <div className="flex items-center gap-2 mb-2">
                        <ChainBadge name={cb.name} />
                        {config && <span className="text-[10px] text-gray-600 font-mono">#{config.chains[chainId]?.chainId}</span>}
                      </div>
                      <div className="space-y-1 ml-1">
                        {/* User balances */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">You</span>
                          <div className="flex gap-3">
                            <span className="text-gray-300 font-mono">
                              {formatUSDC(cb.balances.user['USDC']?.formatted ?? '0')}
                              <span className="text-gray-500 ml-1">USDC</span>
                            </span>
                            <span className="text-gray-300 font-mono">
                              {formatETH(cb.balances.user['ETH']?.formatted ?? '0')}
                              <span className="text-gray-500 ml-1">ETH</span>
                            </span>
                          </div>
                        </div>
                        {/* Solver balances */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Solver</span>
                          <div className="flex gap-3">
                            <span className="text-gray-300 font-mono">
                              {formatUSDC(cb.balances.solver['USDC']?.formatted ?? '0')}
                              <span className="text-gray-500 ml-1">USDC</span>
                            </span>
                            <span className="text-gray-300 font-mono">
                              {formatETH(cb.balances.solver['ETH']?.formatted ?? '0')}
                              <span className="text-gray-500 ml-1">ETH</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <Spinner size={12} /> Loading...
                </div>
              )}
            </div>

            {/* ── Faucet ───────────────────────────────────────────── */}
            <div className="bg-surface-1 border border-border rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Faucet
              </h2>
              <p className="text-xs text-gray-500 mb-1">
                Claim testnet gas and tokens for local chains.
              </p>
              <p className="text-xs mb-3">
                {isConnected ? (
                  <span className="text-brand">
                    Recipient: {truncAddr(connectedAddress!)}
                  </span>
                ) : (
                  <span className="text-gray-600">
                    Recipient: {config ? truncAddr(config.userAddress) : '—'} (default)
                  </span>
                )}
              </p>

              {config && chainEntries.map(([chainId, chain]) => {
                // Only show faucet for local chains (non-mainnet/testnet)
                if (!chain.rpc.includes('127.0.0.1') && !chain.rpc.includes('localhost')) return null
                return (
                  <div key={chainId} className="mb-3 last:mb-0">
                    <div className="flex items-center gap-2 mb-2">
                      <ChainBadge name={chain.name} />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleFaucet(chain.name, 'gas')}
                        disabled={faucetLoading !== null}
                        className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all
                          bg-surface-2 border border-border hover:border-brand text-gray-300 hover:text-white
                          disabled:opacity-50 disabled:cursor-not-allowed
                          flex items-center justify-center gap-1.5"
                      >
                        {faucetLoading === `${chain.name}-gas` ? <Spinner size={12} /> : null}
                        Claim 1 ETH
                      </button>
                      <button
                        onClick={() => handleFaucet(chain.name, 'usdc')}
                        disabled={faucetLoading !== null}
                        className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all
                          bg-surface-2 border border-border hover:border-brand text-gray-300 hover:text-white
                          disabled:opacity-50 disabled:cursor-not-allowed
                          flex items-center justify-center gap-1.5"
                      >
                        {faucetLoading === `${chain.name}-usdc` ? <Spinner size={12} /> : null}
                        Claim 10 USDC
                      </button>
                    </div>
                  </div>
                )
              })}

              {faucetMsg && (
                <div className={`mt-3 text-xs p-2 rounded-lg ${
                  faucetMsg.startsWith('Error')
                    ? 'bg-red-500/5 text-red-400 border border-red-500/10'
                    : 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/10'
                }`}>
                  {faucetMsg}
                </div>
              )}
            </div>

            {/* ── System Info ──────────────────────────────────────── */}
            <div className="bg-surface-1 border border-border rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                System
              </h2>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">User</span>
                  <span className="text-gray-300 font-mono">{config ? truncAddr(config.userAddress) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Solver</span>
                  <span className="text-gray-300 font-mono">{config?.solverAddress ? truncAddr(config.solverAddress) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Chains</span>
                  <span className="text-gray-300">{chainEntries.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Aggregator</span>
                  <span className={health.aggregator === 'ok' ? 'text-emerald-400' : 'text-red-400'}>
                    {health.aggregator}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-border px-6 py-4 mt-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-gray-600">
          <span>OIF Solver MVP</span>
          <span>Powered by Open Intents Framework</span>
        </div>
      </footer>
    </div>
  )
}
