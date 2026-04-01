import { useConnect, WalletType } from 'graz';

import { createContext, useContext } from 'react';

import { Prettify } from '../../utils';
import { WalletData } from '../../wallet-data';

export type ConnectKitContextConfigValue = {
  /**
   * Primary chain to connect to
   */
  chainId: string;
  /**
   * If you want the user to connect to multiple chains, you can pass an array of chainIds
   * or "all" for all supported chains for the connecting wallet.
   */
  multiChainConnect?: string[] | 'all';
  wallets: (
    | WalletType
    | {
        name: WalletType;
        prettyName?: string;
        icon?: string;
      }
  )[];
};

export type WalletDataWithAvailability = Prettify<
  WalletData & {
    isAvailable: boolean;
  }
>;

type State = {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  walletsToShow: WalletDataWithAvailability[];
};

type Functions = {
  connect: ReturnType<typeof useConnect>;
  disconnect: (args?: { chainId?: string }) => Promise<void>;
};

export type ConnectKitContextValue = Prettify<
  ConnectKitContextConfigValue & State & Functions
>;

export const ConnectKitContext = createContext<ConnectKitContextValue | null>(
  null
);

export const useConnectKitContext = () => {
  const context = useContext(ConnectKitContext);
  if (!context) {
    throw new Error(
      'useConnectKitContext must be used within a ConnectKitProvider'
    );
  }
  return context;
};

export const useConnectKitModal = () => {
  const { isModalOpen, setIsModalOpen } = useConnectKitContext();
  return { isModalOpen, setIsModalOpen } as const;
};
