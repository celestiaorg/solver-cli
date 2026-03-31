'use client';

// Onboarding disabled for local dev — go straight to main app
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
