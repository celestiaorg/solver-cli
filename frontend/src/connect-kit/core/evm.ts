import { Config, Connector } from 'wagmi';
import { ConnectMutateAsync, DisconnectMutateAsync } from 'wagmi/query';

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
        chainName: 'Anvil1',
        nativeCurrency: {
          name: 'ETH',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: ['http://127.0.0.1:8545'],
      },
      chainId: 31337,
    });
  };

  const [, error] = await tryCatch<void>(connectLogic());
  if (error) {
    console.error(error);
  }
}
