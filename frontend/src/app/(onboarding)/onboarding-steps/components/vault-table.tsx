'use client';

import { useVaultTable } from '@/hooks/use-vault-table';

import { DynamicSheetDialog } from '@/components/dynamic-sheet/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TruncatedText } from '@/components/ui/truncate-text';
import VaultWidget from '@/components/vault-widget';

import VaultCard from '@/app/(main)/vaults/components/vault-card';
import { GenericFallbackIcon } from '@/icons';
import { edenImages } from '@/lib/constants/eden-images';
import { Vault } from '@/lib/types';

export type VaultTableColumnItem = {
  id: string;
  label: string;
  isDisabled?: boolean;
};

const vaultTableColumns: VaultTableColumnItem[] = [
  { id: 'vault', label: 'Vault' },
  { id: 'tvl', label: 'TVL' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'apy', label: 'APY' },
];

const rewardAvatarCount = new Array(1).fill(0);

export const VaultTable = ({
  data,
  loading = false,
  showWithdraw = false,
}: {
  data: Vault[];
  showWithdraw?: boolean;
  loading?: boolean;
}) => {
  const {
    vaultTableData,
    isLoadingVaultData,
    dialogConfig,
    setDialogConfig,
    handleVaultCardClick,
  } = useVaultTable(data);

  return (
    <div className="max-h-full overflow-auto">
      {/* Mobile View - Card Layout */}
      <div className="mt-5 flex flex-col gap-3 md:!hidden">
        {loading
          ? // Show skeleton cards while loading
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="bg-card border-secondary rounded-xl border p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))
          : vaultTableData.map(row => (
              <VaultCard
                key={row.vault.address}
                row={row}
                loading={isLoadingVaultData}
                showWithdraw={showWithdraw}
                onSelect={type => handleVaultCardClick(type, row.vault._raw)}
              />
            ))}
      </div>

      {/* Desktop View - Table Layout */}
      <Table className="hidden border-separate border-spacing-y-3 md:!table">
        <TableHeader>
          <TableRow className="border-none text-xs hover:bg-transparent">
            {vaultTableColumns.map(column => (
              <TableHead key={column.id} className="text-muted-foreground">
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading
            ? // Show skeleton rows while loading
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow
                  key={index}
                  className="bg-card mb-3 rounded-xl border-none"
                >
                  <TableCell className="w-1/3 p-4 font-medium first:rounded-l-xl md:w-auto">
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-5 rounded-full" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </TableCell>
                  <TableCell className="p-4">
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                  <TableCell className="p-4">
                    <div className="flex items-center gap-2">
                      {rewardAvatarCount.map((_, index) => (
                        <Skeleton key={index} className="size-5 rounded-full" />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="p-4 last:rounded-r-xl">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                </TableRow>
              ))
            : vaultTableData.map(row => (
                <TableRow
                  key={row.vault.address}
                  className="bg-card hover:bg-muted-foreground/50 mb-3 cursor-pointer rounded-xl border-none"
                  onClick={() =>
                    handleVaultCardClick('deposit', row.vault._raw)
                  }
                >
                  <TableCell className="w-1/3 p-4 font-medium first:rounded-l-xl md:w-auto">
                    <div className="flex items-center gap-2">
                      <Avatar className="bg-primary size-5 flex-shrink-0">
                        <AvatarImage src={row.vault.logoURI} />
                        <AvatarFallback className="bg-primary">
                          <GenericFallbackIcon className="text-primary-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-foreground text-sm whitespace-nowrap">
                        <TruncatedText maxLength={10} text={row.vault.name} />
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-4">
                    {isLoadingVaultData ? (
                      <Skeleton className="h-4 w-8" />
                    ) : (
                      <span className="text-foreground text-sm">
                        {row.tvl
                          ? row.tvl.includes('$')
                            ? row.tvl
                            : `$${row.tvl}`
                          : '-'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="p-4">
                    {isLoadingVaultData ? (
                      <div className="flex items-center gap-2">
                        {rewardAvatarCount.map((_, index) => (
                          <Skeleton
                            key={index}
                            className="size-5 rounded-full"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {rewardAvatarCount.map((_, index) => (
                          <Avatar key={index} className="bg-primary size-5">
                            <AvatarFallback className="bg-primary p-0">
                              <GenericFallbackIcon
                                size="24"
                                className="text-primary-foreground"
                              />
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="p-4 last:rounded-r-xl">
                    {isLoadingVaultData ? (
                      <Skeleton className="h-4 w-16" />
                    ) : (
                      <span className="text-foreground text-sm">
                        {row?.apy ? `${row.apy}` : '-'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>

      {vaultTableData?.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center gap-3">
          <img
            src={edenImages.treasure}
            className="mx-auto h-44 w-56"
            alt="no data"
          />
          <p className="text-muted-foreground">
            You don&apos;t have any deposits yet
          </p>
        </div>
      )}

      <DynamicSheetDialog
        showCloseIcon={true}
        open={dialogConfig.showDialog}
        sheetClassName="bg-black/80 md:!hidden"
        onOpenChange={() =>
          setDialogConfig(prev => ({ ...prev, showDialog: false }))
        }
        title={dialogConfig.type === 'deposit' ? 'Deposit' : 'Withdraw'}
      >
        <VaultWidget
          className="!w-full !shadow-none"
          defaultTab={dialogConfig.type}
          vault={dialogConfig.vault as Vault}
        />
      </DynamicSheetDialog>
    </div>
  );
};
