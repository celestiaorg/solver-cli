'use client';

import { Sparkle, Vault } from '@phosphor-icons/react';

import Link from 'next/link';

import { GlowingEffect } from '@/components/ui/glowing-effect';
import RepeatIcon from '@/components/ui/icons/RepeatIcon';
import SummitIcon from '@/components/ui/icons/SummitIcon';

import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  '/bridge': SummitIcon,
  '/vaults': Vault,
  '/trade': RepeatIcon,
  '/explore': Sparkle,
};

export const ActionCard = (props: {
  title: string;
  redirectTo: string;
  description: string;
  className?: string;
  bgImage?: string;
}) => {
  const Icon = ICON_MAP[props.redirectTo] || Sparkle;

  return (
    <Link
      href={props.redirectTo}
      className={cn(
        'bg-background border-secondary relative flex cursor-pointer flex-col gap-8 rounded-lg border bg-cover bg-center p-5 md:min-h-40 md:justify-between',
        props.className
      )}
      style={{ backgroundImage: `url(${props.bgImage})` }}
    >
      <GlowingEffect />

      <Icon className="text-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-foreground md:text-2xl">{props.title}</p>
        <span className="text-muted-foreground md:text-md text-xs">
          {props.description}
        </span>
      </div>
    </Link>
  );
};
