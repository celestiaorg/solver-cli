import React from 'react';

import { OnboardingGuard } from '@/components/onboarding-guard';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import { DynamicBackground } from './components/dynamic-background';
import { Header, HeaderProvider, MobileHeader } from './components/header';
import AppSidebar from './components/sidebar';
import { BottomNavigation } from './components/sidebar/bottom';
import VaultDepositWithdrawDialog from './vaults/[slug]/components/vault-dw-dialog';

const Layout = (props: { children: React.ReactNode }) => {
  return (
    <OnboardingGuard>
      <DynamicBackground>
        <HeaderProvider>
          <MobileHeader />
          <SidebarProvider className="flex-1 gap-4" defaultOpen={false}>
            <AppSidebar />

            <SidebarInset className="border-secondary relative z-2 flex flex-1 flex-col rounded-xl border border-x bg-transparent p-4.5 backdrop-blur-2xl md:!rounded-4xl md:px-6 md:py-5">
              <div className="mb-10 hidden md:!block">
                <Header />
              </div>

              <div className="no-scrollbar h-[78vh] overflow-hidden overflow-y-auto md:h-full md:flex-1">
                {props.children}
              </div>
            </SidebarInset>
          </SidebarProvider>
          <BottomNavigation />
          <VaultDepositWithdrawDialog />
        </HeaderProvider>
      </DynamicBackground>
    </OnboardingGuard>
  );
};

export default Layout;
