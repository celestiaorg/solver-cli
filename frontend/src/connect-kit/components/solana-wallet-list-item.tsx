'use client';

import { WalletReadyState } from '@solana/wallet-adapter-base';
import {
  Wallet as SolanaWallet,
  useWallet as useSolanaWallet,
} from '@solana/wallet-adapter-react';

import { useCallback } from 'react';

import { connectSolanaWallet, disconnectSolanaWallet } from '../core/solana';
import { IsConnectingWallet } from './connecting-wallet-dialog';
import { IsSwitchingWallet } from './switch-wallet-dialog';
import { WalletListItem } from './wallet-list-item';

export const SolanaWalletListItem = ({
  wallet,
  setIsSwitchingWallet,
  setIsConnectingWallet,
}: {
  wallet: SolanaWallet;
  setIsSwitchingWallet: (isSwitchingWallet: IsSwitchingWallet) => void;
  setIsConnectingWallet: (isConnectingWallet: IsConnectingWallet) => void;
}) => {
  const { select, disconnect, wallet: connectedWallet } = useSolanaWallet();

  const isSelectedWallet =
    connectedWallet?.adapter.name === wallet.adapter.name;
  const isConnected = isSelectedWallet && connectedWallet?.adapter?.connected;
  const displayName = wallet.adapter.name;

  const isNotInstalled = wallet.readyState === WalletReadyState.NotDetected;

  const handleClick = useCallback(async () => {
    if (isConnected) {
      await disconnectSolanaWallet(disconnect);
      return;
    }
    if (isNotInstalled) {
      window.open(wallet.adapter.url, '_blank');
      return;
    }
    if (connectedWallet?.adapter?.connected && connectedWallet?.adapter.name) {
      setIsSwitchingWallet({
        isSwitching: true,
        params: {
          ecosystem: 'Solana',
          fromWallet: connectedWallet,
          toWallet: wallet,
        },
      });
      return;
    }
    setIsConnectingWallet({
      isConnecting: true,
      params: {
        walletIcon: wallet.adapter.icon ?? '',
        walletName: wallet.adapter.name,
      },
    });
    await connectSolanaWallet(wallet, select);
    setIsConnectingWallet({ isConnecting: false });
  }, [
    isConnected,
    isNotInstalled,
    connectedWallet,
    wallet,
    select,
    disconnect,
    setIsSwitchingWallet,
    setIsConnectingWallet,
  ]);

  return (
    <WalletListItem
      className={isConnected ? '-order-1' : ''}
      displayName={displayName}
      isConnected={isConnected}
      icon={wallet.adapter.icon ?? ''}
      onClick={handleClick}
      isNotInstalled={isNotInstalled}
      isRecommended={false}
    />
  );
};
