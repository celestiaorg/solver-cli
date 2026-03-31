import { AllWallets } from '../all-wallets';
import { IsConnectingWallet } from '../connecting-wallet-dialog';
import { CosmosWallets } from '../cosmos-wallets';
import { EVMWallets } from '../evm-wallets';
import { IsSelectingEcosystem } from '../select-ecosystem-dialog';
import { SolanaWallets } from '../solana-wallets';
import { IsSwitchingWallet } from '../switch-wallet-dialog';
import { walletEcosystems } from './ecosystems';

export const EcosystemWallets = ({
  activeEcosystem,
  searchQuery,
  setIsSwitchingWallet,
  setIsConnectingWallet,
  setIsSelectingEcosystem,
}: {
  activeEcosystem: (typeof walletEcosystems)[number];
  searchQuery: string;
  setIsSwitchingWallet: (isSwitchingWallet: IsSwitchingWallet) => void;
  setIsConnectingWallet: (isConnectingWallet: IsConnectingWallet) => void;
  setIsSelectingEcosystem: (isSelectingEcosystem: IsSelectingEcosystem) => void;
}) => {
  switch (activeEcosystem.name) {
    case 'All Wallets': {
      return (
        <AllWallets
          searchQuery={searchQuery}
          setIsSwitchingWallet={setIsSwitchingWallet}
          setIsConnectingWallet={setIsConnectingWallet}
          setIsSelectingEcosystem={setIsSelectingEcosystem}
        />
      );
    }
    case 'EVM': {
      return (
        <EVMWallets
          searchQuery={searchQuery}
          setIsSwitchingWallet={setIsSwitchingWallet}
          setIsConnectingWallet={setIsConnectingWallet}
        />
      );
    }
    case 'Cosmos': {
      return (
        <CosmosWallets
          searchQuery={searchQuery}
          setIsSwitchingWallet={setIsSwitchingWallet}
          setIsConnectingWallet={setIsConnectingWallet}
        />
      );
    }
    case 'Solana': {
      return (
        <SolanaWallets
          searchQuery={searchQuery}
          setIsSwitchingWallet={setIsSwitchingWallet}
          setIsConnectingWallet={setIsConnectingWallet}
        />
      );
    }
  }
};
