import ky from "ky";

import { config } from "./constants/config";

export type TxRequest = {
  readonly feeDenomination?: string;
  readonly feeQuantity?: string;
  readonly txHash: string;
  readonly chainId: string;
  /** Whether the tx occurred on the mainnet or the testnet. */
  readonly isMainnet: boolean;
  /** Address of the wallet performing the tx. */
  readonly walletAddress: string;
  readonly type: string;
  readonly metadata?: object;
  readonly amount?: number;
};

export type TxnLogArgs = {
  operationType: string;
  data: TxRequest;
};

const LEAP_API_BASE_URL = config.leapApiBaseUrl;

export class LeapApi {
  private static ky = ky.create({
    prefixUrl: LEAP_API_BASE_URL,
    timeout: false,
  });

  public static async logTxn(args: TxnLogArgs): Promise<void> {
    try {
      const payload = {
        operation: args.operationType,
        data: args.data,
      };
      await LeapApi.ky.post("celestia/", {
        json: payload,
      });
    } catch (e) {
      console.error("Failed to log txn", e);
    }
  }
}
