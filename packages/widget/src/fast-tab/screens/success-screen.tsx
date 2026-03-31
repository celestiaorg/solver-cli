"use client";

import React, { useMemo } from "react";

import { useRelayChains } from "../../hooks/use-chains";

import { PrevArrowIcon } from "../../components/icons/arrow";
import { SuccessBanner } from "../../components/success-banner";
import { Button } from "../../components/ui/button";

import { useRelayFlowStore } from "../../store/swaps";
import { getRelayChainId } from "../../lib/utils";
import { ArrowLeft } from "@phosphor-icons/react";

type SuccessScreenProps = {
  className?: string;
};

export const RelaySuccessScreen: React.FC<SuccessScreenProps> = ({
  className,
}) => {
  const setScreen = useRelayFlowStore((state) => state.setScreen);
  const txData = useRelayFlowStore((state) => state.state.txData);
  const toChain = useRelayFlowStore((state) => state.state.to.chain);
  const toToken = useRelayFlowStore((state) => state.state.to.token);

  const { data } = useRelayChains();
  const chainItems = data?.chains;

  const receivedAmount = txData?.details?.currencyOut?.amountFormatted || "0";

  const explorerLink = useMemo(() => {
    if (txData?.txHashes) {
      const { txHash, chainId } = txData.txHashes[0];
      const sourceChainData = chainItems?.find(
        (chain) => getRelayChainId(chain.chainId) == chainId,
      );
      if (sourceChainData?.explorerUrl) {
        return `${sourceChainData.explorerUrl}/tx/${txHash}`;
      }
    }
    return "";
  }, [txData, chainItems]);

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-foreground">
        <button
          type="button"
          onClick={() => setScreen("home")}
          aria-label="Back"
          className="text-foreground/80 hover:bg-foreground/10 rounded-full p-1"
        >
          <ArrowLeft className="size-4 text-foreground" />
        </button>
      </div>
      <SuccessBanner
        recivedAmount={receivedAmount}
        toChain={toChain}
        toToken={toToken}
        explorerLink={explorerLink}
      />
      <Button
        className="mt-auto w-full"
        size="lg"
        onClick={() => setScreen("home")}
      >
        Swap Again
      </Button>
    </>
  );
};
