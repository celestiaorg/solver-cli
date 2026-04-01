import { TokenAmount } from "@hyperlane-xyz/sdk";
import { ChainId, ProtocolType, toWei } from "@hyperlane-xyz/utils";
import { useQuery } from "@tanstack/react-query";

import { logger } from "../utils/logger";

import { useAccounts } from "./use-accounts";
import { useAddress } from "./use-address";
import { getAssetByDenom, useWarpCore } from "./use-assets";
import { useChainMetadataById, useChainName } from "./use-chains";

export const useValidateInput = (
  {
    originChainId,
    destinationChainId,
    denom,
    inputAmount,
  }: {
    originChainId: ChainId;
    destinationChainId: ChainId;
    denom?: string;
    inputAmount?: string;
  },
  enabled: boolean,
) => {
  const warpCore = useWarpCore();
  const { accounts } = useAccounts();
  const origin = useChainName(originChainId);
  const destination = useChainName(destinationChainId);

  const originChainMetadata = useChainMetadataById(originChainId);
  const sender = useAddress(originChainMetadata);
  let senderPubKey: string | undefined;
  if (
    originChainMetadata &&
    (originChainMetadata.chainType === ProtocolType.Cosmos ||
      originChainMetadata.chainType === ProtocolType.CosmosNative)
  ) {
    const account = accounts[originChainMetadata.chainType];
    senderPubKey = account?.publicKey?.[String(originChainMetadata?.chainId)];
  }

  const destinationChainMetadata = useChainMetadataById(destinationChainId);
  const recipientAddress = useAddress(destinationChainMetadata);

  return useQuery({
    enabled,
    queryKey: [
      "useValidateInput",
      destination,
      recipientAddress,
      denom,
      sender,
      inputAmount,
      senderPubKey,
    ],
    retry: false,
    queryFn: async () => {
      logger.debug(
        `useValidateInput: Validating transfer from ${origin} to ${destination} with denom ${denom} and amount ${inputAmount}`,
      );
      const originToken = getAssetByDenom(warpCore, denom);
      const amountWei = toWei(inputAmount, originToken?.decimals);

      if (!destination || !sender || !originToken || !recipientAddress)
        return null;

      return warpCore.validateTransfer({
        destination: destination,
        sender: sender,
        recipient: recipientAddress,
        originTokenAmount: new TokenAmount(amountWei, originToken),
        senderPubKey,
      });
    },
  });
};
