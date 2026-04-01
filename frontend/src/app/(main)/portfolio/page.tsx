import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { edenImages } from '@/lib/constants/eden-images';
import { cn } from '@/lib/utils';
import { routes } from '@/utils/routes';

import { ActionCard } from '../components/action-card';
import { BalanceDisplay } from './components/balance';
import { TokensTable } from './components/tokens-table';

const Portfolio = () => {
  return (
    <div className="relative w-full flex-1 rounded-tl-lg rounded-tr-lg md:rounded-none">
      <div className="relative z-10 flex flex-col gap-12">
        <section className="flex flex-col items-stretch gap-3 md:!flex-row">
          <div
            className="bg-accent flex flex-2/3 items-start justify-between rounded-lg bg-cover px-7 py-8"
            style={{ backgroundImage: `url(${edenImages.banner3})` }}
          >
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-sm">My Balance</p>
              <BalanceDisplay />
            </div>
          </div>

          <div className="flex flex-1/3 gap-3">
            <ActionCard
              title="Deposit"
              description="Bridge or deposit tokens to Eden"
              className="md:min-h-40"
              redirectTo={routes.vaults}
            />

            <ActionCard
              title="Trade"
              description="Swap TIA, SOL, ETH, BTC & more"
              className="md:min-h-40"
              redirectTo={routes.trade}
            />
          </div>
        </section>
        <section className="flex-1">
          <Tabs defaultValue="tokens" className="w-full">
            <TabsList className="w-full px-4 ![border-image:linear-gradient(to_right,var(--foreground),var(--secondary))_1]">
              <TabsTrigger
                value="tokens"
                className={cn(
                  'text-muted-foreground data-[state=active]:text-accent data-[state=active]:border-accent -mb-[5px] px-4 !pb-3 data-[state=active]:border-b-2'
                )}
              >
                Tokens
              </TabsTrigger>
            </TabsList>
            <TabsContent value="tokens">
              <TokensTable />
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  );
};

export default Portfolio;
