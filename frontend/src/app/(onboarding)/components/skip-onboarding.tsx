'use client';

import { ArrowDown } from '@phosphor-icons/react';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';
import { useOnboardingStore } from '@/store/onboarding';

const SkipOnboarding = (props: {
  className?: string;
  buttonClassName?: string;
}) => {
  const router = useRouter();
  const skipOnboarding = useOnboardingStore(state => state.skipOnboarding);
  const handleSkip = () => {
    skipOnboarding();
    router.push('/');
  };
  return (
    <div className={props.className}>
      <Button
        variant="outline"
        className={cn(
          'border-secondary hover:text-primary-foreground flex items-center gap-2 transition-all hover:scale-105 hover:bg-transparent',
          props.buttonClassName
        )}
        onClick={handleSkip}
      >
        Skip Onboarding
        <ArrowDown className="size-3" />
      </Button>
    </div>
  );
};

export default SkipOnboarding;
