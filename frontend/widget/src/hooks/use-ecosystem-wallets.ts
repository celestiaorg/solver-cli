import { useMemo } from "react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import {
  useWallet as useSolanaWallet,
  type Wallet as SolanaWallet,
} from "@solana/wallet-adapter-react";
import { Connector, useConnect } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import {
  getAvailableWallets,
  useAccount as useCosmosAccount,
  useDisconnect,
  useConnect as useGrazConnect,
  WalletType,
} from "graz";

import {
  enabledCosmosWallets,
  RECOMMENDED_WALLETS,
} from "../lib/connect-wallet/constants";
import {
  checkUAIsCosmostationDappBrowser,
  checkUAIsDappBrowser,
  checkUAIsKeplrDappBrowser,
  checkUAIsLeapDappBrowser,
  checkUAIsMobile,
  mobileWallets,
  wcMobileWallets,
} from "../lib/connect-wallet/utils";
import {
  walletData,
  WalletDataWithAvailability,
} from "../lib/connect-wallet/wallet-data";

const isWarned = false;

export type WalletWithEcosystem =
  | {
      ecosystem: "cosmos";
      name: string;
      wallet: WalletDataWithAvailability;
    }
  | {
      ecosystem: "evm";
      name: string;
      wallet: Connector;
    }
  | {
      ecosystem: "solana";
      name: string;
      wallet: SolanaWallet;
    };

export type WalletWithMultiEcosystems = Record<string, WalletWithEcosystem[]>;

export const useSolanaWallets = (searchQuery: string) => {
  const { wallets: _solanaWallets } = useSolanaWallet();

  const solanaWallets = useMemo(() => {
    if (!_solanaWallets) return undefined;

    // return only unique wallets by name
    const uniqueWallets = new Set();
    return _solanaWallets
      .filter((wallet) => {
        if (uniqueWallets.has(wallet.adapter.name)) return false;
        uniqueWallets.add(wallet.adapter.name);
        return true;
      })
      .filter((wallet) => !["Solflare"].includes(wallet.adapter.name))
      .filter((wallet) => {
        return wallet.adapter.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      });
  }, [_solanaWallets, searchQuery]);

  return useMemo(() => {
    const installed = solanaWallets?.filter(
      (wallet) =>
        wallet.readyState === WalletReadyState.Installed ||
        wallet.readyState === WalletReadyState.Loadable,
    );
    const notDetected = solanaWallets?.filter(
      (wallet) => wallet.readyState === WalletReadyState.NotDetected,
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

export const useEvmWallets = (searchQuery: string) => {
  const { connectors: evmConnectors } = useConnect();

  const evmWallets = useMemo(() => {
    if (!evmConnectors) return undefined;

    // return only unique wallets by id
    const uniqueWallets = new Set();
    return evmConnectors
      .filter((wallet) => {
        if (uniqueWallets.has(wallet.id)) return false;
        uniqueWallets.add(wallet.id);
        return true;
      })
      .filter((wallet) => {
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
    return ["evm-wallets", ...(evmWallets?.map((wallet) => wallet.id) ?? [])];
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
        evmWallets.map(async (wallet) => {
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
        }),
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

export const useCosmosWallets = (searchQuery: string) => {
  const originalGrazWallets: Record<WalletType, boolean> = useMemo(() => {
    const grazWallets = getAvailableWallets();
    if (checkUAIsMobile(navigator.userAgent)) {
      if (checkUAIsDappBrowser(navigator.userAgent)) {
        grazWallets[WalletType.WALLETCONNECT] = false;
        grazWallets[WalletType.WC_LEAP_MOBILE] = false;
        grazWallets[WalletType.WC_KEPLR_MOBILE] = false;
        grazWallets[WalletType.WC_COSMOSTATION_MOBILE] = false;
        grazWallets[WalletType.WC_CLOT_MOBILE] = false;
      }
      if (checkUAIsKeplrDappBrowser(navigator.userAgent)) {
        mobileWallets.forEach((w) => {
          grazWallets[w] = w === WalletType.KEPLR;
        });
      }
      if (checkUAIsCosmostationDappBrowser(navigator.userAgent)) {
        mobileWallets.forEach((w) => {
          grazWallets[w] = w === WalletType.COSMOSTATION;
        });
      }
      if (checkUAIsLeapDappBrowser(navigator.userAgent)) {
        mobileWallets.forEach((w) => {
          grazWallets[w] = w === WalletType.LEAP;
        });
      }
    } else {
      if (!window?.keplr?.getChainInfosWithoutEndpoints) {
        grazWallets[WalletType.KEPLR] = false;
      }
    }
    return grazWallets;
  }, []);

  const { data: grazWallets } = useQuery({
    queryKey: ["updateSnapsStatus"],
    queryFn: async () => {
      const grazWallets = { ...(originalGrazWallets ?? {}) };
      return grazWallets;
    },
    initialData: originalGrazWallets,
  });

  const _walletsToShow: WalletDataWithAvailability[] = useMemo(() => {
    const allWallets = Object.keys(grazWallets) as WalletType[];
    const allWalletsData = allWallets.map((w) => ({
      ...walletData[w],
      name: w,
      isAvailable: grazWallets[w],
    }));

    return enabledCosmosWallets
      .map((w) => {
        if (typeof w === "string") {
          return allWalletsData.find((wallet) => wallet.name === w);
        }
      })
      .filter((w) => !!w)
      .filter((w) => {
        if (checkUAIsMobile(navigator.userAgent)) {
          return w.isAvailable;
        }
        return !wcMobileWallets.has(w.name);
      });
  }, [enabledCosmosWallets, grazWallets]);

  const walletsToShow = useMemo(() => {
    if (!_walletsToShow) return [];

    return _walletsToShow
      .filter((w) => {
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
    const installedWallets = walletsToShow.filter((w) => w.isAvailable);
    const notDetectedWallets = walletsToShow.filter((w) => !w.isAvailable);
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

export const useMergedWallets = (
  cosmosWallets: WalletDataWithAvailability[],
  evmWallets: Connector[],
  solanaWallets: SolanaWallet[] | undefined,
) => {
  return useMemo(() => {
    const allInstalled: WalletWithMultiEcosystems = {};

    cosmosWallets.forEach((wallet) => {
      allInstalled[wallet.prettyName] = [
        {
          ecosystem: "cosmos",
          name: wallet.prettyName,
          wallet: wallet,
        },
      ];
    });
    evmWallets.forEach((wallet) => {
      if (!allInstalled[wallet.name]) {
        allInstalled[wallet.name] = [];
      }
      allInstalled[wallet.name].push({
        ecosystem: "evm",
        name: wallet.name,
        wallet: wallet,
      });
    });
    solanaWallets?.forEach((wallet) => {
      if (!allInstalled[wallet.adapter.name]) {
        allInstalled[wallet.adapter.name] = [];
      }
      allInstalled[wallet.adapter.name].push({
        ecosystem: "solana",
        name: wallet.adapter.name,
        wallet: wallet,
      });
    });
    return allInstalled;
  }, [cosmosWallets, evmWallets, solanaWallets]);
};

export const useEcosystemWallets = (opts?: { searchQuery: string }) => {
  const { searchQuery = "" } = opts ?? {};

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
    solanaInstalledWallets,
  );

  const allNotDetectedWallets = useMergedWallets(
    cosmosNotDetectedWallets,
    evmNotDetectedWallets,
    solanaNotDetectedWallets,
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
      .map((wallet) => allInstalledWallets[wallet]);
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
      .map((wallet) => allNotDetectedWallets[wallet]);
  }, [allNotDetectedWallets]);

  return {
    installedWallets: sortedInstalledWallets,
    notDetectedWallets: sortedNotDetectedWallets,
  };
};
