import { ArrowUpDown } from "lucide-react";

import { useCallback, useMemo } from "react";

import { useUSDPrice, useUSDPriceFromRelay } from "../hooks/use-usd-price";

import { InputType, type TokenRef, type ChainRef } from "../lib/types";
import { formatAmountWithPrefix } from "../lib/utils";

import { Button } from "./ui/button";

const oneBillion = 1_000_000_000;

export const FiatValueDisplay: React.FC<{
  showSwitch?: boolean;
  assetData?: TokenRef;
  selectedChain?: ChainRef;
  inputAmount: string;
  inputType?: InputType;
  setDisplayFormat?: (args: Record<string, string | undefined>) => void;
}> = ({
  showSwitch = true,
  assetData,
  selectedChain,
  inputAmount,
  inputType = InputType.TOKEN,
  setDisplayFormat,
}) => {
  const { data: usdPriceFromCg } = useUSDPrice(assetData?.coingeckoId);

  const { data: usePriceFromRelay } = useUSDPriceFromRelay({
    chainId: selectedChain?.key,
    tokenAddress: assetData?.key,
  });

  const usdPrice = useMemo(() => {
    // Prefer relay price if available
    if (usdPriceFromCg != undefined) {
      return usdPriceFromCg;
    }
    return usePriceFromRelay;
  }, [usePriceFromRelay, usdPriceFromCg]);

  const displayValue = useMemo(() => {
    if (!inputAmount || !usdPrice || !assetData) return 0;

    const amount = parseFloat(inputAmount);

    if (inputType === InputType.TOKEN) {
      // Input is in tokens, display fiat equivalent
      return amount * usdPrice;
    }

    // Input is in fiat, display token equivalent
    return amount / usdPrice;
  }, [inputAmount, usdPrice, assetData, inputType]);

  const handleInputTypeSwitch = useCallback(() => {
    if (!setDisplayFormat) return;
    if (!usdPrice || !assetData || !inputAmount) {
      // If no price or amount data, just switch the type without conversion
      setDisplayFormat({
        type: inputType === InputType.TOKEN ? InputType.FIAT : InputType.TOKEN,
      });
      return;
    }
    const currentAmount = parseFloat(inputAmount);
    const newAmount =
      inputType === InputType.TOKEN
        ? (currentAmount * usdPrice).toFixed(2)
        : (currentAmount / usdPrice).toFixed(2);

    setDisplayFormat({
      type: inputType === InputType.TOKEN ? InputType.FIAT : InputType.TOKEN,
      inputAmount: newAmount,
    });
  }, [inputType, inputAmount, usdPrice, assetData, setDisplayFormat]);

  const formattedValue = useMemo(() => {
    const tokenSymbol = assetData?.symbol || "";
    if (!displayValue) {
      return inputType === InputType.TOKEN ? "$0.00" : `0 ${tokenSymbol}`;
    }

    if (inputType === InputType.TOKEN) {
      // Show fiat value
      return formatAmountWithPrefix(
        displayValue,
        "$",
        undefined,
        undefined,
        displayValue > oneBillion ? "compact" : "standard",
      );
    } else {
      // Show token value
      return `${displayValue.toFixed(4)} ${tokenSymbol}`;
    }
  }, [displayValue, inputType, assetData?.symbol]);

  return (
    <div className="flex items-center gap-1">
      <span className="text-secondary-foreground text-sm">
        {formattedValue}
      </span>
      {showSwitch && (
        <Button
          size="xs"
          variant="glass"
          className="hover:scale-105 size-4.5"
          onClick={handleInputTypeSwitch}
        >
          <ArrowUpDown size={12} className="!size-3 text-foreground" />
          <span className="sr-only">Switch</span>
        </Button>
      )}
    </div>
  );
};
