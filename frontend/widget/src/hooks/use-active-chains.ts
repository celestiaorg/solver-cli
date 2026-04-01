import { ChainName, MultiProtocolProvider } from "@hyperlane-xyz/sdk";
import { ProtocolType } from "@hyperlane-xyz/utils";
import {
  useConnection,
  useWallet as useSolanaWallet,
} from "@solana/wallet-adapter-react";
import { useAccount as useCosmosWallet } from "graz";
import { useAccount } from "wagmi";

import { useMemo } from "react";

import { SupportedProtocols } from "../lib/types";
import { findChainByRpcUrl } from "../lib/utils";
import { logger } from "../utils/logger";

export interface ActiveChainInfo {
  chainDisplayName?: string;
  chainName?: ChainName;
  walletClient?: string;
}

export function useEthereumActiveChain(
  multiProvider: MultiProtocolProvider,
): ActiveChainInfo {
  const { chain, connector } = useAccount();
  return useMemo<ActiveChainInfo>(
    () => ({
      chainDisplayName: chain?.name,
      chainName: chain
        ? multiProvider.tryGetChainMetadata(chain.id)?.name
        : undefined,
      walletClient: connector?.name,
    }),
    [chain, multiProvider, connector],
  );
}

export function useSolanaActiveChain(
  multiProvider: MultiProtocolProvider,
): ActiveChainInfo {
  const { connection } = useConnection();
  const { wallet } = useSolanaWallet();
  const connectionEndpoint = connection?.rpcEndpoint;
  return useMemo<ActiveChainInfo>(() => {
    try {
      const hostname = new URL(connectionEndpoint).hostname;
      const metadata = findChainByRpcUrl(multiProvider, hostname);
      if (!metadata) return {};
      return {
        chainDisplayName: metadata.displayName,
        chainName: metadata.name,
        walletClient: wallet?.adapter.name,
      };
    } catch (error) {
      logger.warn("Error finding sol active chain", error);
      return {};
    }
  }, [connectionEndpoint, multiProvider, wallet?.adapter.name]);
}

export function useCosmosActiveChain(): ActiveChainInfo {
  const { walletType } = useCosmosWallet();
  return useMemo<ActiveChainInfo>(() => {
    return {
      walletClient: walletType,
    };
  }, [walletType]);
}

export function useActiveChains(multiProvider: MultiProtocolProvider): {
  chains: Record<SupportedProtocols, ActiveChainInfo>;
  readyChains: ActiveChainInfo[];
} {
  const evmChain = useEthereumActiveChain(multiProvider);
  const solChain = useSolanaActiveChain(multiProvider);
  const cosmosChain = useCosmosActiveChain();

  const readyChains = useMemo(
    () => [evmChain, solChain].filter((c) => !!c.chainDisplayName),
    [evmChain, solChain],
  );

  return useMemo(
    () => ({
      chains: {
        [ProtocolType.Ethereum]: evmChain,
        [ProtocolType.Sealevel]: solChain,
        [ProtocolType.Cosmos]: cosmosChain,
        [ProtocolType.CosmosNative]: cosmosChain,
      },
      readyChains,
    }),
    [evmChain, solChain, readyChains, cosmosChain],
  );
}
