'use client';

import { DottedGlowBackground } from '@/components/ui/dotted-glow-background';
import { Celestia } from '@/components/ui/icons/Celestia';
import { EdenIcon } from '@/components/ui/icons/Eden';

import { EnterCta } from './components/enter-cta';

const OnboardingLandingPage = () => {
  return (
    <div className="border-secondary max-w-8xl isolate mx-auto my-8 block flex-1 grid-rows-2 overflow-hidden rounded-3xl border md:!grid md:grid-cols-3 md:grid-rows-1">
      <div className="relative row-span-1 flex h-full flex-col justify-between px-8 py-14 backdrop-blur-2xl md:col-span-1 md:px-11 md:py-20">
        <div>
          <div className="mb-9 flex items-center gap-2">
            <Celestia className="size-6" />
            <EdenIcon className="h-auto w-34" />
          </div>

          <h1 className="text-5xl font-bold">Welcome to Eden</h1>
        </div>

        <EnterCta />

        <DottedGlowBackground
          className="pointer-events-none absolute inset-0 -z-10 mask-radial-to-90% mask-radial-at-center"
          opacity={1}
          gap={10}
          radius={1.6}
          color="rgba(255,255,255,0.3)"
          glowColor="rgba(255,255,255,0.75)"
          backgroundOpacity={0}
          speedMin={0.3}
          speedMax={1.6}
          speedScale={1}
        />
      </div>

      <div className="hidden rounded-r-3xl border-y border-r border-white opacity-60 md:col-span-2 md:!block" />
    </div>
  );
};

export default OnboardingLandingPage;
