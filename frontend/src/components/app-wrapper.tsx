'use client';

import { QueryClientProvider } from '@tanstack/react-query';

//import { OnboardingGuard } from '@/components/onboarding-guard';

import { WalletConnectWrapper } from '@/contexts/wallet-connect';
import { queryClient } from '@/lib/query-client';

export function AppWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletConnectWrapper>
        {/* <OnboardingGuard> */}
        {children}
        {/* </OnboardingGuard> */}
      </WalletConnectWrapper>
    </QueryClientProvider>
  );
}
