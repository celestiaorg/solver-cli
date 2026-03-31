'use client';

import { useVaultDeposit } from '@/hooks/use-balances';
import { useVaultInfo } from '@/hooks/use-vault-data';

import { Skeleton } from '@/components/ui/skeleton';

import { Vault } from '@/lib/types';
import { formatAmount } from '@/lib/utils';

import { TokensChart } from './token-chart';
import { TransactionsTable } from './transactions-table';

export const Deposits = ({ vault }: { vault: Vault }) => {
  const { vaultAsset } = useVaultInfo(vault);
  const { data: vaultBalance, isLoading: isVaultBalanceLoading } =
    useVaultDeposit(vault.address as `0x${string}`, vaultAsset);

  return (
    <>
      <div className="bg-secondary mb-6 rounded-3xl p-4">
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">My Deposit</p>
          {isVaultBalanceLoading ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            <span className="md:text-4.5xl text-foreground text-3xl">
              {vaultBalance ? formatAmount(vaultBalance.toString()) : '0.00'}{' '}
              {vaultAsset?.symbol}
            </span>
          )}
        </div>

        <span className="text-sm">-</span>

        <TokensChart tokenId={undefined} />
      </div>
      <p className="mb-3 px-4 text-xs">My Transactions</p>
      <TransactionsTable vaultAddress={vault.address} vaultAsset={vaultAsset} />
    </>
  );
};
