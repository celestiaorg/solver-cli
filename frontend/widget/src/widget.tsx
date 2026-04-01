import { motion } from "framer-motion";

import { ErrorBoundary } from "./components/error-boundary";

import { WarpContextInitGate } from "./contexts/warp-context-init";
import { opacityFadeInOut, transition150 } from "./lib/motion";
import { Screen, Tabs } from "./lib/types";
import { cn } from "./lib/utils";
import { useInputStateStore } from "./store";
import HyperlaneTab from "./advanced-tab";
import { RelayWidget } from "./fast-tab";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useAccount as useCosmosAccount } from "graz";
import { useAccount as useWagmiAccount } from "wagmi";

import { useEffect, useRef } from "react";

import { useWalletConnectStore } from "./store/wallet-connect";
import { useWidgetWalletClientContext } from "./contexts/wallet-connect";
import { useHyperlaneFlowStore } from "./store/bridge";
import { useRelayFlowStore } from "./store/swaps";

export const Widget = (props: {
  className?: string;
  onStatusChange?: (status: Screen) => void;
}) => {
  const config = useWidgetWalletClientContext();
  const setInputState = useInputStateStore((s) => s.setInputState);
  const relaySetFromChain = useRelayFlowStore((s) => s.setFromChain);
  const relaySetToChain = useRelayFlowStore((s) => s.setToChain);
  const relaySetFromToken = useRelayFlowStore((s) => s.setFromToken);
  const relaySetToToken = useRelayFlowStore((s) => s.setToToken);
  const hyperlaneSetFromChain = useHyperlaneFlowStore((s) => s.setFromChain);
  const hyperlaneSetToChain = useHyperlaneFlowStore((s) => s.setToChain);
  const hyperlaneSetFromToken = useHyperlaneFlowStore((s) => s.setFromToken);
  const hyperlaneSetToToken = useHyperlaneFlowStore((s) => s.setToToken);
  const defaultsInitialized = useRef(false);

  useEffect(() => {
    if (defaultsInitialized.current) return;
    defaultsInitialized.current = true;

    const {
      defaultSourceChain,
      defaultSourceToken,
      defaultDestinationChain,
      defaultDestinationToken,
      defaultTab,
    } = config;

    if (defaultSourceChain?.key) {
      relaySetFromChain(defaultSourceChain);
      hyperlaneSetFromChain(defaultSourceChain);
    }
    if (defaultDestinationChain?.key) {
      relaySetToChain(defaultDestinationChain);
      hyperlaneSetToChain(defaultDestinationChain);
    }
    if (defaultSourceToken !== undefined) {
      relaySetFromToken(defaultSourceToken);
      hyperlaneSetFromToken(defaultSourceToken);
    }
    if (defaultDestinationToken !== undefined) {
      relaySetToToken(defaultDestinationToken);
      hyperlaneSetToToken(defaultDestinationToken);
    }

    const effectiveTab = defaultTab;
    if (effectiveTab !== undefined) {
      setInputState({ tab: effectiveTab });
    }
  }, [
    config,
    setInputState,
    relaySetFromChain,
    relaySetToChain,
    relaySetFromToken,
    relaySetToToken,
    hyperlaneSetFromChain,
    hyperlaneSetToChain,
    hyperlaneSetFromToken,
    hyperlaneSetToToken,
  ]);
  const { address: evmAddress } = useWagmiAccount();
  const { wallet: svmWallet } = useSolanaWallet();

  const { setAddress, cosmos } = useWalletConnectStore();

  const { data: cosmosAccount } = useCosmosAccount({
    multiChain: true,
    onConnect: ({ accounts }) => {
      setAddress({
        chain: "cosmos",
        address: accounts
          ? Object.fromEntries(
              Object.entries(accounts)
                .map(([chainId, key]) =>
                  key ? [chainId, key.bech32Address] : null,
                )
                .filter((a) => a !== null),
            )
          : null,
      });
    },
    onDisconnect: () => {
      setAddress({
        chain: "cosmos",
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
        chain: "cosmos",
        address: cosmosAccount
          ? Object.fromEntries(
              Object.entries(cosmosAccount)
                .map(([chainId, key]) =>
                  key ? [chainId, key.bech32Address] : null,
                )
                .filter((a) => a !== null),
            )
          : null,
      });
    }
  }, [cosmosAccount, setAddress, cosmos]);

  useEffect(() => {
    if (evmAddress) {
      setAddress({
        chain: "evm",
        address: evmAddress,
      });
    } else {
      setAddress({
        chain: "evm",
        address: null,
      });
    }
  }, [evmAddress, setAddress]);

  useEffect(() => {
    if (svmWallet?.adapter.publicKey) {
      setAddress({
        chain: "solana",
        address: svmWallet.adapter.publicKey.toBase58(),
      });
    } else {
      setAddress({
        chain: "solana",
        address: null,
      });
    }
  }, [svmWallet?.adapter.publicKey, setAddress]);
  return (
    <motion.div
      key="bridge-view"
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={transition150}
      variants={opacityFadeInOut}
      className={cn(
        `bg-background w-full my-4 relative z-0 flex h-[640px] flex-col rounded-3xl p-4 shadow-sm sm:p-8 `,
        props.className,
      )}
    >
      <TabView onStatusChange={props.onStatusChange} />
    </motion.div>
  );
};

const TabView: React.FC<{ onStatusChange?: (status: Screen) => void }> = ({
  onStatusChange,
}) => {
  const { inputState } = useInputStateStore();
  return (
    <ErrorBoundary>
      {inputState.tab === Tabs.FAST && <RelayWidget />}
      {inputState.tab === Tabs.ADVANCED && (
        <WarpContextInitGate>
          <HyperlaneTab onStatusChange={onStatusChange} />
        </WarpContextInitGate>
      )}
    </ErrorBoundary>
  );
};
