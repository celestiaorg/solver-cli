import { ChainName, IToken, Token, WarpCore } from "@hyperlane-xyz/sdk";
import { ChainId, isNullish } from "@hyperlane-xyz/utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { config } from "../lib/constants/config";
import { links } from "../lib/constants/links";
import { RelayAPI } from "../lib/relay-api";
import { SupportedAsset, Tabs } from "../lib/types";
import { dedupeMultiCollateralTokens } from "../lib/utils";
import { useWidgetWalletClientContext } from "../contexts/wallet-connect";
import { useHyperlaneStore } from "../store/hyperlane";

export function useWarpCore() {
  return useHyperlaneStore((s) => s.warpCore);
}

export function useTokens() {
  return useWarpCore().tokens;
}

export function useHyperlaneTokens(
  chainId: ChainId,
  origin?: ChainName,
  destination?: ChainName,
) {
  const warpCore = useWarpCore();
  const { excludedTokens } = useWidgetWalletClientContext();
  if (!origin || !destination) return [];
  const multiChainTokens = warpCore.tokens.filter(
    (t) => t.chainName === "edentestnet" || t.isMultiChainToken(),
  );
  const tokensWithRoute = warpCore.getTokensForRoute(origin, destination);
  const tokens = multiChainTokens
    .map((t) => ({
      token: t,
      disabled: !tokensWithRoute.includes(t),
    }))
    // Hide/show disabled tokens
    .filter((t) => (config.showDisabledTokens ? true : !t.disabled));
  const tokenList = tokens.map((t) => t.token);
  const { tokens: supportedTokens } = dedupeMultiCollateralTokens(
    tokenList,
    destination as string,
  );
  let result = supportedTokens.map((t) => ({
    chainId: chainId.toString(),
    chainName: t.chainName,
    denom: t.addressOrDenom,
    originDenom: t.addressOrDenom,
    originChainId: chainId.toString(),
    symbol: t.symbol,
    logoUri: links.imgPath + t.logoURI || "",
    name: t.name,
    decimals: t.decimals,
    coingeckoId: t.coinGeckoId,
    tokenContract: t.collateralAddressOrDenom || t.addressOrDenom,
  })) as SupportedAsset[];
  if (excludedTokens?.length) {
    const excludedKeys = new Set(excludedTokens.map((t) => t.key));
    result = result.filter(
      (a) => !excludedKeys.has(a.originDenom) && !excludedKeys.has(a.denom),
    );
  }
  return result;
}

export function useTokenByIndex(tokenIndex?: number) {
  const warpCore = useWarpCore();
  return getTokenByIndex(warpCore, tokenIndex);
}

export function useIndexForToken(token?: IToken): number | undefined {
  const warpCore = useWarpCore();
  return getIndexForToken(warpCore, token);
}

export const useAssetByDenom = (denom?: string) => {
  const warpCore = useWarpCore();
  return getAssetByDenom(warpCore, denom);
};

export function getTokenByIndex(warpCore: WarpCore, tokenIndex?: number) {
  if (isNullish(tokenIndex) || tokenIndex >= warpCore.tokens.length)
    return undefined;
  return warpCore.tokens[tokenIndex];
}

export function getIndexForToken(
  warpCore: WarpCore,
  token?: IToken,
): number | undefined {
  if (!token) return undefined;
  const index = warpCore.tokens.indexOf(token as Token);
  if (index >= 0) return index;
  else return undefined;
}

export function getAssetByDenom(
  warpCore: WarpCore,
  denom?: string,
  chainName?: string,
): IToken | undefined {
  if (!denom) return undefined;
  const token = warpCore.tokens.find(
    (token) =>
      token.addressOrDenom === denom &&
      (chainName ? token.chainName === chainName : true),
  );
  return token;
}

export function tryFindToken(
  warpCore: WarpCore,
  chain: ChainName,
  addressOrDenom?: string,
): IToken | null {
  try {
    return warpCore.findToken(chain, addressOrDenom);
  } catch {
    return null;
  }
}

export function getTokenIndexFromChains(
  warpCore: WarpCore,
  addressOrDenom: string | null,
  origin: string,
  destination: string,
) {
  // find routes
  const tokensWithRoute = warpCore.getTokensForRoute(origin, destination);
  // find provided token addressOrDenom
  const queryToken = tokensWithRoute.find(
    (token) => token.addressOrDenom === addressOrDenom,
  );

  // if found return index
  if (queryToken) return getIndexForToken(warpCore, queryToken);
  // if tokens route has only one route return that index
  else if (tokensWithRoute.length === 1)
    return getIndexForToken(warpCore, tokensWithRoute[0]);
  // if 0 or more than 1 then return undefined
  return undefined;
}

export function getInitialTokenIndex(
  warpCore: WarpCore,
  addressOrDenom: string | null,
  originQuery?: string,
  destinationQuery?: string,
  defaultOriginToken?: Token,
  defaultDestinationChain?: string,
): number | undefined {
  const firstToken = defaultOriginToken || warpCore.tokens[0];
  const connectedToken = firstToken.connections?.[0].token;

  // origin query and destination query is defined
  if (originQuery && destinationQuery)
    return getTokenIndexFromChains(
      warpCore,
      addressOrDenom,
      originQuery,
      destinationQuery,
    );

  // if none of those are defined, use default values and pass token query
  if (defaultDestinationChain || connectedToken) {
    return getTokenIndexFromChains(
      warpCore,
      addressOrDenom,
      firstToken.chainName,
      defaultDestinationChain || connectedToken?.chainName || "",
    );
  }

  return undefined;
}

export function tryFindTokenConnection(token: Token, chainName: string) {
  const connectedToken = token.connections?.find(
    (connection) => connection.token.chainName === chainName,
  );

  return connectedToken ? connectedToken.token : null;
}

export function useRelayTokens(sourceChainId?: ChainId, enabled = true) {
  const { excludedTokens } = useWidgetWalletClientContext();
  const { data, isLoading, error } = useQuery({
    queryKey: ["relayTokens"],
    enabled,
    queryFn: async (): Promise<Record<string, SupportedAsset[]>> => {
      const response = await RelayAPI.getSupportedAssets({
        defaultList: true,
        depositAddressOnly: false,
      });
      if (response?.success) {
        return response.assets;
      }
      throw new Error("Failed to fetch relay tokens");
    },
  });
  const tokens = useMemo(() => {
    const raw = sourceChainId ? data?.[sourceChainId.toString()] || [] : data;
    if (!raw) return raw;
    if (!excludedTokens?.length) return raw;
    const excludedKeys = new Set(excludedTokens.map((t) => t.key));
    if (sourceChainId) {
      return (raw as SupportedAsset[]).filter(
        (a) => !excludedKeys.has(a.originDenom) && !excludedKeys.has(a.denom),
      );
    }
    return Object.fromEntries(
      Object.entries(raw as Record<string, SupportedAsset[]>).map(
        ([chainId, assets]) => [
          chainId,
          assets.filter(
            (a) =>
              !excludedKeys.has(a.originDenom) && !excludedKeys.has(a.denom),
          ),
        ],
      ),
    );
  }, [data, sourceChainId, excludedTokens]);

  return {
    tokens,
    isLoading,
    error,
  };
}

export const useAggregatedAssets = (tabId?: Tabs) => {
  const { tokens } = useRelayTokens(undefined, tabId === Tabs.FAST);
  return tokens || [];
};
