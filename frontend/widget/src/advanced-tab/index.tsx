"use client";

import React, { useEffect, useState } from "react";

import { useHyperlaneTokens } from "../hooks/use-assets";
import { useChainName } from "../hooks/use-chains";

import { useHyperlaneFlowStore } from "../store/bridge";

import { HyperlaneFailureScreen } from "./screens/failure-screen";
// Screen components
import { HyperlaneHomeScreen } from "./screens/home-screen";
import { HyperlaneReviewScreen } from "./screens/review-screen";
import { HyperlaneSelectionScreen } from "./screens/selection-screen";
import { HyperlaneSuccessScreen } from "./screens/success-screen";
import { Screen } from "../lib/types";

type HyperlaneTabProps = {
  className?: string;
  onStatusChange?: (status: Screen) => void;
};

export const HyperlaneTab: React.FC<HyperlaneTabProps> = ({
  className,
  onStatusChange,
}) => {
  // Screen state
  const screen = useHyperlaneFlowStore((state) => state.state.screen);
  const fromChain = useHyperlaneFlowStore((state) => state.state.from.chain);
  const toChain = useHyperlaneFlowStore((state) => state.state.to.chain);
  const fromToken = useHyperlaneFlowStore((state) => state.state.from.token);
  const { setFromToken, setScreen } = useHyperlaneFlowStore();

  const [selectorCtx, setSelectorCtx] = useState<{
    side: "from" | "to";
    kind: "chain" | "token";
    showOnlyChains?: boolean;
    showOnlyTokens?: boolean;
  } | null>(null);

  const sourceChainName = useChainName(fromChain?.key as string);
  const destinationChainName = useChainName(toChain?.key as string);

  const tokenItems = useHyperlaneTokens(
    fromChain?.key as string,
    sourceChainName as string,
    destinationChainName as string,
  );

  // Auto-set default tokens based on selected chains
  useEffect(() => {
    if (!fromChain?.key) return;

    if (tokenItems && !fromToken && tokenItems.length > 0) {
      setFromToken({
        key: tokenItems[0].originDenom,
        symbol: tokenItems[0].symbol,
        logoURI: tokenItems[0].logoUri,
      });
    }
  }, [setFromToken, fromToken, fromChain?.key, tokenItems]);

  // Screen navigation handlers
  const handleNavigate = (newScreen: "selector" | "review") => {
    setScreen(newScreen);
  };

  const handleSetSelectorContext = (ctx: {
    side: "from" | "to";
    kind: "chain" | "token";
    showOnlyChains?: boolean;
  }) => {
    setSelectorCtx(ctx);
  };

  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(screen ?? "home");
    }
  }, [screen, onStatusChange]);

  // Render screens based on current state
  switch (screen) {
    case "home":
      return (
        <HyperlaneHomeScreen
          className={className}
          onNavigate={handleNavigate}
          onSetSelectorContext={handleSetSelectorContext}
        />
      );

    case "review":
      return <HyperlaneReviewScreen className={className} />;

    case "success":
      return <HyperlaneSuccessScreen className={className} />;

    case "failure":
      return <HyperlaneFailureScreen className={className} />;

    case "selector":
      return (
        <HyperlaneSelectionScreen
          className={className}
          selectorCtx={selectorCtx}
        />
      );

    default:
      return (
        <HyperlaneHomeScreen
          className={className}
          onNavigate={handleNavigate}
          onSetSelectorContext={handleSetSelectorContext}
        />
      );
  }
};

export default HyperlaneTab;
