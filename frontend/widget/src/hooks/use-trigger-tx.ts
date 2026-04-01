import { ChainName, TokenAmount } from "@hyperlane-xyz/sdk";
import { ProtocolType, toWei } from "@hyperlane-xyz/utils";

import { useCallback, useState } from "react";

import { useAccounts } from "./use-accounts";
import { useAddress } from "./use-address";
import { useIsApproveRequired } from "./use-approval";
import { getAssetByDenom, useWarpCore } from "./use-assets";
import { useChainMetadataById, useChainName } from "./use-chains";
import { useRemoteTransactions, useTransfer } from "./use-transfer";

import {
  ChainRef,
  GasInfo,
  SentTransferStatuses,
  TokenRef,
  TransferStatus,
} from "../lib/types";
import { tryCatch } from "../lib/utils";
import { useTransferStore } from "../store/transfers";

export type TxStatus = "error" | "success" | "loading" | "validating" | "idle";

const trackTransferStatus = (
  transferIndex: number,
): Promise<string | undefined> => {
  return new Promise((resolve, reject) => {
    const checkStatus = () => {
      const currentTransfers = useTransferStore.getState().transfers;
      const transfer = currentTransfers[transferIndex];

      if (!transfer) {
        reject(new Error("Transfer not found"));
        return;
      }

      if (SentTransferStatuses.includes(transfer.status)) {
        resolve(transfer.msgId);
      } else if (transfer.status === TransferStatus.Failed) {
        reject(new Error("Transaction failed to deliver"));
      } else {
        setTimeout(checkStatus, 1000);
      }
    };

    setTimeout(checkStatus, 1000);
  });
};

export const useTriggerTx = (args: {
  fromToken?: TokenRef;
  fromChain?: ChainRef;
  toChain?: ChainRef;
  inputAmount: string;
}) => {
  const inputAmount = args.inputAmount;
  const warpCore = useWarpCore();
  const { accounts } = useAccounts();
  const originToken = getAssetByDenom(warpCore, args.fromToken?.key);
  const sourceChainName = useChainName(args.fromChain?.key as string);
  const destinationChainName = useChainName(args.toChain?.key as string);
  const sourceChainMetadata = useChainMetadataById(
    args.fromChain?.key as string,
  );
  const destinationChainMetadata = useChainMetadataById(
    args.toChain?.key as string,
  );
  const sourceAddress = useAddress(sourceChainMetadata);
  const recipientAddress = useAddress(destinationChainMetadata);

  let senderPubKey: string | undefined;
  if (
    sourceChainMetadata &&
    (sourceChainMetadata.chainType === ProtocolType.Cosmos ||
      sourceChainMetadata.chainType === ProtocolType.CosmosNative)
  ) {
    const account = accounts[sourceChainMetadata.chainType];
    senderPubKey = account?.publicKey?.[String(sourceChainMetadata?.chainId)];
  }

  const isNft = originToken?.isNft();

  const [txStatus, setTxStatus] = useState<TxStatus>("idle");

  const amountWei = isNft
    ? inputAmount.toString()
    : toWei(inputAmount, originToken?.decimals);

  const { isLoading: isApproveLoading, isApproveRequired } =
    useIsApproveRequired(sourceAddress as string, originToken, amountWei);

  const { data: txs, isLoading: isTxsLoading } = useRemoteTransactions({
    destination: destinationChainName as ChainName,
    sender: sourceAddress as string,
    recipient: recipientAddress as string,
    originTokenAmount: originToken?.amount(amountWei) as TokenAmount,
  });

  const { triggerTransactions, isLoading: isTransferLoading } = useTransfer();

  /*   const trackTransfer = useCallback(
    async (transferIndex: number) => {
      const toastIcons = (
        <ToastIcons
          sourceChainImg={sourceChainMetadata?.logoURI}
          destinationChainImg={destinationChainMetadata?.logoURI}
        />
      );

      const successToastId = toast(
        <ToastItem
          icon={toastIcons}
          title="Bridging in progress..."
          description={`Transferring from ${sourceChainMetadata?.displayName} to ${destinationChainMetadata?.displayName}`}
        />
      );

      const [msgId, transferError] = await tryCatch(
        trackTransferStatus(transferIndex)
      );

      toast.dismiss(successToastId);
      if (transferError) {
        toast.error('Transaction failed to deliver', {
          description: transferError.message,
        });
        return;
      }

      const explorerLink = multiProvider.tryGetExplorerTxUrl(
        sourceChainName as ChainName,
        { hash: msgId as string }
      );

      toast(
        <ToastItem
          icon={toastIcons}
          title="Bridge successful!"
          description={`${formatAmount(inputAmount)} ${originToken?.symbol} transferred to ${destinationChainMetadata?.displayName}`}
          onClick={
            msgId
              ? () => window.open(explorerLink as string, '_blank')
              : undefined
          }
        />
      );
    },
    [
      sourceChainMetadata,
      destinationChainMetadata,
      originToken,
      inputAmount,
      multiProvider,
      sourceChainName,
    ]
  ); */
  const handleConfirm = useCallback(
    async ({ gas }: { gas: GasInfo }) => {
      /*       setTxStatus('validating');
      const [validation, validationError] = await tryCatch(
        warpCore.validateTransfer({
          destination: destinationChainName as ChainName,
          sender: sourceAddress as string,
          recipient: recipientAddress as string,
          originTokenAmount: new TokenAmount(amountWei, originToken!),
          senderPubKey,
        })
      );

      if (validation || validationError) {
        const errorMessage =
          Object.values(validation || {})[0] || 'Something went wrong';

        toast.error('Transaction failed', {
          description: errorMessage,
        });

        setTxStatus('error');
        return;
      } */

      setTxStatus("loading");

      //const transferIndex = transfers.length;

      const [, error] = await tryCatch(
        triggerTransactions({
          denom: args.fromToken?.key as string,
          origin: sourceChainName as ChainName,
          destination: destinationChainName as ChainName,
          amount: inputAmount,
          recipient: recipientAddress as string,
          sourceAddress: sourceAddress as string,
          gasInfo: gas,
        }),
      );

      if (error) {
        setTxStatus("error");
        return;
      }

      setTxStatus("success");
      //trackTransfer(transferIndex);
    },
    [
      destinationChainName,
      recipientAddress,
      triggerTransactions,
      args.fromToken?.key,
      inputAmount,
      sourceChainName,
      sourceAddress,
    ],
  );

  return {
    isApproveRequired,
    isApproveLoading,
    isTransferLoading,
    handleConfirm,
    txStatus,
    txs,
    isTxsLoading,
  };
};
