'use client';

import { useCallback } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { edenImages } from '@/lib/constants/eden-images';
import { useOnboardingStore } from '@/store/onboarding';

import { OnboardingStepCard } from './components/onboarding-step-card';

const OnboardingStepsPage = () => {
  const router = useRouter();
  const { setCurrentStep } = useOnboardingStore();

  const handleOpenBridge = useCallback(() => {
    setCurrentStep(1);
    router.push('/bridge');
  }, [router, setCurrentStep]);

  const handleSkip = useCallback(() => {
    setCurrentStep(1);
    router.push('/onboarding-steps/vaults');
  }, [router, setCurrentStep]);

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

        <div className="z-10 flex w-full flex-col gap-3 rounded-2xl bg-[#2A2B2B] p-6 backdrop-blur-2xl">
          <Button className="w-full" size="lg" onClick={handleOpenBridge}>
            Open Bridge
          </Button>
          <Button
            className="w-full"
            size="lg"
            variant="ghost"
            onClick={handleSkip}
          >
            Skip for now
          </Button>
        </div>
      </section>
    </main>
  );
};

export default OnboardingStepsPage;
