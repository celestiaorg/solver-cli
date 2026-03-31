'use client';

import { cn } from '@/lib/utils';

import { useCosmosWallets } from '../hooks/use-cosmos-wallets';
import { IsConnectingWallet } from './connecting-wallet-dialog';
import { CosmosWalletListItem } from './cosmos-wallet-list-item';
import { IsSwitchingWallet } from './switch-wallet-dialog';

export const CosmosWallets = ({
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
    walletsToShow,
  } = useCosmosWallets(searchQuery);

  if (!walletsToShow || supportedWalletsLength === 0) return <></>;

  return (
    <>
      {installedWallets && installedWallets?.length > 0 && (
        <p className="text-muted-foreground mb-3.75 text-xs font-bold">
          YOUR DETECTED WALLETS
        </p>
      )}

      <div className="flex flex-col gap-3">
        {installedWallets && installedWallets?.length > 0 ? (
          installedWallets?.map((wallet, index) => (
            <CosmosWalletListItem
              key={wallet.name}
              wallet={wallet}
              setIsSwitchingWallet={setIsSwitchingWallet}
              setIsConnectingWallet={setIsConnectingWallet}
            />
          ))
        ) : (
          <></>
        )}
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
          MORE COSMOS WALLETS
        </p>
      )}

      <div className="flex flex-col gap-3">
        {notDetectedWallets && notDetectedWallets?.length > 0 ? (
          notDetectedWallets?.map((wallet, index) => (
            <CosmosWalletListItem
              key={wallet.name}
              wallet={wallet}
              setIsSwitchingWallet={setIsSwitchingWallet}
              setIsConnectingWallet={setIsConnectingWallet}
            />
          ))
        ) : (
          <></>
        )}
      </div>
    </>
  );
};
