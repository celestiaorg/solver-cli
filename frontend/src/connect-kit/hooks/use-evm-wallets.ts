import { useQuery } from '@tanstack/react-query';
import { Connector, useConnect } from 'wagmi';

import { useMemo } from 'react';

import { RECOMMENDED_WALLETS } from '../constants';

export const useEvmWallets = (searchQuery: string) => {
  const { connectors: evmConnectors } = useConnect();

  const evmWallets = useMemo(() => {
    if (!evmConnectors) return undefined;

    // return only unique wallets by id
    const uniqueWallets = new Set();
    return evmConnectors
      .filter(wallet => {
        if (uniqueWallets.has(wallet.id)) return false;
        uniqueWallets.add(wallet.id);
        return true;
      })
      .filter(wallet => {
        return wallet.name.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => {
        const aIsRecommended = RECOMMENDED_WALLETS.includes(a.name);
        const bIsRecommended = RECOMMENDED_WALLETS.includes(b.name);
        if (aIsRecommended && !bIsRecommended) return -1;
        if (!aIsRecommended && bIsRecommended) return 1;
        return 0;
      });
  }, [evmConnectors, searchQuery]);

  const queryKey = useMemo(() => {
    return ['evm-wallets', ...(evmWallets?.map(wallet => wallet.id) ?? [])];
  }, [evmWallets]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!evmWallets) {
        return {
          installedWallets: [],
          notDetectedWallets: [],
          supportedWalletsLength: 0,
        };
      }
      const installed: Connector[] = [];
      const notDetected: Connector[] = [];
      await Promise.all(
        evmWallets.map(async wallet => {
          try {
            const provider = await wallet.getProvider();
            if (provider) {
              installed.push(wallet);
            } else {
              notDetected.push(wallet);
            }
          } catch (e) {
            notDetected.push(wallet);
          }
        })
      );
      return {
        installedWallets: installed,
        notDetectedWallets: notDetected,
        supportedWalletsLength:
          (installed?.length ?? 0) + (notDetected?.length ?? 0),
        evmWallets,
      };
    },
    initialData: {
      installedWallets: [],
      notDetectedWallets: [],
      supportedWalletsLength: 0,
      evmWallets: undefined,
    },
  });
};
