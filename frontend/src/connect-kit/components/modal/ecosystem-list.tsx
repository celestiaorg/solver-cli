import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useAccount as useCosmosWallet } from 'graz';
import { useAccount as useEvmWallet } from 'wagmi';

import { useMemo } from 'react';

import Image from 'next/image';

import { useIsMobileDevice } from '@/hooks/use-is-mobile-device';
import { useTabIndicatorPosition } from '@/hooks/use-tab-indicator-pos';

import { cn } from '@/lib/utils';

import { useConnectKitContext } from '../../contexts/connect-kit';
import { WalletEcosystem, walletEcosystems } from './ecosystems';

export const useEcosystemList = () => {
  const { wallet: connectedSolanaWallet } = useSolanaWallet();
  const { connector: connectedEvmWallet } = useEvmWallet();
  const { walletType: _connectedCosmosWallet } = useCosmosWallet();
  const { walletsToShow: _walletsToShow } = useConnectKitContext();

  const connectedCosmosWallet = useMemo(() => {
    return _walletsToShow?.find(w => w.name === _connectedCosmosWallet);
  }, [_connectedCosmosWallet, _walletsToShow]);

  const ecosystems = useMemo(() => {
    return walletEcosystems.map(ecosystem => {
      let connected = false;
      if (ecosystem.name === 'EVM') {
        connected = !!connectedEvmWallet;
      } else if (ecosystem.name === 'Cosmos') {
        connected = !!connectedCosmosWallet;
      } else if (ecosystem.name === 'Solana') {
        connected = !!connectedSolanaWallet?.adapter.connected;
      }
      return {
        ...ecosystem,
        connected,
      };
    });
  }, [
    connectedSolanaWallet?.adapter.connected,
    connectedEvmWallet,
    connectedCosmosWallet,
  ]);

  const ecosystemsMap = useMemo(() => {
    return ecosystems.reduce(
      (acc, ecosystem) => {
        acc[ecosystem.ecosystem] = ecosystem.connected;
        return acc;
      },
      {} as Record<WalletEcosystem, boolean>
    );
  }, [ecosystems]);

  return { ecosystems, ecosystemsMap };
};

type EcosystemListProps = {
  activeEcosystem: (typeof walletEcosystems)[number];
  setActiveEcosystem: (ecosystem: (typeof walletEcosystems)[number]) => void;
};

export const EcosystemList = (props: EcosystemListProps) => {
  const isMobile = useIsMobileDevice();

  return isMobile ? (
    <EcosystemListMobile {...props} />
  ) : (
    <EcosystemListDesktop {...props} />
  );
};

const EcosystemListDesktop = (props: EcosystemListProps) => {
  const { ecosystems } = useEcosystemList();

  return (
    <div className="relative mx-6 flex justify-start gap-2 md:mx-0">
      {ecosystems.map(ecosystem => (
        <button
          key={ecosystem.name}
          onClick={() => props.setActiveEcosystem(ecosystem)}
          className={cn(
            'text-muted-foreground border-muted-foreground flex cursor-pointer flex-row items-center justify-start gap-3 rounded-4xl border-1 px-4 py-2 text-sm font-bold transition-colors',
            ecosystem.name === props.activeEcosystem.name
              ? 'bg-secondary border-white'
              : 'hover:bg-secondary/80 bg-transparent'
          )}
        >
          <span
            className={cn(
              ecosystem.name === props.activeEcosystem.name
                ? 'text-foreground'
                : 'text-muted-foreground'
            )}
          >
            {ecosystem.name}
          </span>
          {ecosystem.connected && (
            <div className="bg-primary ml-auto size-2 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
};

const EcosystemListMobile = (props: EcosystemListProps) => {
  const { ecosystems } = useEcosystemList();
  const { containerRef, childRefs, indicatorRef } = useTabIndicatorPosition({
    navItems: ecosystems,
    activeId: props.activeEcosystem.id,
  });

  return (
    <div className="overflow-auto border-b px-6">
      <div className="relative flex gap-6" ref={containerRef}>
        {ecosystems.map((ecosystem, index) => (
          <button
            ref={ref => {
              childRefs.current.set(index, ref);
            }}
            key={ecosystem.name}
            onClick={() => props.setActiveEcosystem(ecosystem)}
            className={cn(
              'text-muted-foreground flex shrink-0 flex-row items-center justify-start gap-3 rounded-lg pb-4 text-sm font-semibold whitespace-nowrap',
              'transition-colors',
              ecosystem.name === props.activeEcosystem.name
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {ecosystem.name}
          </button>
        ))}
        <div
          ref={indicatorRef}
          className="md:bg-foreground bg-primary-foreground absolute bottom-0 h-0.5 w-full origin-left"
        />
      </div>
    </div>
  );
};
