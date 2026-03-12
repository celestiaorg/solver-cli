import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppKit, AppKitNetworkButton } from '@reown/appkit/react'
import { useAccount, useDisconnect, useWriteContract, useSignTypedData, useSwitchChain } from 'wagmi'
import { parseAbi } from 'viem'
import { api, Config, AllBalances, Quote, OrderStatus } from './api'

// ── Utilities ─────────────────────────────────────────────────────────────────

function truncAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—'
}

function formatToken(val: string, decimals?: number) {
  const n = parseFloat(val)
  if (isNaN(n)) return '0.00'
  return decimals !== undefined && decimals > 6 ? n.toFixed(4) : n.toFixed(2)
}

function formatETH(val: string) {
  const n = parseFloat(val)
  if (isNaN(n)) return '0.0000'
  return n.toFixed(4)
}

type Step = 'idle' | 'quoting' | 'quoted' | 'signing' | 'submitted' | 'polling' | 'done' | 'error'

function normalizeStatus(status: unknown): string {
  if (typeof status === 'string') return status
  if (status && typeof status === 'object') {
    const keys = Object.keys(status)
    if (keys.length > 0) return keys[0]
  }
  return 'unknown'
}

// ── Primitives ────────────────────────────────────────────────────────────────

function fallbackCopy(text: string) {
  const el = document.createElement('textarea')
  el.value = text
  el.style.position = 'fixed'
  el.style.opacity = '0'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

function CopyableAddress({ address, className }: { address: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500) }
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(address).then(done).catch(() => { fallbackCopy(address); done() })
      } else {
        fallbackCopy(address); done()
      }
    } catch { fallbackCopy(address); done() }
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className={className ?? 'font-mono text-gray-400 text-[11px]'}>{truncAddr(address)}</span>
      <button onClick={handleCopy} title={address} className="text-gray-700 hover:text-gray-400 transition-colors shrink-0">
        {copied
          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        }
      </button>
    </span>
  )
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin-slow shrink-0" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray="40" strokeDashoffset="14" opacity="0.5" />
    </svg>
  )
}

const CHAIN_GRADIENTS: Record<string, string> = {
  anvil1:   'from-violet-500 to-purple-600',
  anvil2:   'from-cyan-400 to-blue-500',
  sepolia:  'from-amber-400 to-orange-500',
  arbitrum: 'from-sky-400 to-blue-500',
}

function ChainBadge({ name }: { name: string }) {
  const g = CHAIN_GRADIENTS[name] || 'from-slate-500 to-slate-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-gradient-to-r ${g} text-white tracking-wide uppercase`}>
      {name}
    </span>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { open, close } = useAppKit()
  const { address: connectedAddress, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { writeContractAsync } = useWriteContract()
  const { signTypedDataAsync } = useSignTypedData()
  const { switchChainAsync } = useSwitchChain()

  const [config, setConfig]     = useState<Config | null>(null)
  const [balances, setBalances] = useState<AllBalances | null>(null)
  const [health, setHealth]     = useState({ backend: 'down', aggregator: 'down' })
  const [loading, setLoading]   = useState(true)

  const [fromChain, setFromChain] = useState('')
  const [toChain, setToChain]     = useState('')
  const [amount, setAmount]       = useState('1')
  const [asset, setAsset]         = useState('')

  const [routeType, setRouteType]     = useState<'fast' | 'slow'>('fast')

  const [step, setStep]               = useState<Step>('idle')
  const [quote, setQuote]             = useState<Quote | null>(null)
  const [orderId, setOrderId]         = useState('')
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null)
  const [error, setError]             = useState('')

  const [slowLoading, setSlowLoading] = useState(false)
  const [slowMsg, setSlowMsg]         = useState('')

  const [rightTab, setRightTab]                 = useState<'balances' | 'tools'>('balances')

  const pollRef = useRef<ReturnType<typeof setInterval>>()

  const availableTokens = (() => {
    if (!config || !fromChain || !toChain) return [] as string[]
    const from = Object.keys(config.chains[fromChain]?.tokens ?? {})
    const to   = new Set(Object.keys(config.chains[toChain]?.tokens ?? {}))
    return from.filter(s => to.has(s))
  })()

  useEffect(() => {
    if (availableTokens.length > 0 && !availableTokens.includes(asset))
      setAsset(availableTokens[0])
  }, [fromChain, toChain, availableTokens, asset])

  const selectedTokenDecimals = config && fromChain && asset
    ? config.chains[fromChain]?.tokens?.[asset]?.decimals ?? 6 : 6

  // ── Data ──────────────────────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await api.config()
      setConfig(cfg)
      const ids    = Object.keys(cfg.chains)
      const a1     = ids.find(id => cfg.chains[id].name === 'anvil1')
      const a2     = ids.find(id => cfg.chains[id].name === 'anvil2')
      if (a1 && a2) { setFromChain(a1); setToChain(a2) }
      else if (ids.length >= 2) { setFromChain(ids[0]); setToChain(ids[1]) }
    } catch {}
  }, [])

  const loadBalances = useCallback(async () => {
    try {
      const addr = isConnected && connectedAddress ? connectedAddress : undefined
      setBalances(await api.balances(addr))
    } catch {}
  }, [isConnected, connectedAddress])

  const checkHealth = useCallback(async () => {
    try { setHealth(await api.health()) }
    catch { setHealth({ backend: 'down', aggregator: 'down' }) }
  }, [])

  useEffect(() => { if (isConnected) close() }, [isConnected, close])

  useEffect(() => {
    Promise.all([loadConfig(), loadBalances(), checkHealth()]).finally(() => setLoading(false))
    const iv = setInterval(() => { loadBalances(); checkHealth() }, 8000)
    return () => clearInterval(iv)
  }, [loadConfig, loadBalances, checkHealth])

  // ── Quote ─────────────────────────────────────────────────────────────────

  const handleGetQuote = async () => {
    if (!fromChain || !toChain || !amount) return
    setStep('quoting'); setError(''); setQuote(null); setOrderId(''); setOrderStatus(null)
    try {
      const fromId = config!.chains[fromChain].chainId
      const toId   = config!.chains[toChain].chainId
      const raw    = Math.round(parseFloat(amount) * 10 ** selectedTokenDecimals).toString()
      const resp   = await api.quote(fromId, toId, raw, asset,
        isConnected && connectedAddress ? connectedAddress : undefined)
      if (!resp.quotes?.length) {
        const meta = (resp as any).metadata
        const allFailed = meta && meta.solvers_queried > 0 && meta.solvers_responded_success === 0
        throw new Error(allFailed
          ? 'SOLVER_REJECTED: No solver could fill this transfer — the amount is likely too small to cover gas and bridging fees. Try a larger amount.'
          : 'No quotes returned. Is the solver running? (make solver)')
      }
      setQuote(resp.quotes[0]); setStep('quoted')
    } catch (err: any) { setError(err.message); setStep('error') }
  }

  const handleAcceptQuote = async () => {
    if (!quote) return
    setStep('signing'); setError('')
    try {
      const fromId    = config!.chains[fromChain].chainId
      if (isConnected && connectedAddress) {
        const chainInfo = config!.chains[fromChain]
        const token     = chainInfo.tokens[asset]
        await switchChainAsync({ chainId: fromId })
        const payload   = quote.order.payload as any
        const isPermit2 = payload.primaryType?.includes('Permit')
        const spender   = isPermit2
          ? (payload.domain?.verifyingContract as `0x${string}`)
          : (chainInfo.contracts?.input_settler_escrow as `0x${string}`)
        if (token && spender) {
          await writeContractAsync({
            address: token.address as `0x${string}`,
            abi: parseAbi(['function approve(address, uint256) returns (bool)']),
            functionName: 'approve', args: [spender, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')], chainId: fromId,
          })
        }
        const types = { ...payload.types }
        delete types.EIP712Domain
        const domain = { ...payload.domain }
        if (typeof domain.chainId === 'string') domain.chainId = Number(domain.chainId)
        const rawSig = await signTypedDataAsync({ domain, types, primaryType: payload.primaryType, message: payload.message })
        const sig    = (isPermit2 ? '0x00' : '0x01') + rawSig.slice(2)
        const resp   = await api.submitSignedOrder(quote, sig)
        setOrderId(resp.orderId); setStep('polling'); startPolling(resp.orderId)
      } else {
        const resp = await api.submitOrder(quote, config!.chains[fromChain].chainId, asset)
        setOrderId(resp.orderId); setStep('polling'); startPolling(resp.orderId)
      }
    } catch (err: any) { setError(err.message); setStep('error') }
  }

  const startPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const s = await api.orderStatus(id)
        setOrderStatus(s)
        loadBalances()
        const n = normalizeStatus(s.status)
        if (n === 'finalized' || n === 'failed' || s.settlement?.fillTransaction) {
          clearInterval(pollRef.current); setStep('done')
        }
      } catch {}
    }, 1000)
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])



  const resetFlowState = () => {
    setStep('idle'); setQuote(null); setOrderId(''); setOrderStatus(null); setError(''); setSlowMsg('')
  }

  // ── Slow route (Celestia bridge, user → user) ─────────────────────────────

  const handleSlowBridge = async () => {
    if (!fromChain || !toChain || !amount) return
    setSlowLoading(true); setSlowMsg('')
    try {
      const fromName  = config!.chains[fromChain].name
      const toName    = config!.chains[toChain].name
      const fromId    = config!.chains[fromChain].chainId
      const rawAmount = Math.round(parseFloat(amount) * 10 ** selectedTokenDecimals).toString()

      if (isConnected && connectedAddress) {
        // Wallet-connected: server prepares the forwarding, wallet executes the txs
        setSlowMsg('Preparing Celestia route…')
        const prep = await api.bridgePrepare(fromName, toName, asset, connectedAddress, rawAmount)

        await switchChainAsync({ chainId: fromId })

        if (prep.needsApproval && prep.underlyingToken) {
          setSlowMsg('Approving token…')
          await writeContractAsync({
            address: prep.underlyingToken as `0x${string}`,
            abi: parseAbi(['function approve(address, uint256) returns (bool)']),
            functionName: 'approve',
            args: [prep.warpToken as `0x${string}`, BigInt(rawAmount)],
            chainId: fromId,
          })
        }

        setSlowMsg('Submitting bridge transaction…')
        const txHash = await writeContractAsync({
          address: prep.warpToken as `0x${string}`,
          abi: parseAbi(['function transferRemote(uint32, bytes32, uint256) payable returns (bytes32)']),
          functionName: 'transferRemote',
          args: [prep.celestiaDomainId, prep.forwardingAddressBytes32 as `0x${string}`, BigInt(rawAmount)],
          chainId: fromId,
          value: 0n,
        })

        setSlowMsg(`Submitted (${txHash.slice(0, 10)}…). Tokens arrive in ~2 min via Celestia.`)
        loadBalances()
      } else {
        // No wallet: server executes using USER_PK
        const resp = await api.bridge(fromName, toName, rawAmount, asset)
        setSlowMsg(resp.message)
        loadBalances()
      }
    } catch (err: any) {
      setSlowMsg(`Error: ${err.message}`)
    } finally {
      setSlowLoading(false)
    }
  }

  const swapChains = () => {
    setFromChain(toChain); setToChain(fromChain); resetFlowState()
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand to-purple-400 flex items-center justify-center shadow-brand">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white"/>
            </svg>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Spinner size={13} /> Connecting to solver…
          </div>
        </div>
      </div>
    )
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const chainEntries = config
    ? Object.entries(config.chains).sort((a, b) => a[1].name.localeCompare(b[1].name))
    : []

  let outputAmount = ''
  if (quote?.preview?.outputs?.[0]?.amount) {
    outputAmount = (parseInt(quote.preview.outputs[0].amount) / 10 ** selectedTokenDecimals).toFixed(2)
  }

  const isServicesUp   = health.backend === 'ok' && health.aggregator === 'ok'
  const isSolverWallet = isConnected && connectedAddress && config?.solverAddress
    && connectedAddress.toLowerCase() === config.solverAddress.toLowerCase()

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative z-50 shrink-0 bg-surface-0/80 backdrop-blur-xl"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto px-8 h-[58px] flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center"
              style={{ boxShadow: '0 0 12px rgba(124,58,237,0.4)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-semibold text-white tracking-tight">OIF</span>
              <span className="text-[11px] text-gray-600 font-medium">Solver</span>
            </div>
          </div>

          {/* Wallet */}
          {isConnected ? (
            <div className="flex items-center gap-1.5">
              <AppKitNetworkButton />
              <div className="flex items-center gap-1.5 bg-surface-2/80 border border-white/[0.06] rounded-lg px-2.5 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" style={{ boxShadow: '0 0 4px rgba(52,211,153,0.6)' }} />
                <CopyableAddress address={connectedAddress!} className="text-[11px] font-mono text-gray-300" />
              </div>
              <button
                onClick={() => disconnect()}
                className="w-6 h-6 flex items-center justify-center rounded-md text-gray-700 hover:text-gray-400 hover:bg-surface-2 transition-colors"
                title="Disconnect"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => open()}
              className="flex items-center gap-1.5 text-white text-[11px] font-semibold px-3.5 py-1.5 rounded-lg transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 0 12px rgba(124,58,237,0.3)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" fill="currentColor"/>
                <path d="M2 10h20" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-stretch">

          {/* ══ Swap Card ════════════════════════════════════════════════════ */}
          <div className="bg-surface-1 border border-border rounded-2xl shadow-card animate-pulse-glow"
            style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)' }}>

            {/* Card top bar */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/50">
              <div>
                <h2 className="text-base font-bold text-white">Transfer</h2>
                <p className="text-[11px] text-gray-600 mt-0.5">Cross-chain via intent protocol</p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                <span className={`w-1.5 h-1.5 rounded-full ${isServicesUp ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {isServicesUp ? 'Ready' : 'Offline'}
              </div>
            </div>

            <div className="p-6 space-y-2">

              {/* Route toggle */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-surface-0/70 rounded-xl border border-border/60 mb-4">
                {(['fast', 'slow'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => { setRouteType(r); resetFlowState() }}
                    className={`flex flex-col items-center gap-0.5 py-2.5 rounded-[10px] transition-all duration-150 ${
                      routeType === r
                        ? 'bg-surface-3 border border-border-light'
                        : 'hover:bg-surface-2/40'
                    }`}
                  >
                    <span className={`text-xs font-bold flex items-center gap-1.5 ${routeType === r ? 'text-white' : 'text-gray-600'}`}>
                      {r === 'fast'
                        ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Fast</>
                        : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 12c1.5-3 3.5-3 5 0s3.5 3 5 0 3.5-3 5 0"/></svg> Slow</>
                      }
                    </span>
                    <span className={`text-[10px] font-normal ${routeType === r ? 'text-gray-500' : 'text-gray-700'}`}>
                      {r === 'fast' ? 'Instant · Solver' : '~2 min · Celestia'}
                    </span>
                  </button>
                ))}
              </div>

              {/* Solver wallet warning (fast route only) */}
              {isSolverWallet && routeType === 'fast' && (
                <div className="flex items-start gap-2.5 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl px-4 py-3 animate-fade-in">
                  <svg className="shrink-0 mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                      stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="12" y1="9" x2="12" y2="13" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="12" y1="17" x2="12.01" y2="17" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <p className="text-xs text-amber-400 leading-relaxed">
                    Connected as the solver wallet — switch to a user wallet to submit orders.
                  </p>
                </div>
              )}

              {/* You Send */}
              <div className="bg-surface-2 border border-border rounded-xl p-4 hover:border-border-light transition-colors group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">You send</span>
                  {balances && fromChain && balances[fromChain] && asset && (
                    <button
                      onClick={() => {
                        const b = balances[fromChain]?.balances?.user?.[asset]?.formatted ?? '0'
                        if (parseFloat(b) > 0) { setAmount(parseFloat(b).toFixed(2)); setStep('idle'); setQuote(null) }
                      }}
                      className="text-[11px] text-gray-600 hover:text-brand-light transition-colors tabular-nums"
                    >
                      {formatToken(balances[fromChain].balances.user[asset]?.formatted ?? '0')} {asset}
                      <span className="ml-1.5 text-brand-light font-bold">MAX</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={fromChain}
                    onChange={e => { setFromChain(e.target.value); setStep('idle'); setQuote(null) }}
                    className="bg-surface-3 border border-border-light rounded-xl px-3 py-2.5 text-white text-sm
                      font-semibold outline-none cursor-pointer min-w-[130px] transition-colors"
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
                    className="flex-1 bg-transparent text-[30px] font-bold text-white outline-none text-right
                      placeholder:text-surface-4 min-w-0 tabular-nums"
                  />
                  <select
                    value={asset}
                    onChange={e => { setAsset(e.target.value); setStep('idle'); setQuote(null) }}
                    className="bg-surface-3 border border-border-light rounded-xl px-3 py-2.5 text-sm
                      font-bold text-white outline-none cursor-pointer min-w-[84px] transition-colors"
                  >
                    {availableTokens.map(sym => <option key={sym} value={sym}>{sym}</option>)}
                  </select>
                </div>
              </div>

              {/* Swap arrow */}
              <div className="flex justify-center py-1 relative z-10">
                <button
                  onClick={swapChains}
                  className="w-9 h-9 rounded-xl bg-surface-2 border border-border hover:border-brand/50
                    hover:bg-surface-3 flex items-center justify-center transition-all duration-300
                    hover:rotate-180 group"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
                    className="text-gray-500 group-hover:text-brand-light transition-colors">
                    <path d="M4 6L8 2L12 6M4 10L8 14L12 10" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* You Receive */}
              <div className="bg-surface-2/60 border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">You receive</span>
                  {balances && toChain && balances[toChain] && asset && (
                    <span className="text-[11px] text-gray-600 tabular-nums">
                      {formatToken(balances[toChain].balances.user[asset]?.formatted ?? '0')} {asset}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={toChain}
                    onChange={e => { setToChain(e.target.value); setStep('idle'); setQuote(null) }}
                    className="bg-surface-3 border border-border-light rounded-xl px-3 py-2.5 text-white text-sm
                      font-semibold outline-none cursor-pointer min-w-[130px] transition-colors"
                  >
                    {chainEntries.map(([id, c]) => (
                      <option key={id} value={id} disabled={id === fromChain}>{c.name}</option>
                    ))}
                  </select>
                  <div className="flex-1 text-right min-w-0">
                    {routeType === 'slow' ? (
                      amount && parseFloat(amount) > 0
                        ? <span className="text-[30px] font-bold text-gray-400 tabular-nums">≈ {parseFloat(amount).toFixed(2)}</span>
                        : <span className="text-[30px] font-bold text-surface-4">—</span>
                    ) : step === 'quoting' ? (
                      <span className="flex items-center justify-end gap-2 text-gray-500 text-sm">
                        <Spinner size={14} /> Fetching…
                      </span>
                    ) : outputAmount ? (
                      <span className="text-[30px] font-bold text-white tabular-nums animate-fade-in">{outputAmount}</span>
                    ) : (
                      <span className="text-[30px] font-bold text-surface-4">—</span>
                    )}
                  </div>
                  <div className="bg-surface-3 border border-border-light rounded-xl px-3 py-2.5 text-sm
                    font-bold text-white min-w-[84px] text-center">
                    {asset || '—'}
                  </div>
                </div>
              </div>

              {/* Quote meta (fast route only) */}
              {routeType === 'fast' && quote && step !== 'idle' && step !== 'error' && (
                <div className="grid grid-cols-4 gap-2 animate-fade-in">
                  {[
                    { label: 'Provider', value: quote.provider },
                    { label: 'ETA',      value: `${quote.eta}s` },
                    { label: 'Valid',    value: new Date(quote.validUntil * 1000).toLocaleTimeString() },
                    { label: 'Type',     value: quote.order.type },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface-0/70 rounded-xl px-3 py-2 border border-border/40">
                      <div className="text-[9px] text-gray-700 mb-0.5 font-semibold uppercase tracking-wider">{label}</div>
                      <div className="text-[11px] text-gray-400 font-medium truncate">{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Order status (fast route only) */}
              {routeType === 'fast' && (step === 'polling' || step === 'done') && orderStatus && (() => {
                const status = normalizeStatus(orderStatus.status)
                const ok     = status === 'finalized'
                const fail   = status === 'failed'
                return (
                  <div className={`rounded-xl p-4 border animate-fade-in ${
                    ok   ? 'bg-emerald-500/[0.06] border-emerald-500/20'
                    : fail ? 'bg-red-500/[0.06] border-red-500/20'
                    : 'bg-surface-0/60 border-border/60'
                  }`}>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs text-gray-500 font-medium">Settlement</span>
                      <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${
                        ok ? 'text-emerald-400' : fail ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {step === 'polling' && !ok && !fail && <Spinner size={10} />}
                        {ok ? '✓ Complete' : status}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {orderId && (
                        <div className="flex justify-between">
                          <span className="text-[11px] text-gray-600">Order</span>
                          <CopyableAddress address={orderId} />
                        </div>
                      )}
                      {orderStatus.settlement?.fillTransaction && (
                        <div className="flex justify-between">
                          <span className="text-[11px] text-gray-600">Fill tx</span>
                          <CopyableAddress address={orderStatus.settlement.fillTransaction.hash} />
                        </div>
                      )}
                      {orderStatus.settlement?.claimTransaction && (
                        <div className="flex justify-between">
                          <span className="text-[11px] text-gray-600">Claim tx</span>
                          <CopyableAddress address={orderStatus.settlement.claimTransaction.hash} className="font-mono text-emerald-400 text-[11px]" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Error */}
              {error && (() => {
                const isSolverRejected = error.startsWith('SOLVER_REJECTED:')
                const isSolverOffline  = error.startsWith('SOLVER_OFFLINE:')
                const displayMsg = error.replace(/^SOLVER_(REJECTED|OFFLINE):\s*/, '')
                return (
                  <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 animate-fade-in border ${
                    isSolverRejected
                      ? 'bg-amber-500/[0.06] border-amber-500/20'
                      : 'bg-red-500/[0.06] border-red-500/20'
                  }`}>
                    <svg className="shrink-0 mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke={isSolverRejected ? '#f59e0b' : '#f87171'} strokeWidth="2"/>
                      <path d="M12 8v4m0 4h.01" stroke={isSolverRejected ? '#f59e0b' : '#f87171'} strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <div className="flex flex-col gap-1">
                      <p className={`text-xs leading-relaxed ${isSolverRejected ? 'text-amber-400' : 'text-red-400'}`}>
                        {displayMsg}
                      </p>
                      {isSolverRejected && (
                        <p className="text-[11px] text-amber-500/70">
                          Tip: increase the amount or check that the solver has sufficient inventory.
                        </p>
                      )}
                      {isSolverOffline && (
                        <p className="text-[11px] text-red-500/70">
                          Run <code className="font-mono bg-surface-3 px-1 rounded">make solver</code> to start the solver.
                        </p>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* CTA */}
              {routeType === 'fast' ? (
                // ── Fast route: quote → sign → settle ──────────────────────
                step === 'idle' || step === 'error' ? (
                  <button
                    onClick={handleGetQuote}
                    disabled={!isServicesUp || !fromChain || !toChain || !amount || fromChain === toChain || !!isSolverWallet}
                    className="w-full py-4 rounded-xl font-bold text-[15px] transition-all duration-200
                      bg-gradient-to-r from-brand to-purple-500 hover:from-brand-light hover:to-purple-400
                      text-white disabled:opacity-20 disabled:cursor-not-allowed
                      hover:shadow-brand active:scale-[0.99]"
                  >
                    {!isServicesUp ? 'Services Offline' : isSolverWallet ? 'Switch to a User Wallet' : 'Get Quote'}
                  </button>
                ) : step === 'quoting' ? (
                  <button disabled className="w-full py-4 rounded-xl font-bold text-sm bg-surface-3 text-gray-500
                    flex items-center justify-center gap-2.5 cursor-not-allowed">
                    <Spinner size={16} /> Getting quote…
                  </button>
                ) : step === 'quoted' ? (
                  <button onClick={handleAcceptQuote}
                    className="w-full py-4 rounded-xl font-bold text-[15px] transition-all duration-200
                      bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400
                      text-white hover:shadow-[0_0_24px_rgba(16,185,129,0.28)] active:scale-[0.99]">
                    Accept & Send →
                  </button>
                ) : step === 'signing' ? (
                  <button disabled className="w-full py-4 rounded-xl font-bold text-sm bg-surface-3 text-gray-500
                    flex items-center justify-center gap-2.5 cursor-not-allowed">
                    <Spinner size={16} /> Signing & submitting…
                  </button>
                ) : step === 'polling' ? (
                  <button disabled className="w-full py-4 rounded-xl font-bold text-sm bg-surface-3 text-amber-400/70
                    flex items-center justify-center gap-2.5 cursor-not-allowed">
                    <Spinner size={16} /> Awaiting settlement…
                  </button>
                ) : step === 'done' ? (
                  <button
                    onClick={resetFlowState}
                    className="w-full py-4 rounded-xl font-bold text-[15px] transition-all duration-200
                      bg-gradient-to-r from-brand to-purple-500 hover:from-brand-light hover:to-purple-400
                      text-white hover:shadow-brand active:scale-[0.99]">
                    New Transfer
                  </button>
                ) : null
              ) : (
                // ── Slow route: direct Celestia bridge ─────────────────────
                <>
                  {slowMsg && (
                    <div className={`text-[11px] px-3 py-2.5 rounded-xl animate-fade-in border ${
                      slowMsg.startsWith('Error')
                        ? 'bg-red-500/[0.06] text-red-400 border-red-500/15'
                        : 'bg-emerald-500/[0.06] text-emerald-400 border-emerald-500/15'
                    }`}>{slowMsg}</div>
                  )}
                  {slowMsg && !slowMsg.startsWith('Error') ? (
                    <button
                      onClick={resetFlowState}
                      className="w-full py-4 rounded-xl font-bold text-[15px] transition-all duration-200
                        bg-gradient-to-r from-brand to-purple-500 hover:from-brand-light hover:to-purple-400
                        text-white hover:shadow-brand active:scale-[0.99]">
                      New Transfer
                    </button>
                  ) : (
                    <button
                      onClick={handleSlowBridge}
                      disabled={slowLoading || !fromChain || !toChain || !amount || fromChain === toChain}
                      className="w-full py-4 rounded-xl font-bold text-[15px] transition-all duration-200
                        bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500
                        text-white disabled:opacity-20 disabled:cursor-not-allowed
                        hover:shadow-[0_0_24px_rgba(14,165,233,0.28)] active:scale-[0.99]"
                    >
                      {slowLoading
                        ? <span className="flex items-center justify-center gap-2.5"><Spinner size={16} /> Bridging…</span>
                        : 'Bridge via Celestia'
                      }
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ══ Right Panel ══════════════════════════════════════════════════ */}
          <div className="bg-surface-1 border border-border rounded-2xl shadow-card overflow-hidden flex flex-col"
            style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)' }}>

            {/* Tabs */}
            <div className="flex border-b border-border/60 px-1 pt-1 gap-0.5 shrink-0">
              {(['balances', 'tools'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className={`flex-1 py-2.5 text-[11px] font-semibold rounded-t-lg transition-all capitalize ${
                    rightTab === tab
                      ? 'text-white bg-surface-2/60 border-b-2 border-brand'
                      : 'text-gray-600 hover:text-gray-400'
                  }`}
                >{tab}</button>
              ))}
            </div>

            {/* ── Balances tab ────────────────────────────────────────────── */}
            {rightTab === 'balances' && (
              <div className="p-5 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-white">Balances</span>
                  <button
                    onClick={loadBalances}
                    className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors px-2 py-1 rounded-lg hover:bg-surface-2"
                  >Refresh</button>
                </div>
                {balances ? (
                  <div className="space-y-3">
                    {Object.entries(balances).map(([chainId, cb]) => (
                      <div key={chainId}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <ChainBadge name={cb.name} />
                          {config && <span className="text-[10px] text-gray-700 font-mono">#{config.chains[chainId]?.chainId}</span>}
                        </div>
                        <div className="rounded-lg overflow-hidden border border-border/50 text-[11px]">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-surface-0/50">
                            <span className="text-gray-600">You</span>
                            <div className="flex gap-2.5 tabular-nums">
                              {asset && cb.balances.user[asset] && (
                                <span className="text-gray-300 font-mono">
                                  {formatToken(cb.balances.user[asset]?.formatted ?? '0')}
                                  <span className="text-gray-600 ml-0.5">{asset}</span>
                                </span>
                              )}
                              {cb.balances.user['ETH'] && (
                                <span className="text-gray-500 font-mono">
                                  {formatETH(cb.balances.user['ETH']?.formatted ?? '0')}
                                  <span className="text-gray-700 ml-0.5">ETH</span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between px-3 py-1.5 bg-surface-0/30 border-t border-border/40">
                            <span className="text-gray-600">Solver</span>
                            <div className="flex gap-2.5 tabular-nums">
                              {asset && cb.balances.solver[asset] && (
                                <span className="text-gray-300 font-mono">
                                  {formatToken(cb.balances.solver[asset]?.formatted ?? '0')}
                                  <span className="text-gray-600 ml-0.5">{asset}</span>
                                </span>
                              )}
                              {cb.balances.solver['ETH'] && (
                                <span className="text-gray-500 font-mono">
                                  {formatETH(cb.balances.solver['ETH']?.formatted ?? '0')}
                                  <span className="text-gray-700 ml-0.5">ETH</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-600 text-xs py-1">
                    <Spinner size={11} /> Loading…
                  </div>
                )}
              </div>
            )}

            {/* ── Tools tab (System) ─────────────────────────────────────── */}
            {rightTab === 'tools' && (
              <div className="divide-y divide-border/60 flex-1 overflow-y-auto">

                {/* System */}
                <div className="p-5">
                  <span className="text-xs font-bold text-white block mb-3">System</span>
                  <div className="space-y-2">
                    {config?.userAddress && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-600">User</span>
                        <CopyableAddress address={config.userAddress} />
                      </div>
                    )}
                    {config?.solverAddress && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-600">Solver</span>
                        <CopyableAddress address={config.solverAddress} />
                      </div>
                    )}
                    {[
                      { label: 'Chains',     value: String(chainEntries.length), status: undefined },
                      { label: 'Backend',    value: health.backend,    status: health.backend },
                      { label: 'Aggregator', value: health.aggregator, status: health.aggregator },
                    ].map(({ label, value, status }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-600">{label}</span>
                        <span className={`text-[11px] ${
                          status === 'ok'  ? 'text-emerald-400 font-medium'
                          : status !== undefined ? 'text-red-400 font-medium'
                          : 'text-gray-300'
                        }`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border/50 px-8 py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] text-gray-700">
          <span className="font-semibold">OIF Solver</span>
          <span>Open Intents Framework</span>
        </div>
      </footer>
    </div>
  )
}
