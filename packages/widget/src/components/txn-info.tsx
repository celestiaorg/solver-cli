import BigNumber from "bignumber.js";

import { useMemo } from "react";

import { useUSDPriceFromRelay } from "../hooks/use-usd-price";

import { type ChainRef, type GasInfo, Tabs, type TokenRef } from "../lib/types";
import { formatAmount } from "../lib/utils";
import { useInputStateStore } from "../store";

import { ETAEstimate } from "./eta";
import { GasFee } from "./gas";
import { HyperlaneLogo } from "./icons/hyperlane-logo";
import { RelayLogo } from "./icons/relay-logo";
import { Skeleton } from "./ui/skeleton";

export const ConversionRateDisplay: React.FC<{
  fromChain?: ChainRef;
  toChain?: ChainRef;
  fromToken?: TokenRef;
  toToken?: TokenRef;
  fromAmount: string;
  toAmount: string;
}> = (props) => {
  /*   const { data: fromTokenUsdPrice, isLoading: isLoadingFromTokenUSDPrice } =
    useUSDPriceFromRelay({
      chainId: props.fromChain?.key,
      tokenAddress: props.fromToken?.key,
    });

  const { data: toTokenUsdPrice, isLoading: isLoadingToTokenUSDPrice } =
    useUSDPriceFromRelay({
      chainId: props.toChain?.key,
      tokenAddress: props.toToken?.key,
    }); */
  const toTokenPerFromToken = useMemo(() => {
    /*     if (isLoadingFromTokenUSDPrice || isLoadingToTokenUSDPrice) {
      return undefined;
    }
    if (!fromTokenUsdPrice || !toTokenUsdPrice) {
      return new BigNumber(props.fromAmount).dividedBy(props.toAmount);
    }
    return new BigNumber(fromTokenUsdPrice).dividedBy(toTokenUsdPrice); */

    return new BigNumber(props.toAmount).dividedBy(props.fromAmount);
  }, [
    // fromTokenUsdPrice,
    // toTokenUsdPrice,
    props.fromAmount,
    props.toAmount,
    // isLoadingFromTokenUSDPrice,
    // isLoadingToTokenUSDPrice,
  ]);
  //if (!fromTokenUsdPrice || !toTokenUsdPrice) return <div> </div>;

  if (!props.toAmount) {
    return <Skeleton className="h-5 w-32 rounded-3xl" />;
  }
  if (toTokenPerFromToken) {
    return (
      <div className="text-xs">
        {`1 ${props.fromToken?.symbol} = ${formatAmount(toTokenPerFromToken, 2, 2, toTokenPerFromToken.gte(10000) ? "compact" : "standard")} ${props.toToken?.symbol}`}
      </div>
    );
  }
  return <div> </div>;
};

export const TxnInfo: React.FC<{
  gasInfo: GasInfo;
  isGasLoading: boolean;
  children?: React.ReactNode;
}> = ({ gasInfo, isGasLoading, children }) => {
  const { inputState } = useInputStateStore();
  const poweredByComp = useMemo(() => {
    if (inputState?.tab === Tabs.FAST)
      return (
        <>
          <RelayLogo className="size-4" />
          <span>Powered by Relay</span>
        </>
      );
    return (
      <>
        <HyperlaneLogo className="size-4" />
        <span>Powered by Hyperlance</span>
      </>
    );
  }, [inputState?.tab]);

  return (
    <div className="bg-secondary mb-3 rounded-2xl p-4 text-xs text-foreground">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          {children}
          <div className="flex items-center gap-2">{poweredByComp}</div>
        </div>
        <div className="flex items-center justify-between">
          <GasFee gasInfo={gasInfo} isLoading={isGasLoading} />
          <ETAEstimate />
        </div>
      </div>
    </div>
  );
};
