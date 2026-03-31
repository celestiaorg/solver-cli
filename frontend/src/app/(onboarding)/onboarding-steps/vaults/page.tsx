'use client';

import { vaults } from '@/app/(main)/vaults/data';
import { edenImages } from '@/lib/constants/eden-images';

import { OnboardingStepCard } from '../components/onboarding-step-card';
import { VaultTable } from '../components/vault-table';

/**
 * Onboarding Steps Page
 *
 * Multi-step scrollable onboarding flow
 * TODO: Add your onboarding steps content
 */
const OnboardingVaultsPage = () => {
  return (
    <main className="size-full max-w-120 flex-1 overflow-hidden">
      <section className="isolate mb-4 flex h-full w-full flex-col">
        <OnboardingStepCard
          image={edenImages.banner7}
          number={2}
          title="VAULT"
          description={
            <>
              Now, it&apos;s time to deposit & earn
              <br />
              on the&nbsp;
              <span className="font-semibold">first ever TIA vault.</span>
            </>
          }
        />

        <div className="w-full flex-1 overflow-hidden rounded-2xl bg-[#232521] p-8 pb-12">
          <h2 className="mb-6 text-sm font-medium">Select a vault</h2>

          <VaultTable data={Object.values(vaults)} />
        </div>
      </section>
    </main>
  );
};

export default OnboardingVaultsPage;
