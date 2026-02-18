import express from 'express';
import cors from 'cors';
import { createPublicClient, createWalletClient, http, parseAbi, formatUnits, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
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
  return JSON.parse(readFileSync(resolve(ROOT, '.solver/state.json'), 'utf8'));
}

function getUserAccount() {
  const pk = process.env.USER_PK;
  if (!pk) throw new Error('USER_PK not set in .env');
  return privateKeyToAccount(`0x${pk.replace('0x', '')}`);
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
]);

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
    const user = getUserAccount();
    const chains = {};

    for (const [chainId, chain] of Object.entries(state.chains)) {
      chains[chainId] = {
        name: chain.name,
        chainId: chain.chain_id,
        rpc: chain.rpc,
        tokens: chain.tokens,
        contracts: chain.contracts || {},
      };
    }

    res.json({
      chains,
      userAddress: user.address,
      solverAddress: state.solver?.address ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Balances: all tokens on all chains for user + solver
app.get('/api/balances', async (req, res) => {
  try {
    const state = readState();
    // Use connected wallet address if provided, otherwise fall back to USER_PK
    const addressParam = req.query.address;
    let userAddress;
    if (addressParam && /^0x[0-9a-fA-F]{40}$/.test(addressParam)) {
      userAddress = addressParam;
    } else {
      userAddress = getUserAccount().address;
    }
    console.log(`[balances] user=${userAddress} solver=${state.solver?.address}`);
    const result = {};

    const promises = Object.entries(state.chains).map(async ([chainId, chain]) => {
      const client = createPublicClient({ transport: http(chain.rpc) });
      const chainBal = { user: {}, solver: {} };

      // Token balances
      for (const [symbol, token] of Object.entries(chain.tokens)) {
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

    // Use provided address (from connected wallet) or fall back to USER_PK
    let recipient;
    if (address) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        throw new Error('Invalid Ethereum address');
      }
      recipient = address;
    } else {
      recipient = getUserAccount().address;
    }

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
    } else if (type === 'usdc') {
      const token = chain.tokens['USDC'];
      if (!token) throw new Error('USDC not configured on this chain');

      const hash = await walletClient.writeContract({
        address: token.address,
        abi: erc20Abi,
        functionName: 'mint',
        args: [recipient, 10000000n], // 10 USDC (6 decimals)
      });
      await publicClient.waitForTransactionReceipt({ hash });
      res.json({ success: true, hash, amount: '10 USDC' });
    } else {
      throw new Error('Invalid faucet type. Use "gas" or "usdc".');
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quote: request quote from aggregator
app.post('/api/quote', async (req, res) => {
  const { fromChainId, toChainId, amount, asset = 'USDC', address } = req.body;
  try {
    const state = readState();
    const user = getUserAccount();

    // Use connected wallet address if provided, otherwise fall back to USER_PK
    let userAddress = user.address;
    if (address && /^0x[0-9a-fA-F]{40}$/.test(address)) {
      userAddress = address;
    }

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
      },
      supportedTypes: ['oif-escrow-v0'],
      solverOptions: { timeout: 5000, minQuotes: 1 },
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
    if (!response.ok) throw new Error(data.message || data.error || JSON.stringify(data));
    console.log(`[quote] Got ${data.quotes?.length ?? 0} quotes`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Order: approve tokens, sign EIP-712, prepend type byte, submit to aggregator
app.post('/api/order', async (req, res) => {
  const { quote, fromChainId, asset = 'USDC' } = req.body;
  try {
    const user = getUserAccount();
    const state = readState();

    // Resolve source chain for approval + signing
    const srcChainId = fromChainId?.toString() || Object.keys(state.chains)[0];
    const srcChain = state.chains[srcChainId];
    if (!srcChain) throw new Error(`Source chain ${srcChainId} not found`);

    const viemChain = makeViemChain(srcChain.chain_id, srcChain.name, srcChain.rpc);

    const walletClient = createWalletClient({
      account: user,
      chain: viemChain,
      transport: http(srcChain.rpc),
    });
    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(srcChain.rpc),
    });

    // Step 1: Approve USDC for InputSettlerEscrow on source chain
    const token = srcChain.tokens[asset];
    const inputSettler = srcChain.contracts?.input_settler_escrow;
    if (token && inputSettler) {
      const approveHash = await walletClient.writeContract({
        address: token.address,
        abi: parseAbi(['function approve(address, uint256) returns (bool)']),
        functionName: 'approve',
        args: [inputSettler, 100000000n], // 100 USDC allowance
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    // Step 2: Sign EIP-712 typed data with viem
    const payload = quote.order.payload;

    // Remove EIP712Domain from types (viem adds it automatically)
    const types = { ...payload.types };
    delete types.EIP712Domain;

    // Coerce domain.chainId to number — the aggregator returns it as a string
    // which causes viem to produce a different EIP-712 hash
    const domain = { ...payload.domain };
    if (typeof domain.chainId === 'string') {
      domain.chainId = Number(domain.chainId);
    }

    const rawSignature = await user.signTypedData({
      domain,
      types,
      primaryType: payload.primaryType,
      message: payload.message,
    });

    // Step 3: Prepend ERC-3009 signature type byte (0x01)
    // The contract checks signature[0] for type: 0x00=Permit2, 0x01=EIP-3009, 0xff=self
    const signature = '0x01' + rawSignature.slice(2);

    // Step 4: Submit signed order to aggregator
    const response = await fetch(`${AGGREGATOR_URL}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteResponse: quote, signature }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || JSON.stringify(data));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  console.log(`  State:      ${resolve(ROOT, '.solver/state.json')}\n`);
});
