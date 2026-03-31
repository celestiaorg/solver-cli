"use client";

import { ProtocolType } from "@hyperlane-xyz/utils";
import {
  type AdaptedWallet,
  type Execute,
  getClient,
  type ProgressData,
} from "@relayprotocol/relay-sdk";
import { adaptSolanaWallet } from "@relayprotocol/relay-svm-wallet-adapter";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  type SendOptions,
  VersionedTransaction,
} from "@solana/web3.js";
import { type WalletClient } from "viem";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useRelayChains } from "../hooks/use-chains";

import { TxnProcessing } from "../components/txn-processing";
import { type ReviewProps, TxnReview } from "../components/txn-review";
import { Button } from "../components/ui/button";

import { RelayChainId, type RelayRouteResponse } from "../lib/relay-api";
import { SwapTxnStatus, type SwapTxnStatusData } from "../lib/types";
import { getRelayChainId } from "../lib/utils";

export class TxnError extends Error {
  /**
   *
   * @param code Error Code
   * @param txnIndex Error Transaction Index
   * @param message Error Message
   */
  constructor(code: number, txnIndex: number, message: string) {
    super(message);
    this.code = code;
    this.txnIndex = txnIndex;
  }

  public code: number;
  public txnIndex: number;
}

type RelayReviewProps = ReviewProps & {
  children?: React.ReactNode;
  quote?: RelayRouteResponse;
  onComplete?: (args: {
    screen: "success" | "failure";
    payload: ProgressData;
  }) => void;
};

export const RelayReview: React.FC<RelayReviewProps> = (props) => {
  const [txState, setTxState] = React.useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const { data } = useRelayChains();
  const [progressData, setProgressData] = useState<ProgressData | undefined>(
    undefined,
  );
  const chains = data?.chains;

  const transactionCount = props.quote?.steps.length || 0;

  const { data: evmWallet } = useWalletClient();
  const { connector, chain: evmActiveChain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { wallet: solanaWallet } = useSolanaWallet();

  const [lastError, setLastError] = useState<TxnError>();

  const [txnStatuses, setTxnStatuses] = useState(
    new Array(transactionCount).fill({
      status: SwapTxnStatus.IDLE,
    }),
  );

  const getTransactingWalletClient = async () => {
    try {
      if (props.fromChain?.chainType === ProtocolType.Ethereum) {
        if (evmActiveChain?.id !== Number(props.fromChain?.key)) {
          await handleNetworkSwitch();
        }
        return {
          wallet: evmWallet,
          name: connector?.name.toLowerCase().replace(" ", "-") ?? "unknown",
        };
      }

      if (props.fromChain?.chainType === ProtocolType.Sealevel && chains) {
        let rpc = "";
        const solanaChain = chains?.find(
          (chain) => chain.chainId === props.fromChain?.key,
        );

        if (
          getRelayChainId(solanaChain?.chainId as string) ===
          Number(RelayChainId.solana)
        ) {
          rpc =
            "https://mainnet.helius-rpc.com/?api-key=5175da47-fc80-456d-81e2-81e6e7459f73";
        } else if (solanaChain) {
          rpc = solanaChain?.rpcUrl;
        }
        const solanaConnection = new Connection(rpc);

        const solanaAdaptedWallet = adaptSolanaWallet(
          solanaWallet?.adapter.publicKey?.toBase58() as string,
          getRelayChainId(solanaChain?.chainId as string),
          solanaConnection,
          async (txn, options) => {
            const res = await solanaWallet?.adapter.sendTransaction(
              txn as VersionedTransaction,
              solanaConnection,
              options as SendOptions,
            );
            return {
              signature: res as string,
            };
          },
        );
        return {
          wallet: solanaAdaptedWallet,
          name:
            solanaWallet?.adapter.name.toLowerCase().replace(" ", "-") ??
            "unknown",
        };
      }
      throw new Error("No wallet client found");
    } catch (e) {
      throw new Error("Error getting transacting wallet client", e as any);
    }
  };

  const updateTxnStatus = useCallback(
    (index: number, status: SwapTxnStatusData) => {
      setTxnStatuses((prevState) => {
        const newState = [...prevState];
        newState[index] = status;
        return newState;
      });
    },
    [],
  );

  useEffect(() => {
    if (!chains) return;
    const executingTxnIndex = 0;

    const currentStep = progressData?.currentStep ?? progressData?.steps[0];
    if (currentStep) {
      const currentStepItem =
        progressData?.currentStepItem ?? currentStep.items[0];
      if (currentStepItem?.errorData) {
        const name = currentStepItem.errorData?.name;
        if (name?.includes("SolverStatusTimeoutError")) {
          setLastError(
            new TxnError(
              9,
              executingTxnIndex,
              `SolverStatusTimeoutError ${currentStepItem.errorData.txHash}`,
            ),
          );
        } else {
          setLastError(
            new TxnError(4, executingTxnIndex, "Transaction failed"),
          );
        }
      }
      switch (currentStepItem?.progressState) {
        case "confirming": {
          if (currentStep.id === "approve") {
            updateTxnStatus(executingTxnIndex, {
              status: SwapTxnStatus.CONFIRMING_ALLOWANCE,
            });
          } else {
            updateTxnStatus(executingTxnIndex, {
              status: SwapTxnStatus.NEEDS_APPROVAL,
            });
          }
          break;
        }
        case "signing": {
          updateTxnStatus(executingTxnIndex, {
            status: SwapTxnStatus.NEEDS_APPROVAL,
          });
          break;
        }
        case "posting":
        case "validating": {
          updateTxnStatus(executingTxnIndex, {
            status: SwapTxnStatus.BROADCASTING,
          });
          break;
        }
        case "complete": {
          if (currentStep.id === "approve" && currentStepItem?.txHashes) {
            const transactingChain = chains?.find(
              (chain) =>
                currentStepItem.txHashes &&
                Number(chain.chainId) === currentStepItem.txHashes[0].chainId,
            );
            // broadcasted approve tx
            updateTxnStatus(executingTxnIndex, {
              status: SwapTxnStatus.BROADCASTED,
              txHash: currentStepItem.txHashes[0].txHash,
              chainId: String(currentStepItem?.txHashes[0].chainId),
              explorerLink: transactingChain
                ? `${transactingChain?.explorerUrl}/tx/${currentStepItem.txHashes[0].txHash}`
                : "",
            });
            break;
          }
          if (!currentStepItem?.internalTxHashes) {
            // broadcast failed
            setLastError(
              new TxnError(
                5,
                executingTxnIndex,
                "Transaction broadcast failed",
              ),
            );
          } else {
            const txHash = currentStepItem?.internalTxHashes[0].txHash;
            if (txHash) {
              // log
            }
            const transactingChain = chains?.find(
              (chain) =>
                currentStepItem.internalTxHashes &&
                Number(chain.chainId) ===
                  currentStepItem.internalTxHashes[0].chainId,
            );
            updateTxnStatus(executingTxnIndex, {
              status: SwapTxnStatus.BROADCASTED,
              txHash: currentStepItem.internalTxHashes[0].txHash,
              chainId: String(currentStepItem?.internalTxHashes[0].chainId),
              explorerLink: transactingChain
                ? `${transactingChain?.explorerUrl}/tx/${currentStepItem.internalTxHashes[0].txHash}`
                : "",
            });
          }
          break;
        }
      }
    }
  }, [chains, progressData, updateTxnStatus]);

  const handleConfirm = useCallback(async () => {
    setTxState("pending");
    try {
      const transactingWalletClient = await getTransactingWalletClient();
      getClient()
        .actions.execute({
          quote: props.quote as Execute,
          wallet: transactingWalletClient?.wallet as
            | AdaptedWallet
            | WalletClient,
          onProgress: (args) => {
            setProgressData(args);
          },
        })
        .catch((e) => {
          throw e;
        });
    } catch (e) {
      setTxState("error");
      props.onComplete?.({ screen: "failure", payload: progressData } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getTransactingWalletClient, props]);

  const currentSwapStatus = useMemo(() => {
    if (lastError?.code) {
      return "FAILED" as const;
    }
    if (txnStatuses[0]?.status === SwapTxnStatus.BROADCASTED) {
      return "SUCCESS" as const;
    }
  }, [lastError, txnStatuses]);

  useEffect(() => {
    if (currentSwapStatus === "SUCCESS") {
      setTxState("success");
      props.onComplete?.({ screen: "success", payload: progressData } as any);
    } else if (currentSwapStatus === "FAILED") {
      setTxState("error");
      props.onComplete?.({ screen: "failure", payload: progressData } as any);
    }
  }, [currentSwapStatus, transactionCount, props, progressData]);

  const handleNetworkSwitch = useCallback(async () => {
    if (!props.fromChain?.key || !switchChainAsync) {
      return;
    }

    try {
      await switchChainAsync({
        chainId: Number(props.fromChain?.key) as number,
      });
    } catch {
      // do nothing
    }
  }, [props.fromChain?.key, switchChainAsync]);

  return (
    <>
      <div className="flex-1">
        <TxnReview
          fromAmount={props.fromAmount}
          fromToken={props.fromToken}
          fromChain={props.fromChain}
          toAmount={props.toAmount}
          toToken={props.toToken}
          toChain={props.toChain}
          onBack={props.onBack}
          displayFormat={props.displayFormat}
        />

        {props.children}
      </div>
      {txState === "pending" && (
        <div className="mt-auto w-full">
          <TxnProcessing />
        </div>
      )}
      {txState === "idle" && (
        <Button
          className="mt-auto w-full transition-all hover:scale-105"
          size="lg"
          onClick={handleConfirm}
        >
          Confirm
        </Button>
      )}
    </>
  );
};

export default RelayReview;
