'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { GlowingEffect } from '@/components/ui/glowing-effect';

import { cn } from '@/lib/utils';
import { useWalletConnectStore } from '@/store/wallet-connect';
import { routes } from '@/utils/routes';

export const BalanceCard = ({ className }: { className?: string }) => {
  const { evm } = useWalletConnectStore();

  return (
    <div
      className={cn(
        'bg-background border-secondary relative flex min-h-40 flex-1/3 flex-col justify-between rounded-lg border p-5',
        className
      )}
    >
      <GlowingEffect />
      <div>
        <p className="text-muted-foreground text-sm">Balance</p>
        <p className="md:!text-4.5xl text-primary-foreground text-lg md:text-2xl">
          $0
        </p>
      </div>
      <div className="max-xs:!items-start xs:!flex-row xs:gap-3 flex flex-col items-center gap-2">
        <Button asChild variant="mono" className="w-fit text-black">
          <Link href={routes.vaults}>Deposit</Link>
        </Button>
        <Button asChild variant="secondary" className="w-fit sm:!hidden">
          <Link href={routes.portfolio}>Portfolio</Link>
        </Button>
        <Button
          asChild
          variant="secondary"
          className="hidden w-fit sm:!inline-flex"
        >
          <Link href={routes.portfolio}>View Portfolio</Link>
        </Button>
      </div>
    </div>
  );
};

export const VaultCard = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        'bg-background border-secondary relative flex min-h-40 flex-1/3 flex-col justify-between rounded-lg border p-5',
        className
      )}
    >
      <GlowingEffect />

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <p className="text-muted-foreground text-sm">Vaults</p>
          <p className="md:!text-4.5xl text-primary-foreground text-lg md:text-2xl">
            $0
          </p>
        </div>
        <div className="flex-1">
          <p className="text-muted-foreground text-sm">Net APY</p>
          <p className="md:!text-4.5xl text-primary-foreground text-lg md:text-2xl">
            0%
          </p>
        </div>
      </div>

      <Button asChild variant="secondary" className="w-fit">
        <Link href={routes.vaults}>View Vaults</Link>
      </Button>
    </div>
  );
};
