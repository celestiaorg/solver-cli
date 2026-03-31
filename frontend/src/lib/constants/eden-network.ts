// Stubbed for local anvil mode
export const EDEN_NETWORK = 'testnet' as const;
export const isEdenMainnet = false;
export const edenNetworkConfig = {
  rpcUrl: 'http://127.0.0.1:8545',
  chainId: 31337,
  chainName: 'Anvil1',
  explorerUrl: '',
  blockscoutApiUrl: '',
  blockscoutTxBaseUrl: '',
};
export const edenRpcUrl = edenNetworkConfig.rpcUrl;
export const edenChainId = edenNetworkConfig.chainId;
export const edenChainName = edenNetworkConfig.chainName;
export const edenExplorerUrl = edenNetworkConfig.explorerUrl;
export const edenBlockscoutApiUrl = edenNetworkConfig.blockscoutApiUrl;
export const edenBlockscoutTxBaseUrl = edenNetworkConfig.blockscoutTxBaseUrl;
