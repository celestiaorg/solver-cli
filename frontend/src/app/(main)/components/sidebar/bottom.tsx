'use client';

import { forwardRef, useMemo } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useTabIndicatorPosition } from '@/hooks/use-tab-indicator-pos';

import { cn } from '@/lib/utils';

import { getDisplayRoute, isNestedRoute, NavItem, navItems } from './items';

export const BottomNavigation = () => {
  const pathname = usePathname();
  const activeId = useMemo(() => getDisplayRoute(pathname), [pathname]);
  const isNested = useMemo(() => isNestedRoute(pathname), [pathname]);

  const { containerRef, indicatorRef, childRefs } = useTabIndicatorPosition({
    navItems,
    activeId: activeId ?? '',
  });

  if (isNested) {
    return null;
  }

  return (
    <nav className="border-secondary sticky bottom-3 z-10 m-auto mt-3 rounded-4xl border-2 bg-black md:hidden">
      <div ref={containerRef} className="flex gap-2 px-2 py-1">
        {navItems.map((item, index) => (
          <NavLink
            key={item.href}
            item={item}
            activeId={activeId}
            ref={ref => {
              childRefs.current.set(index, ref);
            }}
          />
        ))}
      </div>
    </nav>
  );
};

const NavLink = forwardRef<
  HTMLAnchorElement,
  {
    item: NavItem;
    activeId?: string;
    className?: string;
  }
>(({ item, activeId, className }, ref) => {
  return (
    <Link
      ref={ref}
      key={item.href}
      href={item.href}
      className={cn(
        'text border-secondary flex flex-col items-center gap-1 rounded-full border p-3 text-xs font-medium transition-colors',
        activeId === item.id
          ? 'bg-foreground text-black'
          : 'text-primary-foreground bg-background',
        item.isDisabled && 'pointer-events-none opacity-50',
        className
      )}
    >
      <item.Icon className="size-5 text-inherit" weight="fill" />
    </Link>
  );
});

NavLink.displayName = 'NavLink';
