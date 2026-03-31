import { useMemo } from 'react';

import { useMergedWallets } from '@/connect-kit/components/all-wallets';
import { RECOMMENDED_WALLETS } from '@/connect-kit/constants';
import { useCosmosWallets } from '@/connect-kit/hooks/use-cosmos-wallets';
import { useEvmWallets } from '@/connect-kit/hooks/use-evm-wallets';
import { useSolanaWallets } from '@/connect-kit/hooks/use-solana-wallets';

export const useEcosystemWallets = (opts?: { searchQuery: string }) => {
  const { searchQuery = '' } = opts ?? {};

  const {
    installedWallets: cosmosInstalledWallets,
    notDetectedWallets: cosmosNotDetectedWallets,
  } = useCosmosWallets(searchQuery);
  const {
    data: {
      installedWallets: evmInstalledWallets,
      notDetectedWallets: evmNotDetectedWallets,
    },
  } = useEvmWallets(searchQuery);
  const {
    installedWallets: solanaInstalledWallets,
    notDetectedWallets: solanaNotDetectedWallets,
  } = useSolanaWallets(searchQuery);

  const allInstalledWallets = useMergedWallets(
    cosmosInstalledWallets,
    evmInstalledWallets,
    solanaInstalledWallets
  );

  const allNotDetectedWallets = useMergedWallets(
    cosmosNotDetectedWallets,
    evmNotDetectedWallets,
    solanaNotDetectedWallets
  );

  const sortedInstalledWallets = useMemo(() => {
    return Object.keys(allInstalledWallets)
      .sort((a, b) => {
        const aIsRecommended = RECOMMENDED_WALLETS.includes(a);
        const bIsRecommended = RECOMMENDED_WALLETS.includes(b);
        if (aIsRecommended && !bIsRecommended) {
          return -1;
        }
        if (!aIsRecommended && bIsRecommended) {
          return 1;
        }
        return 0;
      })
      .map(wallet => allInstalledWallets[wallet]);
  }, [allInstalledWallets]);

  const sortedNotDetectedWallets = useMemo(() => {
    return Object.keys(allNotDetectedWallets)
      .sort((a, b) => {
        const aIsRecommended = RECOMMENDED_WALLETS.includes(a);
        const bIsRecommended = RECOMMENDED_WALLETS.includes(b);
        if (aIsRecommended && !bIsRecommended) {
          return -1;
        }
        if (!aIsRecommended && bIsRecommended) {
          return 1;
        }
        return 0;
      })
      .map(wallet => allNotDetectedWallets[wallet]);
  }, [allNotDetectedWallets]);

  return {
    installedWallets: sortedInstalledWallets,
    notDetectedWallets: sortedNotDetectedWallets,
  };
};
