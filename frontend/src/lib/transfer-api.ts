const BASE = '/api';

async function json<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data as T;
}

export const transferApi = {
  health: () => json<{ backend: string; aggregator: string }>(`${BASE}/health`),

  balances: (address: string) =>
    json<
      Record<
        string,
        {
          name: string;
          balances: {
            user: Record<string, { raw: string; formatted: string }>;
          };
        }
      >
    >(`${BASE}/balances?address=${address}`),

  celestiaBalances: (address: string) =>
    json<{ balances: { denom: string; amount: string }[] }>(
      `${BASE}/celestia/balances/${address}`
    ),

  cexSources: () =>
    json<{
      sources: Array<{ chainId: number; name: string; tokens: string[] }>;
    }>(`${BASE}/cex/sources`),

  depositAddress: (
    evmAddress: string,
    sourceChainId: number,
    destChainId: number
  ) =>
    json<{
      depositAddress: string;
      exists: boolean;
      forwardingAddress: string;
    }>(
      `${BASE}/cex/deposit-address?evmAddress=${evmAddress}&sourceChainId=${sourceChainId}&destChainId=${destChainId}`
    ),

  createDepositAccount: (
    evmAddress: string,
    sourceChainId: number,
    destChainId: number
  ) =>
    json<{ depositAddress: string; txHash: string; forwardingAddress: string }>(
      `${BASE}/cex/create-account`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evmAddress, sourceChainId, destChainId }),
      }
    ),

  depositBalances: (depositAddress: string, sourceChainId: number) =>
    json<Record<string, string>>(
      `${BASE}/cex/deposit-balances?address=${depositAddress}&sourceChainId=${sourceChainId}`
    ),

  quote: (
    fromChainId: number,
    toChainId: number,
    amount: string,
    asset: string,
    address: string
  ) =>
    json<{
      quotes: Array<{
        quoteId: string;
        order: { type: string; payload: unknown };
        validUntil: number;
        eta: number;
        provider: string;
        preview: {
          outputs: Array<{ asset: string; amount: string }>;
        };
      }>;
    }>(`${BASE}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromChainId, toChainId, amount, asset, address }),
    }),

  submitOrder: (quote: unknown, signature: string) =>
    json<{ orderId: string }>(`${BASE}/order/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quote, signature }),
    }),

  orderStatus: (id: string) =>
    json<{
      orderId: string;
      status: string | Record<string, unknown>;
      fillTransaction?: { hash: string };
    }>(`${BASE}/order/${id}`),

  bridgePrepare: (
    from: string,
    to: string,
    token: string,
    address: string,
    amount: string
  ) =>
    json<{
      warpToken: string;
      underlyingToken: string | null;
      celestiaDomainId: number;
      forwardingAddressBytes32: string;
      needsApproval: boolean;
      isNative: boolean;
    }>(`${BASE}/bridge/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, token, address, amount }),
    }),
};
