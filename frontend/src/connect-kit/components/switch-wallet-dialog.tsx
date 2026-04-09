'use client';

import {
  Wallet as SolanaWallet,
  useWallet as useSolanaWallet,
} from '@solana/wallet-adapter-react';
import { ArrowRight } from 'lucide-react';
import { Connector, useConnect, useDisconnect } from 'wagmi';

import { useCallback, useMemo } from 'react';

import Image from 'next/image';

import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

import {
  useConnectKitContext,
  WalletDataWithAvailability,
} from '../contexts/connect-kit';
import { connectCosmosWallet } from '../core/cosmos';
import { connectEvmWallet, disconnectEvmWallet } from '../core/evm';
import { connectSolanaWallet, disconnectSolanaWallet } from '../core/solana';
import { IsConnectingWallet } from './connecting-wallet-dialog';

export type IsSwitchingWallet =
  | {
      isSwitching: true;
      params:
        | {
            ecosystem: 'EVM';
            fromWallet: Connector;
            toWallet: Connector;
          }
        | {
            ecosystem: 'Cosmos';
            fromWallet: WalletDataWithAvailability;
            toWallet: WalletDataWithAvailability;
          }
        | {
            ecosystem: 'Solana';
            fromWallet: SolanaWallet;
            toWallet: SolanaWallet;
          };
    }
  | {
      isSwitching: false;
    };

export const SwitchWalletDialog = ({
  className,
  isSwitchingWallet,
  setIsSwitchingWallet,
  setIsConnectingWallet,
}: {
  className?: string;
  isSwitchingWallet: Extract<IsSwitchingWallet, { isSwitching: true }>;
  setIsSwitchingWallet: (isSwitchingWallet: IsSwitchingWallet) => void;
  setIsConnectingWallet: (isConnectingWallet: IsConnectingWallet) => void;
}) => {
  const { params } = isSwitchingWallet;

  const { connectAsync: connectEvm } = useConnect();
  const { disconnectAsync: disconnectEvm } = useDisconnect();
  const { select: selectSolana, disconnect: disconnectSolana } =
    useSolanaWallet();
  const {
    chainId: cosmosChainId,
    connect: { connectAsync: connectCosmos },
  } = useConnectKitContext();

  const {
    ecosystem,
    fromWalletName,
    fromWalletIcon,
    toWalletName,
    toWalletIcon,
  } = useMemo(() => {
    switch (params.ecosystem) {
      case 'EVM': {
        return {
          ecosystem: params.ecosystem,
          fromWalletName: params.fromWallet.name,
          fromWalletIcon: params.fromWallet.icon ?? '',
          toWalletName: params.toWallet.name,
          toWalletIcon: params.toWallet.icon ?? '',
        };
      }
      case 'Cosmos': {
        return {
          ecosystem: params.ecosystem,
          fromWalletName: params.fromWallet.prettyName,
          fromWalletIcon: params.fromWallet.icon ?? '',
          toWalletName: params.toWallet.prettyName,
          toWalletIcon: params.toWallet.icon ?? '',
        };
      }
      case 'Solana': {
        return {
          ecosystem: params.ecosystem,
          fromWalletName: params.fromWallet.adapter.name,
          fromWalletIcon: params.fromWallet.adapter.icon ?? '',
          toWalletName: params.toWallet.adapter.name,
          toWalletIcon: params.toWallet.adapter.icon ?? '',
        };
      }
    }
  }, [params]);

  const onClickSwitchWallet = useCallback(async () => {
    switch (params.ecosystem) {
      case 'EVM': {
        const { toWallet, fromWallet } = params;
        setIsSwitchingWallet({ isSwitching: false });
        await disconnectEvmWallet(fromWallet, disconnectEvm);
        setIsConnectingWallet({
          isConnecting: true,
          params: {
            walletIcon: toWallet.icon ?? '',
            walletName: toWallet.name,
          },
        });
        await connectEvmWallet(toWallet, connectEvm);
        setIsConnectingWallet({ isConnecting: false });
        break;
      }
      case 'Cosmos': {
        const { toWallet } = params;
        setIsSwitchingWallet({ isSwitching: false });
        setIsConnectingWallet({
          isConnecting: true,
          params: {
            walletIcon: toWallet.icon ?? '',
            walletName: toWallet.name,
          },
        });
        await connectCosmosWallet(toWallet, connectCosmos, cosmosChainId);
        setIsConnectingWallet({ isConnecting: false });
        break;
      }
      case 'Solana': {
        const { toWallet } = params;
        setIsSwitchingWallet({ isSwitching: false });
        setIsConnectingWallet({
          isConnecting: true,
          params: {
            walletIcon: toWallet.adapter.icon ?? '',
            walletName: toWallet.adapter.name,
          },
        });
        await disconnectSolanaWallet(disconnectSolana);
        await connectSolanaWallet(toWallet, selectSolana);
        setIsConnectingWallet({ isConnecting: false });
        break;
      }
    }
  }, [
    params,
    setIsSwitchingWallet,
    setIsConnectingWallet,
    connectEvm,
    disconnectEvm,
    connectCosmos,
    cosmosChainId,
    disconnectSolana,
    selectSolana,
  ]);

  return (
    <div className={cn('flex flex-col items-center gap-8', className)}>
      <div className="flex flex-col items-center gap-4">
        <div className="flex max-w-80 flex-col items-center gap-2">
          <p className="text-foreground text-xl font-bold">Change Wallets</p>
          <p className="text-muted-foreground text-center text-xs font-medium">
            Switch from {fromWalletName} to {toWalletName} for {ecosystem}-based
            networks.
          </p>
        </div>
        <div className="flex flex-row items-center gap-4">
          <Image
            src={fromWalletIcon}
            alt={fromWalletName}
            width={72}
            height={72}
            className="rounded-md"
          />
          <ArrowRight className="text-disabled size-8" />
          <Image
            src={toWalletIcon}
            alt={toWalletName}
            width={72}
            height={72}
            className="rounded-md"
          />
        </div>
      </div>
      <Button
        className="text-md h-12 w-full rounded-full font-bold text-black transition-all hover:scale-105 hover:bg-gray-100"
        onClick={onClickSwitchWallet}
      >
        Switch Wallet
      </Button>
    </div>
  );
};
