import { notFound } from 'next/navigation';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VaultWidget from '@/components/vault-widget';

import { cn } from '@/lib/utils';

import { mainnetVaults, testnetVaults, vaults } from '../data';
import { Deposits } from './components/deposits';
import { Details } from './components/details';
import { MarketTable } from './components/market-table';
import VaultDepositWithdrawDialog from './components/vault-dw-dialog';
import { VaultHeader } from './components/vault-header';

export async function generateStaticParams() {
  const allAddresses = new Set([
    ...Object.values(mainnetVaults).map(v => v.address),
    ...Object.values(testnetVaults).map(v => v.address),
  ]);
  return Array.from(allAddresses).map(address => ({ slug: address }));
}

export default async function VaultDetails({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vault = vaults[slug as `0x${string}`];

  if (!vault) {
    notFound();
  }

  return (
    <div className="w-full flex-1 rounded-tl-lg rounded-tr-lg md:rounded-none">
      <VaultHeader name={vault.name} />
      <div className="flex justify-center gap-16">
        <section className="w-full md:!w-fit">
          <div className="mb-5">
            <h1 className="md:text-4.5xl mb-2 text-3xl text-wrap break-words">
              {vault.name}
            </h1>
            <p className="md:text-md text-muted-foreground text-xs">
              Vault description comes here
            </p>
          </div>

          <Details vault={vault} />

          <Tabs defaultValue="my-position" className="w-full">
            <TabsList className="mb-6 w-full px-4 ![border-image:linear-gradient(to_right,var(--foreground),var(--secondary))_1]">
              <TabsTrigger
                value="my-position"
                className={cn(
                  'text-muted-foreground data-[state=active]:text-accent data-[state=active]:border-accent -mb-[5px] px-4 !pb-3 data-[state=active]:border-b-2'
                )}
              >
                My Position
              </TabsTrigger>
              <TabsTrigger
                value="market-allocation"
                className={cn(
                  'text-muted-foreground data-[state=active]:text-accent data-[state=active]:border-accent -mb-[5px] px-4 !pb-3 data-[state=active]:border-b-2'
                )}
              >
                Market Allocation
              </TabsTrigger>
            </TabsList>
            <TabsContent value="my-position">
              <Deposits vault={vault} />
            </TabsContent>
            <TabsContent value="market-allocation">
              <MarketTable vault={vault} />
            </TabsContent>
          </Tabs>
        </section>
        <section className="hidden lg:!block">
          <VaultWidget vault={vault} />
        </section>
      </div>
    </div>
  );
}
