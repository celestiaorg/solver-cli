/**
 * Eden network configuration - switches between mainnet and testnet based on
 * NEXT_PUBLIC_EDEN_NETWORK env variable at build time.
 *
 * Mainnet deployment: NEXT_PUBLIC_EDEN_NETWORK=mainnet
 * Testnet deployment: NEXT_PUBLIC_EDEN_NETWORK=testnet (default)
 */

export const EDEN_NETWORK = (process.env.NEXT_PUBLIC_EDEN_NETWORK ??
  'testnet') as 'mainnet' | 'testnet';

export const isEdenMainnet = EDEN_NETWORK === 'mainnet';

// Mainnet config
const EDEN_MAINNET = {
  rpcUrl: 'https://ev-reth-eden-mainnet.binarybuilders.services:8547',
  chainId: 714,
  chainName: 'Eden',
  explorerUrl: 'https://eden.blockscout.com/',
  blockscoutApiUrl: 'https://eden.blockscout.com/api/v2',
  blockscoutTxBaseUrl: 'https://eden.blockscout.com/m',
};

// Testnet config
const EDEN_TESTNET = {
  rpcUrl: 'https://eden-rpc-proxy-production.up.railway.app/rpc',
  chainId: 3735928814,
  chainName: 'Eden Testnet',
  explorerUrl: 'https://explorer-eden-testnet.binarybuilders.services',
  blockscoutApiUrl: 'https://eden-testnet.blockscout.com/api/v2',
  blockscoutTxBaseUrl: 'https://eden-testnet.blockscout.com',
};

export const edenNetworkConfig = isEdenMainnet ? EDEN_MAINNET : EDEN_TESTNET;

export const edenRpcUrl = edenNetworkConfig.rpcUrl;
export const edenChainId = edenNetworkConfig.chainId;
export const edenChainName = edenNetworkConfig.chainName;
export const edenExplorerUrl = edenNetworkConfig.explorerUrl;
export const edenBlockscoutApiUrl = edenNetworkConfig.blockscoutApiUrl;
export const edenBlockscoutTxBaseUrl = edenNetworkConfig.blockscoutTxBaseUrl;
