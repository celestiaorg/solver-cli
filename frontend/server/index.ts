import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { createPublicClient, formatUnits, http, parseAbi } from 'viem';

import { CONFIG } from './chains.js';

const PORT = process.env.PORT || 3001;
const AGGREGATOR_URL = process.env.AGGREGATOR_URL || 'http://localhost:4000';
const FORWARDING_SERVICE =
  process.env.FORWARDING_SERVICE || CONFIG.forwardingService;

// ── Cached config (loaded once on startup) ──────────────────────────────────

interface ApiChainDef {
  name: string;
  chainId: number;
  rpc: string;
  domainId: number;
  tokens: Record<string, { address: string; symbol: string; decimals: number }>;
  contracts: Record<string, string>;
}

interface CachedConfig {
  chains: Record<string, ApiChainDef>;
  solverAddress: string | null;
  cex: {
    celestiaDomain: number;
    sources: Record<string, unknown>;
  };
  forwarding: {
    serviceUrl: string;
  };
}

function loadApiConfig(): CachedConfig {
  const chains: Record<string, ApiChainDef> = {};

  for (const chain of CONFIG.chains) {
    const c = CONFIG.contracts[chain.id.toString()];
    if (!c) continue;

    const tokens: Record<string, { address: string; symbol: string; decimals: number }> = {};
    for (const [symbol, tok] of Object.entries(c.tokens)) {
      tokens[symbol] = { address: tok.address, symbol, decimals: tok.decimals };
    }

    chains[chain.id.toString()] = {
      name: chain.name,
      chainId: chain.id,
      rpc: chain.rpcUrl,
      domainId: c.domainId,
      tokens,
      contracts: {
        inputSettler: c.inputSettler,
        outputSettler: c.outputSettler,
        oracle: c.oracle,
      },
    };
  }

  return {
    chains,
    solverAddress: process.env.SOLVER_ADDRESS || CONFIG.solverAddress,
    cex: {
      celestiaDomain: CONFIG.celestia.domainId,
      sources: {},
    },
    forwarding: {
      serviceUrl: FORWARDING_SERVICE,
    },
  };
}

const API_CONFIG = loadApiConfig();

// ── Viem clients (cached) ────────────────────────────────────────────────────

const clients: Record<number, ReturnType<typeof createPublicClient>> = {};
for (const chain of CONFIG.chains) {
  clients[chain.id] = createPublicClient({ transport: http(chain.rpcUrl) });
}

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

// ── ERC-7930 InteropAddress encoding ─────────────────────────────────────────

function encodeERC7930(chainId: number, address: string): string {
  const chainBigInt = BigInt(chainId);
  let chainRefHex = chainBigInt.toString(16);
  if (chainRefHex.length % 2) chainRefHex = '0' + chainRefHex;
  const chainRef = Buffer.from(chainRefHex, 'hex');
  const addrBytes = Buffer.from(address.replace('0x', ''), 'hex');

  const result = Buffer.alloc(2 + 2 + 1 + chainRef.length + 1 + 20);
  result.writeUInt16BE(1, 0);
  result.writeUInt16BE(0, 2);
  result[4] = chainRef.length;
  chainRef.copy(result, 5);
  result[5 + chainRef.length] = 20;
  addrBytes.copy(result, 6 + chainRef.length);

  return '0x' + result.toString('hex');
}

// ── Bech32 → bytes32 ────────────────────────────────────────────────────────

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32ToBytes32(addr: string): string {
  const pos = addr.lastIndexOf('1');
  if (pos < 1) throw new Error(`Invalid bech32 address: ${addr}`);
  const dataPart = addr.slice(pos + 1, -6);
  const values = [...dataPart].map(c => {
    const idx = BECH32_CHARSET.indexOf(c);
    if (idx < 0) throw new Error(`Invalid bech32 character: ${c}`);
    return idx;
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
  const padded = new Uint8Array(32);
  padded.set(out, 32 - out.length);
  return '0x' + Buffer.from(padded).toString('hex');
}

// ── Express App ──────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/api/health', async (_req, res) => {
  try {
    const agg = await fetch(`${AGGREGATOR_URL}/health`).catch(() => null);
    res.json({
      backend: 'ok',
      aggregator: agg?.ok ? 'ok' : 'down',
    });
  } catch {
    res.json({ backend: 'ok', aggregator: 'down' });
  }
});

// Config (no IO - returns cached config)
app.get('/api/config', (_req, res) => {
  res.json(API_CONFIG);
});

// EVM Balances
app.get('/api/balances', async (req, res) => {
  try {
    const address = req.query.address as string;
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const result: Record<string, unknown> = {};

    const promises = Object.entries(API_CONFIG.chains).map(
      async ([chainId, chain]) => {
        const client = clients[chain.chainId];
        if (!client) return;

        const chainBal: {
          user: Record<string, unknown>;
          solver: Record<string, unknown>;
        } = {
          user: {},
          solver: {},
        };

        // Token balances
        for (const [symbol, token] of Object.entries(chain.tokens)) {
          try {
            const bal = await client.readContract({
              address: token.address as `0x${string}`,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [address as `0x${string}`],
            });
            chainBal.user[symbol] = {
              raw: bal.toString(),
              formatted: formatUnits(bal, token.decimals),
            };
          } catch {
            chainBal.user[symbol] = { raw: '0', formatted: '0' };
          }
        }

        // ETH balance
        try {
          const ethBal = await client.getBalance({
            address: address as `0x${string}`,
          });
          chainBal.user['ETH_NATIVE'] = {
            raw: ethBal.toString(),
            formatted: parseFloat(formatUnits(ethBal, 18)).toFixed(4),
          };
        } catch {
          chainBal.user['ETH_NATIVE'] = { raw: '0', formatted: '0' };
        }

        // Solver balances
        if (API_CONFIG.solverAddress) {
          for (const [symbol, token] of Object.entries(chain.tokens)) {
            try {
              const bal = await client.readContract({
                address: token.address as `0x${string}`,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [API_CONFIG.solverAddress as `0x${string}`],
              });
              chainBal.solver[symbol] = {
                raw: bal.toString(),
                formatted: formatUnits(bal, token.decimals),
              };
            } catch {
              chainBal.solver[symbol] = { raw: '0', formatted: '0' };
            }
          }
        }

        result[chainId] = { name: chain.name, balances: chainBal };
      }
    );

    await Promise.all(promises);
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Celestia balances
app.get('/api/celestia/balances/:address', async (req, res) => {
  try {
    const { address } = req.params;
    if (!address.startsWith('celestia')) {
      return res.status(400).json({ error: 'Invalid Celestia address' });
    }

    const response = await fetch(
      `${CONFIG.celestia.restUrl}/cosmos/bank/v1beta1/balances/${address}`
    );
    if (!response.ok) {
      throw new Error(`Celestia API error: ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Cross-chain transfer endpoints ───────────────────────────────────────────

// Quote (proxy to aggregator)
app.post('/api/quote', async (req, res) => {
  const { fromChainId, toChainId, amount, asset = 'USDC', address } = req.body;
  try {
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error('Invalid address');
    }

    const fromChain = API_CONFIG.chains[fromChainId?.toString()];
    const toChain = API_CONFIG.chains[toChainId?.toString()];
    if (!fromChain) throw new Error(`Source chain ${fromChainId} not found`);
    if (!toChain) throw new Error(`Destination chain ${toChainId} not found`);

    const fromToken = fromChain.tokens[asset];
    const toToken = toChain.tokens[asset];
    if (!fromToken) throw new Error(`${asset} not on ${fromChain.name}`);
    if (!toToken) throw new Error(`${asset} not on ${toChain.name}`);

    const userFrom = encodeERC7930(fromChainId, address);
    const userTo = encodeERC7930(toChainId, address);
    const assetFrom = encodeERC7930(fromChainId, fromToken.address);
    const assetTo = encodeERC7930(toChainId, toToken.address);

    const quoteReq = {
      user: userFrom,
      intent: {
        intentType: 'oif-swap',
        inputs: [
          { user: userFrom, asset: assetFrom, amount: amount.toString() },
        ],
        outputs: [{ receiver: userTo, asset: assetTo }],
        swapType: 'exact-input',
        originSubmission: { mode: 'user', schemes: ['permit2'] },
      },
      supportedTypes: ['oif-escrow-v0'],
      solverOptions: { timeout: 60000, minQuotes: 1 },
    };

    console.log(
      `[quote] from=${fromChain.name} to=${toChain.name} amount=${amount} ${asset}`
    );

    const response = await fetch(`${AGGREGATOR_URL}/api/v1/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteReq),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.error || JSON.stringify(data));
    }
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Submit signed order
app.post('/api/order/submit', async (req, res) => {
  const { quote, signature } = req.body;
  try {
    if (!quote || !signature) throw new Error('Missing quote or signature');

    const response = await fetch(`${AGGREGATOR_URL}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteResponse: quote, signature }),
    });

    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || data.error || JSON.stringify(data));
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Order status
app.get('/api/order/:id', async (req, res) => {
  try {
    const response = await fetch(
      `${AGGREGATOR_URL}/api/v1/orders/${req.params.id}`
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || data.error || JSON.stringify(data));
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Bridge prepare (slow route via Celestia)
app.post('/api/bridge/prepare', async (req, res) => {
  const { from, to, token = 'USDC', address, amount = '1000000' } = req.body;
  if (!from || !to)
    return res.status(400).json({ error: '"from" and "to" required' });
  if (!address) return res.status(400).json({ error: '"address" required' });

  try {
    const fromChain = Object.values(API_CONFIG.chains).find(c => c.name === from);
    const toChain = Object.values(API_CONFIG.chains).find(c => c.name === to);
    if (!fromChain) throw new Error(`Chain "${from}" not found`);
    if (!toChain) throw new Error(`Chain "${to}" not found`);

    const recipientPadded =
      '0x000000000000000000000000' + address.replace('0x', '');

    // Resolve Celestia warp token ID for forwarding
    const celestiaTokenId = CONFIG.celestia.syntheticTokens[token];
    if (!celestiaTokenId) throw new Error(`No Celestia synthetic token ID for ${token}`);

    // Get forwarding address from forwarding service
    const addrResp = await fetch(
      `${FORWARDING_SERVICE}/forwarding-address?dest_domain=${toChain.domainId}&dest_recipient=${recipientPadded}&token_id=${celestiaTokenId}`
    );
    if (!addrResp.ok)
      throw new Error(
        `Forwarding address derivation failed: ${await addrResp.text()}`
      );
    const { address: forwardAddr } = await addrResp.json();

    // Register forwarding request
    const registerResp = await fetch(
      `${FORWARDING_SERVICE}/forwarding-requests`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forward_addr: forwardAddr,
          dest_domain: toChain.domainId,
          dest_recipient: recipientPadded,
          token_id: celestiaTokenId,
        }),
      }
    );
    if (!registerResp.ok)
      throw new Error(
        `Forwarding registration failed: ${await registerResp.text()}`
      );

    // Find warp route for token on source chain
    const contracts = CONFIG.contracts[fromChain.chainId.toString()];
    const warpToken = contracts?.warpRoutes?.[token];
    const underlyingToken = contracts?.tokens[token]?.address || null;
    const needsApproval = !!underlyingToken && underlyingToken !== warpToken;

    res.json({
      warpToken: warpToken || underlyingToken,
      underlyingToken: needsApproval ? underlyingToken : null,
      celestiaDomainId: CONFIG.celestia.domainId,
      forwardingAddressBytes32: bech32ToBytes32(forwardAddr),
      needsApproval,
      isNative: false,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// CEX endpoints (stubs for local mode)
app.get('/api/cex/sources', (_req, res) => {
  res.json({ sources: [] });
});

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const chainNames = CONFIG.chains.map(c => `${c.name} (${c.id})`).join(', ');
  console.log(`\n  Eden Bridge Backend`);
  console.log(`  ───────────────────`);
  console.log(`  API:           http://localhost:${PORT}/api`);
  console.log(`  Aggregator:    ${AGGREGATOR_URL}`);
  console.log(`  Forwarding:    ${FORWARDING_SERVICE}`);
  console.log(`  Chains:        ${chainNames}\n`);
});
