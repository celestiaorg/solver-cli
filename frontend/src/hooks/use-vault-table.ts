import { useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';
import { useTopLoader } from 'nextjs-toploader';

import { useTokens } from '@/hooks/use-vault-data';

import { VaultWidgetTab } from '@/components/vault-widget';

import { Vault } from '@/lib/types';
import {
  getVaultAPY,
  getVaultData,
  TokenData,
  VaultConfiguration,
} from '@/lib/vault-utils';

export type VaultTableRow = {
  vault: {
    name: string;
    address: string;
    logoURI?: string;
    _raw: Vault;
  };
  tvl?: string;
  collateral: {
    symbol: string;
    logoURI?: string;
  }[];
  curator: {
    logoURI?: string;
    name: string;
  };
  apy?: string;
};

export const useVaultTable = (data: Vault[]) => {
  const router = useRouter();
  const [dialogConfig, setDialogConfig] = useState<{
    showDialog: boolean;
    type: VaultWidgetTab | undefined;
    vault?: Vault;
  }>({
    showDialog: false,
    type: undefined,
    vault: undefined,
  });

  const { start } = useTopLoader();

  const { data: tokens } = useTokens();

  const { data: vaultData, isLoading: isLoadingVaultData } = useQuery({
    queryKey: ['vaultData', data.map(vault => vault.address)],
    queryFn: async () => {
      const vaultPromises = data.map(async vault => {
        const vaultConfig = await getVaultData(vault.address as `0x${string}`);
        const vaultAPY = await getVaultAPY(
          vault.address as `0x${string}`,
          vaultConfig.withdrawQueueLength
        );
        return { vaultConfig, vaultAPY };
      });
      const vaultData = await Promise.all(vaultPromises);
      return vaultData.reduce(
        (acc, curr) => {
          acc[curr.vaultConfig.address] = curr;
          return acc;
        },
        {} as Record<
          `0x${string}`,
          {
            vaultConfig: VaultConfiguration;
            vaultAPY:
              | { apy: string; collateralTokens: Set<`0x${string}`> }
              | undefined;
          }
        >
      );
    },
    enabled: data.length > 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });

  const vaultTableData: VaultTableRow[] = useMemo(() => {
    return data.map(vault => {
      let vaultAsset: TokenData | undefined = undefined;
      if (tokens?.[vault.assetAddress]) {
        vaultAsset = tokens[vault.assetAddress];
      }
      let tvl = undefined;
      let apy = undefined;
      let collateral: { symbol: string; logoURI: string | undefined }[] = [];
      if (vaultData?.[vault.address as `0x${string}`]) {
        const { vaultAPY, vaultConfig } =
          vaultData[vault.address as `0x${string}`];
        tvl = new BigNumber(vaultConfig.totalSupply.toString())
          .dividedBy(10 ** Number(vaultAsset?.decimals ?? '18'))
          .toFixed(2);
        tvl = tvl + ' ' + vaultAsset?.symbol;
        apy = vaultAPY?.apy;
        collateral = Array.from(vaultAPY?.collateralTokens ?? []).map(
          collateral => ({
            symbol: tokens?.[collateral]?.symbol ?? '',
            logoURI: tokens?.[collateral]?.icon_url ?? undefined,
          })
        );
      }
      return {
        vault: {
          name: vault.name,
          address: vault.address,
          logoURI: vaultAsset?.icon_url ?? undefined,
          _raw: vault,
        },
        tvl,
        collateral,
        curator: {
          logoURI: undefined,
          name: vault.curator,
        },
        apy,
      };
    });
  }, [tokens, data, vaultData]);

  const handleVaultCardClick = (type: string, vault: Vault) => {
    setDialogConfig({
      showDialog: true,
      type: type as VaultWidgetTab,
      vault,
    });
  };

  const handleNavigate = (address: string) => {
    router.push(`/vaults/${address}`);
    start();
  };

  return {
    vaultTableData,
    isLoadingVaultData,
    dialogConfig,
    setDialogConfig,
    handleVaultCardClick,
    handleNavigate,
  };
};
