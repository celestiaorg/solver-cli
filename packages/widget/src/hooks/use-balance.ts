import { ChainName, IToken } from "@hyperlane-xyz/sdk";
import {
  Address,
  ChainId,
  isValidAddress,
  ProtocolType,
} from "@hyperlane-xyz/utils";
import * as token from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { Abi, erc20Abi } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { multicall3ABI } from "../lib/constants";
import {
  ChainBalanceData,
  HexAddress,
  SupportedAsset,
  SupportedChain,
  TokenBalanceData,
} from "../lib/types";
import { getDecimalPower10 } from "../lib/utils";
import { useInputStateStore } from "../store";
import { useWalletConnectStore } from "../store/wallet-connect";

import { useAggregatedAssets } from "./use-assets";
import {
  useAggregatedChains,
  useChainMetadataById,
  useMultiProvider,
} from "./use-chains";
import { error } from "console";

export const zeroAddress = "0x0000000000000000000000000000000000000000";

export function useBalance(
  chain?: ChainName,
  token?: IToken,
  address?: Address | null,
) {
  const multiProvider = useMultiProvider();
  const { isLoading, isError, error, data } = useQuery({
    // The Token and Multiprovider classes are not serializable, so we can't use it as a key
    queryKey: ["useBalance", chain, address, token?.addressOrDenom],
    queryFn: () => {
      if (
        !chain ||
        !token ||
        !address ||
        !isValidAddress(address, token.protocol)
      )
        return null;
      return token.getBalance(multiProvider, address);
    },
    refetchInterval: 30000,
  });

  return {
    isLoading,
    isError,
    balance: data ?? undefined,
  };
}

export const useEvmChainBalances = ({
  chainId,
  assets,
  chainMetadata,
  enabled = false,
}: {
  chainId: ChainId;
  assets?: SupportedAsset[];
  chainMetadata?: SupportedChain | null;
  enabled?: boolean;
}) => {
  const { address } = useAccount();
  const publicClient = usePublicClient({
    chainId: enabled && chainId ? Number(chainId) : undefined,
  });

  return useQuery({
    queryKey: ["evmChainBalances", chainId, address, assets?.length],
    queryFn: async (): Promise<ChainBalanceData | undefined> => {
      if (!publicClient || !assets || !address || !chainId) {
        throw new Error("Missing required parameters");
      }

      const isForma = chainId === "984122";
      const multicallAddress = isForma
        ? "0xd53C6FFB123F7349A32980F87faeD8FfDc9ef079"
        : "0xcA11bde05977b3631167028862bE2a173976CA11";

      const isEdentestnetChain = assets?.some(
        (asset) => asset.chainName === "edentestnet",
      );

      if (isEdentestnetChain) {
        const nativeBalance = await publicClient.getBalance({
          address: address as `0x${string}`,
        });

        const balances: Record<string, TokenBalanceData> = {};

        // Fetch ERC-20 balances individually (no multicall on Eden testnet)
        for (const asset of assets ?? []) {
          if (
            asset.originDenom.includes("native") ||
            !asset.originDenom ||
            asset.originDenom === zeroAddress
          ) {
            balances[asset.originDenom] = {
              value: nativeBalance.toString(),
              amount: new BigNumber(nativeBalance.toString()).dividedBy(
                getDecimalPower10(asset.decimals),
              ),
            };
          } else {
            try {
              const tokenBalance = await publicClient.readContract({
                address: asset.originDenom as HexAddress,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [address as `0x${string}`],
              });
              balances[asset.originDenom] = {
                value: tokenBalance.toString(),
                amount: new BigNumber(tokenBalance.toString()).dividedBy(
                  getDecimalPower10(asset.decimals),
                ),
              };
            } catch {
              balances[asset.originDenom] = {
                value: "0",
                amount: new BigNumber(0),
              };
            }
          }
        }

        return {
          chainId,
          balances,
        };
      }

      const contracts =
        assets?.map((asset) => {
          if (
            asset.originDenom.includes("native") ||
            !asset.originDenom ||
            asset.originDenom === zeroAddress
          ) {
            return {
              address: multicallAddress as `0x${string}`,
              abi: multicall3ABI,
              functionName: "getEthBalance",
              args: [address as `0x${string}`],
            };
          }
          return {
            address: asset.originDenom as HexAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          };
        }) ?? [];

      const tokenBalances = await publicClient.multicall({
        multicallAddress: multicallAddress as `0x${string}`,
        contracts,
      });

      const balances = assets?.reduce<Record<string, TokenBalanceData>>(
        (acc, asset, i) => {
          acc[asset.originDenom] = {
            value: tokenBalances[i].result?.toString() || "0",
            amount: new BigNumber(
              tokenBalances[i].result?.toString() || "0",
            ).dividedBy(getDecimalPower10(asset.decimals)),
          };

          return acc;
        },
        {} as Record<string, TokenBalanceData>,
      );

      return {
        chainId,
        balances,
      };
    },
    retry: false,
    enabled: !!(chainId && address && publicClient && assets && enabled),
    refetchInterval: 30000,
  });
};

export const useSvmChainBalances = ({
  chainId,
  assets,
  chainMetadata,
  enabled = false,
}: {
  chainId: ChainId;
  assets?: SupportedAsset[];
  chainMetadata?: SupportedChain | null;
  enabled?: boolean;
}) => {
  const { solana } = useWalletConnectStore();
  const address = solana;

  return useQuery({
    queryKey: [
      "svmChainBalances",
      chainId,
      address,
      assets?.length,
      chainMetadata?.rpcUrl,
    ],
    queryFn: async (): Promise<ChainBalanceData | undefined> => {
      if (!chainId || !address || !assets || !chainMetadata) {
        throw new Error("Missing required parameters");
      }

      const rpc =
        chainMetadata.chainId === "solana" ||
        chainMetadata.chainId == "1399811149"
          ? "https://mainnet.helius-rpc.com/?api-key=5175da47-fc80-456d-81e2-81e6e7459f73"
          : chainMetadata?.rpcUrl;
      const connection = new Connection(rpc);

      const nativeBalance = await connection.getBalance(new PublicKey(address));
      const allBalances: Record<string, string> = {};

      allBalances["11111111111111111111111111111111"] =
        nativeBalance.toString(); // solana address

      // batch requesting token accounts
      const tokenAccounts = await connection.getTokenAccountsByOwner(
        new PublicKey(address),
        { programId: token.TOKEN_PROGRAM_ID },
      );

      // processing all token accounts
      tokenAccounts.value.forEach((tokenAccount) => {
        const accountInfo = token.AccountLayout.decode(
          tokenAccount.account.data,
        );
        const mintAddress = accountInfo.mint.toBase58();
        allBalances[mintAddress] = accountInfo.amount.toString();
      });

      const balances = assets?.reduce<Record<string, TokenBalanceData>>(
        (acc, asset) => {
          const denom = asset.tokenContract || asset.originDenom;
          acc[asset.originDenom] = {
            value: allBalances[denom] || "0",
            amount: new BigNumber(allBalances[denom] || "0").dividedBy(
              getDecimalPower10(asset.decimals),
            ),
          };
          return acc;
        },
        {} as Record<string, TokenBalanceData>,
      );
      return {
        chainId,
        balances,
      };
    },
    retry: false,
    enabled: !!(chainId && address && assets && enabled),
    refetchOnWindowFocus: false,
    refetchInterval: 30000,
  });
};

export const useCosmosChainBalances = ({
  chainId,
  assets,
  chainMetadata,
  enabled = false,
}: {
  chainId: ChainId;
  assets?: SupportedAsset[];
  chainMetadata?: SupportedChain | null;
  enabled?: boolean;
}) => {
  const { cosmos } = useWalletConnectStore();

  const address = cosmos?.[chainId] as string;

  return useQuery({
    queryKey: [
      "cosmosChainBalances",
      chainId,
      address,
      assets?.length,
      chainMetadata,
    ],
    queryFn: async (): Promise<ChainBalanceData | undefined> => {
      if (!chainId || !address || !assets || !chainMetadata) {
        throw new Error("Missing required parameters");
      }

      const chainRestUrl = chainMetadata?.restUrl;
      const allBalances: Record<string, string> = {};

      const res = await fetch(
        `${chainRestUrl}/cosmos/bank/v1beta1/spendable_balances/${address}?pagination.limit=250`,
      );
      const { balances } = await res.json();

      balances.forEach((balance: { denom: string; amount: string }) => {
        allBalances[balance.denom] = balance.amount;
      });
      const tokenBalances = assets?.reduce<Record<string, TokenBalanceData>>(
        (acc, asset) => {
          const denom = asset.tokenContract || asset.originDenom;
          acc[asset.originDenom] = {
            value: allBalances[denom] || "0",
            amount: new BigNumber(allBalances[denom] || "0").dividedBy(
              getDecimalPower10(asset.decimals),
            ),
          };
          return acc;
        },
        {} as Record<string, TokenBalanceData>,
      );
      return {
        chainId,
        balances: tokenBalances,
      };
    },
    retry: false,
    enabled: !!(chainId && address && assets && enabled),
    refetchOnWindowFocus: false,
    refetchInterval: 30000,
  });
};

export const useBalances = (
  {
    chainId,
    assets,
  }: {
    chainId: ChainId;
    assets?: SupportedAsset[];
  },
  enabled = true,
) => {
  const { inputState } = useInputStateStore();
  const chains = useAggregatedChains(inputState.tab);
  const chainMetadata = chains.find((c) => c.chainId === chainId);
  const chainAssets = useAggregatedAssets(inputState.tab) as Record<
    string,
    SupportedAsset[]
  >;
  assets = assets || chainAssets?.[chainId.toString()] || [];
  const cosmosBalances = useCosmosChainBalances({
    chainId,
    assets,
    chainMetadata,
    enabled:
      (enabled && chainMetadata?.chainType === ProtocolType.Cosmos) ||
      chainMetadata?.chainType === ProtocolType.CosmosNative,
  });
  const evmBalances = useEvmChainBalances({
    chainId,
    assets,
    chainMetadata,
    enabled: enabled && chainMetadata?.chainType === ProtocolType.Ethereum,
  });
  const svmBalances = useSvmChainBalances({
    chainId,
    assets,
    chainMetadata,
    enabled: enabled && chainMetadata?.chainType === ProtocolType.Sealevel,
  });

  if (
    chainMetadata?.chainType === ProtocolType.Cosmos ||
    chainMetadata?.chainType === ProtocolType.CosmosNative
  ) {
    return cosmosBalances;
  }
  if (chainMetadata?.chainType === ProtocolType.Ethereum) {
    return evmBalances;
  }
  return svmBalances;
};
