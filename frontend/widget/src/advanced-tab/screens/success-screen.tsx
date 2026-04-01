"use client";

import React, { useMemo } from "react";

import { useMultiProvider } from "../../hooks/use-chains";

import { SuccessBanner } from "../../components/success-banner";
import { Button } from "../../components/ui/button";

import { useHyperlaneFlowStore } from "../../store/bridge";
import { useTransferStore } from "../../store/transfers";

import { PrevArrowIcon } from "../../components/icons/arrow";
import { ArrowLeft } from "@phosphor-icons/react";

type HyperlaneSuccessScreenProps = {
  className?: string;
};

export const HyperlaneSuccessScreen: React.FC<HyperlaneSuccessScreenProps> = ({
  className,
}) => {
  const setScreen = useHyperlaneFlowStore((state) => state.setScreen);
  const transfers = useTransferStore((state) => state.transfers);
  const fromAmount = useHyperlaneFlowStore((state) => state.state.from.amount);
  const toChain = useHyperlaneFlowStore((state) => state.state.to.chain);
  const fromToken = useHyperlaneFlowStore((state) => state.state.from.token);

  const multiProvider = useMultiProvider();

  const explorerLink = useMemo(() => {
    const lastTransfer = transfers[transfers.length - 1];
    if (!lastTransfer) return undefined;
    const { origin, msgId, originTxHash } = lastTransfer;

    const explorerLink = multiProvider.tryGetExplorerTxUrl(origin, {
      hash: msgId || (originTxHash as string),
    });
    return explorerLink as string | undefined;
  }, [transfers, multiProvider]);

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
        recivedAmount={fromAmount}
        toChain={toChain}
        toToken={fromToken}
        explorerLink={explorerLink}
      />
      <Button
        className="mt-auto w-full transition-all hover:scale-105"
        size="lg"
        onClick={() => setScreen("home")}
      >
        Bridge Again
      </Button>
    </>
  );
};
