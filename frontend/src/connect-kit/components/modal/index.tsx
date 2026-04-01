'use client';

import { ChevronLeft, XIcon } from 'lucide-react';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useIsMobileView } from '@/hooks/use-is-mobile-view';

import { DynamicSheetDialog } from '@/components/dynamic-sheet/dialog';
import { SearchIcon } from '@/components/icons/search';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { cn } from '@/lib/utils';
import { dappBrowserName } from '@/utils/dapp-detect';

import {
  ConnectingWalletDialog,
  IsConnectingWallet,
} from '../connecting-wallet-dialog';
import {
  IsSelectingEcosystem,
  SelectEcosystemDialog,
} from '../select-ecosystem-dialog';
import { IsSwitchingWallet, SwitchWalletDialog } from '../switch-wallet-dialog';
import { EcosystemList } from './ecosystem-list';
import { walletEcosystems } from './ecosystems';
import { EcosystemWallets } from './wallet-list';

type WalletListViewProps = {
  setMainOpen: (open: boolean) => void;
  setIsSwitchingWallet: (isSwitchingWallet: IsSwitchingWallet) => void;
  setIsConnectingWallet: (isConnectingWallet: IsConnectingWallet) => void;
  setIsSelectingEcosystem: (isSelectingEcosystem: IsSelectingEcosystem) => void;
};

const WalletListView = ({
  setMainOpen,
  setIsSwitchingWallet,
  setIsConnectingWallet,
  setIsSelectingEcosystem,
}: WalletListViewProps) => {
  const [activeEcosystem, setActiveEcosystem] = useState(walletEcosystems[0]);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex w-full flex-1 flex-col gap-7 overflow-y-hidden">
      {/* Search Bar */}
      <Input
        placeholder="Search by wallet name"
        className="focus-within:border-foreground bg-secondary text-foreground-2 m-6 mb-0 h-12 w-auto shrink-0 ring-0 focus-within:ring-0 md:m-0"
        trailingElement={
          <SearchIcon className="text-muted-foreground size-5" />
        }
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
      />

      {/* Wallets */}
      <div className="flex w-full flex-1 flex-col gap-8 overflow-y-hidden">
        <EcosystemList
          activeEcosystem={activeEcosystem}
          setActiveEcosystem={setActiveEcosystem}
        />

        <div className="no-scrollbar mx-6 flex-1 overflow-y-auto pb-6 md:mx-0 md:pb-0">
          <EcosystemWallets
            activeEcosystem={activeEcosystem}
            searchQuery={searchQuery}
            setIsSwitchingWallet={isSwitchingWallet => {
              setIsSwitchingWallet(isSwitchingWallet);
              setIsSelectingEcosystem({ isSelectingEcosystem: false });
              setIsConnectingWallet({ isConnecting: false });
              setMainOpen(false);
            }}
            setIsConnectingWallet={isConnectingWallet => {
              setIsConnectingWallet(isConnectingWallet);
              setIsSelectingEcosystem({ isSelectingEcosystem: false });
              setIsSwitchingWallet({ isSwitching: false });
              setMainOpen(false);
            }}
            setIsSelectingEcosystem={isSelectingEcosystem => {
              setIsSelectingEcosystem(isSelectingEcosystem);
              setIsSwitchingWallet({ isSwitching: false });
              setIsConnectingWallet({ isConnecting: false });
              setMainOpen(false);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export const Modal = (props: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) => {
  const [isSwitchingWallet, setIsSwitchingWallet] = useState<IsSwitchingWallet>(
    {
      isSwitching: false,
    }
  );
  const [isConnectingWallet, _setIsConnectingWallet] =
    useState<IsConnectingWallet>({
      isConnecting: false,
    });
  const [isSelectingEcosystem, setIsSelectingEcosystem] =
    useState<IsSelectingEcosystem>({
      isSelectingEcosystem: false,
    });

  const isConnectingTimeout = useRef<NodeJS.Timeout | null>(null);

  const setIsConnectingWallet = useCallback(
    (isConnectingWallet: IsConnectingWallet) => {
      if (isConnectingWallet.isConnecting) {
        isConnectingTimeout.current = setTimeout(() => {
          _setIsConnectingWallet(isConnectingWallet);
        }, 200);
      } else {
        if (isConnectingTimeout.current) {
          clearTimeout(isConnectingTimeout.current);
        }
        _setIsConnectingWallet(isConnectingWallet);
      }
    },
    [_setIsConnectingWallet]
  );

  const onOpenChangeSwitchingWallet = useCallback((open: boolean) => {
    if (!open) {
      setIsSwitchingWallet({ isSwitching: false });
    }
  }, []);

  const onOpenChangeConnectingWallet = useCallback(
    (open: boolean) => {
      if (!open) {
        setIsConnectingWallet({ isConnecting: false });
      }
    },
    [setIsConnectingWallet]
  );

  const onOpenChangeSelectingEcosystem = (open: boolean) => {
    if (!open) {
      setIsSelectingEcosystem({ isSelectingEcosystem: false });
    }
  };

  const isMobileDevice = useIsMobileView();

  useEffect(() => {
    // for mobile dapp browser, when wallet connect is triggered,
    // we will close the main modal with the list of wallet
    // then open the ecosystem dialog with the list of wallets supported by the dapp browser
    if (!props.isOpen || !dappBrowserName) return;

    props.setIsOpen(false);
    setIsSelectingEcosystem({
      isSelectingEcosystem: true,
      params: {
        name: dappBrowserName,
      },
    });
  }, [props]);

  return (
    <>
      <DynamicSheetDialog
        fullScreen
        showCloseIcon={isMobileDevice}
        open={props.isOpen}
        onOpenChange={props.setIsOpen}
        dialogClassName="h-146 md:max-w-122 gap-7 p-8 h-auto max-h-[calc(100vh-5rem)] border-secondary"
        sheetClassName="bg-background"
        title={
          <div className="relative flex w-full grow-0 flex-row items-center justify-between">
            <DialogTitle className="flex-1 text-center text-xl font-bold">
              Connect your wallets
            </DialogTitle>
            <DialogClose className="absolute left-0">
              <Button
                variant="secondary"
                className="bg-secondary text-foreground hover:bg-muted-foreground absolute -top-4 size-8 md:static"
                size="icon"
              >
                <ChevronLeft />
              </Button>
            </DialogClose>
          </div>
        }
      >
        <WalletListView
          setMainOpen={props.setIsOpen}
          setIsSwitchingWallet={setIsSwitchingWallet}
          setIsConnectingWallet={setIsConnectingWallet}
          setIsSelectingEcosystem={setIsSelectingEcosystem}
        />
      </DynamicSheetDialog>

      <DynamicSheetDialog
        showCloseIcon={isMobileDevice}
        open={isSwitchingWallet.isSwitching}
        onOpenChange={onOpenChangeSwitchingWallet}
        sheetClassName="p-7"
        dialogClassName="p-8 pb-12 pt-0 gap-0 max-w-lg border-secondary"
      >
        <CommonDialogHeader
          className="my-0 md:mt-8 md:mb-6"
          onBack={() => {
            props.setIsOpen(true);
            setIsSwitchingWallet({ isSwitching: false });
          }}
        />

        {isSwitchingWallet.isSwitching ? (
          <SwitchWalletDialog
            isSwitchingWallet={isSwitchingWallet}
            setIsSwitchingWallet={setIsSwitchingWallet}
            setIsConnectingWallet={setIsConnectingWallet}
          />
        ) : null}
      </DynamicSheetDialog>

      <DynamicSheetDialog
        showCloseIcon={isMobileDevice}
        open={isConnectingWallet.isConnecting}
        onOpenChange={onOpenChangeConnectingWallet}
        sheetClassName="p-7"
        dialogClassName="p-8 pb-12 pt-0 gap-0 max-w-lg border-secondary"
      >
        <CommonDialogHeader
          className="my-0 md:mt-8 md:mb-6"
          onBack={() => {
            props.setIsOpen(true);
            setIsConnectingWallet({ isConnecting: false });
          }}
        />

        {isConnectingWallet.isConnecting ? (
          <ConnectingWalletDialog isConnectingWallet={isConnectingWallet} />
        ) : null}
      </DynamicSheetDialog>

      <DynamicSheetDialog
        fullScreen
        showCloseIcon={false}
        open={isSelectingEcosystem.isSelectingEcosystem}
        onOpenChange={onOpenChangeSelectingEcosystem}
        dialogClassName="gap-0 p-0 md:max-w-110 border-secondary"
        title={
          <CommonDialogHeader
            className="md:mx-8 md:mt-8 md:mb-8"
            onBack={() => {
              props.setIsOpen(true);
              setIsSelectingEcosystem({ isSelectingEcosystem: false });
            }}
          >
            <span className="text-xl font-bold">Select ecosystem</span>
          </CommonDialogHeader>
        }
      >
        {isSelectingEcosystem.isSelectingEcosystem ? (
          <SelectEcosystemDialog
            className="p-5 md:p-6 md:pt-0"
            setIsSelectingEcosystem={setIsSelectingEcosystem}
            setIsConnectingWallet={setIsConnectingWallet}
            isSelectingEcosystem={isSelectingEcosystem}
          />
        ) : null}
      </DynamicSheetDialog>
    </>
  );
};

const CommonDialogHeader = ({
  children,
  className,
  onBack,
}: {
  children?: React.ReactNode;
  className?: string;
  onBack?: () => void;
}) => {
  return (
    <header
      className={cn(
        'relative flex flex-row items-center justify-between',
        className
      )}
    >
      <Button
        onClick={onBack}
        variant="secondary"
        className="bg-secondary text-foreground hover:bg-muted-foreground size-8"
        size="icon"
      >
        <ChevronLeft />
      </Button>

      {children}

      <DialogClose asChild>
        <Button
          variant="secondary"
          className="bg-secondary text-foreground hover:bg-muted-foreground size-8"
          size="icon"
        >
          <XIcon />
        </Button>
      </DialogClose>
    </header>
  );
};
