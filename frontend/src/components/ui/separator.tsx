'use client';

import * as SeparatorPrimitive from '@radix-ui/react-separator';

import * as React from 'react';

import { cn } from '@/lib/utils';

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        className
      )}
      {...props}
    />
  );
}

function SeparatorFaded({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-gradient-to-r',
        orientation === 'horizontal'
          ? 'h-px w-full from-transparent via-white to-transparent'
          : 'h-full w-px bg-gradient-to-b from-transparent via-white to-transparent',
        className
      )}
      {...props}
    />
  );
}

export { Separator, SeparatorFaded };
