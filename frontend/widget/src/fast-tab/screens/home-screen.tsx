"use client";

import BigNumber from "bignumber.js";
import { ChevronDown, ChevronRight } from "lucide-react";

import React, { useMemo } from "react";

import { useAddress, useDestinationAddress } from "../../hooks/use-address";
import { useRelayTokens } from "../../hooks/use-assets";
import { useBalances } from "../../hooks/use-balance";
import { useRelayChains } from "../../hooks/use-chains";
import { useRelayerFee } from "../../hooks/use-relay-fees";
import { useSwapQuote } from "../../hooks/use-swap-quote";
import { useUSDPriceFromRelay } from "../../hooks/use-usd-price";

import { AmountCard } from "../../components/amount-card";
import { SideMini } from "../../components/chain/select-chain";
import { CTAWrapper } from "../../components/cta-section";
import { TabSwitch } from "../../components/tabs";
import { ConversionRateDisplay, TxnInfo } from "../../components/txn-info";
import { AnimatedDots } from "../../components/ui/animated-dots";
import { Button } from "../../components/ui/button";

import { InputType, type SupportedAsset } from "../../lib/types";
import { cn } from "../../lib/utils";
import { useRelayFlowStore } from "../../store/swaps";
import RecipientAddress from "../recipient-address";

type HomeScreenProps = {
  className?: string;
  onNavigate: (screen: "selector" | "review") => void;
  onSetSelectorContext: (ctx: {
    side: "from" | "to";
    kind: "chain" | "token";
  }) => void;
};

const getButtonText = (opts: {
  isGasLoading: boolean;
  inputAmount: number;
  chainDisplayName: string;
  quoteError?: Error | null;
  isInsufficientBalance: boolean;
}): string | React.ReactNode => {
  if (!opts.inputAmount) {
    return "Enter amount";
  }

  if (opts.isInsufficientBalance) {
    return "Insufficient balance";
  }

  if (opts.isGasLoading) {
    return <AnimatedDots text="Fetching quote" />;
  }

  if (opts.quoteError) {
    return "Amount too low";
  }

  return `Swap to ${opts.chainDisplayName}`;
};

export const RelayHomeScreen: React.FC<HomeScreenProps> = ({
  className,
  onNavigate,
  onSetSelectorContext,
}) => {
  // Store selectors - optimized for selective subscriptions
  const fromChain = useRelayFlowStore((state) => state.state.from.chain);
  const toChain = useRelayFlowStore((state) => state.state.to.chain);
  const fromToken = useRelayFlowStore((state) => state.state.from.token);
  const toToken = useRelayFlowStore((state) => state.state.to.token);
  const fromAmount = useRelayFlowStore((state) => state.state.from.amount);
  const amountDisplayFormat = useRelayFlowStore(
    (state) => state.state.amountDisplayFormat,
  );
  const { switchChains, setFromAmount, setAmountDisplayFormat } =
    useRelayFlowStore();

  const { tokens: tokenItems, isLoading: isTokensLoading } = useRelayTokens();
  const { data, isLoading: isChainsLoading } = useRelayChains();
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

  const { data: balances, isLoading: isBalancesLoading } = useBalances(
    { chainId: fromChain?.key as string },
    !!fromChain?.key && !!sourceAddress,
  );

  const fromTokenBalance = useMemo(() => {
    if (!balances || !fromToken?.key) return "0";
    const tokenBalanceData = balances.balances[fromToken.key];
    if (!tokenBalanceData) return "0";
    return tokenBalanceData.amount;
  }, [balances, fromToken?.key]);

  const { data: usdPrice } = useUSDPriceFromRelay(
    {
      chainId: fromChain?.key,
      tokenAddress: fromToken?.key,
    },
    Boolean(fromChain?.key && fromToken?.key),
  );

  const fromTokenAmount = useMemo(() => {
    if (!fromAmount) return "0";
    let amountInTokens = new BigNumber(fromAmount);
    if (amountDisplayFormat === InputType.FIAT) {
      if (!usdPrice) return "0";
      const fiatAmount = new BigNumber(fromAmount);
      amountInTokens = fiatAmount.dividedBy(usdPrice);
    }
    return amountInTokens.toString();
  }, [usdPrice, fromAmount, amountDisplayFormat]);

  const inputAmount = useMemo(() => {
    if (!sourceAssetData) return "0";
    if (!fromTokenAmount) return "0";
    const amount = new BigNumber(fromTokenAmount).multipliedBy(
      new BigNumber(10).pow(sourceAssetData.decimals),
    );
    return amount.toFixed(0);
  }, [sourceAssetData, fromTokenAmount]);

  const isInsufficientBalance = useMemo(() => {
    if (!fromTokenAmount || !fromTokenBalance) return false;
    return new BigNumber(fromTokenAmount).isGreaterThan(fromTokenBalance);
  }, [fromTokenAmount, fromTokenBalance]);

  const {
    data: quote,
    isLoading: isQuoteLoading,
    error: quoteError,
  } = useSwapQuote(
    {
      sender: sourceAddress || "",
      recipient: destinationAddress || "",
      sourceChainId: fromChain?.key,
      destinationChainId: toChain?.key,
      sourceAsset: fromToken?.key,
      destinationAsset: toToken?.key,
      amountIn: inputAmount,
    },
    Boolean(
      fromChain &&
      toChain &&
      fromToken &&
      toToken &&
      fromAmount &&
      !isInsufficientBalance,
    ),
  );

  const outAmount = useMemo(() => {
    if (!quote) return "";
    const { details } = quote;
    if (amountDisplayFormat === InputType.FIAT) {
      return details.currencyOut.amountUsd;
    }
    return details.currencyOut.amountFormatted;
  }, [quote, amountDisplayFormat]);

  const gasInfo = useRelayerFee(quote);

  const buttonText = getButtonText({
    isGasLoading: isQuoteLoading,
    inputAmount: Number(fromAmount),
    chainDisplayName: destinationChainData?.displayName as string,
    quoteError,
    isInsufficientBalance,
  });

  return (
    <>
      <div className="overflow-y-scroll max-h-[90vh]">
        <TabSwitch />

        {/* Chains row */}
        <div className="relative mb-5 flex items-center gap-3">
          <SideMini
            title="From"
            selectType="source"
            chainDetails={fromChain}
            onClick={() => {
              onSetSelectorContext({ side: "from", kind: "chain" });
              onNavigate("selector");
            }}
          />
          <div className="bg-card absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full">
            <Button
              size="icon"
              variant="secondary"
              className="border-card bg-card-foreground group hover:bg-foreground/10 h-auto w-auto cursor-pointer border-4 p-2 text-base disabled:opacity-100"
              disabled={fromChain?.key === toChain?.key}
              onClick={() => switchChains()}
            >
              <ChevronRight className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-180 group-disabled:opacity-50" />
            </Button>
          </div>
          <SideMini
            title="To"
            selectType="destination"
            chainDetails={toChain}
            onClick={() => {
              onSetSelectorContext({ side: "to", kind: "chain" });
              onNavigate("selector");
            }}
          />
        </div>

        {/* Inputs */}
        <div className="relative mb-3 flex flex-col gap-1">
          <AmountCard
            label="You send"
            value={fromAmount}
            selectedChain={fromChain}
            assetDetails={fromToken}
            onChange={(v) => setFromAmount(v)}
            onOpenSelector={() => {
              onSetSelectorContext({ side: "from", kind: "token" });
              onNavigate("selector");
            }}
            showDropdownIcon={
              tokenItems && fromChain?.key
                ? (tokenItems as Record<string, SupportedAsset[]>)[
                    fromChain?.key
                  ]?.length > 1
                : false
            }
            selectType="source"
            setFromAmount={setFromAmount}
            displayFormat={amountDisplayFormat}
            setDisplayFormat={setAmountDisplayFormat}
            isLoading={isTokensLoading}
          />
          <div className="bg-card absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full">
            <Button
              size="icon"
              variant="secondary"
              className="border-card bg-card-foreground group hover:bg-foreground/10 h-auto w-auto cursor-pointer border-4 p-2 text-base disabled:opacity-100"
              disabled={true}
            >
              <ChevronDown className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-180 group-disabled:opacity-50" />
            </Button>
          </div>
          <AmountCard
            label="You get"
            value={outAmount}
            selectedChain={toChain}
            assetDetails={toToken}
            onOpenSelector={() => {
              onSetSelectorContext({ side: "to", kind: "token" });
              onNavigate("selector");
            }}
            disabled
            selectType="destination"
            isLoading={isTokensLoading}
            displayFormat={amountDisplayFormat}
            showDropdownIcon={
              tokenItems && toChain?.key
                ? (tokenItems as Record<string, SupportedAsset[]>)[toChain?.key]
                    ?.length > 1
                : false
            }
          />
        </div>

        <RecipientAddress />

        {/* Meta */}
        {quote && (
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
        )}
      </div>
      <CTAWrapper
        className="mt-auto"
        sourceChain={sourceChainData}
        destinationChain={destinationChainData}
      >
        <Button
          className={cn(
            "mt-auto w-full transition-all hover:scale-105 font-medium text-md",
            {
              "!bg-destructive/90 text-white":
                !!quoteError || isInsufficientBalance,
            },
          )}
          size="lg"
          onClick={() => onNavigate("review")}
          disabled={
            !fromAmount ||
            isInsufficientBalance ||
            !fromChain ||
            !fromToken ||
            !toChain ||
            !toToken ||
            isTokensLoading ||
            isQuoteLoading ||
            isChainsLoading ||
            isBalancesLoading ||
            !quote
          }
        >
          {buttonText}
        </Button>
      </CTAWrapper>
    </>
  );
};
