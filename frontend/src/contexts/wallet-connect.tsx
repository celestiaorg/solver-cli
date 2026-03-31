'use client';

import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { GrazProvider, WalletType } from 'graz';
import {
  celestiatestnet3,
  cosmoshub,
  mainnetChainsArray,
  testnetChainsArray,
} from 'graz/chains';
import { WagmiProvider } from 'wagmi';

import dynamic from 'next/dynamic';

import {
  cosmosPrimaryMainnetChainId,
  cosmosPrimaryTestnetChainId,
  defaultWagmiConfig,
  enabledCosmosWallets,
  solanaEndpoint,
  solanaWalletAdapters,
  walletConnectOptions,
  web3ModalConfig,
} from '@/connect-kit/constants';
import { isEdenMainnet } from '@/lib/constants/eden-network';

const ConnectKitProvider = dynamic(
  () => import('@/connect-kit').then(mod => mod.ConnectKitProvider),
  {
    ssr: false,
    loading: () => null,
  }
);

const celestiaTestnetWithRpc = {
  ...celestiatestnet3,
  rpc: 'https://rpc-1.testnet.celestia.nodes.guru',
};

const getGrazOptions = (isTestnet?: boolean) => {
  const supportedChainIdMap = new Map(
    ['celestia', 'neutron-1', 'stride-1', 'mocha-4'].map(chainId => [
      chainId,
      true,
    ])
  );
  const enabledCosmosChains = isTestnet
    ? testnetChainsArray.map(chain =>
        chain.chainId === 'mocha-4' ? celestiaTestnetWithRpc : chain
      )
    : [
        ...mainnetChainsArray.filter(chain =>
          supportedChainIdMap.get(chain.chainId)
        ),
        celestiaTestnetWithRpc,
      ];
  return {
    chains: [
      ...enabledCosmosChains,
      {
        ...cosmoshub,
        rpc: 'https://cosmos-rpc.stakeandrelax.net',
      },
    ],
    defaultWallet: 'leap' as WalletType,
    walletConnect: {
      options: walletConnectOptions,
      web3Modal: web3ModalConfig,
    },
    autoReconnect: false,
  };
};
const grazOptions = getGrazOptions(!isEdenMainnet);

export const WalletConnectWrapper = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <ConnectionProvider endpoint={solanaEndpoint}>
      <WalletProvider
        autoConnect={false}
        wallets={solanaWalletAdapters}
        localStorageKey="eden-portal-solana-wallet"
      >
        <WagmiProvider config={defaultWagmiConfig} reconnectOnMount={true}>
          <GrazProvider grazOptions={grazOptions}>
            <ConnectKitProvider
              multiChainConnect="all"
              chainId={
                isEdenMainnet
                  ? cosmosPrimaryMainnetChainId
                  : cosmosPrimaryTestnetChainId
              }
              wallets={enabledCosmosWallets}
            >
              {children}
            </ConnectKitProvider>
          </GrazProvider>
        </WagmiProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
