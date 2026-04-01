import { ChainName } from "@hyperlane-xyz/sdk";
import { ChainId } from "@hyperlane-xyz/utils";
import { RelayChain } from "@relayprotocol/relay-sdk";
import { useQuery } from "@tanstack/react-query";

import { useCallback, useMemo } from "react";

import { ChainsToDisplay } from "../lib/constants/chains";
import { RelayAPI } from "../lib/relay-api";

import { SupportedChain, Tabs } from "../lib/types";
import { getChainDisplayName } from "../lib/utils";
import { useHyperlaneStore } from "../store/hyperlane";
import { useWarpCore } from "./use-assets";
import { useWidgetWalletClientContext } from "../contexts/wallet-connect";

export function useMultiProvider() {
  return useHyperlaneStore((s) => s.multiProvider);
}

// Ensures that the multiProvider has been populated during the onRehydrateStorage hook above,
// otherwise returns undefined
export function useReadyMultiProvider() {
  const multiProvider = useMultiProvider();
  if (!multiProvider.getKnownChainNames().length) return undefined;
  return multiProvider;
}

export function useHyperlaneChains() {
  const multiProvider = useMultiProvider();
  return multiProvider.metadata;
}

export function useHyperlaneChainList() {
  const multiProvider = useMultiProvider();
  const { isTestnet, excludedChains } = useWidgetWalletClientContext();
  return useMemo(() => {
    const excludedChainKeys = excludedChains?.length
      ? new Set(excludedChains.map((c) => c.key))
      : null;
    return Object.values(multiProvider.metadata)
      .filter(
        (v) =>
          (isTestnet === undefined || isTestnet === v.isTestnet) &&
          // ChainsToDisplay.includes(String(v.chainId)) &&
          (!excludedChainKeys || !excludedChainKeys.has(String(v.chainId))),
      )
      .map((chain) => ({
        chainId: String(chain.chainId),
        name: chain.name,
        displayName: chain.displayName,
        logoURI: chain.logoURI || "",
        bech32Prefix: chain.bech32Prefix || "",
        chainType: chain.protocol || undefined,
        icon: chain.logoURI || "",
        baseDenom: chain.nativeToken?.denom,
        nativeToken: chain.nativeToken || undefined,
        isTestnet: chain.isTestnet,
        explorerUrl: chain?.blockExplorers?.[0].url || undefined,
        rpcUrl: chain.rpcUrls?.[0]?.http,
        restUrl: chain.restUrls?.[0].http,
      })) as SupportedChain[];
  }, [multiProvider.metadata, excludedChains, isTestnet]);
}

export function useChainsList() {
  const multiProvider = useMultiProvider();
  return useMemo(
    () =>
      Object.values(multiProvider.metadata).filter(
        (v) => !v.isTestnet && ChainsToDisplay.includes(String(v.chainId)),
      ),
    [multiProvider.metadata],
  );
}

export function useChainMetadata(chainName?: ChainName) {
  const multiProvider = useMultiProvider();
  if (!chainName) return undefined;
  return multiProvider.tryGetChainMetadata(chainName);
}
export function useChainMetadataById(chainId: ChainId) {
  const chains = useHyperlaneChainList();
  return chains.find((c) => c.chainId == chainId);
}

export function useChainProtocol(chainId: ChainId) {
  const chainName = useChainName(chainId || "1") as ChainName;
  const metadata = useChainMetadata(chainName);
  return metadata?.protocol;
}

export function useChainDisplayName(chainName: ChainName, shortName = false) {
  const multiProvider = useMultiProvider();
  return getChainDisplayName(multiProvider, chainName, shortName);
}

export function useChainName(chainId: ChainId): string | null {
  const multiProvider = useReadyMultiProvider();
  if (!multiProvider) return null;
  const chain = Object.values(multiProvider.metadata).find((chain) => {
    return chain.chainId == chainId;
  });
  return chain ? chain.name : null;
}

export function useGetChainName(): (chainId?: ChainId) => ChainName | null {
  const multiProvider = useMultiProvider();

  return useCallback(
    (chainId?: ChainId) => {
      if (!chainId) return null;

      const chain = Object.values(multiProvider.metadata).find((chain) => {
        return chain.chainId == chainId;
      });

      return chain ? chain.name : null;
    },
    [multiProvider.metadata],
  );
}

export function useDestinationChains(
  defaultSourceChainId?: ChainId,
  enabled = false,
):
  | ((chains: SupportedChain[], sourceChainId?: ChainId) => SupportedChain[])
  | undefined {
  const warpCore = useWarpCore();
  const getChainName = useGetChainName();

  return useMemo(() => {
    if (!enabled) return undefined;
    if (!warpCore) return undefined;

    return (chains: SupportedChain[], sourceChainIdParam?: ChainId) => {
      const sourceChainId = sourceChainIdParam || defaultSourceChainId;
      const sourceChainName = getChainName(sourceChainId);

      if (!sourceChainName) return [];

      return chains.filter((chain) => {
        if (chain.chainId === sourceChainId) return false;

        const tokensWithRoute = warpCore.getTokensForRoute(
          sourceChainName,
          chain.name,
        );
        return tokensWithRoute.length > 0;
      });
    };
  }, [warpCore, getChainName, defaultSourceChainId]);
}

export const useRelayChains = (enabled = true) => {
  const { excludedChains } = useWidgetWalletClientContext();
  return useQuery({
    queryKey: ["relay-chains"],
    enabled,
    queryFn: async (): Promise<{
      chains: SupportedChain[];
      _raw: RelayChain[];
    }> => {
      const response = await RelayAPI.getSupportedChains();
      if (response.success) {
        const excludedChainKeys = excludedChains?.length
          ? new Set(excludedChains.map((c) => c.key))
          : null;
        return {
          chains: response.chains.filter(
            (chain) =>
              ChainsToDisplay.includes(chain.chainId) &&
              (!excludedChainKeys || !excludedChainKeys.has(chain.chainId)),
          ),
          _raw: response._raw,
        };
      } else {
        return {
          chains: [],
          _raw: [],
        };
      }
    },
  });
};

export const useAggregatedChains = (tabId?: Tabs) => {
  const { data: relayChains } = useRelayChains(tabId === Tabs.FAST);
  const hyperlaneChains = useHyperlaneChainList();
  const { excludedChains } = useWidgetWalletClientContext();

  return useMemo(() => {
    let chains =
      tabId === Tabs.FAST ? relayChains?.chains || [] : hyperlaneChains;
    if (excludedChains?.length) {
      const excludedChainKeys = new Set(excludedChains.map((c) => c.key));
      chains = chains.filter((c) => !excludedChainKeys.has(c.chainId));
    }
    return chains;
  }, [tabId, relayChains, hyperlaneChains, excludedChains]);
};
