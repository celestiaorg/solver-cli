// Server-side chain config
// Loads from ../.config/state.json when available (local anvil),
// otherwise falls back to hardcoded testnet config.

import * as fs from 'fs';
import * as path from 'path';

export interface ChainDef {
  id: number;
  name: string;
  rpcUrl: string;
}

export interface ChainContracts {
  chainId: number;
  domainId: number;
  inputSettler: string;
  outputSettler: string;
  oracle: string;
  tokens: Record<string, { address: string; decimals: number }>;
  warpRoutes?: Record<string, string>;
}

export interface ChainsCfg {
  chains: ChainDef[];
  contracts: Record<string, ChainContracts>;
  celestia: { domainId: number; restUrl: string; rpcUrl: string; syntheticTokens: Record<string, string> };
  forwardingService: string;
  solverAddress: string | null;
}

// ── Hardcoded testnet config (Sepolia + Eden) ──────────────────────────────

const TESTNET_CONFIG: ChainsCfg = {
  chains: [
    {
      id: 11155111,
      name: 'sepolia',
      rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    },
    {
      id: 3735928814,
      name: 'eden',
      rpcUrl: 'https://ev-reth-eden-testnet.binarybuilders.services:8545',
    },
  ],
  contracts: {
    '11155111': {
      chainId: 11155111,
      domainId: 11155111,
      inputSettler: '0x156AEa0bBdf1B9A338E2E382e473D18dFb263198',
      outputSettler: '0xDc09667c8f29Bae5cd9A9c97C014834110C06f0E',
      oracle: '0x9265b88c3AF6b1445fCA1C6b446978aD7a1bdAaE',
      tokens: {
        USDC: { address: '0xf77764d1E232Ec088150a3E434678768f8774f21', decimals: 6 },
        LBTC: { address: '0x0A3eC97CA4082e83FeB77Fa69F127F0eAABD016E', decimals: 8 },
        ETH: { address: '0xEEea7Edeb303A1D20F3742edfC66F188f805a28E', decimals: 18 },
      },
      warpRoutes: {
        USDC: '0x22cCd0e1efc2beF46143eA00e3868A35ebA16113',
        LBTC: '0x101612E45d8D1ebE8e2EB90373b7cCecB6F52F5C',
        ETH: '0xEEea7Edeb303A1D20F3742edfC66F188f805a28E',
      },
    },
    '3735928814': {
      chainId: 3735928814,
      domainId: 2147483647,
      inputSettler: '0x2b3789733d542531642CB6B29ceDAf6865Fe1C53',
      outputSettler: '0x272dF2585c54d6E135379f3Fb079508E80D10135',
      oracle: '0x933D26259a4F031a3D836E529DD5dE9b097EFA86',
      tokens: {
        USDC: { address: '0x0C1c5a78669ea6cb269883ad1B65334319Aacfd7', decimals: 6 },
        ETH: { address: '0xf8e7A4608AE1e77743FD83549b36E605213760b6', decimals: 18 },
        LBTC: { address: '0x4d46424A8AA50e7c585F218338BCCE4a9a992c0F', decimals: 8 },
        TIA: { address: '0x43505da95A74Fa577FB9bB0Ce29E293FdF575011', decimals: 18 },
      },
      warpRoutes: {
        USDC: '0x0C1c5a78669ea6cb269883ad1B65334319Aacfd7',
        ETH: '0xf8e7A4608AE1e77743FD83549b36E605213760b6',
        LBTC: '0x4d46424A8AA50e7c585F218338BCCE4a9a992c0F',
      },
    },
  },
  celestia: {
    domainId: 1297040200,
    restUrl: 'https://api-mocha.pops.one',
    rpcUrl: 'https://rpc-mocha.pops.one',
    syntheticTokens: {},
  },
  forwardingService: 'http://51.15.252.63:8080',
  solverAddress: null,
};

// ── Load from state.json ────────────────────────────────────────────────────

function loadFromStateJson(): ChainsCfg | null {
  const statePath = path.resolve(__dirname, '../../.config/state.json');
  if (!fs.existsSync(statePath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const chains: ChainDef[] = [];
    const contracts: Record<string, ChainContracts> = {};

    for (const [chainId, chain] of Object.entries(raw.chains || {})) {
      const c = chain as any;
      chains.push({ id: Number(chainId), name: c.name, rpcUrl: c.rpc });

      const tokens: Record<string, { address: string; decimals: number }> = {};
      for (const [symbol, tok] of Object.entries(c.tokens || {})) {
        const t = tok as any;
        tokens[symbol] = { address: t.address, decimals: t.decimals || 18 };
      }

      // Use Hyperlane domain ID if available, otherwise chain ID
      const domainId = c.contracts?.hyperlane?.domain_id
        ? Number(c.contracts.hyperlane.domain_id)
        : Number(chainId);

      contracts[chainId] = {
        chainId: Number(chainId),
        domainId,
        inputSettler: c.contracts?.input_settler_escrow || '',
        outputSettler: c.contracts?.output_settler_simple || '',
        oracle: c.contracts?.oracle || '',
        tokens,
        warpRoutes: c.contracts?.hyperlane?.warp_token
          ? { USDC: c.contracts.hyperlane.warp_token }
          : undefined,
      };
    }

    // Read Hyperlane addresses for domain IDs and Celestia token IDs
    let celestiaSyntheticTokens: Record<string, string> = {};
    const hypPath = path.resolve(__dirname, '../../.config/hyperlane-addresses.json');
    if (fs.existsSync(hypPath)) {
      try {
        const hyp = JSON.parse(fs.readFileSync(hypPath, 'utf8'));
        for (const [name, info] of Object.entries(hyp)) {
          const h = info as any;
          const chainId = h.chain_id?.toString();
          if (chainId && contracts[chainId] && h.domain_id) {
            contracts[chainId].domainId = h.domain_id;
          }
          if (chainId && contracts[chainId] && h.warp_token) {
            contracts[chainId].warpRoutes = {
              ...contracts[chainId].warpRoutes,
              USDC: h.warp_token,
            };
          }
        }
        // Read Celestia synthetic token IDs
        if (hyp.celestiadev?.synthetic_tokens) {
          celestiaSyntheticTokens = hyp.celestiadev.synthetic_tokens;
        } else if (hyp.celestiadev?.synthetic_token) {
          celestiaSyntheticTokens = { USDC: hyp.celestiadev.synthetic_token };
        }
      } catch { /* ignore hyperlane parse errors */ }
    }

    const solverAddress = raw.solver?.address || null;

    console.log(
      `  Loaded ${chains.length} chain(s) from state.json: ${chains.map(c => `${c.name} (${c.id})`).join(', ')}`
    );

    return {
      chains,
      contracts,
      celestia: {
        domainId: Number(process.env.CELESTIA_DOMAIN || 69420),
        restUrl: process.env.CELESTIA_REST || 'http://127.0.0.1:1317',
        rpcUrl: process.env.CELESTIA_RPC || 'http://127.0.0.1:26657',
        syntheticTokens: celestiaSyntheticTokens,
      },
      forwardingService: process.env.FORWARDING_BACKEND || 'http://127.0.0.1:8080',
      solverAddress,
    };
  } catch (err) {
    console.warn('Failed to load state.json, using testnet config:', (err as Error).message);
    return null;
  }
}

// ── Export ───────────────────────────────────────────────────────────────────

export const CONFIG = loadFromStateJson() || TESTNET_CONFIG;
