import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import {
  getAvailableWallets,
  useAccount as useCosmosAccount,
  useDisconnect,
  useConnect as useGrazConnect,
  WalletType,
} from 'graz';
import { useAccount as useWagmiAccount } from 'wagmi';

import { useEffect, useMemo, useState } from 'react';

import { useWalletConnectStore } from '@/store/wallet-connect';

import { ConnectKitContext, type ConnectKitContextConfigValue } from '.';
import { WalletDataWithAvailability } from '.';
import { Modal } from '../../components/modal';
import {
  checkUAIsCosmostationDappBrowser,
  checkUAIsDappBrowser,
  checkUAIsKeplrDappBrowser,
  checkUAIsLeapDappBrowser,
  checkUAIsMobile,
  mobileWallets,
  wcMobileWallets,
} from '../../utils';
import { walletData } from '../../wallet-data';

const isWarned = false;
export const ConnectKitProvider: React.FC<
  React.PropsWithChildren<ConnectKitContextConfigValue>
> = ({ children, chainId, multiChainConnect, wallets }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { address: evmAddress } = useWagmiAccount();
  const { wallet: svmWallet } = useSolanaWallet();

  const { setAddress, cosmos } = useWalletConnectStore();

  const { data: cosmosAccount } = useCosmosAccount({
    multiChain: true,
    onConnect: ({ accounts }) => {
      setAddress({
        chain: 'cosmos',
        address: accounts
          ? Object.fromEntries(
              Object.entries(accounts)
                .map(([chainId, key]) =>
                  key ? [chainId, key.bech32Address] : null
                )
                .filter(a => a !== null)
            )
          : null,
      });
    },
    onDisconnect: () => {
      setAddress({
        chain: 'cosmos',
        address: null,
      });
    },
  });

  // this will set the address when the page is loaded
  // onConnect will not be called if the page is loaded with an already connected wallet
  useEffect(() => {
    if (!cosmosAccount) return;
    if (!cosmos && cosmosAccount) {
      setAddress({
        chain: 'cosmos',
        address: cosmosAccount
          ? Object.fromEntries(
              Object.entries(cosmosAccount)
                .map(([chainId, key]) =>
                  key ? [chainId, key.bech32Address] : null
                )
                .filter(a => a !== null)
            )
          : null,
      });
    }
  }, [cosmosAccount, setAddress, cosmos]);

  useEffect(() => {
    if (evmAddress) {
      setAddress({
        chain: 'evm',
        address: evmAddress,
      });
    } else {
      setAddress({
        chain: 'evm',
        address: null,
      });
    }
  }, [evmAddress, setAddress]);

  useEffect(() => {
    if (svmWallet?.adapter.publicKey) {
      setAddress({
        chain: 'solana',
        address: svmWallet.adapter.publicKey.toBase58(),
      });
    } else {
      setAddress({
        chain: 'solana',
        address: null,
      });
    }
  }, [svmWallet?.adapter.publicKey, setAddress]);

  const connect = useGrazConnect();
  const { disconnectAsync: disconnect } = useDisconnect();

  const originalGrazWallets: Record<WalletType, boolean> = useMemo(() => {
    const grazWallets = getAvailableWallets();
    if (checkUAIsMobile(navigator.userAgent)) {
      if (checkUAIsDappBrowser(navigator.userAgent)) {
        grazWallets[WalletType.WALLETCONNECT] = false;
        grazWallets[WalletType.WC_LEAP_MOBILE] = false;
        grazWallets[WalletType.WC_KEPLR_MOBILE] = false;
        grazWallets[WalletType.WC_COSMOSTATION_MOBILE] = false;
        grazWallets[WalletType.WC_CLOT_MOBILE] = false;
      }
      if (checkUAIsKeplrDappBrowser(navigator.userAgent)) {
        mobileWallets.forEach(w => {
          grazWallets[w] = w === WalletType.KEPLR;
        });
      }
      if (checkUAIsCosmostationDappBrowser(navigator.userAgent)) {
        mobileWallets.forEach(w => {
          grazWallets[w] = w === WalletType.COSMOSTATION;
        });
      }
      if (checkUAIsLeapDappBrowser(navigator.userAgent)) {
        mobileWallets.forEach(w => {
          grazWallets[w] = w === WalletType.LEAP;
        });
      }
    } else {
      if (!window?.keplr?.getChainInfosWithoutEndpoints) {
        grazWallets[WalletType.KEPLR] = false;
      }
    }
    return grazWallets;
  }, []);

  const { data: grazWallets } = useQuery({
    queryKey: ['updateSnapsStatus'],
    queryFn: async () => {
      const grazWallets = { ...(originalGrazWallets ?? {}) };
      if (originalGrazWallets[WalletType.METAMASK_SNAP_LEAP]) {
        try {
          if (!window?.ethereum?.isMetaMask) {
            throw new Error('MetaMask is not installed');
          }

          const clientVersion = await window.ethereum.request({
            method: 'web3_clientVersion',
          });

          const isMetamask = (clientVersion as string).includes('MetaMask');

          if (!isMetamask) throw new Error('Metamask is not installed');

          if (typeof window?.okxwallet !== 'undefined') {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            if (window?.okxwallet?.isOkxWallet) {
              throw new Error(
                'You have OKX Wallet installed. Please disable and reload the page to use Metamask Snap.'
              );
            }
          }
          const version = (clientVersion as string)
            .split('MetaMask/v')[1]
            ?.split('.')[0];
          const isSupportMMSnap = Number(version) >= 11;
          if (!isSupportMMSnap)
            throw new Error('Metamask Snap is not supported in this version');

          await window.ethereum.request({
            method: 'wallet_getSnaps',
          });

          grazWallets[WalletType.METAMASK_SNAP_LEAP] = true;
        } catch (error) {
          console.error(error);
          grazWallets[WalletType.METAMASK_SNAP_LEAP] = false;
        }
      }
      return grazWallets;
    },
    initialData: originalGrazWallets,
  });

  const walletsToShow: WalletDataWithAvailability[] = useMemo(() => {
    const allWallets = Object.keys(grazWallets) as WalletType[];
    const allWalletsData = allWallets.map(w => ({
      ...walletData[w],
      name: w,
      isAvailable: grazWallets[w],
    }));

    return wallets
      .map(w => {
        if (typeof w === 'string') {
          return allWalletsData.find(wallet => wallet.name === w);
        }
        const wallet = allWalletsData.find(wallet => wallet.name === w.name);
        if (wallet) {
          return {
            ...wallet,
            icon: w.icon ?? wallet.icon,
            prettyName: w.prettyName ?? wallet.prettyName,
          };
        }
        return wallet;
      })
      .filter(w => !!w)
      .filter(w => {
        if (checkUAIsMobile(navigator.userAgent)) {
          return w.isAvailable;
        }
        return !wcMobileWallets.has(w.name);
      });
  }, [wallets, grazWallets]);

  const value = useMemo(() => {
    return {
      chainId,
      wallets,
      isModalOpen,
      setIsModalOpen,
      walletsToShow,
      connect,
      disconnect,
      multiChainConnect,
    };
  }, [
    chainId,
    wallets,
    isModalOpen,
    walletsToShow,
    connect,
    disconnect,
    multiChainConnect,
  ]);

  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.15, bounce: 0.2 }}
    >
      <ConnectKitContext.Provider value={value}>
        <Modal isOpen={isModalOpen} setIsOpen={setIsModalOpen} />
        {children}
      </ConnectKitContext.Provider>
    </MotionConfig>
  );
};
