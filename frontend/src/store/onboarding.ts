import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OnboardingState {
  hasCompletedOnboarding: boolean;
  hasSkippedOnboarding: boolean;
  hasStartedOnboarding: boolean;
  currentStep: number;
  onboardingVersion: string;
  completeOnboarding: () => void;
  skipOnboarding: () => void;
  startOnboarding: () => void;
  setCurrentStep: (step: number) => void;
  resetOnboarding: () => void;
}

const ONBOARDING_VERSION = 'v1';

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    set => ({
      hasCompletedOnboarding: false,
      hasSkippedOnboarding: false,
      hasStartedOnboarding: false,
      currentStep: 0,
      onboardingVersion: ONBOARDING_VERSION,
      completeOnboarding: () =>
        set({
          hasCompletedOnboarding: true,
          hasSkippedOnboarding: false,
          hasStartedOnboarding: true,
        }),
      skipOnboarding: () =>
        set({
          hasSkippedOnboarding: true,
          hasCompletedOnboarding: false,
        }),
      startOnboarding: () =>
        set({
          hasStartedOnboarding: true,
        }),
      setCurrentStep: (step: number) => set({ currentStep: step }),
      resetOnboarding: () =>
        set({
          hasCompletedOnboarding: false,
          hasSkippedOnboarding: false,
          hasStartedOnboarding: false,
          currentStep: 0,
        }),
    }),
    {
      name: 'eden-onboarding-storage',
    }
  )
);
