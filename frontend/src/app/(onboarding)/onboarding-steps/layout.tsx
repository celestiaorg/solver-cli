'use client';

import { ReactNode, useEffect } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { edenImages } from '@/lib/constants/eden-images';
import { useOnboardingStore } from '@/store/onboarding';

import { Header, MobileHeader } from '../components/header';
import SkipOnboarding from '../components/skip-onboarding';

const stepToPath = {
  0: '/onboarding-steps',
  1: '/onboarding-steps/vaults',
};

const Layout = ({ children }: { children: ReactNode }) => {
  const { currentStep } = useOnboardingStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const path =
      stepToPath[currentStep as keyof typeof stepToPath] || stepToPath[0];

    if (pathname !== path) {
      router.push(path);
    }
  }, [currentStep, router, pathname]);

  // Set html background to black to prevent white flash on overscroll bounce
  useEffect(() => {
    document.documentElement.style.backgroundColor = 'black';
    return () => {
      document.documentElement.style.backgroundColor = '';
    };
  }, []);
  return (
    <div
      className={`relative flex min-h-full flex-1 flex-col bg-cover bg-fixed bg-center md:p-0`}
      style={{ backgroundImage: `url(${edenImages.image2})` }}
    >
      <div className="pointer-events-none fixed inset-0 z-1 bg-black opacity-70" />

      <MobileHeader />

      <div className="z-2 flex min-h-0 flex-1 flex-col items-center overflow-auto p-4.5 md:px-10 md:py-4">
        <div className="mb-4 hidden w-full md:!block">
          <Header />
        </div>

        {children}
      </div>

      <SkipOnboarding className="fixed right-10 bottom-10 z-2 mt-4 flex justify-end" />
    </div>
  );
};

export default Layout;
