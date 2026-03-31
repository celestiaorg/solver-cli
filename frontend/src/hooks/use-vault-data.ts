import { useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';

import { useMemo } from 'react';

import { Vault } from '@/lib/types';
import { getTokens, getVaultAPY, getVaultData } from '@/lib/vault-utils';

/**
 * Hook to fetch and cache token data
 */
export const useTokens = () => {
  return useQuery({
    queryKey: ['tokens'],
    queryFn: async () => {
      const tokens = await getTokens();
      return tokens;
    },
    enabled: true,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
};

/**
 * Hook to fetch vault configuration and APY data
 */
export const useVaultData = (vaultAddress?: string) => {
  return useQuery({
    queryKey: ['vaultData', vaultAddress],
    queryFn: async () => {
      if (!vaultAddress) throw new Error('Vault address is required');

      const vaultConfig = await getVaultData(vaultAddress as `0x${string}`);
      const vaultAPY = await getVaultAPY(
        vaultAddress as `0x${string}`,
        vaultConfig.withdrawQueueLength
      );
      return { vaultConfig, vaultAPY };
    },
    enabled: !!vaultAddress,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
};

/**
 * Combined hook that provides tokens, vault data, and computed values
 */
export const useVaultInfo = (vault: Vault) => {
  const { data: tokens, isLoading: isLoadingTokens } = useTokens();
  const { data: vaultData, isLoading: isLoadingVaultData } = useVaultData(
    vault?.address
  );

  const vaultAsset = useMemo(() => {
    if (!vault?.assetAddress || !tokens) return undefined;
    return tokens?.[vault.assetAddress];
  }, [tokens, vault?.assetAddress]);

  const tvl = useMemo(() => {
    if (!vaultData || !vaultAsset) return '-';
    return (
      new BigNumber(vaultData?.vaultConfig?.totalSupply.toString())
        .dividedBy(10 ** Number(vaultAsset?.decimals ?? '18'))
        .toFixed(2) +
      ' ' +
      vaultAsset?.symbol
    );
  }, [vaultData, vaultAsset]);

  return {
    tokens,
    vaultData,
    vaultAsset,
    tvl,
    isLoading: isLoadingTokens || isLoadingVaultData,
    isLoadingTokens,
    isLoadingVaultData,
  };
};
