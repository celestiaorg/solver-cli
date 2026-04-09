"use client";

import React, { useEffect, useMemo } from "react";

import { useHyperlaneTokens } from "../../hooks/use-assets";
import {
  useChainName,
  useDestinationChains,
  useHyperlaneChainList,
} from "../../hooks/use-chains";

import ChainAndTokenSelector from "../../components/selector";

import { SupportedAsset } from "../../lib/types";
import { useHyperlaneFlowStore } from "../../store/bridge";

type HyperlaneSelectionScreenProps = {
  className?: string;
  selectorCtx: {
    side: "from" | "to";
    kind: "chain" | "token";
    showOnlyChains?: boolean;
    showOnlyTokens?: boolean;
  } | null;
};

export const HyperlaneSelectionScreen: React.FC<
  HyperlaneSelectionScreenProps
> = ({ className, selectorCtx }) => {
  // Store selectors
  const fromChain = useHyperlaneFlowStore((state) => state.state.from.chain);
  const toChain = useHyperlaneFlowStore((state) => state.state.to.chain);
  const fromToken = useHyperlaneFlowStore((state) => state.state.from.token);
  const toToken = useHyperlaneFlowStore((state) => state.state.to.token);
  const { setScreen, setFromChain, setToChain, setFromToken } =
    useHyperlaneFlowStore();

  const sourceChainName = useChainName(fromChain?.key as string);
  const destinationChainName = useChainName(toChain?.key as string);

  const tokenItems = useHyperlaneTokens(
    fromChain?.key as string,
    sourceChainName as string,
    destinationChainName as string,
  );
  const chainItems = useHyperlaneChainList();
  const filteredChains = useDestinationChains(undefined, true);

  const destinationChains = useMemo(() => {
    if (!filteredChains) return chainItems;
    if (fromChain?.key) {
      return filteredChains(chainItems, fromChain.key as string);
    }
    return chainItems;
  }, [filteredChains, fromChain?.key, chainItems]);

  useEffect(() => {
    if (toChain?.key && tokenItems.length == 0) {
      setToChain({
        key: destinationChains[0]?.chainId,
        displayName: destinationChains[0]?.displayName as string,
        logoURI: destinationChains[0]?.logoURI,
        chainType: destinationChains[0]?.chainType,
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationChains, tokenItems, toChain?.key]);

  return (
    <ChainAndTokenSelector
      open
      title={
        selectorCtx?.showOnlyChains ? "Select chain" : "Select chain & token"
      }
      chains={selectorCtx?.showOnlyChains ? destinationChains : chainItems}
      onlyChainSelection={selectorCtx?.showOnlyChains}
      tokens={tokenItems as SupportedAsset[]}
      onClose={() => setScreen("home")}
      selectedChain={selectorCtx?.side === "from" ? fromChain : toChain}
      selectedToken={
        selectorCtx?.side === "from" ? fromToken?.key : toToken?.key
      }
      onSelectChain={(item) => {
        if (!selectorCtx) return;
        if (selectorCtx.side === "from") {
          setFromChain({
            key: item.chainId,
            displayName: item.displayName as string,
            logoURI: item.logoURI || undefined,
            chainType: item.chainType,
          });
        } else {
          setToChain({
            key: item.chainId,
            displayName: item.displayName as string,
            logoURI: item.logoURI || undefined,
            chainType: item.chainType,
          });
        }
        setFromToken(undefined);
      }}
      onSelectToken={(item) => {
        if (!selectorCtx) return;
        if (selectorCtx.side === "from") {
          setFromToken({
            key: item.originDenom,
            symbol: item.symbol,
            logoURI: item.logoUri,
            coingeckoId: item.coingeckoId,
          });
        }
        setScreen("home");
      }}
    />
  );
};
