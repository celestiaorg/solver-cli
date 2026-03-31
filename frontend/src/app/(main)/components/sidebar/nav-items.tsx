'use client';

import { useMemo } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

import { getDisplayRoute, NavItem, navItems } from './items';

export const NavItems = () => {
  const pathname = usePathname();
  const activeId = useMemo(() => getDisplayRoute(pathname), [pathname]);

  return (
    <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-3 text-base md:!flex">
      {navItems.map(item =>
        item.isDisabled ? (
          <DisabledNavLink key={item.href} item={item} />
        ) : (
          <NavLink key={item.href} item={item} activeId={activeId} />
        )
      )}
    </div>
  );
};

const NavLink = ({
  item,
  onMouseEnter,
  onMouseLeave,
  className,
  showIcon,
  activeId,
}: {
  activeId?: string;
  item: NavItem;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
  showIcon?: boolean;
}) => {
  return (
    <Link
      href={item.href}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'flex items-center gap-2 text-base',
        activeId === item.id ? 'text-accent-foreground' : 'text-muted',
        className
      )}
    >
      {showIcon && item.Icon && (
        <item.Icon className="size-5 text-inherit" weight="fill" />
      )}
      {typeof item.label === 'string' ? (
        item.label
      ) : (
        <item.label className="h-4 w-20 text-inherit" />
      )}
    </Link>
  );
};

NavLink.displayName = 'NavLink';

const DisabledNavLink = ({
  item,
  onMouseEnter,
  onMouseLeave,
  className,
  showIcon,
}: {
  item: NavItem;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
  showIcon?: boolean;
}) => {
  return (
    <span
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'text-muted flex cursor-not-allowed items-center gap-2 text-base',
        className
      )}
      title="Coming Soon"
    >
      {showIcon && item.Icon && (
        <item.Icon className="size-5 text-inherit" weight="fill" />
      )}
      {typeof item.label === 'string' ? (
        item.label
      ) : (
        <item.label className="h-4 w-20 text-inherit" />
      )}
    </span>
  );
};

DisabledNavLink.displayName = 'DisabledNavLink';
