import { useQuery } from "@tanstack/react-query";

import {
  RelayAPI,
  RelayFee,
  RelayRouteRequest,
  TradeType,
} from "../lib/relay-api";

const getRelayRoute = async (relayRouteData: RelayRouteRequest) => {
  return RelayAPI.getRoute(relayRouteData);
};

export function useSwapQuote(
  args: {
    sender: string;
    recipient: string;
    sourceChainId?: string;
    destinationChainId?: string;
    sourceAsset?: string;
    destinationAsset?: string;
    amountIn: string;
    affiliateFees?: RelayFee[];
  },
  enabled = true,
) {
  const {
    sender,
    recipient,
    sourceChainId,
    destinationChainId,
    sourceAsset,
    destinationAsset,
    amountIn,
    affiliateFees,
  } = args;

  return useQuery({
    queryKey: [
      "swapQuote",
      sender,
      recipient,
      sourceChainId,
      destinationChainId,
      sourceAsset,
      destinationAsset,
      amountIn,
      affiliateFees,
    ],
    queryFn: async () => {
      if (!sourceChainId || !destinationChainId) {
        throw new Error("Source and destination chains ids are required");
      }
      if (!sourceAsset || !destinationAsset) {
        throw new Error("Source and destination assets are required");
      }
      const relayRouteData: RelayRouteRequest = {
        user: sender,
        recipient: recipient,
        originChainId: sourceChainId,
        destinationChainId,
        originCurrency: sourceAsset,
        destinationCurrency: destinationAsset,
        amount: amountIn,
        tradeType: TradeType.EXACT_INPUT,
      };

      if (affiliateFees) {
        relayRouteData.appFees = affiliateFees;
      }

      const res = await getRelayRoute(relayRouteData);
      if (res.success) {
        return res.route;
      }
      throw new Error(res.error || "Failed to fetch swap quote");
    },
    enabled:
      enabled &&
      !!(
        sender &&
        recipient &&
        sourceChainId &&
        destinationChainId &&
        sourceAsset &&
        destinationAsset &&
        amountIn &&
        Number(amountIn) > 0
      ),
    retry: false,
    refetchInterval: 30_000,
  });
}
