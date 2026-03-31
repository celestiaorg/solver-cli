'use client';

import {
  ArrowsDownUp,
  Bank,
  CheckCircle,
  Lightning,
  Path,
  Spinner as SpinnerIcon,
  Wallet,
  Warning,
} from '@phosphor-icons/react';
import { formatUnits, parseAbi, parseUnits } from 'viem';
import {
  useAccount,
  useSignTypedData,
  useSwitchChain,
  useWriteContract,
} from 'wagmi';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { GlowingEffect } from '@/components/ui/glowing-effect';

import { useConnectKitContext } from '@/connect-kit';
import {
  CHAIN_CONFIG,
  getTokensForRoute,
  TOKENS,
} from '@/lib/constants/tokens';
import { transferApi } from '@/lib/transfer-api';
import { useWalletConnectStore } from '@/store/wallet-connect';

import {
  ChainSelector,
  TokenBadge,
  TokenSelector,
} from './components/chain-token-selector';

type Mode = 'fast' | 'slow' | 'exchange';
type Step =
  | 'idle'
  | 'quoting'
  | 'quoted'
  | 'approving'
  | 'signing'
  | 'submitted'
  | 'polling'
  | 'done'
  | 'error';

const CHAINS = [CHAIN_CONFIG.anvil1, CHAIN_CONFIG.anvil2];
const balanceOfAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
]);
const erc20Abi = parseAbi([
  'function approve(address, uint256) returns (bool)',
]);
const warpRouteAbi = parseAbi([
  'function transferRemote(uint32, bytes32, uint256) payable returns (bytes32)',
]);

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function bech32ToBytes32(addr: string): string {
  const pos = addr.lastIndexOf('1');
  if (pos < 1) throw new Error('Invalid bech32');
  const dataPart = addr.slice(pos + 1, -6);
  const values = [...dataPart].map(c => {
    const i = BECH32_CHARSET.indexOf(c);
    if (i < 0) throw new Error('Invalid bech32');
    return i;
  });
  let acc = 0,
    bits = 0;
  const out: number[] = [];
  for (const v of values) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return (
    '0x' +
    out
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .padStart(64, '0')
  );
}

function formatToken(val: string | number, decimals = 2): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(n) ? '0.00' : n.toFixed(decimals);
}

function useTokenBalance(
  chainId: number,
  symbol: string,
  userAddress: string | null
) {
  const [balance, setBalance] = useState<string | null>(null);
  useEffect(() => {
    if (!userAddress) {
      setBalance(null);
      return;
    }
    const tokenDef = TOKENS[symbol];
    const chainInfo = tokenDef?.addresses[chainId];
    const rpc = CHAINS.find(c => c.chainId === chainId)?.rpc;
    if (!tokenDef || !chainInfo || !rpc) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    const doFetch = async () => {
      try {
        const { createPublicClient, http } = await import('viem');
        const client = createPublicClient({ transport: http(rpc) });
        const bal =
          chainInfo.token === 'native'
            ? await client.getBalance({ address: userAddress as `0x${string}` })
            : await client.readContract({
                address: chainInfo.token as `0x${string}`,
                abi: balanceOfAbi,
                functionName: 'balanceOf',
                args: [userAddress as `0x${string}`],
              });
        if (!cancelled) setBalance(formatUnits(bal, tokenDef.decimals));
      } catch {
        if (!cancelled) setBalance(null);
      }
    };
    doFetch();
    const interval = setInterval(doFetch, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chainId, symbol, userAddress]);
  return balance;
}

const BridgePage = () => {
  const { evm } = useWalletConnectStore();
  const { setIsModalOpen } = useConnectKitContext();
  const [mode, setMode] = useState<Mode>('fast');

  return (
    <div className="grid auto-rows-auto grid-cols-12 gap-5 pb-12 md:pb-0">
      <div className="col-span-full flex flex-wrap items-center gap-2">
        {[
          { id: 'fast' as Mode, label: 'Fast', icon: Lightning },
          { id: 'slow' as Mode, label: 'Direct', icon: Path },
          { id: 'exchange' as Mode, label: 'Exchange Deposit', icon: Bank },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
              mode === id
                ? 'bg-foreground border-foreground text-black'
                : 'border-secondary text-foreground hover:bg-foreground/10'
            }`}
          >
            <Icon size={16} weight={mode === id ? 'fill' : 'regular'} />
            {label}
          </button>
        ))}
      </div>

      {mode === 'exchange' ? (
        <ExchangeDeposit
          evmAddress={evm}
          onConnect={() => setIsModalOpen(true)}
        />
      ) : (
        <CrossChainTransfer
          mode={mode}
          evmAddress={evm}
          onConnect={() => setIsModalOpen(true)}
        />
      )}
    </div>
  );
};

function CrossChainTransfer({
  mode,
  evmAddress,
  onConnect,
}: {
  mode: 'fast' | 'slow';
  evmAddress: string | null;
  onConnect: () => void;
}) {
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();

  const [fromChainId, setFromChainId] = useState<number>(
    CHAIN_CONFIG.anvil1.chainId
  );
  const [toChainId, setToChainId] = useState<number>(CHAIN_CONFIG.anvil2.chainId);
  const [token, setToken] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);

  const availableTokens = getTokensForRoute(fromChainId, toChainId);
  useEffect(() => {
    if (availableTokens.length > 0 && !availableTokens.includes(token))
      setToken(availableTokens[0]);
  }, [availableTokens, token]);

  const fromBalance = useTokenBalance(fromChainId, token, evmAddress);
  const toBalance = useTokenBalance(toChainId, token, evmAddress);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quote, setQuote] = useState<any>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orderStatus, setOrderStatus] = useState<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [bridgeTxHash, setBridgeTxHash] = useState<string | null>(null);

  const fromChain = CHAINS.find(c => c.chainId === fromChainId)!;
  const toChain = CHAINS.find(c => c.chainId === toChainId)!;

  const swap = () => {
    setFromChainId(toChainId);
    setToChainId(fromChainId);
    resetState();
  };
  const resetState = () => {
    setStep('idle');
    setError(null);
    setQuote(null);
    setOrderId(null);
    setOrderStatus(null);
    setBridgeTxHash(null);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    resetState();
  }, [mode]);
  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    []
  );

  const ensureChain = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (chainId !== fromChainId) {
      switchChain({ chainId: fromChainId as any });
      return false;
    }
    return true;
  }, [chainId, fromChainId, switchChain]);

  const getQuote = async () => {
    if (!address) return;
    setStep('quoting');
    setError(null);
    try {
      const d = TOKENS[token]?.decimals ?? 6;
      const data = await transferApi.quote(
        fromChainId,
        toChainId,
        parseUnits(amount, d).toString(),
        token,
        address
      );
      if (!data.quotes?.length) throw new Error('No quotes available');
      setQuote(data.quotes[0]);
      setStep('quoted');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message);
      setStep('error');
    }
  };

  const signAndSubmit = async () => {
    if (!quote || !address) return;
    setStep('signing');
    setError(null);
    try {
      if (!(await ensureChain())) {
        setStep('quoted');
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = quote.order.payload as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sig = await signTypedDataAsync({
        domain: p.domain,
        types: p.types,
        primaryType: p.primaryType,
        message: p.message,
      } as any);
      setStep('submitted');
      const result = await transferApi.submitOrder(
        quote,
        '0x00' + sig.slice(2)
      );
      setOrderId(result.orderId);
      setStep('polling');
      let count = 0;
      pollRef.current = setInterval(async () => {
        count++;
        try {
          const st = await transferApi.orderStatus(result.orderId);
          setOrderStatus(st);
          const s =
            typeof st.status === 'string'
              ? st.status
              : Object.keys(st.status)[0];
          if (s === 'failed' || s === 'refunded') {
            setError('Order ' + s);
            setStep('error');
            clearInterval(pollRef.current!);
            return;
          }
          if (['executed', 'settling', 'settled', 'finalized'].includes(s)) {
            setStep('done');
            clearInterval(pollRef.current!);
          }
        } catch {
          /* keep polling */
        }
        if (count > 60) {
          setStep('done');
          clearInterval(pollRef.current!);
        }
      }, 2000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message);
      setStep('error');
    }
  };

  const bridgeSlow = async () => {
    if (!address) return;
    setStep('approving');
    setError(null);
    try {
      if (!(await ensureChain())) {
        setStep('idle');
        return;
      }
      const d = TOKENS[token]?.decimals ?? 6;
      const raw = parseUnits(amount, d).toString();
      const prep = await transferApi.bridgePrepare(
        fromChain.serverName,
        toChain.serverName,
        token,
        address,
        raw
      );
      if (prep.needsApproval && prep.underlyingToken) {
        const approveHash = await writeContractAsync({
          address: prep.underlyingToken as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [prep.warpToken as `0x${string}`, BigInt(raw)],
        });
        const { createPublicClient, http } = await import('viem');
        const client = createPublicClient({ transport: http(fromChain.rpc) });
        await client.waitForTransactionReceipt({ hash: approveHash });
      }
      setStep('submitted');
      const tx = await writeContractAsync({
        address: prep.warpToken as `0x${string}`,
        abi: warpRouteAbi,
        functionName: 'transferRemote',
        args: [
          prep.celestiaDomainId,
          prep.forwardingAddressBytes32 as `0x${string}`,
          BigInt(raw),
        ],
        gas: BigInt(500000),
        ...(prep.isNative ? { value: BigInt(raw) } : {}),
      });
      setBridgeTxHash(tx);
      setStep('done');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message);
      setStep('error');
    }
  };

  if (!evmAddress) {
    return (
      <div className="bg-background border-secondary relative col-span-full flex min-h-60 flex-col items-center justify-center rounded-lg border p-8 text-center">
        <GlowingEffect />
        <Wallet
          size={40}
          className="text-muted-foreground relative z-10 mb-4"
        />
        <h3 className="text-foreground relative z-10 mb-2 text-xl font-semibold">
          Connect Wallet
        </h3>
        <p className="text-muted-foreground relative z-10 mb-4 text-sm">
          Connect an EVM wallet to bridge tokens.
        </p>
        <Button
          variant="mono"
          className="relative z-10 text-black"
          onClick={onConnect}
        >
          Connect Wallet
        </Button>
      </div>
    );
  }

  const tokenDec = TOKENS[token]?.decimals ?? 6;
  const outputAmount = quote?.preview?.outputs?.[0]?.amount
    ? formatUnits(BigInt(quote.preview.outputs[0].amount), tokenDec)
    : '';
  const disabled = !amount || parseFloat(amount) <= 0;
  const insufficient =
    fromBalance !== null &&
    amount &&
    parseFloat(amount) > parseFloat(fromBalance);
  const fastAvailable = token === 'USDC';
  const effectiveMode = mode === 'fast' && !fastAvailable ? 'slow' : mode;

  return (
    <>
      <div className="bg-background border-secondary relative col-span-full rounded-lg border p-5">
        <GlowingEffect />
        <div className="relative z-10">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">You send</p>
            <ChainSelector
              value={fromChainId}
              onChange={id => {
                setFromChainId(id);
                if (id === toChainId) setToChainId(fromChainId);
                resetState();
              }}
            />
          </div>
          <div className="mb-1 flex items-end gap-3">
            <input
              inputMode="decimal"
              value={amount}
              onChange={e => {
                setAmount(e.target.value);
                resetState();
              }}
              placeholder="0.00"
              className="text-foreground w-full flex-1 [appearance:textfield] border-none bg-transparent text-3xl outline-none md:text-4xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <TokenSelector
              value={token}
              onChange={t => {
                setToken(t);
                resetState();
              }}
              tokens={availableTokens}
            />
          </div>
          {fromBalance !== null && (
            <button
              onClick={() => {
                setAmount(fromBalance);
                resetState();
              }}
              className="text-muted-foreground hover:text-foreground mt-1 cursor-pointer text-xs transition-colors"
            >
              Balance: {parseFloat(fromBalance).toFixed(2)} {token}
            </button>
          )}
        </div>
      </div>

      <div className="col-span-full -my-1 flex justify-center">
        <button
          onClick={swap}
          className="bg-background border-secondary group hover:bg-foreground/10 cursor-pointer rounded-full border p-2.5 transition-all"
        >
          <ArrowsDownUp
            size={16}
            className="text-muted-foreground transition-transform duration-300 group-hover:rotate-180"
          />
        </button>
      </div>

      <div className="bg-background border-secondary relative col-span-full rounded-lg border p-5">
        <GlowingEffect />
        <div className="relative z-10">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">You get</p>
            <ChainSelector
              value={toChainId}
              onChange={id => {
                setToChainId(id);
                if (id === fromChainId) setFromChainId(toChainId);
                resetState();
              }}
            />
          </div>
          <div className="mb-1 flex items-end gap-3">
            <span className="text-muted-foreground flex-1 text-3xl md:text-4xl">
              {outputAmount || '—'}
            </span>
            <TokenBadge symbol={token} />
          </div>
          {toBalance !== null && (
            <p className="text-muted-foreground mt-1 text-xs">
              Balance: {parseFloat(toBalance).toFixed(2)} {token}
            </p>
          )}
        </div>
      </div>

      {mode === 'fast' && quote && step !== 'idle' && step !== 'error' && (
        <div className="bg-background border-secondary relative col-span-full rounded-lg border p-5">
          <GlowingEffect />
          <div className="relative z-10 flex flex-col gap-2 text-sm">
            <Row label="Provider" value={quote.provider} />
            <Row label="ETA" value={`${quote.eta}s`} />
          </div>
        </div>
      )}

      {mode === 'fast' &&
        ['signing', 'submitted', 'polling', 'done'].includes(step) && (
          <div
            className={`relative col-span-full rounded-lg border p-5 ${step === 'done' ? 'border-accent/30 bg-accent/5' : 'bg-background border-secondary'}`}
          >
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Settlement</span>
                {step === 'done' ? (
                  <span className="text-accent text-xs font-semibold uppercase">
                    Complete
                  </span>
                ) : (
                  <span className="text-foreground flex items-center gap-1.5 text-xs">
                    <SpinnerIcon size={12} className="animate-spin" />
                    {step === 'signing'
                      ? 'Signing...'
                      : step === 'submitted'
                        ? 'Submitting...'
                        : 'Awaiting settlement...'}
                  </span>
                )}
              </div>
              {orderId && <Row label="Order" value={orderId} mono />}
              {orderStatus?.fillTransaction?.hash && (
                <Row
                  label="Fill TX"
                  value={orderStatus.fillTransaction.hash}
                  mono
                />
              )}
            </div>
          </div>
        )}

      {mode === 'slow' && ['approving', 'submitted', 'done'].includes(step) && (
        <div
          className={`relative col-span-full rounded-lg border p-5 ${step === 'done' ? 'border-accent/30 bg-accent/5' : 'bg-background border-secondary'}`}
        >
          <div className="space-y-2.5 text-sm">
            {[
              {
                label: 'Preparing route',
                done: step !== 'approving',
                active: step === 'approving',
              },
              {
                label: 'Approving token',
                done: step === 'submitted' || step === 'done',
                active: step === 'approving',
              },
              {
                label: 'Submitting bridge',
                done: step === 'done',
                active: step === 'submitted',
              },
            ].map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-2.5 ${s.active ? 'text-foreground' : s.done ? 'text-accent' : 'text-muted-foreground/30'}`}
              >
                {s.active ? (
                  <SpinnerIcon size={14} className="animate-spin" />
                ) : s.done ? (
                  <CheckCircle size={14} />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-current opacity-30" />
                )}
                {s.label}
              </div>
            ))}
            {bridgeTxHash && (
              <Row label="Bridge TX" value={bridgeTxHash} mono />
            )}
            {step === 'done' && (
              <p className="text-muted-foreground text-xs">
                Tokens arrive in ~2 minutes via Celestia.
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="border-destructive/20 bg-destructive/5 relative col-span-full rounded-lg border p-5">
          <div className="text-destructive flex items-start gap-2.5 text-sm">
            <Warning size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="col-span-full">
        {mode === 'fast' ? (
          step === 'idle' || step === 'error' ? (
            <Button
              onClick={getQuote}
              disabled={disabled}
              size="lg"
              className={`w-full font-medium ${insufficient ? '!bg-destructive/90 text-white' : ''}`}
            >
              {insufficient ? 'Insufficient balance' : 'Get Quote'}
            </Button>
          ) : step === 'quoting' ? (
            <Button disabled size="lg" className="w-full">
              <SpinnerIcon size={16} className="animate-spin" /> Getting
              quote...
            </Button>
          ) : step === 'quoted' ? (
            <Button
              onClick={signAndSubmit}
              size="lg"
              variant="mono"
              className="w-full font-medium text-black"
            >
              Sign & Submit
            </Button>
          ) : step === 'done' ? (
            <Button
              onClick={resetState}
              size="lg"
              variant="mono"
              className="w-full font-medium text-black"
            >
              New Transfer
            </Button>
          ) : (
            <Button disabled size="lg" className="w-full">
              <SpinnerIcon size={16} className="animate-spin" /> Processing...
            </Button>
          )
        ) : step === 'idle' || step === 'error' ? (
          <Button
            onClick={bridgeSlow}
            disabled={disabled}
            size="lg"
            className={`w-full font-medium ${insufficient ? '!bg-destructive/90 text-white' : ''}`}
          >
            {insufficient ? 'Insufficient balance' : 'Bridge via Celestia'}
          </Button>
        ) : step === 'done' ? (
          <Button
            onClick={resetState}
            size="lg"
            variant="mono"
            className="w-full font-medium text-black"
          >
            New Transfer
          </Button>
        ) : (
          <Button disabled size="lg" className="w-full">
            <SpinnerIcon size={16} className="animate-spin" /> Processing...
          </Button>
        )}
      </div>
    </>
  );
}

function ExchangeDeposit({
  evmAddress,
  onConnect,
}: {
  evmAddress: string | null;
  onConnect: () => void;
}) {
  const [sourceChainId, setSourceChainId] = useState<number>(
    CHAIN_CONFIG.anvil1.chainId
  );
  const [destChainId, setDestChainId] = useState<number>(
    CHAIN_CONFIG.anvil2.chainId
  );
  const [token, setToken] = useState('USDC');
  const [depositInfo, setDepositInfo] = useState<{
    depositAddress: string;
    exists: boolean;
    forwardingAddress: string;
  } | null>(null);
  const [depositBalances, setDepositBalances] = useState<Record<
    string,
    string
  > | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceChain = CHAINS.find(c => c.chainId === sourceChainId)!;
  const destChain = CHAINS.find(c => c.chainId === destChainId)!;
  const sourceChains = CHAINS.filter(
    c => c.chainId !== CHAIN_CONFIG.anvil2.chainId
  );
  const destChains = CHAINS.filter(c => c.chainId !== sourceChainId);
  const cexTokens = ['USDC', 'ETH', 'LBTC'];

  const destBalance = useTokenBalance(destChainId, token, evmAddress);

  const resetDeposit = () => {
    setDepositInfo(null);
    setDepositBalances(null);
  };

  const fetchDepositInfo = useCallback(async () => {
    if (!evmAddress) return;
    try {
      setDepositInfo(
        await transferApi.depositAddress(evmAddress, sourceChainId, destChainId)
      );
    } catch {}
  }, [evmAddress, sourceChainId, destChainId]);

  const fetchDepositBalances = useCallback(async () => {
    if (!depositInfo?.depositAddress) return;
    try {
      setDepositBalances(
        await transferApi.depositBalances(
          depositInfo.depositAddress,
          sourceChainId
        )
      );
    } catch {}
  }, [depositInfo?.depositAddress, sourceChainId]);

  useEffect(() => {
    if (evmAddress) {
      resetDeposit();
      fetchDepositInfo();
    } else {
      resetDeposit();
    }
  }, [evmAddress, sourceChainId, destChainId, fetchDepositInfo]);

  useEffect(() => {
    if (!depositInfo?.depositAddress) return;
    fetchDepositBalances();
    const i = setInterval(fetchDepositBalances, 8000);
    return () => clearInterval(i);
  }, [depositInfo?.depositAddress, fetchDepositBalances]);

  const createAccount = async () => {
    if (!evmAddress) return;
    setCreating(true);
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try {
      const r = await transferApi.createDepositAccount(
        evmAddress,
        sourceChainId,
        destChainId
      );
      setDepositInfo({
        depositAddress: r.depositAddress,
        exists: true,
        forwardingAddress: r.forwardingAddress,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const hasInTransit =
    depositBalances &&
    Object.values(depositBalances).some(v => parseFloat(v) > 0);

  if (!evmAddress) {
    return (
      <div className="bg-background border-secondary relative col-span-full flex min-h-60 flex-col items-center justify-center rounded-lg border p-8 text-center">
        <GlowingEffect />
        <Wallet
          size={40}
          className="text-muted-foreground relative z-10 mb-4"
        />
        <h3 className="text-foreground relative z-10 mb-2 text-xl font-semibold">
          Connect Wallet
        </h3>
        <p className="text-muted-foreground relative z-10 mb-4 text-sm">
          Connect an EVM wallet to deposit from an exchange.
        </p>
        <Button
          variant="mono"
          className="relative z-10 text-black"
          onClick={onConnect}
        >
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-background border-secondary relative col-span-full rounded-lg border p-5">
        <GlowingEffect />
        <div className="relative z-10 flex gap-3 text-sm">
          <Bank size={16} className="text-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-foreground mb-1 font-medium">
              Deposit from Exchange
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Withdraw from your exchange (Coinbase, Binance, etc.) to the
              deposit address below on {sourceChain.name}. Tokens are
              automatically bridged to {destChain.name}.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-background border-secondary relative col-span-full rounded-lg border p-5">
        <GlowingEffect />
        <div className="relative z-10">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Source</p>
            <ChainSelector
              value={sourceChainId}
              onChange={id => {
                setSourceChainId(id);
                if (id === destChainId)
                  setDestChainId(
                    CHAINS.find(c => c.chainId !== id)?.chainId ?? destChainId
                  );
                resetDeposit();
              }}
              chains={sourceChains}
            />
          </div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Destination</p>
            <ChainSelector
              value={destChainId}
              onChange={id => {
                setDestChainId(id);
                resetDeposit();
              }}
              chains={destChains}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Token</p>
            <TokenSelector
              value={token}
              onChange={setToken}
              tokens={cexTokens}
            />
          </div>
          {destBalance !== null && (
            <p className="text-muted-foreground mt-2 text-xs">
              {destChain.name} balance: {parseFloat(destBalance).toFixed(2)}{' '}
              {token}
            </p>
          )}
        </div>
      </div>

      <div className="bg-background border-secondary relative col-span-full rounded-lg border p-5">
        <GlowingEffect />
        <div className="relative z-10">
          <p className="text-muted-foreground mb-3 text-sm">
            Your Deposit Address ({sourceChain.name})
          </p>
          {!depositInfo ? (
            <div className="flex items-center gap-2">
              <SpinnerIcon
                size={14}
                className="text-muted-foreground animate-spin"
              />
              <span className="text-muted-foreground text-sm">Loading...</span>
            </div>
          ) : depositInfo.exists ? (
            <div>
              <code className="text-foreground font-mono text-sm break-all md:text-base">
                {depositInfo.depositAddress}
              </code>
              <p className="text-muted-foreground mt-2 text-xs">
                Send {token} here from your exchange. It will arrive on{' '}
                {destChain.name}.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground mb-4 text-sm">
                Your deposit account hasn&apos;t been created yet.
              </p>
              <Button
                onClick={createAccount}
                disabled={creating}
                size="lg"
                variant="mono"
                className="w-full font-medium text-black"
              >
                {creating ? (
                  <>
                    <SpinnerIcon size={14} className="animate-spin" />{' '}
                    Creating...
                  </>
                ) : (
                  'Create Deposit Account'
                )}
              </Button>
              {error && (
                <div className="text-destructive mt-3 flex items-center gap-2 text-xs">
                  <Warning size={12} /> {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {hasInTransit && (
        <div className="bg-background border-secondary relative col-span-full rounded-lg border p-5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-primary relative inline-flex h-3 w-3 rounded-full" />
            </div>
            <div>
              <p className="text-foreground text-sm font-medium">
                Bridging in progress
              </p>
              <p className="text-muted-foreground text-xs">
                Tokens route from {sourceChain.name} through Celestia to{' '}
                {destChain.name} automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {depositInfo?.exists && depositBalances && (
        <div className="bg-background border-secondary relative col-span-full rounded-lg border p-5">
          <GlowingEffect />
          <div className="relative z-10">
            <p className="text-muted-foreground mb-3 text-sm">
              In Transit ({sourceChain.name})
            </p>
            <div className="space-y-3">
              {Object.entries(depositBalances).map(([symbol, amount]) => {
                const meta = TOKENS[symbol];
                if (!meta) return null;
                return (
                  <BalRow
                    key={symbol}
                    symbol={symbol}
                    amount={amount}
                    decimals={Math.min(meta.decimals, 6)}
                    logo={meta.logo}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const truncated =
    mono && value.length > 16
      ? `${value.slice(0, 8)}...${value.slice(-6)}`
      : value;
  const handleCopy = () => {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      {mono ? (
        <button
          onClick={handleCopy}
          className="text-foreground hover:text-accent flex cursor-pointer items-center gap-1.5 font-mono text-xs transition-colors"
          title="Click to copy"
        >
          {truncated}
          <span className="text-[10px]">{copied ? '✓' : '⎘'}</span>
        </button>
      ) : (
        <span className="text-foreground">{value}</span>
      )}
    </div>
  );
}

function BalRow({
  symbol,
  amount,
  decimals,
  logo,
}: {
  symbol: string;
  amount: string;
  decimals: number;
  logo: string;
}) {
  const val = parseFloat(amount);
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <img src={logo} alt="" className="h-5 w-5 rounded-full" />
        <span className="text-foreground text-sm">{symbol}</span>
      </div>
      <span
        className={`font-mono text-sm font-medium ${val > 0 ? 'text-foreground' : 'text-muted-foreground'}`}
      >
        {formatToken(amount, decimals)}
      </span>
    </div>
  );
}

export default BridgePage;
