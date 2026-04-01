import { default as default_2 } from 'react';
import { JSX as JSX_2 } from 'react/jsx-runtime';
import { ProtocolType } from '@hyperlane-xyz/utils';

export declare type ChainRef = {
    key: string;
    displayName: string;
    logoURI?: string;
    chainType?: SupportedProtocols;
};

declare type Screen_2 = "home" | "input-active" | "selector" | "review" | "success" | "failure";

declare type SupportedProtocols = ProtocolType.Ethereum | ProtocolType.Sealevel | ProtocolType.Cosmos | ProtocolType.CosmosNative;

export declare enum Tabs {
    FAST = "FAST",
    ADVANCED = "ADVANCED"
}

export declare type TokenRef = {
    key: string;
    symbol: string;
    name?: string;
    logoURI?: string;
    coingeckoId?: string;
};

export declare const Widget: (props: {
    className?: string;
    onStatusChange?: (status: Screen_2) => void;
}) => JSX_2.Element;

export declare const WidgetProvider: React.FC<WidgetProviderProps>;

export declare type WidgetProviderProps = WidgetWalletConnectProviderProps;

declare type WidgetWalletConnectProviderProps = default_2.PropsWithChildren<{
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

export { }
