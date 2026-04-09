'use client';

import { cn } from '@/lib/utils';

import { useSolanaWallets } from '../hooks/use-solana-wallets';
import { IsConnectingWallet } from './connecting-wallet-dialog';
import { SolanaWalletListItem } from './solana-wallet-list-item';
import { IsSwitchingWallet } from './switch-wallet-dialog';

export const SolanaWallets = ({
  searchQuery,
  setIsSwitchingWallet,
  setIsConnectingWallet,
}: {
  searchQuery: string;
  setIsSwitchingWallet: (isSwitchingWallet: IsSwitchingWallet) => void;
  setIsConnectingWallet: (isConnectingWallet: IsConnectingWallet) => void;
}) => {
  const {
    installedWallets,
    notDetectedWallets,
    supportedWalletsLength,
    solanaWallets,
  } = useSolanaWallets(searchQuery);

  if (!solanaWallets || supportedWalletsLength === 0) return <></>;

  return (
    <>
      {installedWallets && installedWallets?.length > 0 && (
        <p className="text-muted-foreground mb-3.75 text-xs font-bold">
          YOUR DETECTED WALLETS
        </p>
      )}

      <div className="flex flex-col gap-3">
        {installedWallets?.map((wallet, index) => (
          <SolanaWalletListItem
            key={wallet.adapter.name}
            wallet={wallet}
            setIsSwitchingWallet={setIsSwitchingWallet}
            setIsConnectingWallet={setIsConnectingWallet}
          />
        ))}
      </div>

      {notDetectedWallets && notDetectedWallets?.length > 0 && (
        <p
          className={cn(
            'text-muted-foreground mb-3.75 text-xs font-bold',
            installedWallets?.length && installedWallets?.length > 0
              ? 'mt-6'
              : ''
          )}
        >
          MORE SOLANA WALLETS
        </p>
      )}

      <div className="flex flex-col gap-3">
        {notDetectedWallets?.map((wallet, index) => (
          <SolanaWalletListItem
            key={wallet.adapter.name}
            wallet={wallet}
            setIsSwitchingWallet={setIsSwitchingWallet}
            setIsConnectingWallet={setIsConnectingWallet}
          />
        ))}
      </div>
    </>
  );
};
