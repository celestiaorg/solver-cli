import { useEffect, useRef, useState } from 'react'

// Icons


function IconLightning() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function IconWave() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  )
}

function IconBook() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function IconScales() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="21" />
      <path d="M3 6l9-3 9 3" />
      <path d="M3 6l3.5 7c0 2-1.6 3.5-3.5 3.5S-.5 15 -.5 13L3 6z" />
      <path d="M21 6l-3.5 7c0 2-1.6 3.5-3.5 3.5S10.5 15 10.5 13L21 6z" />
      <line x1="3" y1="21" x2="21" y2="21" />
    </svg>
  )
}

// Sub-components

interface FlowStepProps {
  number: number
  title: string
  description: string
  tag?: string
  last?: boolean
}

function FlowStep({ number, title, description, tag, last = false }: FlowStepProps) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-7 h-7 rounded-full bg-brand/15 border border-brand/35 flex items-center justify-center text-brand-light text-xs font-bold">
          {number}
        </div>
        {!last && <div className="w-px flex-1 bg-border mt-2 min-h-[20px]" />}
      </div>
      <div className={`${last ? 'pb-0' : 'pb-6'}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-white">{title}</span>
          {tag && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surface-3 text-gray-400 border border-border/60">
              {tag}
            </span>
          )}
        </div>
        <p className="text-[13.5px] text-gray-300 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

interface CalloutProps {
  type: 'info' | 'note' | 'tip'
  title: string
  children: React.ReactNode
}

function Callout({ type, title, children }: CalloutProps) {
  const s = {
    info: { border: 'border-brand/40', bg: 'bg-brand/5', label: 'text-brand-light' },
    note: { border: 'border-amber-500/40', bg: 'bg-amber-500/5', label: 'text-amber-400' },
    tip:  { border: 'border-emerald-500/40', bg: 'bg-emerald-500/5', label: 'text-emerald-400' },
  }[type]
  return (
    <div className={`border-l-2 ${s.border} ${s.bg} pl-4 pr-4 py-3.5 rounded-r-xl my-5`}>
      <div className={`text-[10px] font-bold uppercase tracking-widest ${s.label} mb-1.5`}>{title}</div>
      <div className="text-[13px] text-gray-300 leading-relaxed">{children}</div>
    </div>
  )
}

function SectionDivider() {
  return <div className="border-t border-border/40 my-14" />
}

// Nav sections

const NAV = [
  { id: 'overview',   label: 'Overview',   icon: <IconBook /> },
  { id: 'fast-route', label: 'Fast Route', icon: <IconLightning /> },
  { id: 'slow-route', label: 'Slow Route', icon: <IconWave /> },
  { id: 'comparison', label: 'Comparison', icon: <IconScales /> },
]

// Main component

export function Docs({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState('overview')
  const contentRef = useRef<HTMLDivElement>(null)

  // Escape closes
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Scrollspy
  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const update = () => {
      const trigger = root.scrollTop + root.clientHeight * 0.2
      let current = NAV[0].id
      for (const { id } of NAV) {
        const el = root.querySelector(`#${id}`) as HTMLElement | null
        if (el && el.offsetTop <= trigger) current = id
      }
      setActive(current)
    }
    root.addEventListener('scroll', update, { passive: true })
    update()
    return () => root.removeEventListener('scroll', update)
  }, [])

  const scrollTo = (id: string) => {
    const el = contentRef.current?.querySelector(`#${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col bg-surface-0 animate-fade-in" style={{ top: '72px' }}>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <nav
          className="hidden sm:flex flex-shrink-0 w-48 xl:w-52 flex-col gap-0.5 py-6 px-3 overflow-y-auto"
          style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 pb-3">Contents</div>
          {NAV.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors duration-100 text-left w-full ${
                active === s.id
                  ? 'bg-brand/10 text-white border border-brand/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-2/50'
              }`}
            >
              <span className={active === s.id ? 'text-brand-light' : 'text-gray-400'}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>

        {/* Mobile tabs */}
        <div
          className="sm:hidden flex-shrink-0 flex gap-1 px-4 py-2 overflow-x-auto"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          {NAV.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                active === s.id
                  ? 'bg-brand/15 text-white border border-brand/25'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="max-w-[680px] mx-auto px-6 sm:px-10 xl:px-12 py-10 pb-28">

            <section id="overview" className="scroll-mt-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-light mb-3">Introduction</div>
              <h1 className="text-[22px] font-bold text-white mb-4 leading-tight">What is Celestia Bridge?</h1>
              <p className="text-[14.5px] text-gray-300 leading-relaxed mb-5">
                Celestia Bridge is a cross-chain token transfer interface built on the{' '}
                <span className="text-gray-200 font-medium">Open Intents Framework</span>, an open protocol for
                expressing and fulfilling cross-chain user intents across EVM networks. Move tokens between chains
                without managing bridges, liquidity pools, or multi-step transaction sequences yourself.
              </p>
              <p className="text-[14.5px] text-gray-300 leading-relaxed mb-8">
                Two routing mechanisms let you choose between speed and trustlessness depending on your needs.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                {[
                  {
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-brand-light">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    ),
                    title: 'Intent-based',
                    desc: 'Declare what you want. Solvers compete to fill your order at the best available rate.',
                  },
                  {
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-400">
                        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
                        <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" /><line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
                        <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" /><line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
                      </svg>
                    ),
                    title: 'DA-secured',
                    desc: 'Backed by Celestia data availability for verifiable, trust-minimized cross-chain messaging.',
                  },
                  {
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                      </svg>
                    ),
                    title: 'Multi-chain',
                    desc: 'Any EVM chain to any EVM chain. Routes are configured, not hardcoded to specific pairs.',
                  },
                ].map(f => (
                  <div key={f.title} className="p-4 rounded-xl border border-border/50 bg-surface-1/30">
                    <div className="mb-2.5">{f.icon}</div>
                    <div className="text-[13px] font-semibold text-white mb-1">{f.title}</div>
                    <div className="text-[12px] text-gray-300 leading-relaxed">{f.desc}</div>
                  </div>
                ))}
              </div>

              {/* Architecture overview */}
              <div className="rounded-xl border border-border/50 bg-surface-1/20 p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">System overview</div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-[12px]">
                  {[
                    { label: 'You', sub: 'sign intent', color: 'bg-surface-3 border-border text-gray-300' },
                    null,
                    { label: 'Aggregator', sub: 'routes & quotes', color: 'bg-brand/10 border-brand/25 text-brand-light' },
                    null,
                    { label: 'Solver', sub: 'fills on dest', color: 'bg-surface-3 border-border text-gray-300' },
                    null,
                    { label: 'Oracle', sub: 'attests fill', color: 'bg-surface-3 border-border text-gray-300' },
                  ].map((item, i) =>
                    item === null ? (
                      <div key={i} className="flex sm:flex-col items-center justify-center text-gray-400">
                        <svg className="sm:rotate-90" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                    ) : (
                      <div key={item.label} className={`flex-1 border rounded-lg px-3 py-2.5 text-center ${item.color}`}>
                        <div className="font-semibold">{item.label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{item.sub}</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </section>

            <SectionDivider />

            <section id="fast-route" className="scroll-mt-6">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                  <IconLightning />
                  Fast Route
                </span>
                <span className="text-[11px] text-gray-400">~15–30 seconds</span>
              </div>
              <h2 className="text-[20px] font-bold text-white mb-3 leading-tight">Intent Protocol</h2>
              <p className="text-[14.5px] text-gray-300 leading-relaxed mb-4">
                The fast route uses an <span className="text-gray-200 font-medium">intent-based protocol</span> where
                specialized solvers compete to fill your transfer. Instead of executing a bridge transaction yourself,
                you sign a declaration of what you want; a solver fronts the capital to make it happen
                immediately, then settles with the escrow contract after an oracle verifies the fill.
              </p>
              <p className="text-[14.5px] text-gray-300 leading-relaxed mb-8">
                You never pay gas. The solver earns a small spread between the input and output amounts as compensation
                for the capital risk they take.
              </p>

              <div className="text-[11px] font-bold uppercase tracking-widest text-gray-300 mb-5">Step by step</div>
              <FlowStep
                number={1}
                title="Get Quote"
                description="The aggregator polls all registered solvers and returns the best rate for your transfer, including fees and estimated delivery time. Quotes expire after a short window to prevent front-running."
              />
              <FlowStep
                number={2}
                title="Sign Intent"
                description="You sign an EIP-712 typed data message. Gasless: no transaction is sent, no ETH is spent. The signature proves your authorization and encodes exactly what you're willing to accept."
              />
              <FlowStep
                number={3}
                title="Solver Fills"
                description="The winning solver sends the requested tokens directly to your wallet on the destination chain, using their own inventory. From your perspective, tokens simply appear."
              />
              <FlowStep
                number={4}
                title="Oracle Confirms"
                description="An independent oracle operator watches for the OutputFilled event emitted by the solver, verifies it occurred on-chain, and signs an attestation using a separate key. The solver cannot self-attest."
              />
              <FlowStep
                number={5}
                title="Solver Claims"
                description="Once the oracle attestation is confirmed on the source chain, the solver calls claim() on the InputSettlerEscrow contract and receives the tokens you originally deposited. The flow is complete."
                last
              />

              <Callout type="tip" title="Why you sign instead of transact">
                EIP-712 signing separates authorization from execution. You declare intent; solvers execute.
                This lets solvers batch, optimize, and compete without requiring you to manage gas or bridge contracts.
                Your signature is only valid for the exact parameters you agreed to: amount, destination, expiry.
              </Callout>

              <Callout type="info" title="Oracle independence is critical">
                The oracle operator and solver use different keys and are designed to be separate entities.
                A solver attesting its own fills would be "trust me, I did the work" with no independent verification.
                The oracle independently confirms fills happened on-chain before any settlement is possible.
              </Callout>
            </section>

            <SectionDivider />

            <section id="slow-route" className="scroll-mt-6">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-full">
                  <IconWave />
                  Slow Route
                </span>
                <span className="text-[11px] text-gray-400">~2 minutes</span>
              </div>
              <h2 className="text-[20px] font-bold text-white mb-3 leading-tight">Celestia Bridge</h2>
              <p className="text-[14.5px] text-gray-300 leading-relaxed mb-4">
                The slow route bridges tokens through{' '}
                <span className="text-gray-200 font-medium">Hyperlane warp routes</span> with cross-chain
                messages secured by{' '}
                <span className="text-gray-200 font-medium">Celestia data availability</span>.
                No solvers are involved. The transfer is fully permissionless: no third party can
                decline or censor it.
              </p>
              <p className="text-[14.5px] text-gray-300 leading-relaxed mb-8">
                The "slow" is Celestia's data availability finality time, not any manual step you have to take.
                You send one (or two) transactions and wait ~2 minutes.
              </p>

              <div className="text-[11px] font-bold uppercase tracking-widest text-gray-300 mb-5">Step by step</div>
              <FlowStep
                number={1}
                title="Approve"
                tag="collateral chains only"
                description="On chains where the warp contract holds real ERC-20 tokens as collateral (like Sepolia), you first grant it a token allowance. Chains using synthetic warp tokens skip this step; the contract owns the supply and can burn directly."
              />
              <FlowStep
                number={2}
                title="Transfer Remote"
                description="You call transferRemote() on the Hyperlane warp token contract. On a collateral chain this locks your tokens in the vault. On a synthetic chain it burns them. Either way, a cross-chain message is dispatched to the Hyperlane mailbox."
              />
              <FlowStep
                number={3}
                title="Celestia DA"
                description="The message payload is posted to Celestia for data availability. This creates a verifiable, permanent record of the transfer that doesn't rely on any single chain's security model. Celestia validators attest to availability."
              />
              <FlowStep
                number={4}
                title="Hyperlane Relay"
                description="The Hyperlane relayer detects the message, fetches the Celestia DA proof, and delivers it to the destination chain's mailbox. The mailbox verifies the proof and forwards the message to the warp token contract."
              />
              <FlowStep
                number={5}
                title="Tokens Arrive"
                description="The destination warp contract either mints new synthetic tokens or unlocks collateral tokens to your address. The bridge is complete and your balance updates."
                last
              />

              <Callout type="note" title="When approval is required">
                Whether you see an Approve step depends on the{' '}
                <code className="text-[12.5px] font-mono bg-surface-3 px-1.5 py-0.5 rounded border border-border/60 text-gray-300">warpType</code>{' '}
                of the source chain. A <em className="not-italic text-gray-300">collateral</em> chain (like Sepolia)
                wraps a real ERC-20 and needs allowance. A <em className="not-italic text-gray-300">synthetic</em> chain
                (like Eden) owns its token supply and burns from your balance directly, no approval needed.
              </Callout>

              <Callout type="info" title="Why Celestia?">
                Celestia provides data availability as a separate layer from execution. By posting cross-chain
                messages to Celestia, Hyperlane warp routes inherit Celestia's security for message verification,
                independent of Ethereum's or any destination chain's own consensus.
              </Callout>
            </section>

            <SectionDivider />

            <section id="comparison" className="scroll-mt-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-light mb-3">Routes</div>
              <h2 className="text-[20px] font-bold text-white mb-3 leading-tight">Choosing the Right Route</h2>
              <p className="text-[14.5px] text-gray-300 leading-relaxed mb-8">
                Both routes move the same tokens to the same destination. The difference is the trust model,
                speed, and who executes the transfer on your behalf.
              </p>

              {/* Comparison table */}
              <div className="rounded-xl border border-border/60 overflow-hidden mb-8 text-[13px]">
                <div className="grid grid-cols-3 border-b border-border/60">
                  <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-300 bg-surface-1/50">Feature</div>
                  <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-surface-1/50 border-l border-border/60">⚡ Fast</div>
                  <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-sky-400 bg-surface-1/50 border-l border-border/60">〜 Slow</div>
                </div>
                {[
                  ['Speed',             '~15–30 seconds',          '~2 minutes'],
                  ['Gas you pay',       'None',                    'Source chain tx fee'],
                  ['Steps',             'Sign once',               'Approve + send (or just send)'],
                  ['Requires solver',   'Yes',                     'No'],
                  ['Trust model',       'Oracle + solver network', 'Celestia DA + Hyperlane'],
                  ['Censorship risk',   'Solver can decline',      'Fully permissionless'],
                  ['Best for',          'Speed, best rate',        'Trustlessness, sovereignty'],
                ].map(([feat, fast, slow], i) => (
                  <div key={feat} className={`grid grid-cols-3 ${i % 2 === 0 ? '' : 'bg-surface-1/15'}`}>
                    <div className="px-4 py-3 text-gray-300 font-medium">{feat}</div>
                    <div className="px-4 py-3 text-gray-300 border-l border-border/40">{fast}</div>
                    <div className="px-4 py-3 text-gray-300 border-l border-border/40">{slow}</div>
                  </div>
                ))}
              </div>

              {/* When to use each */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl border border-amber-500/15 bg-amber-500/5">
                  <div className="flex items-center gap-2 mb-3.5">
                    <span className="text-amber-400"><IconLightning /></span>
                    <span className="text-[13px] font-bold text-amber-300">Use Fast when…</span>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      'You want tokens to arrive in seconds',
                      'You prefer not to pay gas yourself',
                      'Solvers are online and competing',
                      'Rate optimization matters',
                    ].map(item => (
                      <li key={item} className="flex items-start gap-2 text-[13px] text-gray-300">
                        <span className="text-amber-400 mt-0.5 flex-shrink-0">›</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-5 rounded-xl border border-sky-500/15 bg-sky-500/5">
                  <div className="flex items-center gap-2 mb-3.5">
                    <span className="text-sky-400"><IconWave /></span>
                    <span className="text-[13px] font-bold text-sky-300">Use Slow when…</span>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      'You want no solver dependency',
                      'Solvers are offline or at capacity',
                      'Censorship resistance matters',
                      'You prefer Celestia-backed security',
                    ].map(item => (
                      <li key={item} className="flex items-start gap-2 text-[13px] text-gray-300">
                        <span className="text-sky-400 mt-0.5 flex-shrink-0">›</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  )
}
