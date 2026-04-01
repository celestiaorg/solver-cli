import type { ChainId } from "@hyperlane-xyz/utils";

import { useEffect, useMemo } from "react";

import { useChainMetadataById, useChainName } from "./use-chains";
import { useFeeQuotes } from "./use-fee";

import { formatAmount } from "../lib/utils";
import { logger } from "../utils/logger";

type GasFeeItem = {
  amount: string;
  amountRaw: string;
  denom: string;
  symbol: string;
};
type GasInfoReturn = {
  gasFees: GasFeeItem[];
  fiatAmount: string | null;
} | null;
type UseGasInfoResult = { gasInfo: GasInfoReturn } & Record<string, any>;

export const useGasInfo = (
  opts: {
    originChainId: ChainId;
    destinationChainId: ChainId;
    asset: string | undefined;
    inputAmount: string;
  },
  enabled = true,
): UseGasInfoResult => {
  const destinationChainMetadata = useChainMetadataById(
    opts.destinationChainId,
  );
  const originChainMetadata = useChainMetadataById(opts.originChainId);

  const feeQuote = useFeeQuotes(
    {
      origin: originChainMetadata || undefined,
      originTokenAmount: opts.inputAmount,
      destination: destinationChainMetadata || undefined,
      denom: opts.asset,
    },
    enabled &&
      !!(
        destinationChainMetadata &&
        opts.asset &&
        originChainMetadata &&
        Number(opts.inputAmount) > 0
      ),
  );
  const fees = feeQuote.data;
  const error = feeQuote.error;

  useEffect(() => {
    logger.debug(
      `useGasInfo: feeQuote for ${opts.originChainId} to ${opts.destinationChainId} with asset ${opts.asset}`,
      fees,
      error,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fees, error]);

  const gasInfo = useMemo(() => {
    if (!fees?.localQuote && !fees?.interchainQuote) return null;

    const gasFees = [];

    if (fees.localQuote && fees.interchainQuote) {
      const localFeesymbol = fees.localQuote.token.symbol;
      const interchainFeesymbol = fees.interchainQuote.token.symbol;
      if (localFeesymbol === interchainFeesymbol) {
        // Sum the amounts (use raw amounts for accuracy, then format)
        const totalAmount = fees.localQuote.plus(fees.interchainQuote.amount);
        gasFees.push({
          amount: formatAmount(totalAmount.getDecimalFormattedAmount()),
          amountRaw: totalAmount.amount.toString(),
          denom: fees.localQuote.token.addressOrDenom,
          symbol: localFeesymbol,
        });
      } else {
        gasFees.push({
          amount: formatAmount(fees.localQuote.getDecimalFormattedAmount()),
          denom: fees.localQuote.token.addressOrDenom,
          amountRaw: fees.localQuote.amount.toString(),
          symbol: localFeesymbol,
        });
        gasFees.push({
          amount: formatAmount(
            fees.interchainQuote.getDecimalFormattedAmount(),
          ),
          amountRaw: fees.interchainQuote.amount.toString(),
          denom: fees.interchainQuote.token.addressOrDenom,
          symbol: interchainFeesymbol,
        });
      }
    } else if (fees.localQuote) {
      const localFeesymbol = fees.localQuote.token.symbol;
      gasFees.push({
        amount: formatAmount(fees.localQuote.getDecimalFormattedAmount()),
        denom: fees.localQuote.token.addressOrDenom,
        amountRaw: fees.localQuote.amount.toString(),
        symbol: localFeesymbol,
      });
    } else if (fees.interchainQuote) {
      const interchainFeesymbol = fees.interchainQuote.token.symbol;
      gasFees.push({
        amount: formatAmount(fees.interchainQuote.getDecimalFormattedAmount()),
        denom: fees.interchainQuote.token.addressOrDenom,
        amountRaw: fees.interchainQuote.amount.toString(),
        symbol: interchainFeesymbol,
      });
    }

    return { gasFees, fiatAmount: null };
  }, [fees]);

  return { gasInfo, ...(feeQuote as any) };
};
