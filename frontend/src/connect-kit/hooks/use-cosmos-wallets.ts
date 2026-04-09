import { useMemo } from 'react';

import { RECOMMENDED_WALLETS } from '../constants';
import { useConnectKitContext } from '../contexts/connect-kit';

export const useCosmosWallets = (searchQuery: string) => {
  const { walletsToShow: _walletsToShow } = useConnectKitContext();

  const walletsToShow = useMemo(() => {
    if (!_walletsToShow) return [];

    return _walletsToShow
      .filter(w => {
        return w.prettyName.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => {
        const aIsRecommended = RECOMMENDED_WALLETS.includes(a.prettyName);
        const bIsRecommended = RECOMMENDED_WALLETS.includes(b.prettyName);
        if (aIsRecommended && !bIsRecommended) return -1;
        if (!aIsRecommended && bIsRecommended) return 1;
        return 0;
      });
  }, [_walletsToShow, searchQuery]);

  return useMemo(() => {
    const installedWallets = walletsToShow.filter(w => w.isAvailable);
    const notDetectedWallets = walletsToShow.filter(w => !w.isAvailable);
    const supportedWalletsLength =
      (installedWallets?.length ?? 0) + (notDetectedWallets?.length ?? 0);
    return {
      installedWallets,
      notDetectedWallets,
      supportedWalletsLength,
      walletsToShow,
    };
  }, [walletsToShow]);
};
