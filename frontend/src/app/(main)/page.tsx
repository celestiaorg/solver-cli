'use client';

import { useEffect, useRef, useState } from 'react';

import { ArcadiaCard } from '@/components/arcadia-card';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { Celestia } from '@/components/ui/icons/Celestia';

import { edenImages } from '@/lib/constants/eden-images';
import { routes } from '@/utils/routes';

import { ActionCard } from './components/action-card';
import { BalanceCard, VaultCard } from './components/balance';

const Home = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current) {
        const isOverflowing =
          containerRef.current.scrollHeight > containerRef.current.clientHeight;
        setHasOverflow(isOverflowing);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);

    return () => window.removeEventListener('resize', checkOverflow);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`max-sm:scroll-shadow-bottom grid h-full auto-rows-auto grid-cols-12 gap-x-6 gap-y-5 overflow-auto pb-12 md:pb-0`}
    >
      <BalanceCard className="col-span-6 md:col-span-4" />
      <VaultCard className="col-span-6 md:col-span-4" />

      <div className="bg-background border-secondary relative col-span-full flex min-h-40 flex-1/3 flex-col justify-between overflow-hidden rounded-lg border md:col-span-4">
        <div
          className="absolute inset-0 bg-cover bg-center object-cover"
          style={{ backgroundImage: `url(${edenImages.banner1})` }}
        />
        <GlowingEffect />
      </div>

      <ActionCard
        title="Deposit"
        description="Bridge or deposit tokens to Eden"
        redirectTo={routes.bridge}
        className="col-span-6 md:col-span-3"
        bgImage={edenImages.action1}
      />

      <ActionCard
        title="Earn"
        description="Earn yield on TIA, BTC, & ETH"
        redirectTo={routes.vaults}
        className="col-span-6 md:col-span-3"
        bgImage={edenImages.action2}
      />

      <ActionCard
        title="Trade"
        description="Swap TIA, SOL, ETH, BTC & more"
        redirectTo={routes.trade}
        className="col-span-6 md:col-span-3"
        bgImage={edenImages.action3}
      />

      <ActionCard
        title="Explore"
        description="Explore apps on Eden"
        redirectTo={routes.home}
        className="col-span-6 md:col-span-3"
        bgImage={edenImages.action4}
      />

      <div className="col-span-12 flex flex-col gap-2">
        <p className="text-primary-foreground font-medium">Featured Apps</p>
        <section className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-3">
          <ArcadiaCard title="Arcadia" subtitle="CLOB" />
          <ArcadiaCard title="Arcadia" subtitle="CLOB" />

          <div className="bg-foreground/30 border-secondary relative isolate col-span-2 min-h-40 rounded-xl border p-5 md:col-span-1">
            <GlowingEffect />
            <div className="mb-2 flex items-center gap-2">
              <img src="/misc/app-logo.png" alt="app-logo" className="size-8" />
              <img src="/misc/app-logo.png" alt="app-logo" className="size-8" />
              <img src="/misc/app-logo.png" alt="app-logo" className="size-8" />
            </div>
            <p className="block text-black">More apps coming soon</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
