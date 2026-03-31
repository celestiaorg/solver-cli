import type {
  DeliverTxResponse,
  ExecuteResult,
  IndexedTx,
} from "@cosmjs/cosmwasm-stargate";
import { OfflineDirectSigner } from "@cosmjs/proto-signing";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { CosmosNativeSigner } from "@hyperlane-xyz/cosmos-sdk";
import {
  ChainName,
  MultiProtocolProvider,
  ProviderType,
  TypedTransactionReceipt,
  WarpTypedTransaction,
} from "@hyperlane-xyz/sdk";
import { assert, ProtocolType } from "@hyperlane-xyz/utils";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import {
  useCosmWasmSigningClient,
  useOfflineSigners,
  useStargateSigningClient,
} from "graz";
import { useConfig } from "wagmi";
import {
  getAccount,
  sendTransaction,
  switchChain,
  waitForTransactionReceipt,
} from "wagmi/actions";

import { useCallback, useMemo } from "react";

import { ethers5TxToWagmiTx } from "../lib/transfer/utils";
import { SupportedProtocols } from "../lib/types";
import { getCosmosChainMetadata } from "../lib/utils";
import { useWalletConnectStore } from "../store/wallet-connect";
import { logger } from "../utils/logger";

export type SendTransactionFn<
  TxReq extends WarpTypedTransaction = WarpTypedTransaction,
  TxResp extends TypedTransactionReceipt = TypedTransactionReceipt,
> = (params: {
  tx: TxReq;
  chainName: ChainName;
  activeChainName?: ChainName;
}) => Promise<{ hash: string; confirm: () => Promise<TxResp> }>;

export type SendMultiTransactionFn<
  TxReq extends WarpTypedTransaction = WarpTypedTransaction,
  TxResp extends TypedTransactionReceipt = TypedTransactionReceipt,
> = (params: {
  txs: TxReq[];
  chainName: ChainName;
  activeChainName?: ChainName;
}) => Promise<{ hash: string; confirm: () => Promise<TxResp> }>;

export type SwitchNetworkFn = (chainName: ChainName) => Promise<void>;

export interface ChainTransactionFns {
  isLoading?: boolean;
  sendTransaction: SendTransactionFn;
  sendMultiTransaction: SendMultiTransactionFn;
  switchNetwork?: SwitchNetworkFn;
}

export function useEthereumTransactionFns(
  multiProvider: MultiProtocolProvider,
): ChainTransactionFns {
  const config = useConfig();

  const onSwitchNetwork = useCallback(
    async (chainName: ChainName) => {
      const chainId = multiProvider.getChainMetadata(chainName)
        .chainId as number;
      await switchChain(config, { chainId });
    },
    [config, multiProvider],
  );
  // Note, this doesn't use wagmi's prepare + send pattern because we're potentially sending two transactions
  // The prepare hooks are recommended to use pre-click downtime to run async calls, but since the flow
  // may require two serial txs, the prepare hooks aren't useful and complicate hook architecture considerably.
  // See https://github.com/hyperlane-xyz/hyperlane-warp-ui-template/issues/19
  // See https://github.com/wagmi-dev/wagmi/discussions/1564
  const onSendTx = useCallback(
    async ({
      tx,
      chainName,
      activeChainName,
    }: {
      tx: WarpTypedTransaction;
      chainName: ChainName;
      activeChainName?: ChainName;
    }) => {
      if (tx.type !== ProviderType.EthersV5)
        throw new Error(`Unsupported tx type: ${tx.type}`);

      // If the active chain is different from tx origin chain, try to switch network first
      if (activeChainName && activeChainName !== chainName)
        await onSwitchNetwork(chainName);

      // Since the network switching is not foolproof, we also force a network check here
      const chainId = multiProvider.getChainMetadata(chainName)
        .chainId as number;
      logger.debug("Checking wallet current chain");
      const latestNetwork = getAccount(config);

      logger.debug(`Sending tx on chain ${chainName}`);
      const wagmiTx = ethers5TxToWagmiTx(tx.transaction);
      const hash = await sendTransaction(config, {
        chainId,
        ...wagmiTx,
      });
      const confirm = (): Promise<TypedTransactionReceipt> => {
        const foo = waitForTransactionReceipt(config, {
          chainId,
          hash,
          confirmations: 1,
        });
        return foo.then((r) => ({
          type: ProviderType.Viem,
          receipt: { ...r, contractAddress: r.contractAddress || null },
        }));
      };

      return { hash, confirm };
    },
    [config, onSwitchNetwork, multiProvider],
  );

  const onMultiSendTx = useCallback(
    async ({
      txs: _,
      chainName: __,
      activeChainName: ___,
    }: {
      txs: WarpTypedTransaction[];
      chainName: ChainName;
      activeChainName?: ChainName;
    }) => {
      throw new Error("Multi Transactions not supported on EVM");
    },
    [],
  );

  return {
    sendTransaction: onSendTx,
    sendMultiTransaction: onMultiSendTx,
    switchNetwork: onSwitchNetwork,
  };
}

export function useSolanaTransactionFns(
  multiProvider: MultiProtocolProvider,
): ChainTransactionFns {
  const { sendTransaction: sendSolTransaction } = useWallet();

  const onSwitchNetwork = useCallback(async (chainName: ChainName) => {
    logger.warn(`Solana wallet must be connected to origin chain ${chainName}`);
  }, []);

  const onSendTx = useCallback(
    async ({
      tx,
      chainName,
      activeChainName,
    }: {
      tx: WarpTypedTransaction;
      chainName: ChainName;
      activeChainName?: ChainName;
    }) => {
      if (tx.type !== ProviderType.SolanaWeb3)
        throw new Error(`Unsupported tx type: ${tx.type}`);
      if (activeChainName && activeChainName !== chainName)
        await onSwitchNetwork(chainName);
      const rpcUrl = multiProvider.getRpcUrl(chainName);
      const connection = new Connection(rpcUrl, "confirmed");
      const {
        context: { slot: minContextSlot },
        value: { blockhash, lastValidBlockHeight },
      } = await connection.getLatestBlockhashAndContext();

      logger.debug(`Sending tx on chain ${chainName}`);
      const signature = await sendSolTransaction(tx.transaction, connection, {
        minContextSlot,
      });

      const confirm = (): Promise<TypedTransactionReceipt> =>
        connection
          .confirmTransaction({ blockhash, lastValidBlockHeight, signature })
          .then(() => connection.getTransaction(signature))
          .then((r) => ({
            type: ProviderType.SolanaWeb3,
            receipt: r!,
          }));

      return { hash: signature, confirm };
    },
    [onSwitchNetwork, sendSolTransaction, multiProvider],
  );

  const onMultiSendTx = useCallback(
    async ({
      txs: _,
      chainName: __,
      activeChainName: ___,
    }: {
      txs: WarpTypedTransaction[];
      chainName: ChainName;
      activeChainName?: ChainName;
    }) => {
      throw new Error("Multi Transactions not supported on Solana");
    },
    [onSwitchNetwork, sendSolTransaction, multiProvider],
  );

  return {
    sendTransaction: onSendTx,
    sendMultiTransaction: onMultiSendTx,
    switchNetwork: onSwitchNetwork,
  };
}

export function useCosmosTransactionFns(
  multiProvider: MultiProtocolProvider,
): ChainTransactionFns {
  const cosmosChains = getCosmosChainMetadata(multiProvider);
  const { cosmos } = useWalletConnectStore();
  const { data: offlineSigners, isLoading: isOfflineSignersLoading } =
    useOfflineSigners({
      chainId: Object.keys(cosmos ?? {}),
      multiChain: true,
    });
  const {
    data: cosmWasmSigningClients,
    isLoading: isCosmWasmSigningClientsLoading,
  } = useCosmWasmSigningClient({
    chainId: Object.keys(cosmos ?? {}),
    multiChain: true,
  });
  const {
    data: stargateSigningClients,
    isLoading: isStargateSigningClientsLoading,
  } = useStargateSigningClient({
    chainId: Object.keys(cosmos ?? {}),
    multiChain: true,
  });

  const onSwitchNetwork = useCallback(
    async (chainName: ChainName) => {
      const displayName =
        multiProvider.getChainMetadata(chainName).displayName || chainName;

      throw new Error(
        `Cosmos wallet must be connected to origin chain ${displayName}}`,
      );
    },
    [multiProvider],
  );

  const onSendTx = useCallback(
    async ({
      tx,
      chainName,
      activeChainName,
    }: {
      tx: WarpTypedTransaction;
      chainName: ChainName;
      activeChainName?: ChainName;
    }) => {
      const chainMetadata = cosmosChains[chainName];
      const chainAddress = cosmos?.[chainMetadata.chainId];
      if (!chainAddress) {
        throw new Error(`Cosmos wallet not connected for ${chainName}`);
      }
      if (
        !offlineSigners ||
        !stargateSigningClients ||
        !cosmWasmSigningClients
      ) {
        throw new Error(
          `Cosmos signing clients not initialized for ${chainName}`,
        );
      }

      if (activeChainName && activeChainName !== chainName)
        await onSwitchNetwork(chainName);

      logger.debug(`Sending tx on chain ${chainName}`);
      let result: ExecuteResult | DeliverTxResponse;
      let txDetails: IndexedTx | null;
      if (tx.type === ProviderType.CosmJsWasm) {
        const client = cosmWasmSigningClients[chainMetadata.chainId];
        if (!client) {
          throw new Error(`CosmWasm client not initialized for ${chainName}`);
        }
        result = (await client.executeMultiple(
          chainAddress,
          [tx.transaction],
          "auto",
        )) as unknown as ExecuteResult;
        txDetails = (await client?.getTx(
          result.transactionHash,
        )) as IndexedTx | null;
      } else if (tx.type === ProviderType.CosmJs) {
        const signer = offlineSigners[chainMetadata.chainId];

        const client = await SigningStargateClient.connectWithSigner(
          chainMetadata.rpcUrls[0].http,
          signer?.offlineSignerAuto as unknown as OfflineDirectSigner,
          {
            // set zero gas price here so it does not error. actual gas price
            // will be injected from the wallet registry like Keplr or Leap
            gasPrice: GasPrice.fromString("0token"),
          },
        );

        if (!client) {
          throw new Error(`Stargate client not initialized for ${chainName}`);
        }
        result = await client?.signAndBroadcast(
          chainAddress,
          [tx.transaction],
          2,
        );
        txDetails = await client?.getTx(result.transactionHash);
      } else if (tx.type === ProviderType.CosmJsNative) {
        const signer = offlineSigners[chainMetadata.chainId];
        const client = await CosmosNativeSigner.connectWithSigner(
          chainMetadata.rpcUrls.map((url) => url.http),
          signer?.offlineSignerAuto as unknown as OfflineDirectSigner,
          {
            metadata: {
              // set zero gas price here so it does not error. actual gas price
              // will be injected from the wallet registry like Keplr or Leap
              gasPrice: GasPrice.fromString("0token"),
            },
          },
        );

        result = await client.sendAndConfirmTransaction(tx.transaction);
        txDetails = {
          height: result.height,
          txIndex: result.txIndex,
          hash: result.transactionHash,
          code: result.code,
          events: result.events,
          gasUsed: result.gasUsed,
          gasWanted: result.gasWanted,
          rawLog: result.rawLog ?? "",
          msgResponses: result.msgResponses,
          tx: new Uint8Array(),
        };
      } else {
        throw new Error(`Invalid cosmos provider type ${tx.type}`);
      }

      const confirm = async (): Promise<TypedTransactionReceipt> => {
        assert(
          txDetails,
          `Cosmos tx failed: ${JSON.stringify(result, (key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          )}`,
        );
        return {
          type: tx.type,
          receipt: { ...txDetails, transactionHash: result.transactionHash },
        };
      };
      return { hash: result.transactionHash, confirm };
    },
    [
      onSwitchNetwork,
      cosmWasmSigningClients,
      offlineSigners,
      stargateSigningClients,
      cosmos,
      cosmosChains,
    ],
  );

  const onMultiSendTx = useCallback(
    async ({
      txs: _,
      chainName: __,
      activeChainName: ___,
    }: {
      txs: WarpTypedTransaction[];
      chainName: ChainName;
      activeChainName?: ChainName;
    }) => {
      throw new Error("Multi Transactions not supported on Cosmos");
    },
    [],
  );

  return {
    sendTransaction: onSendTx,
    sendMultiTransaction: onMultiSendTx,
    switchNetwork: onSwitchNetwork,
    isLoading:
      isOfflineSignersLoading ||
      isCosmWasmSigningClientsLoading ||
      isStargateSigningClientsLoading,
  };
}

export function useTransactionFns(
  multiProvider: MultiProtocolProvider,
): Record<SupportedProtocols, ChainTransactionFns> {
  const {
    switchNetwork: onSwitchEvmNetwork,
    sendTransaction: onSendEvmTx,
    sendMultiTransaction: onSendMultiEvmTx,
  } = useEthereumTransactionFns(multiProvider);
  const {
    switchNetwork: onSwitchSolNetwork,
    sendTransaction: onSendSolTx,
    sendMultiTransaction: onSendMultiSolTx,
  } = useSolanaTransactionFns(multiProvider);

  const {
    switchNetwork: onSwitchCosmosNetwork,
    sendTransaction: onSendCosmosTx,
    sendMultiTransaction: onSendMultiCosmosTx,
  } = useCosmosTransactionFns(multiProvider);

  return useMemo(
    () => ({
      [ProtocolType.Ethereum]: {
        sendTransaction: onSendEvmTx,
        sendMultiTransaction: onSendMultiEvmTx,
        switchNetwork: onSwitchEvmNetwork,
      },
      [ProtocolType.Sealevel]: {
        sendTransaction: onSendSolTx,
        sendMultiTransaction: onSendMultiSolTx,
        switchNetwork: onSwitchSolNetwork,
      },
      [ProtocolType.Cosmos]: {
        sendTransaction: onSendCosmosTx,
        sendMultiTransaction: onSendMultiCosmosTx,
        switchNetwork: onSwitchCosmosNetwork,
      },
      [ProtocolType.CosmosNative]: {
        sendTransaction: onSendCosmosTx,
        sendMultiTransaction: onSendMultiCosmosTx,
        switchNetwork: onSwitchCosmosNetwork,
      },
    }),
    [
      onSwitchEvmNetwork,
      onSendEvmTx,
      onSendMultiEvmTx,
      onSwitchSolNetwork,
      onSendSolTx,
      onSendMultiSolTx,
      onSwitchCosmosNetwork,
      onSendCosmosTx,
      onSendMultiCosmosTx,
    ],
  );
}
