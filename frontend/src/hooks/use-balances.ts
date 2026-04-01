import { useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import { publicActions } from 'viem';
import { useWalletClient } from 'wagmi';

import { IMetaMorpho_ABI } from '@/lib/constants/vault-abi';
import { getBalances, TokenData } from '@/lib/vault-utils';

import { useVaultData, useVaultInfo } from './use-vault-data';

/**
 * Hook to fetch and cache token balances for a given address
 */
export const useBalances = (address?: `0x${string}`) => {
  return useQuery({
    queryKey: ['token-balances', address],
    queryFn: async () => {
      if (!address) return null;
      const balances = await getBalances(address);
      return balances;
    },
    enabled: !!address,
    refetchOnWindowFocus: false,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: false,
  });
};

export const useVaultDeposit = (
  vaultAddress?: `0x${string}`,
  vaultAsset?: TokenData
) => {
  const { data: evmWalletClient } = useWalletClient();
  return useQuery({
    queryKey: ['vault-asset-balance', evmWalletClient, vaultAddress],
    queryFn: async () => {
      if (!evmWalletClient || !vaultAddress) return;
      const extendedSigner = evmWalletClient.extend(publicActions);
      const userShares = await extendedSigner.readContract({
        address: vaultAddress,
        abi: IMetaMorpho_ABI,
        functionName: 'balanceOf',
        args: [evmWalletClient.account.address],
      });

      const assets = await extendedSigner.readContract({
        address: vaultAddress,
        abi: IMetaMorpho_ABI,
        functionName: 'convertToAssets',
        args: [userShares],
      });

      return new BigNumber(assets.toString()).dividedBy(
        new BigNumber(10).pow(vaultAsset?.decimals || 18)
      );
    },
    enabled: !!evmWalletClient && !!vaultAddress && !!vaultAsset,
    refetchOnWindowFocus: false,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: false,
  });
};
