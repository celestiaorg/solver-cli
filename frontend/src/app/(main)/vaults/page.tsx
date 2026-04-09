'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { edenImages } from '@/lib/constants/eden-images';
import { cn } from '@/lib/utils';
import { routes } from '@/utils/routes';

import { AllVaults } from './components/all-vaults';
import { MyVaults } from './components/my-vaults';
import { vaults } from './data';

const Vaults = () => {
  return (
    <div className="relative z-10 flex w-full flex-1 flex-col gap-12 rounded-tl-lg rounded-tr-lg md:rounded-none">
      <section className="flex flex-col items-stretch gap-3 md:!flex-row">
        <div
          className="bg-accent flex flex-2/3 items-start justify-between rounded-2xl bg-cover px-7 py-8"
          style={{ backgroundImage: `url(${edenImages.banner3})` }}
        >
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground text-sm">My Deposits</p>
            <span className="text-4.5xl text-primary-foreground">$0</span>
          </div>

          <div className="bg-muted-foreground/60 flex min-w-5 flex-col gap-1 rounded-2xl px-3 py-2">
            <p className="text-primary-foreground/50 text-sm">Net APY</p>
            <span className="text-4.5xl text-primary-foreground">-</span>
          </div>
        </div>
        <div
          className="bg-accent flex flex-1/3 items-end justify-between rounded-2xl bg-cover px-7 py-8"
          style={{ backgroundImage: `url(${edenImages.banner4})` }}
        >
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground text-sm">Claimable Rewards</p>
            <span className="text-4.5xl text-primary-foreground">-</span>
          </div>
          <Button
            asChild
            className="bg-primary-foreground hover:bg-primary-foreground mb-3 text-black transition-all hover:scale-105"
          >
            <Link href={routes.portfolio}>View Portfolio</Link>
          </Button>
        </div>
      </section>
      <section className="flex-1">
        <Tabs defaultValue="my-vaults" className="w-full">
          <TabsList className="w-full px-4 ![border-image:linear-gradient(to_right,var(--foreground),var(--secondary))_1]">
            <TabsTrigger
              value="my-vaults"
              className={cn(
                'text-muted-foreground data-[state=active]:text-accent data-[state=active]:border-accent -mb-[5px] px-4 !pb-3 data-[state=active]:border-b-2'
              )}
            >
              My Vaults
            </TabsTrigger>
            <TabsTrigger
              value="all-vaults"
              className={cn(
                'text-muted-foreground data-[state=active]:text-accent data-[state=active]:border-accent -mb-[5px] px-4 !pb-3 data-[state=active]:border-b-2'
              )}
            >
              All Vaults
            </TabsTrigger>
          </TabsList>
          <TabsContent value="my-vaults">
            <MyVaults data={Object.values(vaults)} />
          </TabsContent>
          <TabsContent value="all-vaults">
            <AllVaults data={Object.values(vaults)} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
};

export default Vaults;
