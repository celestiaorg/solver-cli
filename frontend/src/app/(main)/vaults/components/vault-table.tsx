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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import VaultWidget from '@/components/vault-widget';

import { GenericFallbackIcon } from '@/icons';
import { edenImages } from '@/lib/constants/eden-images';
import { Vault } from '@/lib/types';

import VaultCard from './vault-card';

export type VaultTableColumnItem = {
  id: string;
  label: string;
  isDisabled?: boolean;
};

const vaultTableColumns: VaultTableColumnItem[] = [
  { id: 'vault', label: 'Vault' },
  { id: 'tvl', label: 'TVL' },
  { id: 'collateral', label: 'Collateral' },
  { id: 'curator', label: 'Curator' },
  { id: 'apy', label: 'APY' },
];

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
    handleNavigate,
  } = useVaultTable(data);

  return (
    <>
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
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))
          : vaultTableData.map(row => (
              <div
                key={row.vault.address}
                onClick={() => handleNavigate(row.vault.address)}
              >
                <VaultCard
                  row={row}
                  loading={isLoadingVaultData}
                  showWithdraw={showWithdraw}
                  onSelect={type => handleVaultCardClick(type, row.vault._raw)}
                />
              </div>
            ))}
      </div>

      {/* Desktop View - Table Layout */}
      <Table className="hidden border-separate border-spacing-y-3 px-4 md:!table">
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
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </TableCell>
                  <TableCell className="p-4">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="p-4">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-6 w-6 rounded-full" />
                    </div>
                  </TableCell>
                  <TableCell className="p-4">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-4 w-24" />
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
                  onClick={() => handleNavigate(row.vault.address)}
                >
                  <TableCell className="w-1/3 p-4 font-medium first:rounded-l-xl md:w-auto">
                    <div className="flex items-center gap-2">
                      <Avatar className="flex-shrink-0">
                        <AvatarImage src={row.vault.logoURI} />
                        <AvatarFallback>
                          <GenericFallbackIcon />
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-wrap break-words">
                        {row.vault.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-4">
                    {isLoadingVaultData ? (
                      <Skeleton className="h-4 w-20" />
                    ) : (
                      (row.tvl ?? '-')
                    )}
                  </TableCell>
                  <TableCell className="p-4">
                    {isLoadingVaultData ? (
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          {row.collateral.map(collateral => (
                            <Tooltip key={collateral.symbol}>
                              <TooltipTrigger>
                                <Avatar>
                                  <AvatarImage src={collateral.logoURI} />
                                  <AvatarFallback>
                                    <GenericFallbackIcon />
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent>
                                {collateral.symbol}
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                        {row.collateral.length === 0 && '-'}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="p-4">
                    <div className="flex items-center gap-2">
                      <Avatar>
                        <AvatarImage src={row.curator.logoURI} />
                        <AvatarFallback>
                          <GenericFallbackIcon />
                        </AvatarFallback>
                      </Avatar>
                      {`Eden Testnet`}
                    </div>
                  </TableCell>
                  <TableCell className="p-4 last:rounded-r-xl">
                    {isLoadingVaultData ? (
                      <Skeleton className="h-4 w-16" />
                    ) : (
                      (row?.apy ?? '-')
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
    </>
  );
};
