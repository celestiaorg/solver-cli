"use client";

import { ArrowLeft, X } from "@phosphor-icons/react";

import React from "react";

import { PrevArrowIcon } from "../../components/icons/arrow";
import { ListMessage } from "../../components/miscellaneous";
import { Button } from "../../components/ui/button";

import { useRelayFlowStore } from "../../store/swaps";

type FailureScreenProps = {
  className?: string;
};

export const RelayFailureScreen: React.FC<FailureScreenProps> = ({
  className,
}) => {
  const setScreen = useRelayFlowStore((state) => state.setScreen);

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
        <div className="text-sm font-semibold">Back</div>
      </div>
      <ListMessage
        icon={<X className="size-8 text-red-500" />}
        message="Transaction Failed"
        subtext="Something went wrong during the transaction. Please try again."
      />
      <Button
        className="mt-auto w-full"
        size="lg"
        onClick={() => setScreen("home")}
      >
        Try Again
      </Button>
    </>
  );
};
