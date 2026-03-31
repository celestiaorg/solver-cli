'use client';

import { Info } from '@phosphor-icons/react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useAccount as useCosmosWallet } from 'graz';
import {
  useAccount as useEvmWallet,
  useConnect as useWagmiConnect,
  useDisconnect as useWagmiDisconnect,
} from 'wagmi';

import { useCallback, useMemo, useState } from 'react';

import Image from 'next/image';

import { useEcosystemWallets } from '@/hooks/use-ecosystem-wallets';

import { NextArrowIcon } from '@/components/icons/arrow';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

import { cn, sleep } from '@/lib/utils';
import { dappBrowserName } from '@/utils/dapp-detect';

import { useConnectKitContext } from '../contexts/connect-kit';
import { connectCosmosWallet } from '../core/cosmos';
import { connectEvmWallet, disconnectEvmWallet } from '../core/evm';
import { connectSolanaWallet, disconnectSolanaWallet } from '../core/solana';
import { WalletWithEcosystem } from './all-wallets';
import { ConnectedMobile } from './connected-mobile';
import { IsConnectingWallet } from './connecting-wallet-dialog';
import { useEcosystemList } from './modal/ecosystem-list';
import { WalletEcosystem, walletEcosystems } from './modal/ecosystems';
import { useDisconnect } from './use-disconnect';

export type IsSelectingEcosystem =
  | {
      isSelectingEcosystem: true;
      params: {
        wallets: WalletWithEcosystem[];
      };
    }
  | {
      isSelectingEcosystem: true;
      params: {
        name: string;
      };
    }
  | {
      isSelectingEcosystem: false;
    };

type SwitchingEcosystem = {
  from: {
    icon?: string;
    name: string;
  };
  to: {
    icon?: string;
    name: string;
  };
};

export const SelectEcosystemDialog = ({
  className,
  isSelectingEcosystem,
  setIsSelectingEcosystem,
  setIsConnectingWallet,
}: {
  className?: string;
  isSelectingEcosystem: Extract<
    IsSelectingEcosystem,
    { isSelectingEcosystem: true }
  >;
  setIsSelectingEcosystem: (isSelectingEcosystem: IsSelectingEcosystem) => void;
  setIsConnectingWallet: (isConnectingWallet: IsConnectingWallet) => void;
}) => {
  const params = isSelectingEcosystem.params;
  const { installedWallets } = useEcosystemWallets();

  const wallets = useMemo(() => {
    if ('wallets' in params) {
      return params.wallets;
    }

    if ('name' in params) {
      return (
        installedWallets.find(wallet =>
          wallet.some(w => w.name === params.name)
        ) || []
      );
    }

    return [];
  }, [params, installedWallets]);

  const displayName = wallets[0].name;
  const [selectedEcosystems, setSelectedEcosystems] = useState<
    WalletWithEcosystem[]
  >(wallets ?? []);
  const {
    chainId: cosmosChainId,
    connect: { connectAsync: cosmosConnect },
  } = useConnectKitContext();
  const { connectAsync: evmConnect } = useWagmiConnect();
  const { disconnectAsync: disconnectEvm } = useWagmiDisconnect();
  const { select: solanaSelect, disconnect: solanaDisconnect } =
    useSolanaWallet();

  const { ecosystemsMap } = useEcosystemList();

  const { wallet: connectedSolanaWallet } = useSolanaWallet();
  const { connector: connectedEvmWallet } = useEvmWallet();

  const { walletType: _connectedCosmosWallet } = useCosmosWallet();
  const { walletsToShow: _walletsToShow } = useConnectKitContext();

  const connectedCosmosWallet = useMemo(() => {
    return _walletsToShow?.find(w => w.name === _connectedCosmosWallet);
  }, [_connectedCosmosWallet, _walletsToShow]);

  const { icon, name: walletName } = useMemo(() => {
    let icon = '';
    let name = '';
    for (const wallet of wallets) {
      const { ecosystem, wallet: walletData } = wallet;

      switch (ecosystem) {
        case 'solana': {
          if (!icon) {
            icon = walletData.adapter.icon;
            name = walletData.adapter.name;
          }
          break;
        }
        case 'cosmos': {
          if (!icon) {
            icon = walletData.icon;
            name = walletData.name;
          }
          break;
        }
        case 'evm': {
          if (!icon) {
            icon = walletData.icon ?? '';
            name = walletData.name;
          }
          break;
        }
      }
    }
    return {
      icon: icon ?? '',
      name,
    };
  }, [wallets]);

  const { ecosystems, allEcosystemsConnected } = useMemo(() => {
    const ecosystems = wallets.map(wallet => {
      return walletEcosystems.find(
        ecosystem => ecosystem.ecosystem === wallet.ecosystem
      );
    });

    const connectedEcosystemCount = ecosystems.filter(
      ecosystem => ecosystem?.ecosystem && ecosystemsMap[ecosystem?.ecosystem]
    ).length;

    const displayEcosystems = [
      ...(dappBrowserName
        ? connectedEcosystemCount <= ecosystems.length - 2
          ? [{ ecosystem: 'all', name: 'Select All', icon: '/misc/grid.svg' }]
          : []
        : [{ ecosystem: 'all', name: 'Select All', icon: '/misc/grid.svg' }]),
      ...ecosystems
        .filter(ecosystem => ecosystem !== undefined)
        .map(ecosystem => {
          let switching: SwitchingEcosystem | null = null;

          if (ecosystem.ecosystem === 'evm' && connectedEvmWallet?.name) {
            switching = {
              from: {
                icon: connectedEvmWallet.icon,
                name: connectedEvmWallet.name,
              },
              to: {
                icon: icon,
                name: walletName,
              },
            };
          }

          if (
            ecosystem.ecosystem === 'solana' &&
            connectedSolanaWallet?.adapter?.connected
          ) {
            switching = {
              from: {
                icon: connectedSolanaWallet.adapter.icon,
                name: connectedSolanaWallet.adapter.name,
              },
              to: {
                icon: icon,
                name: walletName,
              },
            };
          }

          if (ecosystem.ecosystem === 'cosmos' && connectedCosmosWallet?.name) {
            switching = {
              from: {
                icon: connectedCosmosWallet.icon,
                name: connectedCosmosWallet.name,
              },
              to: {
                icon: icon,
                name: walletName,
              },
            };
          }
          return {
            ...ecosystem,
            switching,
          };
        }),
    ];

    const allEcosystemsConnected =
      connectedEcosystemCount === ecosystems.length;

    return { ecosystems: displayEcosystems, allEcosystemsConnected };
  }, [
    wallets,
    ecosystemsMap,
    connectedEvmWallet,
    connectedSolanaWallet,
    connectedCosmosWallet,
    walletName,
    icon,
  ]);

  const handleConnect = useCallback(async () => {
    // for dapp browsers, we only connect to the ecosystems that are not already connected
    const ecosystemsToConnect = dappBrowserName
      ? selectedEcosystems.filter(
          ecosystem => !ecosystemsMap[ecosystem.ecosystem as WalletEcosystem]
        )
      : selectedEcosystems;

    if (ecosystemsToConnect.length === 0) {
      return;
    }

    setIsSelectingEcosystem({ isSelectingEcosystem: false });
    setIsConnectingWallet({
      isConnecting: true,
      params: {
        walletIcon: icon,
        walletName: displayName,
      },
    });

    const sortedEcosystems = ecosystemsToConnect;
    for await (const wallet of sortedEcosystems) {
      switch (wallet.ecosystem) {
        case 'evm': {
          if (connectedEvmWallet) {
            await disconnectEvmWallet(connectedEvmWallet, disconnectEvm);
          }
          await connectEvmWallet(wallet.wallet, evmConnect);
          break;
        }
        case 'solana':
          await sleep(100);
          if (connectedSolanaWallet?.adapter.connected) {
            await disconnectSolanaWallet(solanaDisconnect);
          }
          await connectSolanaWallet(wallet.wallet, solanaSelect);
          break;
        case 'cosmos':
          await connectCosmosWallet(
            wallet.wallet,
            cosmosConnect,
            cosmosChainId
          );
          break;
      }
    }
    setIsConnectingWallet({ isConnecting: false });
  }, [
    selectedEcosystems,
    setIsSelectingEcosystem,
    setIsConnectingWallet,
    icon,
    displayName,
    ecosystemsMap,
    disconnectEvm,
    connectedEvmWallet,
    evmConnect,
    solanaDisconnect,
    solanaSelect,
    cosmosConnect,
    cosmosChainId,
  ]);

  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center gap-6',
        className
      )}
    >
      <p className="text-muted-foreground text-center text-sm font-medium">
        {displayName} can connect to multiple types of networks
      </p>
      <div className="flex w-full flex-col items-center justify-center gap-4">
        {ecosystems.map(ecosystem => {
          let isSelected = false;
          if (ecosystem.ecosystem === 'all') {
            isSelected = selectedEcosystems.length === wallets.length;
          } else {
            isSelected = !!selectedEcosystems.find(
              selectedEcosystem =>
                selectedEcosystem.ecosystem === ecosystem.ecosystem
            );
          }

          const isDappConnected =
            !!dappBrowserName &&
            ecosystemsMap[ecosystem.ecosystem as WalletEcosystem];

          return (
            <SelectEcosystemItem
              key={ecosystem.ecosystem}
              isDappConnected={isDappConnected}
              ecosystem={ecosystem}
              isSelected={isSelected}
              setSelectedEcosystems={setSelectedEcosystems}
              wallets={wallets}
              switching={'switching' in ecosystem ? ecosystem.switching : null}
            />
          );
        })}
      </div>

      {!(dappBrowserName && allEcosystemsConnected) && (
        <Button
          className="text-md text-primary-foreground mx-1.5 mt-auto mb-1.5 h-13 w-full rounded-full px-4 py-3 font-bold transition-all hover:scale-105"
          onClick={handleConnect}
          disabled={selectedEcosystems.length === 0}
        >
          Connect Wallet
        </Button>
      )}
    </div>
  );
};

const SelectEcosystemItem = ({
  ecosystem,
  isSelected,
  setSelectedEcosystems,
  wallets,
  isDappConnected,
  switching,
}: {
  isSelected: boolean;
  wallets: WalletWithEcosystem[];
  ecosystem: { ecosystem: string; name: string; icon: string };
  setSelectedEcosystems: React.Dispatch<
    React.SetStateAction<WalletWithEcosystem[]>
  >;
  isDappConnected: boolean;
  switching: SwitchingEcosystem | null;
}) => {
  const disconnectWallet = useDisconnect(
    ecosystem.ecosystem as WalletEcosystem
  );

  return (
    <div className="hover:bg-secondary group flex w-full flex-col gap-3 rounded-lg p-4">
      <label
        className={cn(
          'flex w-full cursor-pointer flex-row items-center justify-between gap-3 transition-colors',
          isDappConnected && '-order-1'
        )}
        onClick={e => {
          if (isDappConnected) {
            e.preventDefault();
            e.stopPropagation();
            disconnectWallet();
          }
        }}
      >
        <div className="flex flex-row items-center justify-center gap-3">
          <Image
            src={ecosystem.icon}
            alt={ecosystem.name}
            className="rounded-full"
            width={28}
            height={28}
          />

          <div className="flex flex-col">
            <span className="text-foreground text-md font-bold">
              {ecosystem.name}
            </span>
          </div>
        </div>

        {isDappConnected ? (
          <ConnectedMobile />
        ) : (
          <Checkbox
            className="text-primary-foreground size-5"
            checked={isSelected}
            onCheckedChange={checked => {
              if (ecosystem.ecosystem === 'all') {
                setSelectedEcosystems(checked ? wallets : []);
                return;
              }
              if (!checked) {
                setSelectedEcosystems(prev =>
                  prev.filter(
                    selectedEcosystem =>
                      selectedEcosystem.ecosystem !== ecosystem.ecosystem
                  )
                );
                return;
              }

              const wallet = wallets.find(
                wallet => wallet.ecosystem === ecosystem.ecosystem
              );
              if (wallet) {
                setSelectedEcosystems(prev => [...prev, wallet]);
              }
            }}
          />
        )}
      </label>

      {!dappBrowserName && switching && (
        <SwitchingWallet switching={switching} />
      )}
    </div>
  );
};

const SwitchingWallet = ({ switching }: { switching: SwitchingEcosystem }) => {
  return (
    <div className="bg-border group-hover:bg-secondary-dark rounded-md2 flex items-center justify-between p-3 select-none">
      <div className="text-muted-foreground flex flex-row items-center gap-2">
        <Info weight="fill" size={16} />
        <span className="max-w-[12rem] truncate text-xs">
          <span className="hidden md:block">
            Disconnects {switching.from.name} for {switching.to.name}
          </span>
          <span className="block md:hidden">
            Disconnects {switching.from.name}
          </span>
        </span>
      </div>

      <div className="ml-auto flex flex-row items-center justify-center gap-1">
        <Image
          className="size-5 rounded-full object-cover"
          width={20}
          height={20}
          src={switching.from.icon || ''}
          alt={switching.from.name}
        />
        <NextArrowIcon className="size-5" />
        <Image
          className="size-5 rounded-full object-cover"
          width={20}
          height={20}
          src={switching.to.icon || ''}
          alt={switching.to.name}
        />
      </div>
    </div>
  );
};
