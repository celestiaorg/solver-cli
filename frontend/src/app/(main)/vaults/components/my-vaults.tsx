'use client';

import { useQuery } from '@tanstack/react-query';

import { Vault } from '@/lib/types';
import { isUserVault } from '@/lib/vault-utils';
import { useWalletConnectStore } from '@/store/wallet-connect';

import { VaultTable } from './vault-table';

export const MyVaults = ({ data }: { data: Vault[] }) => {
  const evmAddress = useWalletConnectStore(state => state.evm);

  const { data: filteredVaults, isLoading } = useQuery({
    queryKey: ['userVaults', evmAddress, data.map(v => v.address)],
    queryFn: async () => {
      if (!evmAddress) return [];

      const vaultAddresses = data.map(vault => vault.address as `0x${string}`);
      const userVaultAddresses = await isUserVault(
        vaultAddresses,
        evmAddress as `0x${string}`
      );

      console.log('User Vault Addresses:', userVaultAddresses);

      // Filter the original data to only include user's vaults
      return data.filter(vault =>
        userVaultAddresses.includes(vault.address as `0x${string}`)
      );
    },
    enabled: !!evmAddress && data.length > 0,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return (
    <VaultTable data={filteredVaults ?? []} loading={isLoading} showWithdraw />
  );
};
