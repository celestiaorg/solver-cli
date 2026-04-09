import { type IToken } from "@hyperlane-xyz/sdk";
import { useQuery } from "@tanstack/react-query";

import { logger } from "../utils/logger";

import { useWarpCore } from "./use-assets";

export function useIsApproveRequired(
  address: string | undefined,
  token?: IToken,
  amount?: string,
  enabled = true,
) {
  const warpCore = useWarpCore();

  const { isLoading, isError, error, data } = useQuery({
    // The Token class is not serializable, so we can't use it as a key
    queryKey: ["useIsApproveRequired", address, amount, token?.addressOrDenom],
    queryFn: async () => {
      if (!token || !address || !amount) return false;
      return warpCore.isApproveRequired({
        originTokenAmount: token.amount(amount),
        owner: address,
      });
    },
    enabled,
  });

  if (error) {
    logger.debug("useIsApproveRequired", { error });
  }

  return { isLoading, isError, isApproveRequired: !!data };
}
