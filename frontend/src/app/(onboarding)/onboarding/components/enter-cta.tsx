import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { useState } from 'react';

import { useRouter } from 'next/navigation';
import { useTopLoader } from 'nextjs-toploader';

import { Button } from '@/components/ui/button';

import { Modal } from '@/connect-kit/components/modal';
import { useOnboardingStore } from '@/store/onboarding';
import { useWalletConnectStore } from '@/store/wallet-connect';

export const EnterCta = () => {
  const { startOnboarding } = useOnboardingStore();
  const { isConnected } = useWalletConnectStore();

  const router = useRouter();
  const { start } = useTopLoader();

  const [showWalletConnectModal, setShowWalletConnectModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleCTAClick = () => {
    if (isConnected) {
      startOnboarding();
      start();
      router.push('/onboarding-steps');
      return;
    }

    setShowWalletConnectModal(true);
  };

  const textToShow = isConnected ? 'Enter Portal' : 'Connect Wallet';

  return (
    <>
      <Button
        size="lg"
        variant="mono"
        className="relative w-full overflow-hidden rounded-2xl font-semibold text-black"
        onClick={handleCTAClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <AnimatePresence mode="popLayout">
          <motion.span
            key={textToShow}
            animate={{
              x: isHovered ? -12 : 0,
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 25,
            }}
          >
            {textToShow}
          </motion.span>
        </AnimatePresence>

        <motion.span
          className="absolute right-4"
          initial={{ x: 20, opacity: 0 }}
          animate={{
            x: isHovered ? 0 : 20,
            opacity: isHovered ? 1 : 0,
          }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 25,
          }}
        >
          <ArrowRight className="size-5.25" />
        </motion.span>
      </Button>

      <Modal
        isOpen={showWalletConnectModal}
        setIsOpen={setShowWalletConnectModal}
      />
    </>
  );
};
