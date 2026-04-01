'use client';

import { CaretDoubleLeft } from '@phosphor-icons/react';
import { motion } from 'framer-motion';

import { Fragment } from 'react';

import { usePathname, useRouter } from 'next/navigation';
import { useTopLoader } from 'nextjs-toploader';

import { SeparatorFaded } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

import { cn } from '@/lib/utils';

import { getDisplayRoute, linkItems, NavItem, navItems } from './items';

export default function AppSidebar() {
  const { toggleSidebar, open } = useSidebar();

  return (
    <Sidebar
      collapsible="icon"
      variant="floating"
      className="relative h-full p-0"
    >
      <div
        onClick={toggleSidebar}
        className="border-muted-100 text-foreground absolute -right-3 z-10 flex size-4.5 cursor-pointer items-center justify-center rounded-full border bg-black/34"
      >
        <CaretDoubleLeft
          className={cn(
            'size-2 transition-transform duration-500',
            open ? 'rotate-0' : 'rotate-180'
          )}
        />
      </div>
      <SidebarContent className="p-0">
        <motion.div
          className="border-muted-100 flex h-full flex-col justify-between border bg-[#00000057] px-2 py-3 backdrop-blur-lg"
          animate={{
            borderRadius: open ? 12 : 50,
          }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
          }}
        >
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu className="gap-3.5">
                {navItems.map((item, index) => (
                  <Fragment key={item.id}>
                    {(index === 1 || index === 4) && <SeparatorFaded />}
                    <SidebarMenuItem key={item.id}>
                      <SidebarButton href={item.href} open={open} item={item} />
                    </SidebarMenuItem>
                  </Fragment>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu className="gap-3.5">
                {linkItems.map((item, index) => (
                  <Fragment key={item.id}>
                    {index === 0 && <SeparatorFaded />}
                    <SidebarMenuItem key={item.id}>
                      <SidebarButton
                        key={item.href}
                        href={item.href}
                        open={open}
                        item={item}
                      />
                    </SidebarMenuItem>
                  </Fragment>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </motion.div>
      </SidebarContent>
    </Sidebar>
  );
}

const SidebarButton = ({
  href,
  open,
  item,
}: {
  href: string;
  open: boolean;
  item: NavItem;
}) => {
  const pathname = usePathname();
  const activeRoute = getDisplayRoute(pathname);

  const router = useRouter();
  const { start } = useTopLoader();

  const handleClick = (href: string) => {
    router.push(href);
    start();
  };

  return (
    <SidebarMenuButton asChild isActive={activeRoute === item.id}>
      <motion.button
        onClick={() => {
          handleClick(href);
        }}
        className={
          'data-[active=true]:!bg-foreground border-muted-100 cursor-pointer rounded-[4px] border transition-colors data-[active=false]:!bg-white/5 data-[active=false]:hover:!bg-white/15 data-[active=true]:!text-black [[data-collapsible=icon]_&]:!w-full'
        }
        style={{
          overflow: 'hidden',
          borderRadius: open ? 4 : 50,
        }}
        animate={{
          borderRadius: open ? 4 : 50,
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
      >
        <item.Icon />

        <span className="font-normal">
          {typeof item.label === 'string' ? (
            item.label
          ) : (
            <item.label className="w-24 text-inherit" />
          )}
        </span>
      </motion.button>
    </SidebarMenuButton>
  );
};
