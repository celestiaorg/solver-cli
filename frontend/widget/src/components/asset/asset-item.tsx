import { AnimatePresence, motion, type Transition } from "framer-motion";

import { memo } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";

import { GenericFallbackIcon } from "../../icons";
import { opacityFadeInOut, transition150 } from "../../lib/motion";
import type { SupportedAsset, TokenBalanceData } from "../../lib/types";
import { formatAmount, getImageSrc } from "../../lib/utils";

export const assetItemVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

export const assetItemTransition: Transition = {
  duration: 0.2,
  ease: "easeOut",
};

const AssetItemRaw: React.FC<{
  asset: SupportedAsset;
  isSelected: boolean;
  onSelect: (denom: string) => void;
  balanceInfo?: TokenBalanceData;
  isLoadingBalances?: boolean;
}> = ({ asset, isSelected, onSelect, balanceInfo, isLoadingBalances }) => {
  return (
    <Button
      asChild
      key={asset.originDenom}
      size="sm"
      variant="ghost"
      className="text-foreground bg-secondary/40 rounded-md2 flex h-auto w-full items-center justify-start gap-3 px-3 py-2 ring-inset disabled:!opacity-50"
      onClick={() => onSelect(asset.originDenom)}
      disabled={isSelected}
    >
      <motion.button
        initial="initial"
        animate="animate"
        transition={assetItemTransition}
        variants={assetItemVariants}
      >
        <Avatar className="h-8 w-8 shrink-0 bg-white p-1">
          <AvatarImage src={getImageSrc(asset.logoUri) ?? ""} />
          <AvatarFallback>
            <GenericFallbackIcon />
          </AvatarFallback>
        </Avatar>

        <div className="w-full text-left">
          <div className="flex items-center justify-between">
            <span className="flex flex-col">
              <span className="text-base font-bold">{asset.symbol}</span>
              <span className="text-secondary-foreground text-xs capitalize">
                {asset.chainName}
              </span>
            </span>

            <AnimatePresence mode="wait">
              {isLoadingBalances ? (
                <motion.div
                  key="balance-skeleton"
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  transition={transition150}
                  variants={opacityFadeInOut}
                >
                  <Skeleton className="h-4 w-10" />
                </motion.div>
              ) : (
                <motion.div
                  key="balance"
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  transition={transition150}
                  variants={opacityFadeInOut}
                  className="flex flex-col items-end text-right"
                >
                  <span className="text-secondary-foreground text-xs font-medium">
                    {balanceInfo?.amount
                      ? `${formatAmount(balanceInfo?.amount)} ${asset.symbol}`
                      : ""}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.button>
    </Button>
  );
};

export const AssetItem = memo(AssetItemRaw);
