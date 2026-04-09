import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useAccount as useCosmosWallet } from 'graz';
import { PlusIcon } from 'lucide-react';
import { useDebounceValue } from 'usehooks-ts';
import { useAccount as useEvmWallet } from 'wagmi';

import { useMemo } from 'react';

import Image from 'next/image';

import { useIsMobileView } from '@/hooks/use-is-mobile-view';

import { WalletIcon } from '@/components/icons/wallet';
import { Button } from '@/components/ui/button';

import { useConnectKitContext, useConnectKitModal } from '@/connect-kit';
import { cn, sliceAddress } from '@/lib/utils';
import { useWalletConnectStore } from '@/store/wallet-connect';

export const ConnectWalletButton = ({
  className,
  keepDesktopView = false,
}: {
  className?: string;
  keepDesktopView?: boolean;
}) => {
  const { setIsModalOpen } = useConnectKitModal();
  const { wallet: connectedSolanaWallet } = useSolanaWallet();
  const { connector: connectedEvmWallet } = useEvmWallet();
  const { walletType: _connectedCosmosWallet } = useCosmosWallet();
  const { walletsToShow: _walletsToShow } = useConnectKitContext();

  const { cosmos, evm, solana } = useWalletConnectStore();

  const connectedCosmosWallet = useMemo(() => {
    return _walletsToShow?.find(w => w.name === _connectedCosmosWallet);
  }, [_connectedCosmosWallet, _walletsToShow]);

  const [debouncedConnectedCosmosWallet] = useDebounceValue(
    connectedCosmosWallet,
    1000
  );

  const isConnected = useMemo(() => {
    return (
      connectedSolanaWallet?.adapter.connected ||
      connectedEvmWallet ||
      debouncedConnectedCosmosWallet
    );
  }, [
    connectedSolanaWallet?.adapter.connected,
    connectedEvmWallet,
    debouncedConnectedCosmosWallet,
  ]);

  const walletIcons = useMemo(() => {
    const icons: {
      icon: string | React.ReactNode;
      name: string;
    }[] = [];

    if (debouncedConnectedCosmosWallet) {
      icons.push({
        icon: debouncedConnectedCosmosWallet.icon,
        name: debouncedConnectedCosmosWallet.name,
      });
    }

    if (connectedEvmWallet) {
      icons.push({
        icon: connectedEvmWallet.icon,
        name: connectedEvmWallet.name,
      });
    }

    if (connectedSolanaWallet?.adapter.connected) {
      icons.push({
        icon: connectedSolanaWallet.adapter.icon,
        name: connectedSolanaWallet.adapter.name,
      });
    }

    // get unique icons by name, match names case insensitive
    const uniqueIcons: { icon: string | React.ReactNode; name: string }[] = [];

    icons.forEach(icon => {
      const lowerCaseName = icon.name.toLowerCase();
      if (uniqueIcons.find(t => t.name.toLowerCase() === lowerCaseName)) {
        return;
      }

      // Leap wallet has different names for different ecosystems
      if (
        lowerCaseName.includes('leap') &&
        uniqueIcons.find(t => t.name.toLowerCase().includes('leap'))
      ) {
        return;
      }

      uniqueIcons.push(icon);
    });

    return uniqueIcons;
  }, [
    connectedSolanaWallet?.adapter.connected,
    connectedEvmWallet,
    debouncedConnectedCosmosWallet,
  ]);

  const connectedWalletAddress = cosmos?.[0] || evm || solana;

  if (isConnected) {
    return (
      <button
        key="connected-wallet-button"
        className="bg-secondary hover:bg-secondary-dark text-disabled hover:text-foreground font-muted-foreground ml-auto flex cursor-pointer items-center gap-1 rounded-lg rounded-md px-3 py-2 transition-all hover:scale-105"
        onClick={() => setIsModalOpen(true)}
      >
        {walletIcons.map(({ icon, name }, index) => {
          if (typeof icon === 'string') {
            return (
              <Image
                key={`${name}-${index}`}
                src={icon}
                alt={name || 'wallet icon'}
                width={20}
                height={20}
                className="h-5 w-5 rounded-full"
              />
            );
          }

          return <span key={`${name}-${index}`}>{icon}</span>;
        })}

        {!!connectedWalletAddress && (
          <span className="ml-1">{sliceAddress(connectedWalletAddress)}</span>
        )}
      </button>
    );
  }

  return (
    <ConnectButton className={className} keepDesktopView={keepDesktopView} />
  );
};

const ConnectButton = ({
  className,
  keepDesktopView = false,
}: {
  className?: string;
  keepDesktopView: boolean;
}) => {
  const { setIsModalOpen, isModalOpen } = useConnectKitModal();
  const isMobile = useIsMobileView();

  if (isMobile && !keepDesktopView) {
    return (
      <Button
        size="icon"
        variant="secondary"
        className={cn(
          'bg-primary hover:bg-primary ml-auto rounded-full transition-all hover:scale-105',
          className
        )}
        onClick={() => setIsModalOpen(true)}
        key="connect-wallet-button-mobile"
      >
        <WalletIcon className="text-primary-foreground size-5" />
      </Button>
    );
  }

  return (
    <Button
      variant="mono"
      className={cn(
        'text-md bg-secondary hover:bg-secondary text-foreground ml-auto rounded-sm px-4 py-3 transition-all hover:scale-105',
        className
      )}
      onClick={() => setIsModalOpen(true)}
      key="connect-wallet-button-desktop"
    >
      {isModalOpen ? 'Requesting...' : 'Connect Wallet'}
    </Button>
  );
};

export const ConnectButtonFull = ({
  buttonProps,
  label = 'Connect Wallet',
}: {
  buttonProps?: React.ComponentProps<typeof Button>;
  label?: string;
}) => {
  const { setIsModalOpen } = useConnectKitModal();

  return (
    <Button {...buttonProps} onClick={() => setIsModalOpen(true)}>
      {label}
    </Button>
  );
};
