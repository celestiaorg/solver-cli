"use client";

import BigNumber from "bignumber.js";
import { ChevronDown, ChevronRight } from "lucide-react";

import React, { useMemo } from "react";

import { useHyperlaneTokens } from "../../hooks/use-assets";
import { useBalances } from "../../hooks/use-balance";
import { useChainName, useHyperlaneChainList } from "../../hooks/use-chains";
import { useGasInfo } from "../../hooks/use-gas-info";
import { useUSDPrice } from "../../hooks/use-usd-price";
import { useValidateInput } from "../../hooks/use-validate-input";

import { AmountCard } from "../../components/amount-card";
import { ConversionRateDisplayForTransfer } from "../../components/miscellaneous";
import { AnimatedDots } from "../../components/ui/animated-dots";
import { Button } from "../../components/ui/button";

import { InputType, SupportedAsset } from "../../lib/types";
import { cn } from "../../lib/utils";
import { useHyperlaneFlowStore } from "../../store/bridge";

import { SideMini } from "../../components/chain/select-chain";
import { CTAWrapper } from "../../components/cta-section";
import { TabSwitch } from "../../components/tabs";
import { TxnInfo } from "../../components/txn-info";
import { DestinationTokenInfo } from "../token-info";
import RecipientAddress from "../recipient-address";

type HyperlaneHomeScreenProps = {
  className?: string;
  onNavigate: (screen: "selector" | "review") => void;
  onSetSelectorContext: (ctx: {
    side: "from" | "to";
    kind: "chain" | "token";
    showOnlyChains?: boolean;
  }) => void;
};

const getButtonText = (opts: {
  isGasLoading: boolean;
  inputAmount: number;
  chainDisplayName: string;
  isValidating: boolean;
  validation?: Record<string, string> | null;
  validationError?: Error | null;
  isRefreshingGasQuote?: boolean;
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
  if (opts.isValidating) {
    return <AnimatedDots text="Validating" />;
  }

  if (opts.validation) {
    return Object.values(opts.validation)[0];
  }

  if (opts.validationError) {
    return "Insufficient funds for gas fee";
  }

  return `Send to ${opts.chainDisplayName}`;
};

export const HyperlaneHomeScreen: React.FC<HyperlaneHomeScreenProps> = ({
  className,
  onNavigate,
  onSetSelectorContext,
}) => {
  // Store selectors - optimized for selective subscriptions
  const fromChain = useHyperlaneFlowStore((state) => state.state.from.chain);
  const toChain = useHyperlaneFlowStore((state) => state.state.to.chain);
  const fromToken = useHyperlaneFlowStore((state) => state.state.from.token);
  const fromAmount = useHyperlaneFlowStore((state) => state.state.from.amount);
  const amountDisplayFormat = useHyperlaneFlowStore(
    (state) => state.state.amountDisplayFormat,
  );
  const { switchChains, setFromAmount, setAmountDisplayFormat } =
    useHyperlaneFlowStore();

  const sourceChainName = useChainName(fromChain?.key as string);
  const destinationChainName = useChainName(toChain?.key as string);
  const tokenItems = useHyperlaneTokens(
    fromChain?.key as string,
    sourceChainName as string,
    destinationChainName as string,
  );

  const chainItems = useHyperlaneChainList();

  const sourceChainData = useMemo(() => {
    if (!chainItems || !fromChain?.key) return undefined;
    return chainItems.find((c) => c.chainId === fromChain?.key);
  }, [chainItems, fromChain?.key]);

  const destinationChainData = useMemo(() => {
    if (!chainItems || !toChain?.key) return undefined;
    return chainItems.find((c) => c.chainId === toChain?.key);
  }, [chainItems, toChain?.key]);

  const { data: balances, isLoading: isBalancesLoading } = useBalances(
    { chainId: fromChain?.key as string, assets: tokenItems },
    !!fromChain?.key,
  );

  const fromTokenBalance = useMemo(() => {
    if (!balances || !fromToken?.key) return "0";
    const sourceAsset = tokenItems.find(
      (asset) => asset.originDenom === fromToken?.key,
    );
    const tokenBalanceData =
      balances.balances[sourceAsset?.originDenom as string];

    if (!tokenBalanceData) return "0";
    return tokenBalanceData.amount;
  }, [balances, fromToken?.key, tokenItems]);

  const { data: usdPrice } = useUSDPrice(fromToken?.coingeckoId as string);

  const inputAmount = useMemo(() => {
    if (!fromAmount) return "0";
    let amountInTokens = new BigNumber(fromAmount);
    if (amountDisplayFormat === InputType.FIAT) {
      if (!usdPrice) return "0";
      const fiatAmount = new BigNumber(fromAmount);
      amountInTokens = fiatAmount.dividedBy(usdPrice);
    }
    return amountInTokens.toString();
  }, [fromAmount, usdPrice, amountDisplayFormat]);

  const isInsufficientBalance = useMemo(() => {
    if (!inputAmount || !fromTokenBalance) return false;
    return new BigNumber(inputAmount).isGreaterThan(fromTokenBalance);
  }, [inputAmount, fromTokenBalance]);

  const { isFetching: isGasLoading, gasInfo } = useGasInfo(
    {
      originChainId: fromChain?.key as string,
      destinationChainId: toChain?.key as string,
      asset: fromToken?.key,
      inputAmount: inputAmount || "0",
    },
    !isInsufficientBalance,
  );

  const {
    data: validation,
    isLoading: isValidating,
    error: validationError,
  } = useValidateInput(
    {
      originChainId: fromChain?.key as string,
      destinationChainId: toChain?.key as string,
      denom: fromToken?.key as string,
      inputAmount: inputAmount,
    },
    !isInsufficientBalance && Number(inputAmount) > 0,
  );
  const formattedInputAmount = +inputAmount;
  const buttonText = getButtonText({
    isGasLoading,
    inputAmount: formattedInputAmount,
    chainDisplayName: destinationChainData?.displayName as string,
    isValidating,
    validation,
    validationError,
    isInsufficientBalance,
  });

  return (
    <>
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
        <div className="bg-card absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full direction-button-bg">
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
            onSetSelectorContext({
              side: "to",
              kind: "chain",
              showOnlyChains: true,
            });
            onNavigate("selector");
          }}
        />
      </div>

      {/* Inputs */}
      <div className="relative mb-3 flex flex-col gap-2">
        <AmountCard
          label="You send"
          value={fromAmount}
          assets={tokenItems as SupportedAsset[]}
          selectedChain={fromChain}
          assetDetails={fromToken}
          onChange={(v) => setFromAmount(v)}
          onOpenSelector={() => {
            onSetSelectorContext({ side: "from", kind: "token" });
            onNavigate("selector");
          }}
          showDropdownIcon={
            tokenItems && fromChain?.key ? tokenItems.length > 1 : false
          }
          selectType="source"
          isLoading={tokenItems.length === 0}
          setFromAmount={setFromAmount}
          displayFormat={amountDisplayFormat}
          setDisplayFormat={setAmountDisplayFormat}
        />
        <div className="bg-card absolute top-[52%] left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full direction-button-bg">
          <Button
            size="icon"
            variant="secondary"
            className="border-card bg-card-foreground group hover:bg-foreground/10 h-auto w-auto cursor-pointer border-4 p-2 text-base disabled:opacity-100"
            disabled={true}
          >
            <ChevronDown className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-180 group-disabled:opacity-50" />
          </Button>
        </div>
        <div className="bg-secondary flex w-full flex-col rounded-xl px-4 py-6">
          <div className="text-muted-foreground mb-3 text-xs">You get</div>
          <DestinationTokenInfo
            assetData={fromToken}
            chainData={toChain}
            outAmount={inputAmount || "0"}
          />
        </div>
      </div>

      <RecipientAddress />
      {/* Meta */}
      {formattedInputAmount && gasInfo ? (
        <TxnInfo gasInfo={gasInfo} isGasLoading={isGasLoading}>
          <ConversionRateDisplayForTransfer fromToken={fromToken} />
        </TxnInfo>
      ) : null}

      <CTAWrapper
        className="mt-auto"
        sourceChain={sourceChainData}
        destinationChain={destinationChainData}
      >
        <Button
          className={cn(
            "mt-auto w-full transition-all hover:scale-105 font-medium text-md",
            (isInsufficientBalance || !!validation || !!validationError) &&
              !isGasLoading
              ? "!bg-destructive/90 text-white"
              : "",
          )}
          size="lg"
          onClick={() => onNavigate("review")}
          disabled={
            isGasLoading ||
            isBalancesLoading ||
            isInsufficientBalance ||
            !fromToken ||
            !formattedInputAmount ||
            !sourceChainData?.chainType ||
            !!validation ||
            !!validationError ||
            isValidating
          }
        >
          {buttonText}
        </Button>
      </CTAWrapper>
    </>
  );
};
