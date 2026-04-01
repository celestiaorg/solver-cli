'use client';

import { cn } from '@/lib/utils';

import { useEvmWallets } from '../hooks/use-evm-wallets';
import { IsConnectingWallet } from './connecting-wallet-dialog';
import { EvmWalletListItem } from './evm-wallet-list-item';
import { IsSwitchingWallet } from './switch-wallet-dialog';

export const EVMWallets = ({
  searchQuery,
  setIsSwitchingWallet,
  setIsConnectingWallet,
}: {
  searchQuery: string;
  setIsSwitchingWallet: (isSwitchingWallet: IsSwitchingWallet) => void;
  setIsConnectingWallet: (isConnectingWallet: IsConnectingWallet) => void;
}) => {
  const {
    data: {
      installedWallets,
      notDetectedWallets,
      supportedWalletsLength,
      evmWallets,
    },
  } = useEvmWallets(searchQuery);

  if (!evmWallets || supportedWalletsLength === 0) return <></>;

  return (
    <>
      {installedWallets && installedWallets?.length > 0 && (
        <p className="text-muted-foreground mb-3.75 text-xs font-bold">
          YOUR DETECTED WALLETS
        </p>
      )}
      <div className="flex flex-col gap-3">
        {installedWallets?.map((wallet, index) => (
          <EvmWalletListItem
            key={wallet.id}
            wallet={wallet}
            isNotInstalled={false}
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
          MORE EVM WALLETS
        </p>
      )}

      <div className="flex flex-col gap-3">
        {notDetectedWallets?.map((wallet, index) => (
          <EvmWalletListItem
            key={wallet.id}
            wallet={wallet}
            isNotInstalled={true}
            setIsSwitchingWallet={setIsSwitchingWallet}
            setIsConnectingWallet={setIsConnectingWallet}
          />
        ))}
      </div>
    </>
  );
};
