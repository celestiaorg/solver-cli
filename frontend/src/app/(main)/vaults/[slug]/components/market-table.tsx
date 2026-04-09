'use client';

import BigNumber from 'bignumber.js';

import { useMemo } from 'react';

import { useTokens, useVaultInfo } from '@/hooks/use-vault-data';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { Vault } from '@/lib/types';

export type MarketTableColumnItem = {
  id: string;
  label: string;
  isDisabled?: boolean;
};

type MarketTableRow = {
  market: string;
  allocation: string;
  value: string;
  supply: string;
};

const marketTableColumns: MarketTableColumnItem[] = [
  { id: 'market', label: 'Market' },
  { id: 'allocation', label: 'Allocation' },
  { id: 'value', label: '$Value' },
  { id: 'supply', label: 'Supply' },
];

export const MarketTable = ({ vault }: { vault: Vault }) => {
  const { data: tokens, isLoading: isLoadingTokens } = useTokens();
  const { vaultAsset, vaultData, isLoadingVaultData } = useVaultInfo(vault);

  const marketTableData = useMemo(() => {
    if (
      !vaultData?.vaultAPY?.marketData ||
      !vaultData?.vaultAPY?.totalAllocation ||
      !tokens
    ) {
      return [];
    }
    return vaultData?.vaultAPY?.marketData?.map(market => {
      const tokenInfo = tokens[market.params.collateralToken];
      const allocationPercent = new BigNumber(String(market.allocation))
        .multipliedBy(10000)
        .dividedBy(
          new BigNumber(String(vaultData?.vaultAPY?.totalAllocation) || '0')
        )
        .dividedBy(100);
      return {
        market: tokenInfo
          ? `${tokenInfo.symbol}-${vaultAsset?.symbol}`
          : 'Unknown Market',
        allocation: `${allocationPercent}%`,
        value: '-',
        supply: new BigNumber(String(market.supplyShares || '0'))
          .dividedBy(10 ** Number(vaultAsset?.decimals || 18))
          .toFixed(2),
      };
    });
  }, [
    vaultData?.vaultAPY?.marketData,
    vaultData?.vaultAPY?.totalAllocation,
    tokens,
    vaultAsset,
  ]);

  const isLoading = isLoadingTokens || isLoadingVaultData;

  return (
    <Table className="bg-secondary border-separate border-spacing-y-3 rounded-xl px-5">
      <TableHeader>
        <TableRow className="border-none text-xs hover:bg-transparent">
          {marketTableColumns.map(column => (
            <TableHead key={column.id} className="text-muted-foreground">
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <TableRow
                key={`skeleton-${index}`}
                className="hover:bg-muted-foreground/50 border-none"
              >
                <TableCell className="font-medium first:rounded-l-xl">
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20" />
                </TableCell>
                <TableCell className="rounded-r-xl">
                  <Skeleton className="h-5 w-24" />
                </TableCell>
              </TableRow>
            ))
          : marketTableData?.map((row, index) => (
              <TableRow
                key={index}
                className="hover:bg-muted-foreground/50 border-none"
              >
                <TableCell className="font-medium first:rounded-l-xl">
                  {row.market}
                </TableCell>
                <TableCell>{row.allocation}</TableCell>
                <TableCell>{row.value}</TableCell>
                <TableCell className="rounded-r-xl">{row.supply}</TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
};
