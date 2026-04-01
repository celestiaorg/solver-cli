import { AnimatePresence, motion } from "framer-motion";

import React, { useCallback, useMemo } from "react";

import { useBalances } from "../hooks/use-balance";

import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";

import { opacityFadeInOut, transition150 } from "../lib/motion";
import {
  type ChainRef,
  InputType,
  type SupportedAsset,
  type TokenRef,
} from "../lib/types";
import { cn, formatAmount } from "../lib/utils";
import { useWalletConnectStore } from "../store/wallet-connect";

export const TokenBalance: React.FC<{
  assets?: SupportedAsset[];
  sourceChain?: ChainRef;
  selectedAsset?: string | undefined;
  selectedAssetData?: TokenRef | null;
  inputAmount: string;
  inputType: InputType;
  showMaxButton?: boolean;
  setFromAmount?: (amount: string) => void;
}> = ({
  assets,
  sourceChain,
  selectedAsset,
  inputAmount,
  setFromAmount,
  inputType,
  selectedAssetData,
  showMaxButton = false,
}) => {
  const { isConnected } = useWalletConnectStore();

  const assetData = useMemo(() => {
    if (selectedAssetData) return selectedAssetData;
    return assets?.find((asset) => asset.denom === selectedAsset);
  }, [assets, selectedAsset, selectedAssetData]);

  const {
    data: balances,
    isLoading,
    isError,
  } = useBalances({
    chainId: sourceChain?.key as string,
    assets,
  });

  const balance = balances?.balances[selectedAssetData?.key ?? ""];

  const handleMaxClick = useCallback(() => {
    if (!balance) return;

    const maxAmount = balance.amount.toString();

    // If input is in fiat mode, we need to keep it in token amount
    // since balance is always in token terms
    /*     if (inputType === InputType.FIAT) {
      setAssetInput({
        inputAmount: maxAmount,
        type: InputType.TOKEN,
      });
      return;
    } */

    if (!setFromAmount) return;

    setFromAmount(maxAmount);
  }, [balance, inputType, setFromAmount]);

  const balanceCn = useMemo(() => {
    if (inputAmount && balance && inputType === InputType.TOKEN) {
      const balanceAmount = +balance.amount.toString();
      return +inputAmount > balanceAmount && showMaxButton
        ? "text-destructive"
        : "";
    }
    return "";
  }, [inputAmount, balance, inputType, showMaxButton]);

  if (!isConnected) return null;

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "text-secondary-foreground flex items-center gap-1 text-sm font-medium transition-colors",
          balanceCn,
        )}
      >
        <p>Bal:</p>
        <AnimatePresence mode="wait">
          {isLoading ? (
            <Skeleton className="inline-block h-4 w-14" />
          ) : balance && assetData ? (
            <motion.p
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={transition150}
              variants={opacityFadeInOut}
            >
              {formatAmount(balance.amount.toString())} {assetData.symbol}
            </motion.p>
          ) : isError ? (
            <motion.p
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={transition150}
              variants={opacityFadeInOut}
            >
              -
            </motion.p>
          ) : (
            <motion.p
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={transition150}
              variants={opacityFadeInOut}
            >
              0
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      {showMaxButton && (
        <Button
          size="xs"
          variant="glass"
          className="h-auto px-1.5 py-0 text-xs text-foreground hover:scale-105"
          disabled={isLoading || !balance || !assetData}
          onClick={handleMaxClick}
        >
          Max
        </Button>
      )}
    </div>
  );
};
