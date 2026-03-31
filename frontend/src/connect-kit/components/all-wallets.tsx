'use client';

import { Wallet as SolanaWallet } from '@solana/wallet-adapter-react';
import { Connector } from 'wagmi';

import { useMemo } from 'react';

import { useEcosystemWallets } from '@/hooks/use-ecosystem-wallets';

import { cn } from '@/lib/utils';

import { WalletDataWithAvailability } from '../contexts/connect-kit';
import { AllWalletListItem } from './all-wallet-list-item';
import { IsConnectingWallet } from './connecting-wallet-dialog';
import { CosmosWalletListItem } from './cosmos-wallet-list-item';
import { EvmWalletListItem } from './evm-wallet-list-item';
import { IsSelectingEcosystem } from './select-ecosystem-dialog';
import { SolanaWalletListItem } from './solana-wallet-list-item';
import { IsSwitchingWallet } from './switch-wallet-dialog';

export type WalletWithEcosystem =
  | {
      ecosystem: 'cosmos';
      name: string;
      wallet: WalletDataWithAvailability;
    }
  | {
      ecosystem: 'evm';
      name: string;
      wallet: Connector;
    }
  | {
      ecosystem: 'solana';
      name: string;
      wallet: SolanaWallet;
    };

export type WalletWithMultiEcosystems = Record<string, WalletWithEcosystem[]>;

export const useMergedWallets = (
  cosmosWallets: WalletDataWithAvailability[],
  evmWallets: Connector[],
  solanaWallets: SolanaWallet[] | undefined
) => {
  return useMemo(() => {
    const allInstalled: WalletWithMultiEcosystems = {};

    cosmosWallets.forEach(wallet => {
      allInstalled[wallet.prettyName] = [
        {
          ecosystem: 'cosmos',
          name: wallet.prettyName,
          wallet: wallet,
        },
      ];
    });
    evmWallets.forEach(wallet => {
      if (!allInstalled[wallet.name]) {
        allInstalled[wallet.name] = [];
      }
      allInstalled[wallet.name].push({
        ecosystem: 'evm',
        name: wallet.name,
        wallet: wallet,
      });
    });
    solanaWallets?.forEach(wallet => {
      if (!allInstalled[wallet.adapter.name]) {
        allInstalled[wallet.adapter.name] = [];
      }
      allInstalled[wallet.adapter.name].push({
        ecosystem: 'solana',
        name: wallet.adapter.name,
        wallet: wallet,
      });
    });
    return allInstalled;
  }, [cosmosWallets, evmWallets, solanaWallets]);
};

export const AllWallets = ({
  searchQuery,
  setIsSwitchingWallet,
  setIsConnectingWallet,
  setIsSelectingEcosystem,
}: {
  searchQuery: string;
  setIsSwitchingWallet: (isSwitchingWallet: IsSwitchingWallet) => void;
  setIsConnectingWallet: (isConnectingWallet: IsConnectingWallet) => void;
  setIsSelectingEcosystem: (isSelectingEcosystem: IsSelectingEcosystem) => void;
}) => {
  const {
    installedWallets: sortedInstalledWallets,
    notDetectedWallets: sortedNotDetectedWallets,
  } = useEcosystemWallets({ searchQuery });

  if (
    sortedInstalledWallets.length === 0 &&
    sortedNotDetectedWallets.length === 0
  ) {
    return null;
  }

  return (
    <>
      {sortedInstalledWallets && sortedInstalledWallets?.length > 0 && (
        <p className="text-muted-foreground mb-3.75 text-xs font-bold">
          YOUR DETECTED WALLETS
        </p>
      )}

      <div className="flex flex-col gap-3 overflow-y-auto">
        {sortedInstalledWallets?.map((wallets, index) => {
          if (wallets.length === 1) {
            const wallet = wallets[0];
            switch (wallet.ecosystem) {
              case 'evm':
                return (
                  <EvmWalletListItem
                    key={`installed-${wallet.ecosystem}-${wallet.wallet.id}`}
                    wallet={wallet.wallet}
                    isNotInstalled={false}
                    setIsSwitchingWallet={setIsSwitchingWallet}
                    setIsConnectingWallet={setIsConnectingWallet}
                  />
                );
              case 'solana':
                return (
                  <SolanaWalletListItem
                    key={`installed-${wallet.ecosystem}-${wallet.wallet.adapter.name}`}
                    wallet={wallet.wallet}
                    setIsSwitchingWallet={setIsSwitchingWallet}
                    setIsConnectingWallet={setIsConnectingWallet}
                  />
                );
              case 'cosmos':
                return (
                  <CosmosWalletListItem
                    key={`installed-${wallet.ecosystem}-${wallet.wallet.prettyName}`}
                    wallet={wallet.wallet}
                    setIsSwitchingWallet={setIsSwitchingWallet}
                    setIsConnectingWallet={setIsConnectingWallet}
                  />
                );
            }
          }
          // handle multi connect case
          return (
            <AllWalletListItem
              key={`installed-${wallets[0].ecosystem}-${wallets[0].name}`}
              wallets={wallets}
              isNotInstalled={false}
              setIsSelectingEcosystem={setIsSelectingEcosystem}
            />
          );
        })}
      </div>

      {sortedNotDetectedWallets && sortedNotDetectedWallets?.length > 0 && (
        <p
          className={cn(
            'text-muted-foreground mb-3.75 text-xs font-bold',
            sortedInstalledWallets?.length && sortedInstalledWallets?.length > 0
              ? 'mt-6'
              : ''
          )}
        >
          OTHER WAYS TO CONNECT
        </p>
      )}

      <div className="flex flex-col gap-3">
        {sortedNotDetectedWallets?.map((wallets, index) => {
          if (wallets.length === 1) {
            const wallet = wallets[0];
            switch (wallet.ecosystem) {
              case 'evm':
                return (
                  <EvmWalletListItem
                    key={`not-detected-${wallet.ecosystem}-${wallet.wallet.id}`}
                    wallet={wallet.wallet}
                    isNotInstalled={false}
                    setIsSwitchingWallet={setIsSwitchingWallet}
                    setIsConnectingWallet={setIsConnectingWallet}
                  />
                );
              case 'solana':
                return (
                  <SolanaWalletListItem
                    key={`not-detected-${wallet.ecosystem}-${wallet.wallet.adapter.name}`}
                    wallet={wallet.wallet}
                    setIsSwitchingWallet={setIsSwitchingWallet}
                    setIsConnectingWallet={setIsConnectingWallet}
                  />
                );
              case 'cosmos':
                return (
                  <CosmosWalletListItem
                    key={`not-detected-${wallet.ecosystem}-${wallet.wallet.prettyName}`}
                    wallet={wallet.wallet}
                    setIsSwitchingWallet={setIsSwitchingWallet}
                    setIsConnectingWallet={setIsConnectingWallet}
                  />
                );
            }
          }
          // handle multi connect case
        })}
      </div>
    </>
  );
};
