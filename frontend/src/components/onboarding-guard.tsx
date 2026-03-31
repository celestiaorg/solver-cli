'use client';

import { useEffect, useState } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { useOnboardingStore } from '@/store/onboarding';

/**
 * OnboardingGuard
 *
 * Client-side navigation guard that redirects users to onboarding
 * if they haven't completed or skipped it.
 *
 * Compatible with Next.js static export (output: 'export')
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hasCompletedOnboarding, hasSkippedOnboarding, hasStartedOnboarding } =
    useOnboardingStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Skip check if already on onboarding page
    if (pathname?.startsWith('/onboarding')) {
      setIsChecking(false);
      return;
    }

    // Check if user needs onboarding
    const needsOnboarding = !hasCompletedOnboarding && !hasSkippedOnboarding;

    if (needsOnboarding) {
      // If user has started onboarding, redirect to steps page
      // Otherwise, redirect to landing page
      if (hasStartedOnboarding) {
        router.push('/onboarding-steps');
      } else {
        router.push('/onboarding');
      }
    } else {
      setIsChecking(false);
    }
  }, [
    pathname,
    hasCompletedOnboarding,
    hasSkippedOnboarding,
    hasStartedOnboarding,
    router,
  ]);

  // Show loading state while checking (prevents flash of main content)
  if (isChecking && !pathname?.startsWith('/onboarding')) {
    return <></>;
  }

  return <>{children}</>;
}
