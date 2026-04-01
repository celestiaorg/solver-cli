import { ChainAddresses } from "@hyperlane-xyz/registry";
import { ChainMap, ChainMetadata, ChainName, Token } from "@hyperlane-xyz/sdk";
import { Address, ChainId, ProtocolType } from "@hyperlane-xyz/utils";
import BigNumber from "bignumber.js";

import { NativeToken } from "./relay-api";

export type SupportedChain = {
  chainId: string;
  name: string;
  displayName?: string;
  pfmEnabled: boolean;
  logoURI: string;
  bech32Prefix: string;
  chainType?: SupportedProtocols;
  icon: string;
  baseDenom?: string;
  nativeToken?: NativeToken;
  isTestnet: boolean;
  multicallAddress?: string;
  lifiChainId?: string;
  relayChainId?: string;
  explorerUrl?: string;
  restUrl?: string;
  rpcUrl: string;
};

export type SupportedAsset = {
  chainId: string;
  chainName?: string;
  denom: string;
  originDenom: string;
  originChainId: string;
  symbol: string;
  logoUri: string;
  trace?: string;
  name: string | null;
  decimals: number;
  tokenContract?: string;
  coingeckoId: string | undefined;
  priceUSD?: string;
};

export type TokenBalanceResult = Readonly<{
  data: TokenBalanceData | undefined;
  isLoading: boolean;
  error: Error;
  isWalletConnected: boolean;
}>;

export interface WalletEventDetail {
  name: string;
  connectionType: string;
  address: string;
  logoUrl?: string;
}

export interface WalletConnectEvent extends Event {
  detail: WalletEventDetail;
}

export interface WalletDisconnectEvent extends Event {
  detail: {
    connectionType: string;
  };
}

export type MultiCollateralTokenMap = Record<string, Record<string, Token[]>>;

export type TokenChainMap = {
  chains: ChainMap<{ token: Token; metadata: ChainMetadata | null }>;
  tokenInformation: Token;
};

export type Tokens = Array<{ token: Token; disabled: boolean }>;

export type GasInfo =
  | {
      gasFees: {
        amount: string;
        symbol: string;
        denom: string;
        amountRaw: string;
      }[];
      fiatAmount: string | null;
    }
  | null
  | undefined;

export interface TransferFormValues {
  origin: ChainName;
  destination: ChainName;
  denom: string | undefined;
  amount: string;
  recipient: Address;
  sourceAddress: Address;
  gasInfo: GasInfo;
}

export enum TransferStatus {
  Preparing = "preparing",
  CreatingTxs = "creating-txs",
  SigningApprove = "signing-approve",
  SigningRevoke = "signing-revoke",
  ConfirmingRevoke = "confirming-revoke",
  ConfirmingApprove = "confirming-approve",
  SigningTransfer = "signing-transfer",
  ConfirmingTransfer = "confirming-transfer",
  ConfirmedTransfer = "confirmed-transfer",
  Delivered = "delivered",
  Failed = "failed",
}

export const SentTransferStatuses = [
  TransferStatus.ConfirmedTransfer,
  TransferStatus.Delivered,
];

// Statuses considered not pending
export const FinalTransferStatuses = [
  ...SentTransferStatuses,
  TransferStatus.Failed,
];

export interface TransferContext {
  status: TransferStatus;
  origin: ChainName;
  destination: ChainName;
  originTokenAddressOrDenom?: string;
  destTokenAddressOrDenom?: string;
  amount: string;
  sender: Address;
  recipient: Address;
  originTxHash?: string;
  msgId?: string;
  timestamp: number;
}

export interface AccountInfo {
  protocol: ProtocolType;
  // This needs to be an array instead of a single address b.c.
  // Cosmos wallets have different addresses per chain
  addresses: Array<ChainAddresses>;
  // And another Cosmos exception, public keys are needed
  // for tx simulation and gas estimation
  publicKey?: Record<string, string | undefined>;
  isReady: boolean;
}

export type TokenBalanceData = {
  value: string;
  amount: BigNumber;
};

export type HexAddress = `0x${string}`;
export interface ChainBalanceData {
  chainId: ChainId;
  balances: Record<string, TokenBalanceData>;
}

export enum InputType {
  TOKEN = "TOKEN",
  FIAT = "FIAT",
}
export enum Tabs {
  FAST = "FAST",
  ADVANCED = "ADVANCED",
}

export type ChainData = {
  id: ChainId;
  displayName: string;
  logoURI?: string;
};
export type SupportedProtocols =
  | ProtocolType.Ethereum
  | ProtocolType.Sealevel
  | ProtocolType.Cosmos
  | ProtocolType.CosmosNative;

export enum SwapTxnStatus {
  // The transaction has not been initiated
  IDLE = "IDLE",
  // The transaction has been initiated, it needs to be approved (signed)
  NEEDS_APPROVAL = "NEEDS_APPROVAL",
  // Confirming allowance
  CONFIRMING_ALLOWANCE = "CONFIRMING_ALLOWANCE",
  // The transaction has been approved (signed)
  SIGNED = "SIGNED",
  // The transaction is being broadcasted
  BROADCASTING = "BROADCASTING",
  // The transaction has been broadcasted
  BROADCASTED = "BROADCASTED",
}

export type SwapTxnStatusData =
  | {
      status: SwapTxnStatus.IDLE;
    }
  | {
      status: SwapTxnStatus.NEEDS_APPROVAL;
    }
  | {
      status: SwapTxnStatus.CONFIRMING_ALLOWANCE;
    }
  | {
      status: SwapTxnStatus.SIGNED;
    }
  | {
      status: SwapTxnStatus.BROADCASTING;
    }
  | {
      status: SwapTxnStatus.BROADCASTED;
      txHash: string;
      chainId: string;
      explorerLink?: string;
    };

export type Screen =
  | "home"
  | "input-active"
  | "selector"
  | "review"
  | "success"
  | "failure";

export type ChainRef = {
  key: string;
  displayName: string;
  logoURI?: string;
  chainType?: SupportedProtocols;
};

export type TokenRef = {
  key: string;
  symbol: string;
  name?: string;
  logoURI?: string;
  coingeckoId?: string;
};

export type SideState = {
  chain?: ChainRef;
  token?: TokenRef;
  amount: string;
  address?: string;
};
