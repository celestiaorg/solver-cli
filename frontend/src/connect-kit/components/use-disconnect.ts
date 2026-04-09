import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import {
  useAccount as useWagmiAccount,
  useDisconnect as useWagmiDisconnect,
} from 'wagmi';

import { useCallback } from 'react';

import { useConnectKitContext } from '../contexts/connect-kit';
import { disconnectCosmosWallet } from '../core/cosmos';
import { disconnectEvmWallet } from '../core/evm';
import { disconnectSolanaWallet } from '../core/solana';
import { WalletEcosystem } from './modal/ecosystems';

export const useDisconnect = (ecosystem: WalletEcosystem) => {
  const { disconnect: cosmosDisconnect } = useConnectKitContext();
  const { connector } = useWagmiAccount();
  const { disconnectAsync: evmDisconnect } = useWagmiDisconnect();
  const { disconnect: solanaDisconnect } = useSolanaWallet();

  return useCallback(async () => {
    try {
      switch (ecosystem) {
        case 'evm': {
          if (connector?.connect) {
            await disconnectEvmWallet(connector, evmDisconnect);
          }
          return;
        }

        case 'solana': {
          await disconnectSolanaWallet(solanaDisconnect);
          return;
        }

        case 'cosmos': {
          await disconnectCosmosWallet(cosmosDisconnect);
          return;
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }, [connector, cosmosDisconnect, ecosystem, evmDisconnect, solanaDisconnect]);
};
