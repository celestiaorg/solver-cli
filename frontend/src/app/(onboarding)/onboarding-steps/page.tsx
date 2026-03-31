'use client';

import { Tabs, Widget, WidgetProvider } from '@celestia/widget';

import { useCallback } from 'react';

import { useRouter } from 'next/navigation';

import { useConnectKitContext } from '@/connect-kit';
import { edenImages } from '@/lib/constants/eden-images';
import { isEdenMainnet } from '@/lib/constants/eden-network';
import { useOnboardingStore } from '@/store/onboarding';

import { OnboardingStepCard } from './components/onboarding-step-card';

/**
 * Onboarding Steps Page
 *
 * Multi-step scrollable onboarding flow
 * TODO: Add your onboarding steps content
 */
const OnboardingStepsPage = () => {
  const router = useRouter();

  const { setIsModalOpen } = useConnectKitContext();
  const { setCurrentStep } = useOnboardingStore();

  const handleWalletConnect = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleStatusChange = useCallback(
    (status: string) => {
      if (status === 'success') {
        router.push('/onboarding-steps/vaults');
        setCurrentStep(1);
      }
    },
    [router, setCurrentStep]
  );

  return (
    <main className="w-full max-w-120">
      <section className="isolate w-full">
        <OnboardingStepCard
          image={edenImages.banner5}
          number={1}
          title="BRIDGE"
          description={
            <>
              First, let&apos;s get you onboarded. <br /> Bridge to Eden, from
              anywhere
            </>
          }
        />

        <WidgetProvider
          connectWallet={handleWalletConnect}
          isTestnet={!isEdenMainnet ? true : undefined}
          defaultTab={Tabs.ADVANCED}
          showDefaultTabOnly
        >
          <Widget
            onStatusChange={handleStatusChange}
            className={`eden-widget-ui z-10 w-full bg-[#2A2B2B] backdrop-blur-2xl`}
          />
        </WidgetProvider>
      </section>
    </main>
  );
};

export default OnboardingStepsPage;
