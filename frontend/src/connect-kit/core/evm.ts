import { Config, Connector } from 'wagmi';
import { ConnectMutateAsync, DisconnectMutateAsync } from 'wagmi/query';

import {
  edenChainId,
  edenChainName,
  edenExplorerUrl,
  edenRpcUrl,
} from '@/lib/constants/eden-network';
import { tryCatch } from '@/lib/utils';

export async function disconnectEvmWallet(
  wallet: Connector,
  disconnect: DisconnectMutateAsync<unknown>
) {
  const [, error] = await tryCatch(
    disconnect({
      connector: wallet,
    })
  );
  if (error) {
    console.error(error);
  }
}

export async function connectEvmWallet(
  wallet: Connector,
  connect: ConnectMutateAsync<Config, unknown>
) {
  const connectLogic = async () => {
    await connect({ connector: wallet });
    await wallet.switchChain?.({
      addEthereumChainParameter: {
        chainName: edenChainName,
        nativeCurrency: {
          name: 'ETH',
          symbol: 'ETH',
          decimals: 18,
        },
        blockExplorerUrls: [edenExplorerUrl],
        rpcUrls: [edenRpcUrl],
      },
      chainId: edenChainId,
    });
  };

  const [, error] = await tryCatch<void>(connectLogic());
  if (error) {
    console.error(error);
  }
}
