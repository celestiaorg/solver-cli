'use client';

import {
  Connector,
  useConnect,
  useDisconnect,
  useAccount as useWagmiAccount,
} from 'wagmi';

import { useCallback, useMemo } from 'react';

import { RECOMMENDED_WALLETS } from '../constants';
import { connectEvmWallet, disconnectEvmWallet } from '../core/evm';
import { getImageUrl } from '../wallet-data';
import { IsConnectingWallet } from './connecting-wallet-dialog';
import { IsSwitchingWallet } from './switch-wallet-dialog';
import { WalletListItem } from './wallet-list-item';

export const EvmWalletListItem = ({
  wallet,
  isNotInstalled,
  setIsSwitchingWallet,
  setIsConnectingWallet,
}: {
  wallet: Connector;
  isNotInstalled: boolean;
  setIsSwitchingWallet: (isSwitchingWallet: IsSwitchingWallet) => void;
  setIsConnectingWallet: (isConnectingWallet: IsConnectingWallet) => void;
}) => {
  const { connectAsync: connect } = useConnect();
  const { disconnectAsync: disconnect } = useDisconnect();

  const { isConnected: _isAnyWalletConnected, connector } = useWagmiAccount();
  const isSelectedWallet = connector?.id === wallet?.id;
  const isConnected = isSelectedWallet && _isAnyWalletConnected;
  const displayName = wallet.name;
  const isRecommended = useMemo(() => {
    return !isConnected && RECOMMENDED_WALLETS.includes(displayName);
  }, [displayName, isConnected]);

  const isLeapWallet = useMemo(() => {
    return displayName === 'Leap Wallet';
  }, [displayName]);

  const walletIcon = useMemo(() => {
    if (isLeapWallet) {
      return getImageUrl('leap');
    }
    return wallet.icon ?? '';
  }, [wallet, isLeapWallet]);

  const handleClick = useCallback(async () => {
    if (isConnected) {
      await disconnectEvmWallet(wallet, disconnect);
      return;
    }
    if (isNotInstalled) {
      return;
    }
    if (connector) {
      setIsSwitchingWallet({
        isSwitching: true,
        params: { ecosystem: 'EVM', fromWallet: connector, toWallet: wallet },
      });
      return;
    }
    setIsConnectingWallet({
      isConnecting: true,
      params: {
        walletIcon: wallet.icon ?? '',
        walletName: wallet.name,
      },
    });
    await connectEvmWallet(wallet, connect);
    setIsConnectingWallet({ isConnecting: false });
  }, [
    wallet,
    connector,
    disconnect,
    connect,
    isConnected,
    isNotInstalled,
    setIsSwitchingWallet,
    setIsConnectingWallet,
  ]);

  return (
    <WalletListItem
      className={isConnected ? '-order-1' : ''}
      displayName={displayName}
      isConnected={isConnected}
      icon={walletIcon ?? ''}
      onClick={handleClick}
      isNotInstalled={isNotInstalled}
      isRecommended={isRecommended}
      hideInstallButton={true}
    />
  );
};
