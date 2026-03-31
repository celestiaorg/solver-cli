'use client';

import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';

import { useMemo } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { edenImages } from '@/lib/constants/eden-images';
import { formatAmount, sliceAddress } from '@/lib/utils';
import {
  getUserTransactions,
  TokenData,
  type Transaction,
} from '@/lib/vault-utils';
import { useWalletConnectStore } from '@/store/wallet-connect';

export type TransactionsTableColumnItem = {
  id: string;
  label: string;
  isDisabled?: boolean;
};

type TransactionsTableRow = {
  date: string;
  type: string;
  amount: string;
  txn: string;
  timestamp: string;
};

const transactionsTableColumns: TransactionsTableColumnItem[] = [
  { id: 'date', label: 'Date' },
  { id: 'type', label: 'Type' },
  { id: 'amount', label: 'Amount' },
  { id: 'txn', label: 'Transaction' },
];

export const TransactionsTable = ({
  vaultAddress,
  vaultAsset,
}: {
  vaultAddress: string;
  vaultAsset?: TokenData;
}) => {
  const { evm } = useWalletConnectStore();
  const { data: transactions, isLoading: isLoadingTxns } = useQuery({
    queryKey: ['transactionsTableData', evm],
    queryFn: async () => {
      const res = await getUserTransactions('from', evm as `0x${string}`);
      return res;
    },
    enabled: !!evm,
  });

  const transactionTableData = useMemo(() => {
    if (!transactions?.items) return [];

    // Filter transactions by method (only "deposit" and "withdraw") and vaultAddress
    const filteredTransactions = transactions.items.filter(
      (tx: Transaction) => {
        const method = tx.method?.toLowerCase();
        const isDepositOrWithdraw =
          method === 'deposit' || method === 'withdraw';
        const isVaultTransaction =
          tx.to?.hash?.toLowerCase() === vaultAddress.toLowerCase();
        return isDepositOrWithdraw && isVaultTransaction;
      }
    );

    // Sort by timestamp (most recent first)
    const sortedTransactions = filteredTransactions.sort(
      (a: Transaction, b: Transaction) => {
        return (
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      }
    );

    // Map to table row format
    return sortedTransactions.map((tx: Transaction) => {
      const date = new Date(tx.timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      const type =
        tx.method.charAt(0).toUpperCase() + tx.method.slice(1).toLowerCase();

      // Get amount from decoded_input parameters (assets field)
      let amount = '-';
      if (vaultAsset && tx.decoded_input?.parameters) {
        const assetsParam = tx.decoded_input.parameters.find(
          param => param.name === 'assets'
        );
        if (assetsParam?.value) {
          const formattedAmount = formatUnits(
            BigInt(assetsParam.value),
            parseInt(vaultAsset.decimals)
          );
          amount = `${formatAmount(formattedAmount, 2, 6)} ${vaultAsset.symbol}`;
        }
      }

      const txnHash = sliceAddress(tx.hash);

      return {
        date,
        type,
        amount,
        txn: txnHash,
        timestamp: tx.timestamp,
      };
    });
  }, [transactions, vaultAddress, vaultAsset]);

  return (
    <div className="bg-secondary mb-10 rounded-xl">
      <Table className="border-separate border-spacing-y-3 px-5">
        <TableHeader>
          <TableRow className="border-none text-xs hover:bg-transparent">
            {transactionsTableColumns.map(column => (
              <TableHead
                key={column.id}
                className={`text-muted-foreground ${
                  column.id === 'txn' ? 'hidden md:!table-cell' : ''
                }`}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoadingTxns
            ? // Skeleton loader for loading state
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index} className="border-none">
                  <TableCell className="p-4 first:rounded-l-xl">
                    <Skeleton className="h-4 w-16 md:w-24" />
                  </TableCell>
                  <TableCell className="p-4">
                    <Skeleton className="h-4 w-16 md:w-20" />
                  </TableCell>
                  <TableCell className="p-4">
                    <Skeleton className="h-4 w-16 md:w-32" />
                  </TableCell>
                  <TableCell className="hidden rounded-r-xl p-4">
                    <Skeleton className="h-4 w-16 md:w-28" />
                  </TableCell>
                </TableRow>
              ))
            : transactionTableData?.map((row, index) => (
                <TableRow
                  key={index}
                  className="hover:bg-muted-foreground/50 border-none"
                >
                  <TableCell className="p-4 font-medium first:rounded-l-xl">
                    {row.date}
                  </TableCell>
                  <TableCell className="p-4">{row.type}</TableCell>
                  <TableCell className="p-4">{row.amount}</TableCell>
                  <TableCell className="hidden rounded-r-xl p-4 md:!block">
                    {row.txn}
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {!isLoadingTxns && transactionTableData?.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 pb-8">
          <img
            src={edenImages.treasure}
            className="mx-auto h-44 w-56"
            alt="no data"
          />
          <p className="text-muted-foreground">No Transactions found</p>
        </div>
      )}
    </div>
  );
};
