'use client';

import React, { createContext, useContext, useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ConnectWalletButton } from '@/components/connect-wallet-button';

import {
  getBreadcrumbs,
  getHeadingForRoute,
  isNestedRoute,
} from './sidebar/items';

type HeaderContextType = {
  nestedTitle: string | null;
  setNestedTitle: (title: string | null) => void;
};

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [nestedTitle, setNestedTitle] = useState<string | null>(null);

  return (
    <HeaderContext.Provider value={{ nestedTitle, setNestedTitle }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('useHeader must be used within HeaderProvider');
  }
  return context;
}

export function Header() {
  const pathname = usePathname();
  const baseHeading = getHeadingForRoute(pathname);
  const breadcrumbs = getBreadcrumbs(pathname);
  const isNested = isNestedRoute(pathname);

  // Try to get nested title from context (will be null if not set)
  let nestedTitle: string | null = null;
  try {
    const context = useContext(HeaderContext);
    nestedTitle = context?.nestedTitle || null;
  } catch {
    // Context not available, continue with default behavior
  }

  const heading = nestedTitle || baseHeading;

  return (
    <nav className="relative z-10 flex w-full items-center justify-between">
      {/* Left side - Heading with Breadcrumbs */}
      <div className="flex gap-1">
        {isNested && breadcrumbs.length > 0 && (
          <div className="text-muted-foreground flex items-center gap-1">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.href}>
                <Link
                  href={crumb.href}
                  className="hover:text-foreground text-xl transition-colors md:text-3xl"
                >
                  {crumb.label}
                </Link>
                {index < breadcrumbs.length && (
                  <span className="mx-2 text-xl md:text-3xl">/</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
        <h3 className="text-xl text-wrap break-words md:text-3xl">{heading}</h3>
      </div>

      {/* Right side - Wallet Connect Button */}
      <ConnectWalletButton />
    </nav>
  );
}

export function MobileHeader() {
  return (
    <div className="border-secondary relative z-2 mb-3 rounded-xl border py-2 pr-3 pl-5 backdrop-blur-2xl md:hidden">
      <Header />
    </div>
  );
}
