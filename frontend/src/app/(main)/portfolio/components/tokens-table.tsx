'use client';

import { Avatar, AvatarFallback } from '@radix-ui/react-avatar';
import { useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';

import { useMemo } from 'react';

import { useBalances } from '@/hooks/use-balances';

import { AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { GenericFallbackIcon } from '@/icons';
import { edenImages } from '@/lib/constants/eden-images';
import { formatAmount } from '@/lib/utils';
import { getNativeTokenBalance } from '@/lib/vault-utils';
import { useWalletConnectStore } from '@/store/wallet-connect';

import { NativeTokenMetadata } from './balance';

export type TokenTableColumnItem = {
  id: string;
  label: string;
  isDisabled?: boolean;
};

type TokenTableRow = {
  token: {
    symbol: string;
    logoURI: string;
  };
  amount: string;
  value: string;
};

const tokenTableColumns: TokenTableColumnItem[] = [
  { id: 'token', label: 'Token' },
  { id: 'amount', label: 'Amount' },
  { id: 'value', label: '$Value' },
];

export const TokensTable = () => {
  const { evm } = useWalletConnectStore();

  const {
    data: balance,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['native--token-balance', evm],
    queryFn: async () => {
      const balance = await getNativeTokenBalance(evm as `0x${string}`);
      return balance;
    },
    enabled: !!evm,
  });

  const {
    data: allTokenBalances,
    isLoading: isLoadingAllTokenBalances,
    isError: isErrorAllTokenBalances,
  } = useBalances(evm as `0x${string}`);

  const tokenTableData = useMemo(() => {
    if (!evm) return [];
    let tokenBalances = [];
    if (!isLoading && !isError && balance) {
      const amount = new BigNumber(balance.balance).dividedBy(
        10 ** NativeTokenMetadata.decimals
      );
      tokenBalances.push({
        token: {
          symbol: NativeTokenMetadata.symbol,
          logoURI: NativeTokenMetadata.logoURI,
        },
        amount: formatAmount(amount, 2, 3),
        value: '$0',
      });
    }
    if (
      !isLoadingAllTokenBalances &&
      !isErrorAllTokenBalances &&
      allTokenBalances
    ) {
      const otherTokens = allTokenBalances.map(tokenBalance => {
        const amount = new BigNumber(tokenBalance.value).dividedBy(
          10 ** Number(tokenBalance.token.decimals)
        );
        return {
          token: {
            symbol: tokenBalance.token.symbol,
            logoURI: tokenBalance.token.icon_url || '',
          },
          amount: amount.toFixed(2),
          value: '$0',
        };
      });
      tokenBalances = tokenBalances.concat(otherTokens);
    }
    return tokenBalances;
  }, [balance, isLoading, isError, evm]);

  return (
    <>
      <Table className="border-separate border-spacing-y-3 px-4">
        <TableHeader>
          <TableRow className="border-none text-xs hover:bg-transparent">
            {tokenTableColumns.map(column => (
              <TableHead key={column.id} className="text-muted-foreground">
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={3} className="p-4">
                <Skeleton className="h-4.5 w-14" />
              </TableCell>
            </TableRow>
          ) : (
            tokenTableData.map((row, index) => (
              <TableRow
                key={index}
                className="bg-secondary hover:bg-muted-foreground/50 mb-3 rounded-xl border-none"
              >
                <TableCell className="p-4 font-medium first:rounded-l-xl">
                  <div className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage src={row.token.logoURI} className="size-4" />
                      <AvatarFallback>
                        <GenericFallbackIcon className="size-4" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-wrap break-words">
                      {row.token.symbol}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="p-4">{row.amount}</TableCell>
                <TableCell className="p-4 last:rounded-r-xl">
                  {row.value}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {!isLoading && tokenTableData?.length === 0 && (
        <div className="mx-auto flex max-w-fit flex-col items-center justify-center gap-3">
          <img
            src={edenImages.treasure}
            className="mx-auto h-44 w-56"
            alt="no data"
          />
          {evm ? (
            <p className="text-foreground text-center">
              No tokens found in your wallet.
            </p>
          ) : (
            <p className="text-foreground max-w-[80%] text-center">
              Connect your wallet to see your tokens.
            </p>
          )}
        </div>
      )}
    </>
  );
};
