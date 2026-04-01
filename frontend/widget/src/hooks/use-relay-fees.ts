import BigNumber from "bignumber.js";

import { RelayRouteResponse } from "../lib/relay-api";
import { GasInfo } from "../lib/types";
import { formatAmount, formatAmountWithPrefix } from "../lib/utils";

export const useRelayerFee = (routeData?: RelayRouteResponse): GasInfo => {
  if (routeData) {
    const relayerFee = routeData?.fees.relayer;
    return {
      gasFees: relayerFee
        ? [
            {
              amount: formatAmount(relayerFee.amountFormatted),
              symbol: relayerFee.currency.symbol,
              denom: relayerFee.currency.address,
              amountRaw: relayerFee.amount,
            },
          ]
        : [],
      fiatAmount: formatAmountWithPrefix(
        new BigNumber(relayerFee?.amountUsd ?? "0").toString(),
        "$",
      ),
    };
  }
  return {
    gasFees: [],
    fiatAmount: null,
  };
};
