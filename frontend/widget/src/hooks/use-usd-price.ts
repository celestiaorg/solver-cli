import { useQuery } from "@tanstack/react-query";

import { RelayAPI } from "../lib/relay-api";

import { useAssetByDenom } from "./use-assets";
import { useRelayChains } from "./use-chains";

export async function getUSDValue(coingeckoId: string) {
  if (!coingeckoId) {
    throw new Error("coingeckoId is not defined");
  }
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coingeckoId)}&vs_currencies=usd`,
  );
  if (!res.ok) {
    throw new Error("Failed to fetch price from CoinGecko");
  }
  const data = await res.json();
  const price = data?.[coingeckoId]?.usd;
  if (typeof price !== "number") {
    return undefined;
  }
  return price;
}

export const useUSDPrice = (coingeckoId: string | undefined) => {
  return useQuery<number | undefined>({
    queryKey: ["coingecko-usd-price", coingeckoId],
    queryFn: () => getUSDValue(coingeckoId || ""),
    enabled: !!coingeckoId,
    refetchInterval: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * React hook to get the USD price of a token from Squid
 */
export const useUSDPriceFromRelay = (
  info: {
    chainId?: string;
    tokenAddress?: string;
  },
  enabled = true,
) => {
  const key = `${info.chainId}:${info.tokenAddress}`;
  const { data: relayChains } = useRelayChains();
  return useQuery<number | undefined>({
    queryKey: ["relay-usd-price", key],
    queryFn: async () => {
      if (!relayChains?.chains || !info.chainId) {
        throw new Error("Relay chains not loaded");
      }
      const isRelayChain = relayChains.chains.find(
        (chain) => chain.chainId === info.chainId,
      );
      const result = await RelayAPI.getTokenPrice(
        info.tokenAddress,
        isRelayChain ? info.chainId : undefined,
      );
      if (result === -1) {
        throw new Error("Token price not found");
      }
      return result;
    },
    enabled: enabled && !!key,
    refetchInterval: 1000 * 60 * 5, // 5 minutes
  });
};

export const useUSDPriceByDenom = (denom?: string) => {
  const asset = useAssetByDenom(denom);
  return useUSDPrice(asset?.coinGeckoId);
};
