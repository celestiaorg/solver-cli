"use client";

import {
  configureViemChain,
  createClient,
  MAINNET_RELAY_API,
} from "@relayprotocol/relay-sdk";

import React, { useEffect, useState } from "react";

import { useRelayTokens } from "../hooks/use-assets";
import { useRelayChains } from "../hooks/use-chains";

import type { SupportedAsset } from "../lib/types";
import { useRelayFlowStore } from "../store/swaps";

import { RelayFailureScreen } from "./screens/failure-screen";
// Screen components
import { RelayHomeScreen } from "./screens/home-screen";
import { RelayReviewScreen } from "./screens/review-screen";
import { RelaySelectionScreen } from "./screens/selection-screen";
import { RelaySuccessScreen } from "./screens/success-screen";

type RelayWidgetProps = {
  className?: string;
};

export const RelayWidget: React.FC<RelayWidgetProps> = ({ className }) => {
  // Screen state
  const screen = useRelayFlowStore((state) => state.state.screen);
  const { setFromToken, setToToken, setScreen } = useRelayFlowStore();

  const [selectorCtx, setSelectorCtx] = useState<{
    side: "from" | "to";
    kind: "chain" | "token";
  } | null>(null);

  const { tokens: tokenItems } = useRelayTokens();
  const { data } = useRelayChains();

  // Auto-set default tokens based on selected chains
  useEffect(() => {
    if (!tokenItems) return;

    const fromChain = useRelayFlowStore.getState().state.from.chain;
    if (fromChain) {
      const fromChainTokens = (tokenItems as Record<string, SupportedAsset[]>)[
        fromChain.key
      ];
      if (
        !useRelayFlowStore.getState().state.from.token &&
        fromChainTokens?.length > 0
      ) {
        setFromToken({
          key: fromChainTokens[0].originDenom,
          symbol: fromChainTokens[0].symbol,
          logoURI: fromChainTokens[0].logoUri,
        });
      }
    }

    const toChain = useRelayFlowStore.getState().state.to.chain;
    if (toChain) {
      const toChainTokens = (tokenItems as Record<string, SupportedAsset[]>)[
        toChain.key
      ];
      if (
        !useRelayFlowStore.getState().state.to.token &&
        toChainTokens?.length > 0
      ) {
        setToToken({
          key: toChainTokens[0].originDenom,
          symbol: toChainTokens[0].symbol,
          logoURI: toChainTokens[0].logoUri,
        });
      }
    }
  }, [tokenItems, setFromToken, setToToken]);

  // Initialize Relay SDK
  useEffect(() => {
    if (data?._raw) {
      createClient({
        baseApiUrl: MAINNET_RELAY_API,
        chains: data?._raw.map((chain: any) => configureViemChain(chain)),
      });
    }
  }, [data?._raw]);

  // Screen navigation handlers
  const handleNavigate = (newScreen: "selector" | "review") => {
    setScreen(newScreen);
  };

  const handleSetSelectorContext = (ctx: {
    side: "from" | "to";
    kind: "chain" | "token";
  }) => {
    setSelectorCtx(ctx);
  };

  // Render screens based on current state
  switch (screen) {
    case "home":
      return (
        <RelayHomeScreen
          className={className}
          onNavigate={handleNavigate}
          onSetSelectorContext={handleSetSelectorContext}
        />
      );

    case "review":
      return <RelayReviewScreen className={className} />;

    case "success":
      return <RelaySuccessScreen className={className} />;

    case "failure":
      return <RelayFailureScreen className={className} />;

    case "selector":
      return (
        <RelaySelectionScreen className={className} selectorCtx={selectorCtx} />
      );

    default:
      return (
        <RelayHomeScreen
          className={className}
          onNavigate={handleNavigate}
          onSetSelectorContext={handleSetSelectorContext}
        />
      );
  }
};

export default RelayWidget;
