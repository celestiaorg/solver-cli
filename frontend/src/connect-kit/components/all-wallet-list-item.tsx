import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useAccount } from 'graz';
import {
  useAccount as useWagmiAccount,
  useDisconnect as useWagmiDisconnect,
} from 'wagmi';

import { useCallback, useMemo } from 'react';

import { RECOMMENDED_WALLETS } from '../constants';
import { useConnectKitContext } from '../contexts/connect-kit';
import { disconnectCosmosWallet } from '../core/cosmos';
import { disconnectEvmWallet } from '../core/evm';
import { disconnectSolanaWallet } from '../core/solana';
import { WalletWithEcosystem } from './all-wallets';
import { IsSelectingEcosystem } from './select-ecosystem-dialog';
import { WalletListItem } from './wallet-list-item';

export const AllWalletListItem = ({
  wallets,
  isNotInstalled,
  setIsSelectingEcosystem,
}: {
  wallets: WalletWithEcosystem[];
  isNotInstalled: boolean;
  setIsSelectingEcosystem: (isSelectingEcosystem: IsSelectingEcosystem) => void;
}) => {
  const { disconnect: cosmosDisconnect } = useConnectKitContext();
  const { walletType: cosmosConnectedWalletType } = useAccount();
  const {
    connector: evmConnectedWallet,
    isConnected: isAnyEvmWalletConnected,
  } = useWagmiAccount();
  const { disconnectAsync: evmDisconnect } = useWagmiDisconnect();
  const { disconnect: solanaDisconnect, wallet: solanaConnectedWallet } =
    useSolanaWallet();

  const displayName = wallets[0].name;
  const {
    icon,
    url,
    isConnected,
    isEvmConnected,
    isSolanaConnected,
    isCosmosConnected,
  } = useMemo(() => {
    let icon = '';
    let url = '';
    let isSolanaConnected = false;
    let isCosmosConnected = false;
    let isEvmConnected = false;
    for (const wallet of wallets) {
      const { ecosystem, wallet: walletData } = wallet;
      switch (ecosystem) {
        case 'solana': {
          if (
            walletData.adapter.name === solanaConnectedWallet?.adapter.name &&
            solanaConnectedWallet?.adapter.connected
          ) {
            isSolanaConnected = true;
          }
          if (!icon) {
            icon = walletData.adapter.icon;
          }
          if (!url) {
            url = walletData.adapter.url;
          }
          break;
        }
        case 'cosmos': {
          if (walletData.name === cosmosConnectedWalletType) {
            isCosmosConnected = true;
          }
          if (!icon) {
            icon = walletData.icon;
          }
          if (!url) {
            url = walletData.downloadUrl?.desktop ?? '';
          }
          break;
        }
        case 'evm': {
          if (
            walletData.id === evmConnectedWallet?.id &&
            isAnyEvmWalletConnected
          ) {
            isEvmConnected = true;
          }
          if (!icon) {
            icon = walletData.icon ?? '';
          }
          break;
        }
      }
    }
    const isAnyConnected =
      isSolanaConnected || isCosmosConnected || isEvmConnected;
    return {
      icon,
      url,
      isConnected: isAnyConnected,
      isEvmConnected,
      isSolanaConnected,
      isCosmosConnected,
    };
  }, [
    cosmosConnectedWalletType,
    evmConnectedWallet?.id,
    isAnyEvmWalletConnected,
    solanaConnectedWallet?.adapter.connected,
    solanaConnectedWallet?.adapter.name,
    wallets,
  ]);

  const isRecommended = useMemo(() => {
    return !isConnected && RECOMMENDED_WALLETS.includes(displayName);
  }, [displayName, isConnected]);

  const handleClick = useCallback(async () => {
    // is not installed = redirect to the wallet's website using any of the wallets
    if (isNotInstalled) {
      window.open(url, '_blank');
      return;
    }
    if (isConnected) {
      let sortedWallets = wallets;
      if (wallets.some(w => w.name === 'Keplr')) {
        /**
         * This sorting is done to ensure that in case of Keplr,
         * evm is disconnected first, and then cosmos is disconnected.
         * This is because Keplr's evm disconnect method:
         * ```
         * keplr.ethereum.request({
         *   method: 'wallet_revokePermissions',
         *   params: [
         *     {
         *       eth_accounts: {}
         *     }
         *   ]
         * })
         * ```
         * if invoke after it's cosmos disconnect (or in case of evm is already disconnected),
         * it opens a popup to connect to evm chain. Whereas in case of leap/metamask,
         * evenif `wallet_revokePermissions` is invoked twice in row,
         * it doesn't open a popup to connect to evm chain after the first one.
         *
         * If above is sorted from Keplr's end, we can remove sorting.
         */
        sortedWallets = wallets.sort((a, b) => {
          if (a.ecosystem === 'evm' && b.ecosystem !== 'evm') return -1;
          if (a.ecosystem !== 'evm' && b.ecosystem === 'evm') return 1;
          return 0;
        });
      }
      // is fully connected = disconnect from all wallets
      // Can we trigger this in parallel? Will it break for any wallet as it leads to multiple parallel requests to same wallet's connect script?
      // For now, we'll do it serially
      for await (const wallet of sortedWallets) {
        try {
          switch (wallet.ecosystem) {
            case 'evm': {
              if (isEvmConnected) {
                await disconnectEvmWallet(wallet.wallet, evmDisconnect);
              }
              break;
            }
            case 'solana': {
              if (isSolanaConnected) {
                await disconnectSolanaWallet(solanaDisconnect);
              }
              break;
            }
            case 'cosmos': {
              if (isCosmosConnected) {
                await disconnectCosmosWallet(cosmosDisconnect);
              }
              break;
            }
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      }
      return;
    }
    setIsSelectingEcosystem({
      isSelectingEcosystem: true,
      params: { wallets },
    });
    // // is partially connected = connect to the remaining wallets
    // // TODO: handle switching wallets cases
    // for await (const wallet of wallets) {
    //   switch (wallet.ecosystem) {
    //     case 'evm':
    //       if (!isEvmConnected) {
    //         await connectEvmWallet(wallet.wallet, evmConnect)
    //       }
    //       break
    //     case 'aptos':
    //       if (!isAptosConnected) {
    //         await connectAptosWallet(wallet.wallet.name, aptosConnect)
    //       }
    //       break
    //     case 'solana':
    //       if (!isSolanaConnected) {
    //         await connectSolanaWallet(wallet.wallet, solanaSelect)
    //       }
    //       break
    //     case 'cosmos':
    //       if (!isCosmosConnected) {
    //         await connectCosmosWallet(wallet.wallet, cosmosConnect, cosmosChainId)
    //       }
    //       break
    //   }
    // }
  }, [
    isNotInstalled,
    isConnected,
    setIsSelectingEcosystem,
    wallets,
    url,
    isEvmConnected,
    isSolanaConnected,
    isCosmosConnected,
    evmDisconnect,
    solanaDisconnect,
    cosmosDisconnect,
  ]);

  return (
    <WalletListItem
      className={isConnected ? '-order-1' : ''}
      displayName={displayName}
      isConnected={isConnected}
      icon={icon ?? ''}
      onClick={handleClick}
      isNotInstalled={isNotInstalled}
      isRecommended={isRecommended}
    />
  );
};
