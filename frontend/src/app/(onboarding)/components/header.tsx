'use client';

import React from 'react';

import { ConnectWalletButton } from '@/components/connect-wallet-button';

export function Header() {
  return (
    <nav className="relative z-10 mb-2 flex w-full items-center justify-between pt-2">
      <div className="flex gap-1">
        <h3 className="text-xl text-wrap break-words md:text-3xl">
          Welcome to Eden
        </h3>
      </div>

      <ConnectWalletButton />
    </nav>
  );
}

export function MobileHeader() {
  return (
    <div className="border-secondary relative z-2 mb-3 rounded-xl border px-4 backdrop-blur-2xl md:hidden">
      <Header />
    </div>
  );
}
