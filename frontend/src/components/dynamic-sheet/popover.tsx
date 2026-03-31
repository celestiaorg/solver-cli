'use client';

import { useIsMobileDevice } from '@/hooks/use-is-mobile-device';

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { cn } from '@/lib/utils';

export type DynamicSheetPopoverProps = React.PropsWithChildren<{
  title?: string;
  trigger?: React.ReactNode;
  align?: 'start' | 'end';
  open: boolean;
  handleOpenChange: (open: boolean) => void;
  modal?: boolean;
  avoidCollisions?: boolean;
}>;

export const DynamicSheetPopover = (props: DynamicSheetPopoverProps) => {
  const isMobile = useIsMobileDevice();

  return isMobile ? <MobileView {...props} /> : <DesktopView {...props} />;
};

export const DesktopView = ({
  children,
  open,
  handleOpenChange,
  trigger,
  align = 'start',
  modal = false,
  avoidCollisions = false,
}: DynamicSheetPopoverProps) => {
  return (
    <Popover modal={modal} open={open} onOpenChange={handleOpenChange}>
      <PopoverAnchor>
        <PopoverTrigger className="w-fit" asChild>
          {trigger}
        </PopoverTrigger>
      </PopoverAnchor>
      <PopoverContent
        sideOffset={8}
        align={align}
        avoidCollisions={avoidCollisions}
        className={cn(
          'bg-background flex max-h-105 w-full flex-col gap-1 p-5 md:w-105',
          modal ? 'z-50' : 'z-40'
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
};

export const MobileView = ({
  children,
  open,
  handleOpenChange,
  title,
  trigger,
}: DynamicSheetPopoverProps) => {
  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger className="w-fit" asChild>
        {trigger}
      </DrawerTrigger>
      <DrawerContent fullScreen>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>

        {children}
      </DrawerContent>
    </Drawer>
  );
};

const DynamicSheetFooter = ({ children }: React.PropsWithChildren) => {
  return (
    <div className="bg-secondary sticky bottom-0 flex w-full gap-3 p-4 md:bg-transparent md:p-0 [&>*]:flex-1">
      {children}
    </div>
  );
};

DynamicSheetPopover.Footer = DynamicSheetFooter;
