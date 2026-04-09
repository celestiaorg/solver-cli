import { useAccount } from 'graz';

import { useCallback, useMemo } from 'react';

import { RECOMMENDED_WALLETS } from '../constants';
import {
  useConnectKitContext,
  WalletDataWithAvailability,
} from '../contexts/connect-kit';
import { connectCosmosWallet, disconnectCosmosWallet } from '../core/cosmos';
import { checkUAIsDesktop, checkUAIsIOS } from '../utils';
import { IsConnectingWallet } from './connecting-wallet-dialog';
import { IsSwitchingWallet } from './switch-wallet-dialog';
import { WalletListItem } from './wallet-list-item';

export const CosmosWalletListItem = ({
  wallet,
  setIsSwitchingWallet,
  setIsConnectingWallet,
}: {
  wallet: WalletDataWithAvailability;
  setIsSwitchingWallet: (isSwitchingWallet: IsSwitchingWallet) => void;
  setIsConnectingWallet: (isConnectingWallet: IsConnectingWallet) => void;
}) => {
  const {
    chainId,
    connect: { connectAsync },
    disconnect,
    walletsToShow,
  } = useConnectKitContext();
  const { walletType: connectedWalletType } = useAccount();
  const isConnected = connectedWalletType === wallet.name;

  const displayName = wallet.prettyName;
  const isNotInstalled = !wallet.isAvailable;
  const icon = wallet.icon;

  const isRecommended = useMemo(() => {
    return !isConnected && RECOMMENDED_WALLETS.includes(displayName);
  }, [displayName, isConnected]);

  const handleClick = useCallback(async () => {
    if (isNotInstalled) {
      const isDesktop = checkUAIsDesktop(navigator.userAgent);
      const platform = isDesktop
        ? 'desktop'
        : checkUAIsIOS(navigator.userAgent)
          ? 'ios'
          : 'android';
      const url = wallet.downloadUrl?.[platform];
      if (url) {
        window.open(url, '_blank');
      }
    }

    if (isConnected) {
      await disconnectCosmosWallet(disconnect);
      return;
    }

    if (connectedWalletType) {
      const connectedWallet = walletsToShow?.find(
        w => w.name === connectedWalletType
      );
      if (connectedWallet) {
        setIsSwitchingWallet({
          isSwitching: true,
          params: {
            ecosystem: 'Cosmos',
            fromWallet: connectedWallet,
            toWallet: wallet,
          },
        });
        return;
      }
    }

    setIsConnectingWallet({
      isConnecting: true,
      params: {
        walletIcon: wallet.icon ?? '',
        walletName: wallet.prettyName,
      },
    });
    await connectCosmosWallet(wallet, connectAsync, chainId);
    setIsConnectingWallet({ isConnecting: false });
  }, [
    chainId,
    connectAsync,
    connectedWalletType,
    disconnect,
    isConnected,
    isNotInstalled,
    setIsSwitchingWallet,
    wallet,
    walletsToShow,
    setIsConnectingWallet,
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
