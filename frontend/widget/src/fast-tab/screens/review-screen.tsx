"use client";

import { type ProgressData } from "@relayprotocol/relay-sdk";
import BigNumber from "bignumber.js";

import React, { useMemo } from "react";

import { useAddress, useDestinationAddress } from "../../hooks/use-address";
import { useRelayTokens } from "../../hooks/use-assets";
import { useRelayChains } from "../../hooks/use-chains";
import { useRelayerFee } from "../../hooks/use-relay-fees";
import { useSwapQuote } from "../../hooks/use-swap-quote";

import { ConversionRateDisplay, TxnInfo } from "../../components/txn-info";

import type { SupportedAsset } from "../../lib/types";
import { useRelayFlowStore } from "../../store/swaps";

import { RelayReview } from "../review";

type ReviewScreenProps = {
  className?: string;
};

export const RelayReviewScreen: React.FC<ReviewScreenProps> = () => {
  // Store selectors
  const fromChain = useRelayFlowStore((state) => state.state.from.chain);
  const toChain = useRelayFlowStore((state) => state.state.to.chain);
  const fromToken = useRelayFlowStore((state) => state.state.from.token);
  const toToken = useRelayFlowStore((state) => state.state.to.token);
  const fromAmount = useRelayFlowStore((state) => state.state.from.amount);
  const amountDisplayFormat = useRelayFlowStore(
    (state) => state.state.amountDisplayFormat,
  );
  const setScreen = useRelayFlowStore((state) => state.setScreen);
  const setTxData = useRelayFlowStore((state) => state.setTxData);

  const { tokens: tokenItems } = useRelayTokens();
  const { data } = useRelayChains();
  const chainItems = data?.chains;

  const sourceChainData = useMemo(() => {
    if (!chainItems || !fromChain?.key) return undefined;
    return chainItems.find((c) => c.chainId === fromChain?.key);
  }, [chainItems, fromChain?.key]);

  const destinationChainData = useMemo(() => {
    if (!chainItems || !toChain?.key) return undefined;
    return chainItems.find((c) => c.chainId === toChain?.key);
  }, [chainItems, toChain?.key]);

  const sourceAssetData = useMemo(() => {
    if (!fromToken || !tokenItems || !fromChain) return null;
    const assets = (tokenItems as Record<string, SupportedAsset[]>)[
      fromChain.key
    ];
    if (!assets) return null;
    return assets.find((t) => t.originDenom === fromToken?.key);
  }, [fromToken, tokenItems, fromChain]);

  const sourceAddress = useAddress(sourceChainData);
  const destinationAddress = useDestinationAddress(destinationChainData);

  const inputAmount = useMemo(() => {
    if (!sourceAssetData) return "0";
    if (!fromAmount) return "0";
    const amount = new BigNumber(fromAmount).multipliedBy(
      new BigNumber(10).pow(sourceAssetData.decimals),
    );
    return amount.toFixed(0);
  }, [sourceAssetData, fromAmount]);

  const { data: quote, isLoading: isQuoteLoading } = useSwapQuote(
    {
      sender: sourceAddress || "",
      recipient: destinationAddress || "",
      sourceChainId: fromChain?.key,
      destinationChainId: toChain?.key,
      sourceAsset: fromToken?.key,
      destinationAsset: toToken?.key,
      amountIn: inputAmount,
    },
    false,
  );

  const outAmount = useMemo(() => {
    if (!quote) return "";
    const { details } = quote;
    return details.currencyOut.amountFormatted;
  }, [quote]);

  const gasInfo = useRelayerFee(quote);
  const handleOnComplete = (data: {
    screen: "success" | "failure";
    payload: ProgressData;
  }) => {
    setTxData(data.payload);
    setScreen(data.screen);
  };

  return (
    <RelayReview
      fromAmount={fromAmount || "0.00"}
      fromChain={fromChain}
      fromToken={fromToken}
      toAmount={outAmount || "0.00"}
      toChain={toChain}
      toToken={toToken}
      quote={quote}
      displayFormat={amountDisplayFormat}
      onBack={() => setScreen("home")}
      onComplete={handleOnComplete}
    >
      <TxnInfo gasInfo={gasInfo} isGasLoading={isQuoteLoading}>
        <ConversionRateDisplay
          fromChain={fromChain}
          toChain={toChain}
          fromToken={fromToken}
          toToken={toToken}
          fromAmount={fromAmount || "0"}
          toAmount={outAmount || "0"}
        />
      </TxnInfo>
    </RelayReview>
  );
};
