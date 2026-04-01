'use client';

import { VaultTableRow } from '@/hooks/use-vault-table';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

import { GenericFallbackIcon } from '@/icons';
import { cn } from '@/lib/utils';

type VaultCardProps = {
  row: VaultTableRow;
  loading?: boolean;
  showWithdraw?: boolean;
  onSelect?: (type: string) => void;
};

export const VaultCard = (props: VaultCardProps) => {
  const handleDeposit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (props.onSelect) {
      props.onSelect('deposit');
    }
  };
  const handleWithdraw = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (props.onSelect) {
      props.onSelect('withdraw');
    }
  };
  return (
    <div className="border-secondary cursor-pointer rounded-xl border bg-black/33 p-4 transition-colors hover:bg-black/40 md:p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarImage src={props.row.vault.logoURI} />
            <AvatarFallback className="bg-secondary">
              <GenericFallbackIcon />
            </AvatarFallback>
          </Avatar>
          <span className="text-sm md:text-base">{props.row.vault.name}</span>
        </div>
        {props.loading ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <span className="text-primary-foreground text-sm md:text-base">
            {props.row.apy ?? '-'}
          </span>
        )}
      </div>

      <Separator className="my-3 opacity-40" />

      {/* Body */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs md:text-sm">
          <span>Deposits</span>
          {props.loading ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            <span>{props.row.tvl ?? '-'}</span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs md:text-sm">
          <span>Collateral</span>
          {props.loading ? (
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {props.row.collateral.length > 0 ? (
                props.row.collateral.map((token, i) => (
                  <Avatar key={i}>
                    <AvatarImage src={token.logoURI} />
                    <AvatarFallback className="bg-secondary">
                      <GenericFallbackIcon />
                    </AvatarFallback>
                  </Avatar>
                ))
              ) : (
                <span>-</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs md:text-sm">
          <span>Curator</span>
          <div className="flex items-center gap-2">
            <Avatar>
              <AvatarImage src={props.row.curator.logoURI} />
              <AvatarFallback className="bg-secondary">
                <GenericFallbackIcon />
              </AvatarFallback>
            </Avatar>
            <span>Eden Testnet</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Button
          className={cn('transition-all hover:scale-105', {
            'col-span-2': !props.showWithdraw,
          })}
          onClick={handleDeposit}
        >
          Deposit
        </Button>
        {props.showWithdraw ? (
          <Button
            variant="outline"
            className="hover:!text-primary-foreground bg-card hover:!bg-card !border-none transition-all hover:scale-105"
            onClick={handleWithdraw}
          >
            Withdraw
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default VaultCard;
