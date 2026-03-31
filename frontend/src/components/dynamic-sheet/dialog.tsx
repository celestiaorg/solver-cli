'use client';

import { useIsMobileView } from '@/hooks/use-is-mobile-view';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

import { cn } from '@/lib/utils';

export type DynamicSheetDialogProps = React.PropsWithChildren<{
  title?: React.ReactNode;
  trigger?: React.ReactNode;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  showCloseIcon?: boolean;
  sheetClassName?: string;
  dialogClassName?: string;
  fullScreen?: boolean;
}>;

export const DynamicSheetDialog = (props: DynamicSheetDialogProps) => {
  const isMobile = useIsMobileView();

  return isMobile ? <MobileView {...props} /> : <DesktopView {...props} />;
};

export const DesktopView = ({
  children,
  open,
  onOpenChange,
  trigger,
  title,
  showCloseIcon,
  dialogClassName,
}: DynamicSheetDialogProps) => {
  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <DialogTrigger className="w-fit" asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent
        showCloseIcon={showCloseIcon}
        className={cn(
          'bg-background flex w-full flex-col gap-1 p-5',
          dialogClassName
        )}
      >
        {title && (
          <DialogHeader>
            <DialogTitle className="text-center text-xl">{title}</DialogTitle>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
};

export const MobileView = ({
  children,
  open,
  onOpenChange,
  title,
  trigger,
  showCloseIcon,
  fullScreen,
  sheetClassName,
}: DynamicSheetDialogProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger className="w-fit" asChild>
        {trigger}
      </DrawerTrigger>
      <DrawerContent fullScreen={fullScreen} className={cn(sheetClassName)}>
        {!!title && (
          <DrawerHeader showCloseIcon={showCloseIcon}>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
        )}
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

DynamicSheetDialog.Footer = DynamicSheetFooter;
