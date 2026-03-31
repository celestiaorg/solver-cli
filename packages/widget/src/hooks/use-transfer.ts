import {
  IToken,
  ProviderType,
  TokenAmount,
  TypedTransactionReceipt,
  WarpCore,
  WarpTxCategory,
} from "@hyperlane-xyz/sdk";
import { ProtocolType, toTitleCase, toWei } from "@hyperlane-xyz/utils";
import { useQuery } from "@tanstack/react-query";

import { useCallback, useState } from "react";

import {
  SupportedProtocols,
  TransferContext,
  TransferFormValues,
  TransferStatus,
} from "../lib/types";
import {
  getChainDisplayName,
  tryGetMsgIdFromTransferReceipt,
} from "../lib/utils";
import { TransferState, useTransferStore } from "../store/transfers";
import { logger } from "../utils/logger";

import { useAccounts } from "./use-accounts";
import { useActiveChains } from "./use-active-chains";
import { getAssetByDenom, useWarpCore } from "./use-assets";
import { useMultiProvider } from "./use-chains";
import {
  useCosmosTransactionFns,
  useTransactionFns,
} from "./use-transaction-fns";
import {
  TransferTxnInfo,
  TxnSignApprovedArgs,
  useTxLogging,
} from "./use-txn-log";

const CHAIN_MISMATCH_ERROR = "ChainMismatchError";
const TRANSFER_TIMEOUT_ERROR1 = "block height exceeded";
const TRANSFER_TIMEOUT_ERROR2 = "timeout";

export function useTransfer() {
  const { transfers, addTransfer, updateTransferStatus } = useTransferStore();
  const transferIndex = transfers.length;

  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const activeAccounts = useAccounts();
  const activeChains = useActiveChains(multiProvider);
  const transactionFns = useTransactionFns(multiProvider);
  const { isLoading: isCosmosTransactionFnsLoading } =
    useCosmosTransactionFns(multiProvider);

  const { logTx } = useTxLogging();

  const [isLoading, setIsLoading] = useState(false);

  // TODO implement cancel callback for when modal is closed?
  const triggerTransactions = useCallback(
    (values: TransferFormValues) =>
      executeTransfer({
        warpCore,
        values,
        transferIndex,
        activeAccounts,
        activeChains,
        transactionFns,
        addTransfer,
        updateTransferStatus,
        setIsLoading,
        logTx,
      }),
    [
      warpCore,
      transferIndex,
      activeAccounts,
      activeChains,
      transactionFns,
      setIsLoading,
      addTransfer,
      updateTransferStatus,
      logTx,
    ],
  );

  return {
    isLoading: isLoading || isCosmosTransactionFnsLoading,
    triggerTransactions,
  };
}

interface TransferExecutionContext {
  warpCore: WarpCore;
  values: TransferFormValues;
  transferIndex: number;
  activeAccounts: ReturnType<typeof useAccounts>;
  activeChains: ReturnType<typeof useActiveChains>;
  transactionFns: ReturnType<typeof useTransactionFns>;
  addTransfer: (t: TransferContext) => void;
  updateTransferStatus: TransferState["updateTransferStatus"];
  setIsLoading: (b: boolean) => void;
  logTx: (txnData: TxnSignApprovedArgs) => void;
}

interface TransferPreparationResult {
  originToken: IToken;
  connection: ReturnType<IToken["getConnectionForChain"]>;
  originProtocol: SupportedProtocols;
  originTokenAmount: ReturnType<IToken["amount"]>;
  sender: string;
  multiProvider: WarpCore["multiProvider"];
}

async function prepareTransfer(
  context: TransferExecutionContext,
): Promise<TransferPreparationResult> {
  const {
    warpCore,
    values,
    transferIndex,
    activeAccounts,
    updateTransferStatus,
  } = context;
  const { destination, denom, amount, sourceAddress } = values;
  const multiProvider = warpCore.multiProvider;

  logger.debug("Preparing transfer transaction(s)");
  updateTransferStatus(transferIndex, TransferStatus.Preparing);

  const originToken = getAssetByDenom(warpCore, denom);
  const connection = originToken?.getConnectionForChain(destination);
  if (!originToken || !connection)
    throw new Error("No token route found between chains");

  // Type assertion since we've checked for null above
  const validOriginToken = originToken as IToken;
  const validConnection = connection;

  const originProtocol = validOriginToken.protocol as SupportedProtocols;
  const isNft = validOriginToken.isNft();
  const weiAmountOrId = isNft
    ? amount
    : toWei(amount, validOriginToken.decimals);
  const originTokenAmount = validOriginToken.amount(weiAmountOrId);

  const account = activeAccounts.accounts[originProtocol];
  if (!account) throw new Error("No active account found for origin chain");

  return {
    originToken: validOriginToken,
    connection: validConnection,
    originProtocol,
    originTokenAmount,
    sender: sourceAddress,
    multiProvider,
  };
}

async function validateCollateralAndCreateTransfer(
  context: TransferExecutionContext,
  preparation: TransferPreparationResult,
): Promise<void> {
  const { warpCore, values, transferIndex, addTransfer, updateTransferStatus } =
    context;
  const { origin, destination, amount, recipient } = values;
  const { originToken, connection, originTokenAmount, sender } = preparation;

  const isCollateralSufficient =
    await warpCore.isDestinationCollateralSufficient({
      originTokenAmount,
      destination,
    });
  if (!isCollateralSufficient) {
    throw new Error("Insufficient destination collateral");
  }

  addTransfer({
    timestamp: new Date().getTime(),
    status: TransferStatus.Preparing,
    origin,
    destination,
    originTokenAddressOrDenom: originToken.addressOrDenom,
    destTokenAddressOrDenom: connection?.token.addressOrDenom,
    sender,
    recipient,
    amount,
  });

  updateTransferStatus(transferIndex, TransferStatus.CreatingTxs);
}

async function executeTransactions(
  context: TransferExecutionContext,
  preparation: TransferPreparationResult,
): Promise<{
  hashes: string[];
  txReceipt: TypedTransactionReceipt | undefined;
  msgId: string | undefined;
}> {
  const {
    warpCore,
    values,
    transferIndex,
    transactionFns,
    activeChains,
    updateTransferStatus,
    logTx,
  } = context;
  const { origin, destination, recipient, gasInfo } = values;
  const {
    originProtocol,
    originTokenAmount,
    sender,
    multiProvider,
    originToken,
  } = preparation;

  const txs = await warpCore.getTransferRemoteTxs({
    originTokenAmount,
    destination,
    sender,
    recipient,
  });

  const sendTransaction = transactionFns[originProtocol].sendTransaction;
  const sendMultiTransaction =
    transactionFns[originProtocol].sendMultiTransaction;
  const activeChain = activeChains.chains[originProtocol];

  const hashes: string[] = [];
  let txReceipt: TypedTransactionReceipt | undefined = undefined;
  const txData = {
    txHash: "",
    address: sender,
    recipient,
    data: {
      type: "bridge_send",
      transferId: crypto.randomUUID(),
      fromChain: origin,
      toChain: destination,
      token: originToken,
      bridge: "hyperlane",
      provider: "",
    } as TransferTxnInfo,
    originChainProtocol: originProtocol,
    transactionCount: txs.length,
    amount: originTokenAmount.amount.toString(),
    walletClient: activeChain.walletClient,
    fees: gasInfo?.gasFees.map((fee) => ({
      denom: fee.denom ?? fee.symbol,
      amount: fee.amountRaw,
    })),
  } as TxnSignApprovedArgs;

  if (txs.length > 1 && txs.every((tx) => tx.type === ProviderType.Starknet)) {
    updateTransferStatus(
      transferIndex,
      txCategoryToStatuses[WarpTxCategory.Transfer][0],
    );
    const { hash, confirm } = await sendMultiTransaction({
      txs,
      chainName: origin,
      activeChainName: activeChain.chainName,
    });
    updateTransferStatus(
      transferIndex,
      txCategoryToStatuses[WarpTxCategory.Transfer][1],
    );
    txReceipt = await confirm();
    const description = toTitleCase(WarpTxCategory.Transfer);
    logger.debug(`${description} transaction confirmed, hash:`, hash);

    hashes.push(hash);
  } else {
    for (const tx of txs) {
      updateTransferStatus(transferIndex, txCategoryToStatuses[tx.category][0]);
      const { hash, confirm } = await sendTransaction({
        tx,
        chainName: origin,
        activeChainName: activeChain.chainName,
      });
      if (tx.category === WarpTxCategory.Transfer) {
        txData.txHash = hash;
        logTx(txData);
      }
      updateTransferStatus(transferIndex, txCategoryToStatuses[tx.category][1]);
      txReceipt = await confirm();
      const description = toTitleCase(tx.category);
      logger.debug(`${description} transaction confirmed, hash:`, hash);
      hashes.push(hash);
    }
  }

  const msgId = txReceipt
    ? tryGetMsgIdFromTransferReceipt(multiProvider, origin, txReceipt)
    : undefined;

  return { hashes, txReceipt, msgId };
}

function handleTransferError(
  error: unknown,
  transferStatus: TransferStatus,
  transferIndex: number,
  updateTransferStatus: TransferState["updateTransferStatus"],
  multiProvider: WarpCore["multiProvider"],
  origin: string,
): void {
  const errorDetails = error instanceof Error ? error.message : String(error);
  updateTransferStatus(transferIndex, TransferStatus.Failed);
  logger.error(`Error at stage ${transferStatus}`, { error, errorDetails });

  if (errorDetails.includes(CHAIN_MISMATCH_ERROR)) {
    // Wagmi switchNetwork call helps prevent this but isn't foolproof
  } else if (
    errorDetails.includes(TRANSFER_TIMEOUT_ERROR1) ||
    errorDetails.includes(TRANSFER_TIMEOUT_ERROR2)
  ) {
    logger.error(
      "Transaction timed out",
      `${getChainDisplayName(multiProvider, origin)} may be busy. Please try again.`,
    );
  } else {
    logger.error(
      "Unable to transfer tokens",
      errorMessages[transferStatus] || "Unable to transfer tokens.",
    );
  }
}

async function executeTransfer(context: TransferExecutionContext) {
  const { transferIndex, updateTransferStatus, setIsLoading } = context;

  setIsLoading(true);
  const transferStatus: TransferStatus = TransferStatus.Preparing;

  try {
    const preparation = await prepareTransfer(context);
    await validateCollateralAndCreateTransfer(context, preparation);

    const { hashes, msgId } = await executeTransactions(context, preparation);

    updateTransferStatus(transferIndex, TransferStatus.ConfirmedTransfer, {
      originTxHash: hashes.at(-1),
      msgId,
    });
  } catch (error: unknown) {
    handleTransferError(
      error,
      transferStatus,
      transferIndex,
      updateTransferStatus,
      context.warpCore.multiProvider,
      context.values.origin,
    );
    throw error;
  }

  setIsLoading(false);
}

const errorMessages: Partial<Record<TransferStatus, string>> = {
  [TransferStatus.Preparing]: "Error while preparing the transactions.",
  [TransferStatus.CreatingTxs]: "Error while creating the transactions.",
  [TransferStatus.SigningApprove]:
    "Error while signing the approve transaction.",
  [TransferStatus.ConfirmingApprove]:
    "Error while confirming the approve transaction.",
  [TransferStatus.SigningTransfer]:
    "Error while signing the transfer transaction.",
  [TransferStatus.ConfirmingTransfer]:
    "Error while confirming the transfer transaction.",
};

const txCategoryToStatuses: Record<
  WarpTxCategory,
  [TransferStatus, TransferStatus]
> = {
  [WarpTxCategory.Approval]: [
    TransferStatus.SigningApprove,
    TransferStatus.ConfirmingApprove,
  ],
  [WarpTxCategory.Revoke]: [
    TransferStatus.SigningRevoke,
    TransferStatus.ConfirmingRevoke,
  ],
  [WarpTxCategory.Transfer]: [
    TransferStatus.SigningTransfer,
    TransferStatus.ConfirmingTransfer,
  ],
};

export const useRemoteTransactions = ({
  originTokenAmount,
  destination,
  sender,
  recipient,
}: {
  originTokenAmount: TokenAmount;
  destination: string;
  sender: string;
  recipient: string;
}) => {
  const warpCore = useWarpCore();

  return useQuery({
    queryKey: ["useRemoteTxs", sender, recipient],
    retry: false,
    queryFn: async () => {
      return warpCore.getTransferRemoteTxs({
        originTokenAmount,
        destination,
        sender,
        recipient,
      });
    },
  });
};
