'use client';

import { ArrowsLeftRight } from '@phosphor-icons/react';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { Celestia } from '@/components/ui/icons/Celestia';
import { EdenIcon } from '@/components/ui/icons/Eden';

import { routes } from '@/utils/routes';

const TradePage = () => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="bg-background border-secondary relative flex max-w-lg flex-col items-center rounded-lg border p-10 text-center">
        <GlowingEffect />

        <div className="relative z-10 mb-6 flex items-center gap-3">
          <Celestia className="text-foreground size-8" />
          <EdenIcon className="text-foreground h-auto w-28" />
        </div>

        <ArrowsLeftRight
          size={48}
          className="text-muted-foreground/30 relative z-10 mb-4"
        />

        <h2 className="text-foreground relative z-10 mb-2 text-2xl font-bold">
          Trade is coming soon
        </h2>
        <p className="text-muted-foreground relative z-10 mb-6 text-sm leading-relaxed">
          Swap TIA, ETH, LBTC and more directly on Eden.
          <br />
          This feature is currently in development.
        </p>

        <Button
          size="lg"
          variant="mono"
          asChild
          className="relative z-10 w-full text-black"
        >
          <Link href={routes.bridge}>Bridge tokens instead</Link>
        </Button>
      </div>
    </div>
  );
};

export default TradePage;
