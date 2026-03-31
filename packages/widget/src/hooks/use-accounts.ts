import { ProtocolType } from "@hyperlane-xyz/utils";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAccount as useCosmosWalletAccount } from "graz";
import { useAccount } from "wagmi";

import { useMemo } from "react";

import type { AccountInfo, SupportedProtocols } from "../lib/types";
import { useWalletConnectStore } from "../store/wallet-connect";

export function useEthereumAccount(): AccountInfo {
  const { address, isConnected, connector } = useAccount();
  const isReady = !!(address && isConnected && connector);

  return useMemo<AccountInfo>(
    () => ({
      protocol: ProtocolType.Ethereum,
      addresses: address ? [{ address: `${address}` }] : [],
      isReady: isReady,
    }),
    [address, isReady],
  );
}

export function useSolanaAccount(): AccountInfo {
  const { publicKey, connected, wallet } = useWallet();
  const isReady = !!(publicKey && wallet && connected);
  const address = publicKey?.toBase58();

  return useMemo<AccountInfo>(
    () => ({
      protocol: ProtocolType.Sealevel,
      addresses: address ? [{ address: address }] : [],
      isReady: isReady,
    }),
    [address, isReady],
  );
}

export function useCosmosAccount(): AccountInfo {
  const { cosmos } = useWalletConnectStore();
  const { data: cosmosAccount } = useCosmosWalletAccount({
    multiChain: true,
    chainId: Object.keys(cosmos ?? {}),
  });
  return useMemo<AccountInfo>(() => {
    const addresses: Array<{
      address: string;
      chainId: string;
    }> = [];
    const publicKey: Record<string, string | undefined> = {};
    let isReady = false;
    for (const [chainId, address] of Object.entries(cosmos ?? {})) {
      if (!address) continue;
      if (cosmosAccount?.[chainId]?.pubKey) {
        const key = Array.isArray(cosmosAccount?.[chainId]?.pubKey)
          ? cosmosAccount?.[chainId]?.pubKey
          : Array.from(cosmosAccount?.[chainId]?.pubKey);
        publicKey[chainId] = Buffer.from(key).toString("hex");
      }
      addresses.push({ address: address, chainId });
      isReady = true;
    }
    return {
      protocol: ProtocolType.Cosmos,
      addresses,
      publicKey,
      isReady,
    };
  }, [cosmos, cosmosAccount]);
}

export function useAccounts(): {
  accounts: Record<SupportedProtocols, AccountInfo>;
  readyAccounts: AccountInfo[];
} {
  const ethereumAccount = useEthereumAccount();
  const solanaAccount = useSolanaAccount();
  const cosmosAccount = useCosmosAccount();

  const readyAccounts = useMemo(
    () =>
      [ethereumAccount, solanaAccount, cosmosAccount].filter((a) => a.isReady),
    [ethereumAccount, solanaAccount, cosmosAccount],
  );

  return useMemo(
    () => ({
      accounts: {
        [ProtocolType.Ethereum]: ethereumAccount,
        [ProtocolType.Sealevel]: solanaAccount,
        [ProtocolType.Cosmos]: cosmosAccount,
        [ProtocolType.CosmosNative]: cosmosAccount,
      },
      readyAccounts,
    }),
    [ethereumAccount, solanaAccount, cosmosAccount, readyAccounts],
  );
}
