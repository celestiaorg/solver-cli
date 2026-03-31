import { Config, Connector } from 'wagmi';
import { ConnectMutateAsync, DisconnectMutateAsync } from 'wagmi/query';

import { CHAIN_CONFIG } from '@/lib/constants/tokens';
import { tryCatch } from '@/lib/utils';

const firstChain = Object.values(CHAIN_CONFIG)[0];

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
        chainName: firstChain.name,
        nativeCurrency: {
          name: 'ETH',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: [firstChain.rpc],
      },
      chainId: firstChain.chainId,
    });
  };

  const [, error] = await tryCatch<void>(connectLogic());
  if (error) {
    console.error(error);
  }
}
