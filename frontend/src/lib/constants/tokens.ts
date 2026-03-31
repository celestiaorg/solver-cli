// Token and chain configuration from hyperlane-ops registry deployments

export const CHAIN_CONFIG = {
  sepolia: {
    chainId: 11155111,
    domainId: 11155111,
    name: 'Sepolia',
    serverName: 'sepolia',
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  },
  eden: {
    chainId: 3735928814,
    domainId: 2147483647,
    name: 'Eden Testnet',
    serverName: 'eden',
    rpc: 'https://ev-reth-eden-testnet.binarybuilders.services:8545/',
    logo: '/favicon.png',
  },
} as const;

export const CONTRACTS = {
  sepolia: {
    usdc: '0xf77764d1E232Ec088150a3E434678768f8774f21',
    usdcWarpRoute: '0x22cCd0e1efc2beF46143eA00e3868A35ebA16113',
    lbtc: '0x0A3eC97CA4082e83FeB77Fa69F127F0eAABD016E',
    lbtcWarpRoute: '0x101612E45d8D1ebE8e2EB90373b7cCecB6F52F5C',
    ethWarpRoute: '0xEEea7Edeb303A1D20F3742edfC66F188f805a28E',
    inputSettler: '0x156AEa0bBdf1B9A338E2E382e473D18dFb263198',
    outputSettler: '0xDc09667c8f29Bae5cd9A9c97C014834110C06f0E',
    oracle: '0x9265b88c3AF6b1445fCA1C6b446978aD7a1bdAaE',
  },
  eden: {
    usdc: '0x0C1c5a78669ea6cb269883ad1B65334319Aacfd7',
    eth: '0xf8e7A4608AE1e77743FD83549b36E605213760b6',
    lbtc: '0x4d46424A8AA50e7c585F218338BCCE4a9a992c0F',
    tia: '0x43505da95A74Fa577FB9bB0Ce29E293FdF575011',
    inputSettler: '0x2b3789733d542531642CB6B29ceDAf6865Fe1C53',
    outputSettler: '0x272dF2585c54d6E135379f3Fb079508E80D10135',
    oracle: '0x933D26259a4F031a3D836E529DD5dE9b097EFA86',
  },
  celestia: {
    domainId: 1297040200,
    restUrl: 'https://api-mocha.pops.one',
  },
  depositFactory: '0x6C7A87cCed5aF1Fd2ab4E19b20e2793e079bF81e',
  forwardingService: 'http://51.15.252.63:8080',
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
      [CHAIN_CONFIG.sepolia.chainId]: {
        token: CONTRACTS.sepolia.usdc,
        warpRoute: CONTRACTS.sepolia.usdcWarpRoute,
        type: 'collateral',
      },
      [CHAIN_CONFIG.eden.chainId]: {
        token: CONTRACTS.eden.usdc,
        type: 'synthetic',
      },
    },
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    addresses: {
      [CHAIN_CONFIG.sepolia.chainId]: {
        token: 'native',
        warpRoute: CONTRACTS.sepolia.ethWarpRoute,
        type: 'native',
      },
      [CHAIN_CONFIG.eden.chainId]: {
        token: CONTRACTS.eden.eth,
        type: 'synthetic',
      },
    },
  },
  LBTC: {
    symbol: 'LBTC',
    name: 'Lombard BTC',
    decimals: 8,
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
    addresses: {
      [CHAIN_CONFIG.sepolia.chainId]: {
        token: CONTRACTS.sepolia.lbtc,
        warpRoute: CONTRACTS.sepolia.lbtcWarpRoute,
        type: 'collateral',
      },
      [CHAIN_CONFIG.eden.chainId]: {
        token: CONTRACTS.eden.lbtc,
        type: 'synthetic',
      },
    },
  },
  TIA: {
    symbol: 'TIA',
    name: 'Celestia',
    decimals: 18,
    logo: '/favicon.png',
    addresses: {
      [CHAIN_CONFIG.eden.chainId]: {
        token: CONTRACTS.eden.tia,
        type: 'native',
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
