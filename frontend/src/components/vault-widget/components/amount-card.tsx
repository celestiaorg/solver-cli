'use client';

import BigNumber from 'bignumber.js';
import { ArrowUpDown } from 'lucide-react';

import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { GenericFallbackIcon } from '@/icons';
import { cn, formatAmount } from '@/lib/utils';

export const AmountCard = (props: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  assetDetails?: { symbol: string; logoURI?: string };
  tokenBalance?: BigNumber;
  isBalanceLoading?: boolean;
  disabled?: boolean;
}) => {
  const [displayFormat, setDisplayFormat] = useState('token');

  const handleMaxClick = () => {
    props.onChange?.(props.tokenBalance?.toString() || '0');
  };

  return (
    <div className="bg-card-foreground focus-within:border-foreground/10 flex w-full flex-col rounded-xl px-4 py-6 focus-within:border focus-within:shadow-sm">
      <div className="text-muted-foreground mb-3 text-xs">{props.label}</div>
      <div className="flex w-full items-end justify-between gap-2">
        <div className="flex flex-1 items-center gap-1">
          {displayFormat === 'fiat' ? (
            <span className="text-3.5xl">$</span>
          ) : null}
          <input
            inputMode="decimal"
            value={props.value}
            onChange={e => props.onChange?.(e.target.value)}
            placeholder="0.00"
            disabled={props.disabled}
            className="text-3.5xl text-foreground w-full flex-1 border-none bg-transparent outline-none"
          />
        </div>
        <div
          className={cn(
            'text-base-lg bg-foreground/10 text-foreground flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-1.5 py-1 font-medium transition-all hover:scale-105',
            !props.assetDetails && 'ps-3'
          )}
        >
          {props.assetDetails ? (
            <Avatar className="mr-1 size-6 shrink-0">
              <AvatarImage src={props.assetDetails?.logoURI ?? ''} />
              <AvatarFallback>
                <GenericFallbackIcon className="size-6" />
              </AvatarFallback>
            </Avatar>
          ) : null}

          <span className="flex-1 truncate">
            {props.assetDetails ? props.assetDetails.symbol : 'Select Token'}
          </span>
        </div>
      </div>
      <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <span className="text-secondary-foreground text-sm">{'$0.00'}</span>
          <Button
            size="xs"
            variant="glass"
            className="bg-foreground/10 size-4.5 hover:scale-105"
            onClick={() => {}}
          >
            <ArrowUpDown size={12} className="text-foreground !size-3" />
            <span className="sr-only">Switch</span>
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            <p>Bal:</p>
            {props.isBalanceLoading ? (
              <Skeleton className="inline-block h-4 w-14" />
            ) : props.tokenBalance && props.assetDetails ? (
              <div>
                {formatAmount(props.tokenBalance.toString())}{' '}
                {props.assetDetails.symbol}
              </div>
            ) : (
              <div>-</div>
            )}
          </div>
          <Button
            size="xs"
            variant="glass"
            className="text-foreground bg-foreground/10 h-auto px-1.5 py-0 text-xs hover:scale-105"
            disabled={!props.assetDetails}
            onClick={handleMaxClick}
          >
            Max
          </Button>
        </div>
      </div>
    </div>
  );
};
