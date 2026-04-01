import {
  Bridge,
  Briefcase,
  FileCode,
  TelegramLogo,
  Vault,
  XLogo,
} from '@phosphor-icons/react';

import { TradeIcon } from '@/components/icons/trade';
import { Celestia } from '@/components/ui/icons/Celestia';
import { EdenIcon } from '@/components/ui/icons/Eden';

import { links } from '@/utils/links';
import { routes } from '@/utils/routes';

export type NavItem = {
  id: string;
  label: string | React.ElementType;
  href: string;
  heading?: string;
  isNew?: boolean;
  activeOn?: Set<string>;
  Icon: React.ElementType;
  subItems?: NavItem[];
  isDisabled?: boolean;
};

export const navItems: NavItem[] = [
  {
    id: routes.home,
    label: EdenIcon,
    href: routes.home,
    heading: 'Welcome to Eden',
    Icon: Celestia,
  },
  {
    id: routes.bridge,
    label: 'Bridge',
    href: routes.bridge,
    heading: 'Bridge',
    Icon: Bridge,
  },
  {
    id: routes.vaults,
    label: 'Earn',
    href: routes.vaults,
    heading: 'Earn',
    activeOn: new Set([routes.vaults]),
    Icon: Vault,
  },
  {
    id: routes.trade,
    label: 'Trade',
    href: routes.trade,
    heading: 'Trade',
    isDisabled: true,
    Icon: TradeIcon,
  },
  {
    id: routes.portfolio,
    label: 'Portfolio',
    href: routes.portfolio,
    heading: 'Portfolio',
    isDisabled: false,
    Icon: Briefcase,
  },
];

export const linkItems: NavItem[] = [
  {
    id: links.docs,
    label: 'Docs',
    href: links.docs,
    Icon: FileCode,
  },
  {
    id: links.xLink,
    label: 'Twitter/X',
    href: links.xLink,
    Icon: XLogo,
  },
  {
    id: links.telegram,
    label: 'Telegram',
    href: links.telegram,
    isDisabled: false,
    Icon: TelegramLogo,
  },
];

export const getDisplayRoute = (pathname: string) => {
  // Check for exact match first
  const exactMatch = navItems.find(item => item.href === pathname)?.id;
  if (exactMatch) return exactMatch;

  // Check custom activeOn rules
  const activeOn = navItems.find(item => item.activeOn?.has(pathname))?.id;
  if (activeOn) return activeOn;

  // Check for parent/child relationship - if pathname starts with a nav item's href
  const parentMatch = navItems.find(
    item => item.href !== '/' && pathname.startsWith(item.href + '/')
  )?.id;

  return parentMatch;
};

export const getHeadingForRoute = (pathname: string): string => {
  // Check for exact match first
  const exactMatch = navItems.find(item => item.href === pathname);
  if (exactMatch?.heading) return exactMatch.heading;

  // Check custom activeOn rules
  const activeOn = navItems.find(item => item.activeOn?.has(pathname));
  if (activeOn?.heading) return activeOn.heading;

  // Check for parent/child relationship - if pathname starts with a nav item's href
  const parentMatch = navItems.find(
    item => item.href !== '/' && pathname.startsWith(item.href + '/')
  );
  if (parentMatch?.heading) return parentMatch.heading;

  // Default heading
  return 'Welcome to Eden';
};

export type Breadcrumb = {
  label: string;
  href: string;
};

export const getBreadcrumbs = (pathname: string): Breadcrumb[] => {
  const breadcrumbs: Breadcrumb[] = [];

  // Check for exact match first (no breadcrumbs for top-level pages)
  const exactMatch = navItems.find(item => item.href === pathname);
  if (exactMatch) return breadcrumbs;

  // Check for parent/child relationship
  const parentMatch = navItems.find(
    item => item.href !== '/' && pathname.startsWith(item.href + '/')
  );

  if (parentMatch) {
    // Add parent to breadcrumb
    breadcrumbs.push({
      label:
        typeof parentMatch.label === 'string'
          ? parentMatch.label
          : parentMatch.heading || '',
      href: parentMatch.href,
    });
  }

  return breadcrumbs;
};

export const isNestedRoute = (pathname: string): boolean => {
  // A route is nested if it's not an exact match to any nav item
  const exactMatch = navItems.find(item => item.href === pathname);
  return !exactMatch && pathname !== '/';
};
