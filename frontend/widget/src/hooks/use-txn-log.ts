import { ChainName, IToken } from "@hyperlane-xyz/sdk";
import { ProtocolType } from "@hyperlane-xyz/utils";
import Bowser from "bowser";
import { logger } from "ethers";
import { WalletType } from "graz";

import { useCallback } from "react";

import { LeapApi, TxRequest } from "../lib/leap-api";

import { useChainsList } from "./use-chains";
import { getUSDValue } from "./use-usd-price";

export type TransferTxnInfo = {
  type: "bridge_send" | "ibc_transfer";
  transferId: string;
  fromChain: ChainName;
  toChain: ChainName;
  token?: IToken;
  bridge: "ibc" | "hyperlane" | undefined;
  provider: string;
};

export type TxnSignApprovedArgs = {
  txHash: string;
  address: string;
  data?: TransferTxnInfo;
  originChainProtocol: ProtocolType;
  amount: string;
  fees?: { denom: string; amount: string }[];
  transactionCount: number;
  walletClient: WalletType;
};

export type Token = {
  amount?: number | string;
  denom?: string;
};

export type SendTransaction = {
  toChain?: string;
  token?: Token;
};

export type IBCSendTransaction = {
  token?: Token;
  toChain?: string;
  mappingId?: string;
};

export type BridgeSendTransaction = {
  provider?: string;
  bridge?: string;
  fromChain?: string;
  toChain?: string;
  token?: Token;
  mappingId?: string;
};

export type BaseMetadata = {
  browser: string;
  walletClient: string;
};

export type _TransactionMetadata = IBCSendTransaction | BridgeSendTransaction;

export type TransactionMetadata = _TransactionMetadata & BaseMetadata;

const convertWalletTypeToCosmosKitWalletName = (walletType: WalletType) => {
  switch (walletType) {
    case WalletType.COSMIFRAME:
      return "cosmiframe-extension";
    case WalletType.COSMOSTATION:
      return "cosmostation-extension";
    case WalletType.KEPLR:
      return "keplr-extension";
    case WalletType.LEAP:
      return "leap-extension";
    case WalletType.STATION:
      return "station-extension";
    case WalletType.VECTIS:
      return "vectis-extension";
    case WalletType.XDEFI:
      return "xdefi-extension";
    case WalletType.WALLETCONNECT:
      return "walletconnect";
    case WalletType.WC_LEAP_MOBILE:
      return "leap-mobile";
    case WalletType.WC_KEPLR_MOBILE:
      return "keplr-mobile";
    case WalletType.WC_COSMOSTATION_MOBILE:
      return "cosmostation-mobile";
    case WalletType.WC_CLOT_MOBILE:
      return "clot-mobile";
    case WalletType.METAMASK_SNAP_COSMOS:
      return "cosmos-extension-metamask";
    case WalletType.METAMASK_SNAP_LEAP:
      return "leap-metamask-cosmos-snap";
    case WalletType.COMPASS:
      return "compass-extension";
    case WalletType.INITIA:
      return "initia-extension";
    case WalletType.OKX:
      return "okx-extension";
  }
};

export const getIBCSendTxnMetadata = (
  data: TransferTxnInfo & {
    fromChainId?: string;
    toChainId?: string;
  },
  amount: string,
  includeMappingId: boolean,
): IBCSendTransaction => {
  const metadata: IBCSendTransaction = {
    token: {
      amount,
      denom: data.token?.addressOrDenom,
    },
    toChain: data.toChainId as string,
  };
  if (includeMappingId) {
    metadata.mappingId = data.transferId;
  }
  return metadata;
};

export const getBridgeSendTxnMetadata = (
  data: TransferTxnInfo & {
    fromChainId?: string;
    toChainId?: string;
  },
  amount: string,
  includeMappingId: boolean,
): BridgeSendTransaction => {
  const metadata: BridgeSendTransaction = {
    provider: data.provider,
    bridge: data.bridge,
    fromChain: data.fromChainId,
    token: {
      amount,
      denom: data.token?.addressOrDenom,
    },
    toChain: data.toChainId,
  };
  if (includeMappingId) {
    metadata.mappingId = data.transferId;
  }
  return metadata;
};

function getChainType(protocol: ProtocolType) {
  switch (protocol) {
    case ProtocolType.Ethereum:
      return "evm";
    case ProtocolType.Sealevel:
      return "svm";
    case ProtocolType.Cosmos:
    case ProtocolType.CosmosNative:
      return "cosmos";
    default:
      return "unknown";
  }
}

async function calculateAmount(data: TransferTxnInfo, amount: string) {
  let totalUSDAmount;
  if (
    data.token?.decimals &&
    !isNaN(parseFloat(amount)) &&
    data.token.coinGeckoId
  ) {
    const inAmount = parseFloat(amount) / 10 ** (data.token?.decimals ?? 6);
    const inPrice = await getUSDValue(data.token.coinGeckoId);

    if (inPrice !== undefined && !isNaN(inPrice)) {
      totalUSDAmount = inAmount * inPrice;
    }
  }
  return totalUSDAmount;
}

export const useTxLogging = () => {
  const chains = useChainsList();
  const logTx = useCallback(
    async (txnData: TxnSignApprovedArgs) => {
      logger.debug("useTxLogging", txnData);
      if (txnData.data === undefined) {
        return;
      }

      const {
        txHash,
        address,
        originChainProtocol,
        data,
        amount,
        transactionCount,
        walletClient,
      } = txnData;

      let fees;
      const chainType = getChainType(originChainProtocol);
      if (chainType === "cosmos") {
        fees = txnData.fees;
      }
      const fromChainMetadata = chains.find(
        (chain) => chain.name === data.fromChain,
      );
      const toChainMetadata = chains.find(
        (chain) => chain.name === data.toChain,
      );

      let txType;
      let txnMetadata: _TransactionMetadata;

      const includeMappingId = transactionCount > 1;

      switch (data.type) {
        case "ibc_transfer":
          txnMetadata = getIBCSendTxnMetadata(
            {
              ...data,
              fromChainId: String(fromChainMetadata?.chainId),
              toChainId: String(toChainMetadata?.chainId),
            },
            amount,
            includeMappingId,
          );
          break;
        default:
          txType = "bridge_send";
          txnMetadata = getBridgeSendTxnMetadata(
            {
              ...data,
              fromChainId: String(fromChainMetadata?.chainId),
              toChainId: String(toChainMetadata?.chainId),
            },
            amount,
            includeMappingId,
          );
          break;
      }
      txType = txType ?? data.type;

      const usdAmount = await calculateAmount(data, amount);
      const ua = Bowser.parse(window.navigator.userAgent);

      const platform =
        ua.platform.type?.replace(" ", "_")?.toLowerCase() ?? "unknown";
      const browserName =
        ua.browser.name?.replace(" ", "_")?.toLowerCase() ?? "unknown";

      const browser = `${platform}_${browserName}`;

      const metadata: TransactionMetadata = {
        ...txnMetadata,
        browser,
        walletClient:
          chainType === "cosmos"
            ? convertWalletTypeToCosmosKitWalletName(walletClient)
            : walletClient,
      };

      const logInfo: TxRequest = {
        txHash,
        chainId: String(fromChainMetadata?.chainId),
        type: txType,
        feeDenomination: fees?.[0].denom,
        feeQuantity: fees?.[0].amount,
        metadata,
        walletAddress: address,
        amount: usdAmount,
        isMainnet: true,
      };

      const operationType = `${chainType}.tx`;
      LeapApi.logTxn({
        operationType,
        data: logInfo,
      });
    },
    [chains],
  );

  return { logTx };
};
