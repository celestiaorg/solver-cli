"use client";

import { CheckCircle } from "@phosphor-icons/react";

import React, { useEffect, useState } from "react";

import { TransferStatus } from "../lib/types";

type ProcessingProps = {
  message?: string;
  subMessage?: string;
  txCount?: number;
  currentTxStatus?: TransferStatus;
};

export const TxnProcessing: React.FC<ProcessingProps> = ({
  message,
  subMessage,
  txCount = 1,
  currentTxStatus,
}) => {
  const [currenIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentTxStatus === TransferStatus.ConfirmingApprove) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }
  }, [currentTxStatus]);
  const txns = new Array(txCount).fill(0);
  return (
    <div>
      <div className="flex flex-col items-center gap-3 text-center text-foreground">
        <div className="flex items-center justify-center gap-4">
          {txns.map((_, index) => {
            if (index === currenIndex) {
              return (
                <div
                  key={index}
                  className="border-foreground/30 border-t-foreground size-4 animate-spin rounded-full border-2"
                />
              );
            } else if (index < currenIndex) {
              return <CheckCircle key={index} className="size-4" />;
            }
            return (
              <div
                key={index}
                className="border-foreground/30 text-muted-foreground flex size-4 items-center justify-center rounded-full border-2 text-[10px]"
              >
                {index + 1}
              </div>
            );
          })}
        </div>

        <div className="text-sm">
          {message || "Sign your transaction in your wallet to continue"}
        </div>
        <div className="text-muted-foreground text-xs">
          {subMessage ||
            "If your wallet does not show a transaction request or never confirms, please try the transfer again."}
        </div>
      </div>
    </div>
  );
};

export const TxnRoute = () => {
  return (
    <div className="bg-secondary rounded-2xl border p-4 text-xs text-foreground">
      Multi-step transactions require more than one approval.
    </div>
  );
};
