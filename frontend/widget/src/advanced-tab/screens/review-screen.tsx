"use client";

import BigNumber from "bignumber.js";

import React, { useEffect, useMemo } from "react";

import { useGasInfo } from "../../hooks/use-gas-info";
import { useTriggerTx } from "../../hooks/use-trigger-tx";
import { useUSDPrice } from "../../hooks/use-usd-price";

import { ConversionRateDisplayForTransfer } from "../../components/miscellaneous";
import { TxnProcessing, TxnRoute } from "../../components/txn-processing";
import { TxnReview } from "../../components/txn-review";
import { Button } from "../../components/ui/button";

import { InputType } from "../../lib/types";
import { useHyperlaneFlowStore } from "../../store/bridge";
import { useTransferStore } from "../../store/transfers";

import { TxnInfo } from "../../components/txn-info";

type HyperlaneReviewScreenProps = {
  className?: string;
};

export const HyperlaneReviewScreen: React.FC<HyperlaneReviewScreenProps> = ({
  className,
}) => {
  // Store selectors
  const fromChain = useHyperlaneFlowStore((state) => state.state.from.chain);
  const toChain = useHyperlaneFlowStore((state) => state.state.to.chain);
  const fromToken = useHyperlaneFlowStore((state) => state.state.from.token);
  const fromAmount = useHyperlaneFlowStore((state) => state.state.from.amount);
  const amountDisplayFormat = useHyperlaneFlowStore(
    (state) => state.state.amountDisplayFormat,
  );
  const setScreen = useHyperlaneFlowStore((state) => state.setScreen);
  const transfers = useTransferStore((state) => state.transfers);

  const { data: usdPrice } = useUSDPrice(fromToken?.coingeckoId as string);

  const inputAmount = useMemo(() => {
    if (!fromAmount) return "0";
    let amountInTokens = new BigNumber(fromAmount);
    if (amountDisplayFormat === InputType.FIAT) {
      if (!usdPrice) return "0";
      const fiatAmount = new BigNumber(fromAmount);
      amountInTokens = fiatAmount.dividedBy(usdPrice);
    }
    return amountInTokens.toString();
  }, [fromAmount, usdPrice, amountDisplayFormat]);

  const currentTxStatus = useMemo(() => {
    return transfers[transfers.length - 1]?.status;
  }, [transfers]);

  const { handleConfirm, txStatus, txs, isApproveRequired, isTxsLoading } =
    useTriggerTx({
      fromChain,
      fromToken,
      toChain,
      inputAmount: inputAmount,
    });

  useEffect(() => {
    if (txStatus === "error") {
      setScreen("failure");
    } else if (txStatus === "success") {
      setScreen("success");
    }
  }, [txStatus, setScreen]);

  const { isFetching: isGasLoading, gasInfo } = useGasInfo(
    {
      originChainId: fromChain?.key as string,
      destinationChainId: toChain?.key as string,
      asset: fromToken?.key,
      inputAmount: inputAmount || "0",
    },
    false,
  );

  return (
    <>
      <div className="flex-1">
        <TxnReview
          fromAmount={fromAmount}
          fromToken={fromToken}
          fromChain={fromChain}
          toAmount={fromAmount}
          toToken={fromToken}
          toChain={toChain}
          displayFormat={amountDisplayFormat}
          onBack={() => setScreen("home")}
        />
        <TxnInfo gasInfo={gasInfo} isGasLoading={isGasLoading}>
          <ConversionRateDisplayForTransfer fromToken={fromToken} />
        </TxnInfo>
        {txs && !isTxsLoading && txs?.length > 1 ? <TxnRoute /> : null}
      </div>
      {(txStatus === "loading" || txStatus === "validating") && (
        <div className="mt-auto w-full">
          <TxnProcessing
            txCount={txs?.length}
            currentTxStatus={currentTxStatus}
          />
        </div>
      )}
      {txStatus === "idle" && (
        <Button
          className="mt-auto w-full"
          size="lg"
          onClick={() => handleConfirm({ gas: gasInfo })}
          disabled={isGasLoading || isTxsLoading}
        >
          Confirm
        </Button>
      )}
    </>
  );
};
