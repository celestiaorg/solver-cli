import express from 'express';
import cors from 'cors';
import { createPublicClient, createWalletClient, http, parseAbi, formatUnits, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

config({ path: resolve(ROOT, '.env') });

const AGGREGATOR_URL = process.env.AGGREGATOR_URL || 'http://localhost:4000';
const PORT = process.env.BACKEND_PORT || 3001;

// ── Helpers ──────────────────────────────────────────────────────────────────

function readState() {
  return JSON.parse(readFileSync(resolve(ROOT, '.config/state.json'), 'utf8'));
}

function makeViemChain(chainId, name, rpc) {
  return defineChain({
    id: chainId,
    name,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });
}

/** Encode an address to ERC-7930 InteropAddress hex format */
function encodeERC7930(chainId, address) {
  const chainBigInt = BigInt(chainId);
  let chainRefHex = chainBigInt.toString(16);
  if (chainRefHex.length % 2) chainRefHex = '0' + chainRefHex;
  const chainRef = Buffer.from(chainRefHex, 'hex');
  const addrBytes = Buffer.from(address.replace('0x', ''), 'hex');

  const result = Buffer.alloc(2 + 2 + 1 + chainRef.length + 1 + 20);
  result.writeUInt16BE(1, 0);                    // version = 1
  result.writeUInt16BE(0, 2);                    // chainType = EIP-155
  result[4] = chainRef.length;                   // chainRef length
  chainRef.copy(result, 5);                      // chainRef bytes
  result[5 + chainRef.length] = 20;              // address length
  addrBytes.copy(result, 6 + chainRef.length);   // address bytes

  return '0x' + result.toString('hex');
}

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function mint(address, uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address, uint256) returns (bool)',
]);

// ── Bech32 → bytes32 (replaces Python script) ───────────────────────────────

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32ToBytes32(addr) {
  const pos = addr.lastIndexOf('1');
  if (pos < 1) throw new Error(`Invalid bech32 address: ${addr}`);
  const dataPart = addr.slice(pos + 1, -6); // strip checksum (last 6 chars)
  const values = [...dataPart].map(c => {
    const idx = BECH32_CHARSET.indexOf(c);
    if (idx < 0) throw new Error(`Invalid bech32 character: ${c}`);
    return idx;
  });
  // Convert 5-bit groups to 8-bit bytes
  let acc = 0, bits = 0;
  const out = [];
  for (const v of values) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  // Left-pad to 32 bytes
  const padded = new Uint8Array(32);
  padded.set(out, 32 - out.length);
  return '0x' + Buffer.from(padded).toString('hex');
}

// ── Warp Route Config ────────────────────────────────────────────────────────

/**
 * Parse a Hyperlane warp route YAML to extract per-chain addresses.
 * Returns: { chainName: { addressOrDenom, standard, collateralAddressOrDenom? } }
 */
function parseWarpRouteYaml(yamlContent) {
  const blocks = yamlContent.split(/^\s*-\s/m).filter(Boolean);
  const result = {};
  for (const block of blocks) {
    const chain = (block.match(/chainName:\s*['"]?(\w+)/) || [])[1];
    const addr = (block.match(/addressOrDenom:\s*['"]?(0x[0-9a-fA-F]+)/) || [])[1];
    const standard = (block.match(/standard:\s*['"]?(\w+)/) || [])[1];
    const collateral = (block.match(/collateralAddressOrDenom:\s*['"]?(0x[0-9a-fA-F]+)/) || [])[1];
    if (chain && addr) {
      result[chain] = { addressOrDenom: addr, standard, collateralAddressOrDenom: collateral };
    }
  }
  return result;
}

/**
 * Get warp route addresses for a token.
 * Auto-discovers from multiple sources:
 *   1. Hyperlane registry YAML: hyperlane/registry/deployments/warp_routes/{SYMBOL}/
 *   2. hyperlane-addresses.json (USDC backward compat)
 *   3. state.json hyperlane.warp_token fields
 *
 * Returns: { anvil1: { underlying, warpToken, domainId, chainId, rpc },
 *            anvil2: { warpToken, domainId, chainId, rpc },
 *            celestiaDomainId }
 */
function getWarpRouteConfig(token) {
  const state = readState();
  const hypAddresses = readHyperlaneAddresses();
  if (!hypAddresses) return null;

  const celestiaDomainId = hypAddresses.celestiadev?.domain_id || 69420;

  // Build chain metadata lookup by name from state.json
  const stateChainsByName = {};
  for (const chain of Object.values(state.chains)) {
    stateChainsByName[chain.name] = chain;
  }

  // Build domain ID lookup: hyperlane-addresses.json first, then relayer-config.json as fallback
  const domainIds = {};
  for (const [name, data] of Object.entries(hypAddresses)) {
    if (data.domain_id) domainIds[name] = data.domain_id;
  }
  try {
    const relayerCfg = JSON.parse(readFileSync(resolve(ROOT, 'hyperlane/relayer-config.json'), 'utf8'));
    for (const [name, data] of Object.entries(relayerCfg.chains || {})) {
      if (!domainIds[name] && data.domainId) domainIds[name] = data.domainId;
    }
  } catch {}

  // Merge all warp route YAML files for this token (handles routes added incrementally per chain)
  const allParsed = {};
  const warpDir = resolve(ROOT, `hyperlane/registry/deployments/warp_routes/${token}`);
  if (existsSync(warpDir)) {
    for (const file of readdirSync(warpDir).filter(f => f.endsWith('.yaml'))) {
      Object.assign(allParsed, parseWarpRouteYaml(readFileSync(resolve(warpDir, file), 'utf8')));
    }
  }

  // Fallback for USDC: read from hyperlane-addresses.json
  if (token === 'USDC' && Object.keys(allParsed).length === 0) {
    const a1 = hypAddresses.anvil1;
    const a2 = hypAddresses.anvil2;
    if (!a1?.mock_usdc || !a1?.warp_token || !a2?.warp_token) {
      throw new Error('USDC warp route not deployed — missing addresses in hyperlane-addresses.json');
    }
    allParsed.anvil1 = { addressOrDenom: a1.warp_token, collateralAddressOrDenom: a1.mock_usdc, standard: 'HypERC20Collateral' };
    allParsed.anvil2 = { addressOrDenom: a2.warp_token, standard: 'HypERC20' };
  }

  if (Object.keys(allParsed).length === 0) {
    throw new Error(`No warp route found for ${token}. Deploy a Hyperlane warp route first — see docs/deploy-new-token.md`);
  }

  // Build the chains map for all EVM chains (skip Celestia hub)
  const chains = {};
  for (const [chainName, entry] of Object.entries(allParsed)) {
    if (chainName === 'celestiadev') continue;
    const stateChain = stateChainsByName[chainName];
    if (!stateChain) continue; // chain not in state.json, skip
    const isCollateral = !!(entry.standard?.includes('Collateral') || entry.collateralAddressOrDenom);
    const underlying = entry.collateralAddressOrDenom || stateChain.tokens?.[token]?.address;
    if (isCollateral && !underlying) {
      throw new Error(`Warp route for ${token}/${chainName} is collateral type but no underlying ERC20 found. Register it with: make token-add CHAIN=${chainName} SYMBOL=${token} ADDRESS=<addr> DECIMALS=6`);
    }
    chains[chainName] = {
      warpToken: entry.addressOrDenom,
      warpType: isCollateral ? 'collateral' : 'synthetic',
      underlying: isCollateral ? underlying : undefined,
      domainId: domainIds[chainName] ?? stateChain.chain_id,
      chainId: stateChain.chain_id,
      rpc: stateChain.rpc,
    };
  }

  if (Object.keys(chains).length === 0) {
    throw new Error(`Warp route for ${token} found but no chains matched state.json. Run make deploy first.`);
  }

  return { chains, celestiaDomainId };
}

function readHyperlaneAddresses() {
  try {
    return JSON.parse(readFileSync(resolve(ROOT, '.config/hyperlane-addresses.json'), 'utf8'));
  } catch {
    return null;
  }
}

/** Check if a chain is the origin (collateral) chain — it has mock_usdc in hyperlane addresses */
function isOriginChain(chainName, hypAddresses) {
  if (!hypAddresses) return true; // No Hyperlane setup, assume all chains are mintable
  const data = hypAddresses[chainName.toLowerCase()];
  return data && data.mock_usdc;
}

// ── Error helpers ────────────────────────────────────────────────────────────

/**
 * Map raw aggregator error messages to user-friendly descriptions.
 * The aggregator returns generic strings; we enrich them with actionable context.
 */
function mapAggregatorQuoteError(msg) {
  if (typeof msg !== 'string') return JSON.stringify(msg);
  const lower = msg.toLowerCase();
  if (lower.includes('all solvers failed') || lower.includes('no quotes')) {
    return `SOLVER_REJECTED: ${msg}`;
  }
  if (lower.includes('no solvers available') || lower.includes('solver offline')) {
    return `SOLVER_OFFLINE: ${msg}`;
  }
  return msg;
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

// Config: chain info, user address, solver address
app.get('/api/config', (_req, res) => {
  try {
    const state = readState();
    const chains = {};

    // Build warp route fallback tokens (same logic as /api/balances)
    const warpTokenByChainName = {};
    try {
      for (const symbol of ['USDC']) {
        const warp = getWarpRouteConfig(symbol);
        if (!warp) continue;
        for (const [chainName, info] of Object.entries(warp.chains)) {
          if (!warpTokenByChainName[chainName]) warpTokenByChainName[chainName] = {};
          const queryAddr = info.warpType === 'collateral' ? info.underlying : info.warpToken;
          if (queryAddr) warpTokenByChainName[chainName][symbol] = { address: queryAddr, symbol, decimals: 6, token_type: 'erc20' };
        }
      }
    } catch {}

    for (const [chainId, chain] of Object.entries(state.chains)) {
      const warpFallback = warpTokenByChainName[chain.name] ?? {};
      const tokens = Object.keys(chain.tokens).length > 0 ? chain.tokens : warpFallback;
      chains[chainId] = {
        name: chain.name,
        chainId: chain.chain_id,
        rpc: chain.rpc,
        tokens,
        contracts: chain.contracts || {},
      };
    }

    // Determine which chains support faucet (origin chains with mintable tokens)
    const hypAddresses = readHyperlaneAddresses();
    const faucetChains = Object.values(state.chains)
      .filter(c => isOriginChain(c.name, hypAddresses))
      .filter(c => c.rpc.includes('127.0.0.1') || c.rpc.includes('localhost'))
      .map(c => c.name);

    res.json({
      chains,
      solverAddress: state.solver?.address ?? null,
      faucetChains,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Balances: all tokens on all chains for user + solver
app.get('/api/balances', async (req, res) => {
  try {
    const state = readState();
    const addressParam = req.query.address;
    if (!addressParam || !/^0x[0-9a-fA-F]{40}$/.test(addressParam)) {
      return res.status(400).json({ error: 'Missing or invalid "address" query parameter. Connect a wallet.' });
    }
    const userAddress = addressParam;
    console.log(`[balances] user=${userAddress} solver=${state.solver?.address}`);
    const result = {};

    // Build warp route fallback: chainName -> symbol -> { address, decimals }
    // Used when state.json tokens are missing (e.g. race condition or testnet chains)
    const warpTokenByChainName = {};
    try {
      for (const symbol of ['USDC']) {
        const warp = getWarpRouteConfig(symbol);
        if (!warp) continue;
        for (const [chainName, info] of Object.entries(warp.chains)) {
          if (!warpTokenByChainName[chainName]) warpTokenByChainName[chainName] = {};
          // For balance queries: collateral chain → underlying ERC20; synthetic → warpToken
          const queryAddr = info.warpType === 'collateral' ? info.underlying : info.warpToken;
          if (queryAddr) warpTokenByChainName[chainName][symbol] = { address: queryAddr, decimals: 6 };
        }
      }
    } catch {}

    const promises = Object.entries(state.chains).map(async ([chainId, chain]) => {
      const client = createPublicClient({ transport: http(chain.rpc) });
      const chainBal = { user: {}, solver: {} };

      // Merge state tokens with warp route fallback (state takes precedence)
      const warpFallback = warpTokenByChainName[chain.name] ?? {};
      const tokensToQuery = { ...warpFallback, ...chain.tokens };

      // Token balances
      for (const [symbol, token] of Object.entries(tokensToQuery)) {
        try {
          const userBal = await client.readContract({
            address: token.address, abi: erc20Abi,
            functionName: 'balanceOf', args: [userAddress],
          });
          chainBal.user[symbol] = { raw: userBal.toString(), formatted: formatUnits(userBal, token.decimals) };
        } catch { chainBal.user[symbol] = { raw: '0', formatted: '0' }; }

        if (state.solver?.address) {
          try {
            const solverBal = await client.readContract({
              address: token.address, abi: erc20Abi,
              functionName: 'balanceOf', args: [state.solver.address],
            });
            chainBal.solver[symbol] = { raw: solverBal.toString(), formatted: formatUnits(solverBal, token.decimals) };
          } catch { chainBal.solver[symbol] = { raw: '0', formatted: '0' }; }
        }
      }

      // ETH balance
      try {
        const ethBal = await client.getBalance({ address: userAddress });
        chainBal.user['ETH'] = { raw: ethBal.toString(), formatted: parseFloat(formatUnits(ethBal, 18)).toFixed(4) };
      } catch { chainBal.user['ETH'] = { raw: '0', formatted: '0' }; }

      if (state.solver?.address) {
        try {
          const ethBal = await client.getBalance({ address: state.solver.address });
          chainBal.solver['ETH'] = { raw: ethBal.toString(), formatted: parseFloat(formatUnits(ethBal, 18)).toFixed(4) };
        } catch { chainBal.solver['ETH'] = { raw: '0', formatted: '0' }; }
      }

      result[chainId] = { name: chain.name, balances: chainBal };
    });

    await Promise.all(promises);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Faucet: send gas or mint USDC
app.post('/api/faucet', async (req, res) => {
  const { chainName, type, address } = req.body;
  try {
    const state = readState();
    const chain = Object.values(state.chains).find(c => c.name === chainName);
    if (!chain) throw new Error(`Chain "${chainName}" not found`);

    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error('Missing or invalid "address". Connect a wallet first.');
    }
    const recipient = address;

    // Resolve deployer key
    const envKey = `${chainName.toUpperCase()}_PK`;
    const deployerPk = process.env[envKey];
    if (!deployerPk) throw new Error(`No deployer key (${envKey}) for chain ${chainName}`);

    const deployer = privateKeyToAccount(`0x${deployerPk.replace('0x', '')}`);
    const viemChain = makeViemChain(chain.chain_id, chain.name, chain.rpc);

    const walletClient = createWalletClient({
      account: deployer,
      chain: viemChain,
      transport: http(chain.rpc),
    });
    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(chain.rpc),
    });

    if (type === 'gas') {
      const hash = await walletClient.sendTransaction({
        to: recipient,
        value: 1000000000000000000n, // 1 ETH
      });
      await publicClient.waitForTransactionReceipt({ hash });
      res.json({ success: true, hash, amount: '1 ETH' });
    } else if (type === 'token') {
      const symbol = req.body.symbol || 'USDC';
      const token = chain.tokens[symbol];
      if (!token) throw new Error(`${symbol} not configured on this chain`);

      // Only allow minting on origin chains (where MockERC20 has public mint)
      const hypAddresses = readHyperlaneAddresses();
      if (!isOriginChain(chainName, hypAddresses)) {
        throw new Error(`Cannot mint on ${chainName} — it uses bridged tokens. Use the faucet on the origin chain and bridge.`);
      }

      const mintAmount = BigInt(10 * (10 ** token.decimals));
      const hash = await walletClient.writeContract({
        address: token.address,
        abi: erc20Abi,
        functionName: 'mint',
        args: [recipient, mintAmount],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      res.json({ success: true, hash, amount: `10 ${symbol}` });
    } else if (type === 'usdc') {
      // Backward compat: treat 'usdc' as token mint for USDC
      const token = chain.tokens['USDC'];
      if (!token) throw new Error('USDC not configured on this chain');
      const hypAddresses = readHyperlaneAddresses();
      if (!isOriginChain(chainName, hypAddresses)) {
        throw new Error(`Cannot mint on ${chainName} — it uses bridged tokens.`);
      }
      const hash = await walletClient.writeContract({
        address: token.address, abi: erc20Abi, functionName: 'mint',
        args: [recipient, 10000000n],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      res.json({ success: true, hash, amount: '10 USDC' });
    } else {
      throw new Error('Invalid faucet type. Use "gas" or "token".');
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bridge prepare: derive forwarding address + register, return contract info for wallet-side execution
app.post('/api/bridge/prepare', async (req, res) => {
  const { from, to, token = 'USDC', amount = '10000000', address } = req.body;
  if (!from || !to) return res.status(400).json({ error: '"from" and "to" are required' });
  if (!address) return res.status(400).json({ error: '"address" (user wallet) is required' });
  try {
    const warp = getWarpRouteConfig(token);
    if (!warp) return res.status(503).json({ error: 'Slow route unavailable: Hyperlane not deployed on this network' });
    const src = warp.chains[from];
    const dst = warp.chains[to];
    if (!src) throw new Error(`Chain "${from}" not found in ${token} warp route`);
    if (!dst) throw new Error(`Chain "${to}" not found in ${token} warp route`);

    const forwardingBackend = process.env.FORWARDING_BACKEND || 'http://127.0.0.1:8080';
    const recipientPadded = '0x000000000000000000000000' + address.replace('0x', '');

    const addrResp = await fetch(
      `${forwardingBackend}/forwarding-address?dest_domain=${dst.domainId}&dest_recipient=${recipientPadded}`
    );
    if (!addrResp.ok) throw new Error(`Failed to derive forwarding address: ${await addrResp.text()}`);
    const { address: forwardAddr } = await addrResp.json();

    const registerResp = await fetch(`${forwardingBackend}/forwarding-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forward_addr: forwardAddr, dest_domain: dst.domainId, dest_recipient: recipientPadded }),
    });
    if (!registerResp.ok) throw new Error(`Forwarding registration failed: ${await registerResp.text()}`);

    const needsApproval = src.warpType === 'collateral';
    res.json({
      warpToken: src.warpToken,
      underlyingToken: needsApproval ? src.underlying : null,
      celestiaDomainId: warp.celestiaDomainId,
      forwardingAddressBytes32: bech32ToBytes32(forwardAddr),
      needsApproval,
    });
  } catch (err) {
    res.status(500).json({ error: `Bridge prepare failed: ${err.message}` });
  }
});

// Bridge: server-side signing removed — wallet handles tx submission via /api/bridge/prepare
app.post('/api/bridge', (_req, res) => {
  res.status(400).json({ error: 'Server-side bridge removed. Connect a wallet and use the wallet-based bridge flow.' });
});

// Quote: request quote from aggregator
app.post('/api/quote', async (req, res) => {
  const { fromChainId, toChainId, amount, asset = 'USDC', address } = req.body;
  try {
    const state = readState();
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error('Missing or invalid "address". Connect a wallet first.');
    }
    const userAddress = address;

    const fromChain = state.chains[fromChainId.toString()];
    const toChain = state.chains[toChainId.toString()];
    if (!fromChain) throw new Error(`Source chain ${fromChainId} not found`);
    if (!toChain) throw new Error(`Destination chain ${toChainId} not found`);

    const fromToken = fromChain.tokens[asset];
    const toToken = toChain.tokens[asset];
    if (!fromToken) throw new Error(`${asset} not found on ${fromChain.name}`);
    if (!toToken) throw new Error(`${asset} not found on ${toChain.name}`);

    const userFrom = encodeERC7930(fromChainId, userAddress);
    const userTo = encodeERC7930(toChainId, userAddress);
    const assetFrom = encodeERC7930(fromChainId, fromToken.address);
    const assetTo = encodeERC7930(toChainId, toToken.address);

    const quoteReq = {
      user: userFrom,
      intent: {
        intentType: 'oif-swap',
        inputs: [{ user: userFrom, asset: assetFrom, amount: amount.toString() }],
        outputs: [{ receiver: userTo, asset: assetTo }],
        swapType: 'exact-input',
        originSubmission: { mode: 'user', schemes: ['permit2'] },
      },
      supportedTypes: ['oif-escrow-v0'],
      solverOptions: { timeout: 60000, minQuotes: 1 },
    };

    console.log(`[quote] user=${userAddress} from=${fromChainId}(${fromChain.name}) to=${toChainId}(${toChain.name}) amount=${amount}`);
    console.log(`[quote] ERC7930 userFrom=${userFrom} userTo=${userTo}`);
    console.log(`[quote] ERC7930 assetFrom=${assetFrom} assetTo=${assetTo}`);

    const response = await fetch(`${AGGREGATOR_URL}/api/v1/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteReq),
    });

    const data = await response.json();
    if (!response.ok) {
      const rawMsg = data.message || data.error || JSON.stringify(data);
      throw new Error(mapAggregatorQuoteError(rawMsg));
    }
    console.log(`[quote] Got ${data.quotes?.length ?? 0} quotes`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Order: deprecated server-side signing — use /api/order/submit with wallet signature
app.post('/api/order', (_req, res) => {
  res.status(400).json({ error: 'Server-side signing removed. Connect a wallet and use the client-side signing flow.' });
});

// Order submit: forward a pre-signed order (for MetaMask / client-side signing flow)
app.post('/api/order/submit', async (req, res) => {
  const { quote, signature } = req.body;
  try {
    if (!quote || !signature) throw new Error('Missing quote or signature');

    console.log(`[order/submit] MetaMask flow — quoteId=${quote.quoteId} provider=${quote.provider}`);
    console.log(`[order/submit] EIP-712 domain:`, JSON.stringify(quote.order?.payload?.domain));
    console.log(`[order/submit] signature prefix: ${signature.slice(0, 6)}...`);

    const response = await fetch(`${AGGREGATOR_URL}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteResponse: quote, signature }),
    });

    const data = await response.json();
    console.log(`[order/submit] aggregator response: ${response.status}`, JSON.stringify(data).slice(0, 200));
    if (!response.ok) throw new Error(data.message || data.error || JSON.stringify(data));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Order status
app.get('/api/order/:id', async (req, res) => {
  try {
    const response = await fetch(`${AGGREGATOR_URL}/api/v1/orders/${req.params.id}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || JSON.stringify(data));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  OIF Solver Backend`);
  console.log(`  ─────────────────`);
  console.log(`  API:        http://localhost:${PORT}/api`);
  console.log(`  Aggregator: ${AGGREGATOR_URL}`);
  console.log(`  State:      ${resolve(ROOT, '.config/state.json')}\n`);
});
