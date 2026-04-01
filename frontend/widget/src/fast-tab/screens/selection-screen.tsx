"use client";

import React from "react";

import { useRelayTokens } from "../../hooks/use-assets";
import { useRelayChains } from "../../hooks/use-chains";

import ChainAndTokenSelector from "../../components/selector";

import type { SupportedAsset } from "../../lib/types";
import { useRelayFlowStore } from "../../store/swaps";

type SelectionScreenProps = {
  className?: string;
  selectorCtx: {
    side: "from" | "to";
    kind: "chain" | "token";
  } | null;
};

export const RelaySelectionScreen: React.FC<SelectionScreenProps> = ({
  className,
  selectorCtx,
}) => {
  // Store selectors
  const fromChain = useRelayFlowStore((state) => state.state.from.chain);
  const toChain = useRelayFlowStore((state) => state.state.to.chain);
  const fromToken = useRelayFlowStore((state) => state.state.from.token);
  const toToken = useRelayFlowStore((state) => state.state.to.token);
  const { setScreen, setFromChain, setToChain, setFromToken, setToToken } =
    useRelayFlowStore();

  const { tokens: tokenItems } = useRelayTokens();
  const { data } = useRelayChains();
  const chainItems = data?.chains;

  return (
    <div className="flex-1">
      <ChainAndTokenSelector
        open
        title={"Select chain & token"}
        chains={chainItems}
        tokens={tokenItems as Record<string, SupportedAsset[]>}
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
            setFromToken(undefined);
          } else {
            setToChain({
              key: item.chainId,
              displayName: item.displayName as string,
              logoURI: item.logoURI || undefined,
              chainType: item.chainType,
            });
            setToToken(undefined);
          }
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
          } else {
            setToToken({
              key: item.originDenom,
              symbol: item.symbol,
              logoURI: item.logoUri,
              coingeckoId: item.coingeckoId,
            });
          }
          setScreen("home");
        }}
      />
    </div>
  );
};
