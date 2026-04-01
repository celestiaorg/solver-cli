import React, { createContext, useMemo } from "react";

import type { ChainRef, TokenRef, Tabs } from "../lib/types";

export type WidgetWalletConnectProviderProps = React.PropsWithChildren<{
  connectWallet: () => void;
  isTestnet?: boolean;
  defaultSourceChain?: ChainRef;
  defaultSourceToken?: TokenRef;
  defaultDestinationChain?: ChainRef;
  defaultDestinationToken?: TokenRef;
  defaultTab?: Tabs;
  showDefaultTabOnly?: boolean;
  excludedChains?: ChainRef[];
  excludedTokens?: TokenRef[];
}>;

type WidgetWalletContextType = {
  connectWallet: () => void;
  isTestnet?: boolean;
  defaultSourceChain?: ChainRef;
  defaultSourceToken?: TokenRef;
  defaultDestinationChain?: ChainRef;
  defaultDestinationToken?: TokenRef;
  defaultTab?: Tabs;
  showDefaultTabOnly?: boolean;
  excludedChains?: ChainRef[];
  excludedTokens?: TokenRef[];
};

const WidgetWalletContext = createContext<WidgetWalletContextType | null>(null);

export const WidgetWalletConnectProvider: React.FC<
  WidgetWalletConnectProviderProps
> = ({
  children,
  connectWallet,
  isTestnet,
  defaultSourceChain,
  defaultSourceToken,
  defaultDestinationChain,
  defaultDestinationToken,
  defaultTab,
  showDefaultTabOnly,
  excludedChains,
  excludedTokens,
}) => {
  const value = useMemo(
    () => ({
      connectWallet,
      isTestnet,
      defaultSourceChain,
      defaultSourceToken,
      defaultDestinationChain,
      defaultDestinationToken,
      defaultTab,
      showDefaultTabOnly,
      excludedChains,
      excludedTokens,
    }),
    [
      connectWallet,
      isTestnet,
      defaultSourceChain,
      defaultSourceToken,
      defaultDestinationChain,
      defaultDestinationToken,
      defaultTab,
      showDefaultTabOnly,
      excludedChains,
      excludedTokens,
    ],
  );
  return (
    <WidgetWalletContext.Provider value={value}>
      {children}
    </WidgetWalletContext.Provider>
  );
};

export const useWidgetWalletClientContext = (): WidgetWalletContextType => {
  const context = React.useContext(WidgetWalletContext);
  if (!context) {
    throw new Error(
      "useWidgetWalletClientContext must be used within a WidgetWalletConnectProvider",
    );
  }
  return context;
};
