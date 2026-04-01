import ky, { HTTPError } from "ky";

import { SupportedAsset, SupportedChain } from "./types";
import { getRelayChainId, parseRelayChainType } from "./utils";

export enum RelayChainId {
  solana = "792703809",
  bitcoin = "8253038",
}

export enum TradeType {
  EXACT_INPUT = "EXACT_INPUT",
  EXACT_OUTPUT = "EXACT_OUTPUT",
  EXPECTED_OUTPUT = "EXPECTED_OUTPUT",
}

export type NativeToken = {
  id: string;
  symbol: string;
  name: string;
  chainId: number;
  address: string;
  decimals: number;
  supportsBridging?: boolean;
};

type ChainContracts = {
  multicall3: string;
  multicaller: string;
  onlyOwnerMulticaller: string;
  relayReceiver: string;
  erc20Router: string;
  approvalProxy: string;
};

type RelayAsset = {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  metadata: {
    logoURI: string;
    verified: boolean;
    isNative: boolean;
  };
};

type RelayAssetJSON = {
  groupID: string;
  vmType: string;
} & RelayAsset;

export type RelaySupportedAssetsArgs = {
  chainIds?: string[];
  defaultList: boolean;
  depositAddressOnly: boolean;
  term?: string;
  verified?: boolean;
  limit?: number;
};

export type RelayFee = {
  recipient: string;
  fee: string;
};

export type RelayRouteRequest = {
  user?: string;
  recipient?: string;
  originChainId: string;
  destinationChainId: string;
  originCurrency: string;
  destinationCurrency: string;
  amount: string;
  tradeType: TradeType;
  txs?: {
    to: string;
    value: string;
    data: string;
  }[];
  referrer?: string;
  refundTo?: string;
  refundOnOrigin?: boolean;
  useReceiver?: boolean;
  useExternalLiquidity?: boolean;
  usePermit?: boolean;
  useDepositAddress?: boolean;
  /**
   * Use BPS (basis points) for slippage
   */
  slippageTolerance?: string;
  appFees?: RelayFee[];
  gasLimitForDepositSpecifiedTxs?: number;
  userOperationGasOverhead?: number;
  forceSolverExecution?: boolean;
};

type RelayFees = {
  currency: RelayAsset;
  amount: string;
  amountFormatted: string;
  amountUsd: string;
  minimumAmount: string;
};

export type StepItem = {
  status: string;
  data: {
    from: string;
    to: string;
    data: string;
    value: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    chainId?: number;
  };
  check: {
    endpoint: string;
    method: string;
  };
};

export type TransactionStep = {
  id: string;
  action: string;
  description: string;
  kind: "transaction" | "signature";
  requestId: string;
  items: StepItem[];
};

export type RelayRouteResponse = {
  steps: TransactionStep[];
  fees: {
    gas: RelayFees;
    relayer: RelayFees;
    relayerGas: RelayFees;
    relayerService: RelayFees;
    app: RelayFees;
  };
  details: {
    operation: "send" | "swap" | "wrap" | "unwrap" | "bridge";
    sender: string;
    recipient: string;
    currencyIn: {
      currency: RelayAsset;
      amount: string;
      amountFormatted: string;
      amountUsd: string;
      minimumAmount: string;
    };
    currencyOut: {
      currency: RelayAsset;
      amount: string;
      amountFormatted: string;
      amountUsd: string;
      minimumAmount: string;
    };
    totalImpact: {
      usd: string;
      percent: string;
    };
    swapImpact: {
      usd: string;
      percent: string;
    };
    rate: string;
    slippageTolerance: {
      origin: {
        usd: string;
        value: string;
        percent: string;
      };
      destination: {
        usd: string;
        value: string;
        percent: string;
      };
    };
    timeEstimate: number;
    userBalance: string;
  };
  does_swap: boolean;
  swap_price_impact_percent?: string;
  request?: RelayRouteRequest;
};

export type RelayTrackTransactionRequest = {
  requestId: string;
};

export type RelayTrackerResponse = {
  status: "refund" | "delayed" | "waiting" | "failure" | "pending" | "success";
  inTxHashes: string[];
  txHashes: string[];
  time: number;
  originChainId: number;
  destinationChainId: number;
};

export type ChainVM = "evm" | "svm" | "bvm";
export type RelayChain = {
  id: number;
  name: string;
  displayName: string;
  httpRpcUrl?: string;
  wsRpcUrl?: string;
  explorerUrl?: string;
  icon: {
    dark?: string;
    light?: string;
    squaredDark?: string;
    squaredLight?: string;
  };
  currency: NativeToken;
  depositEnabled?: boolean;
  blockProductionLagging?: boolean;
  iconUrl: string | null;
  logoUrl: string | null;
  brandColor?: string | null;
  vmType?: ChainVM;
  baseChainId?: number | null;
  contracts: ChainContracts;
};

export const RELAY_API_BASE_URL = "https://api.relay.link";

export class RelayAPI {
  private static ky = ky.create({
    prefixUrl: RELAY_API_BASE_URL,
    timeout: false,
  });

  public static async getChains(includeChains = ""): Promise<
    | {
        success: false;
        error: string;
      }
    | { success: true; chains: RelayChain[] }
  > {
    try {
      const result = await RelayAPI.ky.get("chains", {
        searchParams: {
          includeChains,
        },
      });

      const data = await result.json<{
        chains: RelayChain[];
      }>();
      return {
        success: true,
        chains: data.chains,
      };
    } catch (e) {
      if (e instanceof HTTPError && e.response) {
        return {
          success: false,
          error: (await e.response.json()).message,
        };
      }
      return {
        success: false,
        error: (e as Error).message,
      };
    }
  }

  public static async getSupportedChains(): Promise<
    | {
        success: false;
        error: string;
      }
    | { success: true; chains: SupportedChain[]; _raw: RelayChain[] }
  > {
    const result = await this.getChains();
    if (result.success) {
      const chains = result.chains.map(
        (chain) =>
          ({
            chainId:
              chain.id.toString() === RelayChainId.solana
                ? "solana"
                : chain.id.toString(),
            baseDenom: chain.currency?.address,
            name: chain.displayName,
            displayName: chain.displayName,
            logoURI: chain?.iconUrl as string,
            chainType: parseRelayChainType(chain.vmType),
            icon: chain?.iconUrl as string,
            isTestnet: false,
            nativeToken: {
              id: chain.currency?.id,
              address: chain.currency?.address,
              symbol: chain.currency?.symbol,
              chainId: chain.id,
              decimals: chain.currency?.decimals,
              name: chain.currency?.name,
            },
            multicallAddress: chain?.contracts?.multicall3,
            pfmEnabled: false,
            explorerUrl: chain.explorerUrl,
            rpcUrl: chain.httpRpcUrl || "",
            bech32Prefix: "",
          }) satisfies SupportedChain,
      );
      return {
        success: true,
        chains,
        _raw: result.chains,
      };
    }
    return result;
  }

  public static async getSupportedAssets(
    args: RelaySupportedAssetsArgs,
  ): Promise<
    | {
        success: false;
        error: string;
      }
    | { success: true; assets: Record<string, SupportedAsset[]> }
  > {
    try {
      const result = await RelayAPI.ky.post("currencies/v1", {
        json: {
          defaultList: args.defaultList ?? true,
          depositAddressOnly: args.depositAddressOnly ?? false,
          limit: args.limit ?? 1000,
          term: args.term ?? "",
        },
      });

      const data = await result.json<RelayAssetJSON[][]>();

      const assets: Record<string, SupportedAsset[]> = {};

      data.forEach((assetGroup) => {
        assetGroup.forEach((asset) => {
          const normalizedChainId =
            asset.chainId.toString() === RelayChainId.solana
              ? "solana"
              : asset.chainId.toString();

          if (!assets[normalizedChainId]) {
            assets[normalizedChainId] = [];
          }

          assets[normalizedChainId].push({
            chainId: normalizedChainId,
            denom: asset.address,
            originChainId: normalizedChainId,
            originDenom: asset.address,
            symbol: asset.symbol ?? asset.address,
            name: asset.name ?? null,
            logoUri: asset.metadata.logoURI ?? "",
            trace: "",
            priceUSD: "",
            tokenContract: asset.address,
            decimals: asset.decimals,
            coingeckoId: undefined,
          });
        });
      });

      return {
        success: true,
        assets: assets,
      };
    } catch (e) {
      if (e instanceof HTTPError && e.response) {
        return {
          success: false,
          error: (await e.response.json()).message,
        };
      }
      return {
        success: false,
        error: (e as Error).message,
      };
    }
  }

  public static async getRoute(args: RelayRouteRequest): Promise<
    | {
        success: false;
        error: string;
      }
    | { success: true; route: RelayRouteResponse }
  > {
    try {
      const result = await RelayAPI.ky.post("quote", {
        json: {
          user: args.user,
          recipient: args.recipient,
          originChainId: getRelayChainId(String(args.originChainId)),
          destinationChainId: getRelayChainId(String(args.destinationChainId)),
          originCurrency: args.originCurrency,
          destinationCurrency: args.destinationCurrency,
          amount: args.amount,
          tradeType: args.tradeType,
          txs: args.txs,
          referrer: args.referrer,
          refundTo: args.refundTo,
          refundOnOrigin: args.refundOnOrigin,
          useReceiver: args.useReceiver,
          useExternalLiquidity: args.useExternalLiquidity,
          usePermit: args.usePermit,
          useDepositAddress: args.useDepositAddress,
          slippageTolerance: args.slippageTolerance,
          appFees: args.appFees,
          gasLimitForDepositSpecifiedTxs: args.gasLimitForDepositSpecifiedTxs,
          userOperationGasOverhead: args.userOperationGasOverhead,
          forceSolverExecution: args.forceSolverExecution,
        },
      });
      const data = await result.json<RelayRouteResponse>();

      return {
        success: true,
        route: {
          ...data,
          does_swap: data.details.operation === "swap",
          swap_price_impact_percent: data.details.swapImpact.percent,
          request: args,
        },
      };
    } catch (e) {
      console.error(e);
      if (e instanceof HTTPError && e.response) {
        return {
          success: false,
          error: (await e.response.json()).message,
        };
      }
      return {
        success: false,
        error: `Error getting route - ${
          (e as Error).message ?? "unknown error"
        }`,
      };
    }
  }

  public static async trackTransaction(
    args: RelayTrackTransactionRequest,
  ): Promise<
    | {
        success: true;
        response: RelayTrackerResponse;
      }
    | {
        success: false;
        error: string;
      }
  > {
    try {
      const result = await RelayAPI.ky.get("intents/status/v2", {
        searchParams: {
          requestId: args.requestId,
        },
      });

      return {
        success: true,
        response: await result.json(),
      };
    } catch (e) {
      if (e instanceof HTTPError && e.response) {
        return {
          success: false,
          error: (await e.response.json()).message,
        };
      }
      return {
        success: false,
        error: (e as Error).message,
      };
    }
  }

  public static async getTokenPrice(
    address?: string,
    chainId?: string,
  ): Promise<number> {
    if (!address || !chainId) {
      return -1;
    }
    const relayChainId = getRelayChainId(chainId);
    const request: Promise<number> = RelayAPI.ky
      .get("currencies/token/price", {
        searchParams: {
          address,
          chainId: relayChainId,
        },
      })
      .then((res) => res.json<{ price: number }>())
      .then((res) => {
        const price = res.price;
        return new Promise<number>((resolve) => {
          resolve(price);
        });
      })
      .catch(() => {
        return -1;
      });
    const result = await request;
    return result;
  }
}
