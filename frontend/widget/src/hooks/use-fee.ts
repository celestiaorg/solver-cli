import { ProtocolType } from "@hyperlane-xyz/utils";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import type { SupportedChain } from "../lib/types";
import { logger } from "../utils/logger";

import { useAccounts } from "./use-accounts";
import { useAddress, useDestinationAddress } from "./use-address";
import { getAssetByDenom, useWarpCore } from "./use-assets";

export function useFeeQuotes(
  {
    origin,
    originTokenAmount,
    destination,
    denom,
  }: {
    origin?: SupportedChain;
    originTokenAmount: string;
    destination?: SupportedChain;
    denom?: string;
  },
  enabled: boolean,
): UseQueryResult<any, unknown> {
  const warpCore = useWarpCore();
  const { accounts } = useAccounts();
  const sender = useAddress(origin);
  const destinationAddress = useDestinationAddress(destination);
  let senderPubKey: string | undefined;
  if (
    origin &&
    (origin.chainType === ProtocolType.Cosmos ||
      origin.chainType === ProtocolType.CosmosNative)
  ) {
    const account = accounts[origin.chainType];
    senderPubKey = account?.publicKey?.[String(origin?.chainId)];
  }

  return useQuery<any, unknown>({
    enabled,
    queryKey: [
      "useFeeQuotes",
      destination,
      denom,
      sender,
      origin?.chainId,
      senderPubKey,
    ],
    refetchInterval: 30_000,
    retry: false,
    queryFn: async () => {
      const originToken = getAssetByDenom(warpCore, denom, origin?.name);

      if (!destination || !sender || !originToken || !destinationAddress)
        return null;
      logger.debug("Fetching fee quotes");

      return warpCore.estimateTransferRemoteFees({
        originTokenAmount: originToken.amount(originTokenAmount),
        destination: destination.chainId,
        recipient: destinationAddress,
        sender,
        senderPubKey,
      });
    },
  });
}
