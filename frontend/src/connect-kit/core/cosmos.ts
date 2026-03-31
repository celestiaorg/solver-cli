import { ConnectArgs, ConnectResult, getChainInfo } from 'graz';

import { tryCatch } from '@/lib/utils';

import { WalletDataWithAvailability } from '../contexts/connect-kit';
import { getSupportedChains } from '../core/get-supported-chains';

export async function disconnectCosmosWallet(
  disconnect: (args?: { chainId?: string }) => Promise<void>
) {
  const [, error] = await tryCatch<void>(disconnect());
  if (error) {
    console.error(error);
  }
}

export async function connectCosmosWallet(
  wallet: WalletDataWithAvailability,
  connect: (args?: ConnectArgs) => Promise<ConnectResult>,
  chainId: string
) {
  const connectLogic = async () => {
    const chainsToConnect = [chainId];

    const supportedChains = await getSupportedChains(wallet.name);

    chainsToConnect.push(...supportedChains);

    const grazSupportedChainsToConnect = chainsToConnect.filter(
      c => !!getChainInfo({ chainId: c })
    );

    await connect({
      walletType: wallet.name,
      chainId: grazSupportedChainsToConnect,
      autoReconnect: false,
    });
  };

  const [, error] = await tryCatch<void>(connectLogic());
  if (error) {
    console.error(error);
  }
}
