'use client';

import { CaretDown } from '@phosphor-icons/react';

import { useEffect, useRef, useState } from 'react';

import { CHAIN_CONFIG, TOKENS } from '@/lib/constants/tokens';

const CHAINS = [CHAIN_CONFIG.sepolia, CHAIN_CONFIG.eden];

export function ChainSelector({
  value,
  onChange,
  chains: chainsProp,
}: {
  value: number;
  onChange: (chainId: number) => void;
  chains?: typeof CHAINS;
}) {
  const chains = chainsProp || CHAINS;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = chains.find(c => c.chainId === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="bg-foreground/10 hover:bg-foreground/20 flex items-center gap-2 rounded-full py-1.5 pr-3 pl-2 transition-colors"
      >
        <img src={selected?.logo} alt="" className="h-5 w-5 rounded-full" />
        <span className="text-foreground text-sm font-medium whitespace-nowrap">
          {selected?.name}
        </span>
        <CaretDown
          size={12}
          className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-secondary bg-card absolute top-full right-0 z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl border shadow-2xl backdrop-blur-2xl">
          {chains.map(chain => {
            const isActive = chain.chainId === value;
            return (
              <button
                key={chain.chainId}
                onClick={() => {
                  onChange(chain.chainId);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isActive ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <img src={chain.logo} alt="" className="h-6 w-6 rounded-full" />
                <span className="text-foreground text-sm font-medium">
                  {chain.name}
                </span>
                {isActive && (
                  <div className="bg-primary ml-auto h-1.5 w-1.5 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TokenSelector({
  value,
  onChange,
  tokens,
}: {
  value: string;
  onChange: (symbol: string) => void;
  tokens: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = TOKENS[value];

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="bg-foreground/10 hover:bg-foreground/20 flex items-center gap-2 rounded-full py-1.5 pr-3 pl-2 transition-colors"
      >
        {selected?.logo && (
          <img src={selected.logo} alt="" className="h-5 w-5 rounded-full" />
        )}
        <span className="text-foreground text-sm font-medium">{value}</span>
        <CaretDown
          size={12}
          className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="border-secondary bg-card absolute top-full right-0 z-50 mt-1 min-w-[200px] overflow-y-auto rounded-xl border shadow-2xl backdrop-blur-2xl"
          style={{ maxHeight: '112px' }}
        >
          {tokens.map(symbol => {
            const meta = TOKENS[symbol];
            if (!meta) return null;
            const isActive = symbol === value;
            return (
              <button
                key={symbol}
                onClick={() => {
                  onChange(symbol);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isActive ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <img src={meta.logo} alt="" className="h-6 w-6 rounded-full" />
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {symbol}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    {meta.name}
                  </p>
                </div>
                {isActive && (
                  <div className="bg-primary ml-auto h-1.5 w-1.5 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TokenBadge({ symbol }: { symbol: string }) {
  const meta = TOKENS[symbol];
  return (
    <div className="bg-foreground/10 flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-3 pl-2">
      {meta?.logo && (
        <img src={meta.logo} alt="" className="h-5 w-5 rounded-full" />
      )}
      <span className="text-foreground text-sm font-medium">{symbol}</span>
    </div>
  );
}
