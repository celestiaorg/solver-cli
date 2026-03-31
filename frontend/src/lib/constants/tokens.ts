// Token and chain configuration for local anvil chains

export const CHAIN_CONFIG = {
  anvil1: {
    chainId: 31337,
    domainId: 131337,
    name: 'Anvil1',
    serverName: 'anvil1',
    rpc: 'http://127.0.0.1:8545',
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  },
  anvil2: {
    chainId: 31338,
    domainId: 31338,
    name: 'Anvil2',
    serverName: 'anvil2',
    rpc: 'http://127.0.0.1:8546',
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  },
} as const;

export const CONTRACTS = {
  anvil1: {
    usdc: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    inputSettler: '0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E',
    outputSettler: '0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690',
    oracle: '0x67d269191c92Caf3cD7723F116c85e6E9bf55933',
  },
  anvil2: {
    usdc: '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44',
    inputSettler: '0xc5a5C42992dECbae36851359345FE25997F5C42d',
    outputSettler: '0x67d269191c92Caf3cD7723F116c85e6E9bf55933',
    oracle: '0x09635F643e140090A9A8Dcd712eD6285858ceBef',
  },
  celestia: {
    domainId: 69420,
    restUrl: 'http://127.0.0.1:1317',
  },
  forwardingService: 'http://127.0.0.1:8080',
} as const;

export interface TokenDef {
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
  addresses: Partial<
    Record<
      number,
      {
        token: string | 'native';
        warpRoute?: string;
        type: 'collateral' | 'synthetic' | 'native';
      }
    >
  >;
}

export const TOKENS: Record<string, TokenDef> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    addresses: {
      [CHAIN_CONFIG.anvil1.chainId]: {
        token: CONTRACTS.anvil1.usdc,
        type: 'collateral',
      },
      [CHAIN_CONFIG.anvil2.chainId]: {
        token: CONTRACTS.anvil2.usdc,
        type: 'synthetic',
      },
    },
  },
};

export function getTokensForRoute(
  fromChainId: number,
  toChainId: number
): string[] {
  return Object.keys(TOKENS).filter(
    s => TOKENS[s].addresses[fromChainId] && TOKENS[s].addresses[toChainId]
  );
}
