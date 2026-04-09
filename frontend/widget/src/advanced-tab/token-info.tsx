import { AnimatePresence, motion } from "framer-motion";

import React, { useMemo } from "react";

import { GenericFallbackIcon } from "../icons";
import { opacityFadeInOut, transition150 } from "../lib/motion";
import { ChainRef, InputType, TokenRef } from "../lib/types";
import { formatAmount } from "../lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";

export const DestinationTokenInfo: React.FC<{
  assetData?: TokenRef;
  chainData?: ChainRef;
  outAmount?: string;
  displayFormat?: InputType;
}> = ({ assetData, chainData, displayFormat, outAmount = "0" }) => {
  const formattedAmount = useMemo(() => {
    if (!assetData) return "0";

    const amount = formatAmount(outAmount);

    if (displayFormat === InputType.FIAT) {
      return `$${amount}`;
    }
    return `${amount} ${assetData.symbol}`;
  }, [outAmount, assetData, displayFormat]);
  return (
    <div className="flex w-full items-center gap-4 overflow-hidden text-foreground">
      <div className="relative">
        <Avatar className="size-12">
          <AvatarImage src={assetData?.logoURI} />
          <AvatarFallback>
            <GenericFallbackIcon className="size-12" />
          </AvatarFallback>
        </Avatar>

        <Avatar className="absolute right-0 bottom-0 size-4 rounded-full">
          <AvatarImage src={chainData?.logoURI} />
          <AvatarFallback>
            <GenericFallbackIcon className="size-4" />
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="flex flex-col overflow-hidden">
        <span className="text-3.5xl truncate leading-10.75">
          {formattedAmount}
        </span>

        {chainData?.displayName && (
          <span className="text-secondary-foreground text-sm font-medium">
            on{" "}
            <AnimatePresence mode="wait">
              <motion.span
                key={chainData?.displayName}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={transition150}
                variants={opacityFadeInOut}
              >
                {chainData?.displayName}
              </motion.span>
            </AnimatePresence>
          </span>
        )}
      </div>
    </div>
  );
};
