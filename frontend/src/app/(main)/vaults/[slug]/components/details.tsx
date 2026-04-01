'use client';

import { useVaultInfo } from '@/hooks/use-vault-data';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

import { GenericFallbackIcon } from '@/icons';
import { Vault } from '@/lib/types';

export const Details = ({ vault }: { vault: Vault }) => {
  const { vaultAsset, vaultData, tvl, isLoadingVaultData } =
    useVaultInfo(vault);
  return (
    <>
      <div className="mb-7 flex gap-5">
        <div className="rounded-5xl bg-muted-foreground/20 flex items-center gap-2.5 px-4 py-2">
          <Avatar className="size-4">
            <AvatarImage />
            <AvatarFallback>
              <GenericFallbackIcon />
            </AvatarFallback>
          </Avatar>
          <p className="text-sm">Curator Name</p>
        </div>
        <div className="rounded-5xl bg-muted-foreground/20 flex w-fit items-center gap-2.5 px-4 py-2">
          <Avatar className="size-4">
            <AvatarImage src={vaultAsset?.icon_url ?? undefined} />
            <AvatarFallback>
              <GenericFallbackIcon />
            </AvatarFallback>
          </Avatar>
          <p className="text-sm">{vaultAsset?.symbol}</p>
        </div>
      </div>

      <div className="mb-12 grid grid-cols-3">
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">TVL</p>
          {isLoadingVaultData ? (
            <Skeleton className="h-10 w-20" />
          ) : (
            <span className="md:text-4.5xl text-foreground text-2xl">
              {tvl}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">Liquidity</p>
          <span className="md:text-4.5xl text-foreground text-2xl">$12M</span>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">APY</p>
          {isLoadingVaultData ? (
            <Skeleton className="h-10 w-20" />
          ) : (
            <span className="md:text-4.5xl text-foreground text-2xl">
              {vaultData?.vaultAPY?.apy ?? '-'}
            </span>
          )}
        </div>
      </div>
    </>
  );
};
