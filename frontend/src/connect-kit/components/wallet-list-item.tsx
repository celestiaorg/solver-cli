import { motion } from 'framer-motion';

import { useCallback, useMemo, useState } from 'react';

import { useIsMobileDevice } from '@/hooks/use-is-mobile-device';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

import { AsyncAvatarImage } from './async-avatar-image';
import { ConnectedMobile } from './connected-mobile';

const variants = {
  slideUp: { opacity: 0, y: -10 },
  slideDown: { opacity: 0, y: 10 },
  normal: { opacity: 1, y: 0 },
};

const transition = {
  duration: 0.1,
};

export function WalletListItem({
  displayName,
  isConnected,
  icon,
  onClick,
  isNotInstalled,
  isRecommended,
  hideInstallButton,
  className,
}: {
  displayName: string;
  isConnected: boolean;
  icon: string;
  onClick: () => void;
  isNotInstalled: boolean;
  isRecommended: boolean;
  hideInstallButton?: boolean;
  className?: string;
}) {
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const isMobile = useIsMobileDevice();

  const displayInitials = useMemo(() => {
    const initials = displayName
      .split(' ')
      .map((substr: string) => substr[0].toUpperCase());
    if (initials.length === 1) {
      return initials[0];
    }
    return initials[0] + initials[initials.length - 1];
  }, [displayName]);

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  return (
    <Button
      variant="ghost"
      className={cn(
        'flex h-15 w-full flex-row items-center justify-between overflow-hidden rounded-lg px-3 py-1',
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      disabled={isNotInstalled && hideInstallButton}
      key={displayName}
      onClick={onClick}
    >
      <div className="flex flex-row items-center justify-start gap-3">
        <Avatar className="h-8 w-8 rounded-sm">
          <AsyncAvatarImage src={icon ?? ''} />
          <AvatarFallback className="text-sm">{displayInitials}</AvatarFallback>
        </Avatar>
        <p className="text-foreground text-md leading-none font-bold">
          {displayName}
        </p>
        {/*  {isRecommended && (
          <Badge
            variant="success"
            className="rounded-sm px-1 py-0 text-xs font-medium"
          >
            Recommended
          </Badge>
        )} */}
      </div>
      {isConnected ? (
        isMobile ? (
          <ConnectedMobile />
        ) : (
          <div className="relative">
            {isHovering ? (
              <motion.p
                key={`disconnect-${displayName}`}
                variants={variants}
                transition={transition}
                initial="slideDown"
                animate="normal"
                className="text-destructive bg-destructive/10 rounded-full px-3 py-1.5 text-xs font-medium"
                layout
              >
                Disconnect
              </motion.p>
            ) : (
              <motion.p
                key={`connected-${displayName}`}
                variants={variants}
                transition={transition}
                initial="slideUp"
                animate="normal"
                className="text-foreground/50 text-xs font-medium"
                layout
              >
                Connected
              </motion.p>
            )}
          </div>
        )
      ) : (
        !(isNotInstalled && hideInstallButton) && (
          <p
            key={`connect-${displayName}`}
            className="text-xs font-medium text-[var(--accent-yellow)]"
          >
            {isNotInstalled && 'Install'}
          </p>
        )
      )}
    </Button>
  );
}
