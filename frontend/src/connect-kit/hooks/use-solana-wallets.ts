import { WalletReadyState } from '@solana/wallet-adapter-base';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';

import { useMemo } from 'react';

export const useSolanaWallets = (searchQuery: string) => {
  const { wallets: _solanaWallets } = useSolanaWallet();

  const solanaWallets = useMemo(() => {
    if (!_solanaWallets) return undefined;

    // return only unique wallets by name
    const uniqueWallets = new Set();
    return _solanaWallets
      .filter(wallet => {
        if (uniqueWallets.has(wallet.adapter.name)) return false;
        uniqueWallets.add(wallet.adapter.name);
        return true;
      })
      .filter(wallet => !['Solflare'].includes(wallet.adapter.name))
      .filter(wallet => {
        return wallet.adapter.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      });
  }, [_solanaWallets, searchQuery]);

  return useMemo(() => {
    const installed = solanaWallets?.filter(
      wallet =>
        wallet.readyState === WalletReadyState.Installed ||
        wallet.readyState === WalletReadyState.Loadable
    );
    const notDetected = solanaWallets?.filter(
      wallet => wallet.readyState === WalletReadyState.NotDetected
    );
    return {
      installedWallets: installed,
      notDetectedWallets: notDetected,
      supportedWalletsLength:
        (installed?.length ?? 0) + (notDetected?.length ?? 0),
      solanaWallets,
    };
  }, [solanaWallets]);
};
