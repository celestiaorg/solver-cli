import { AnimatePresence, motion } from "framer-motion";

import { GasPump } from "../components/icons/gas-pump";
import { Skeleton } from "../components/ui/skeleton";

import { opacityFadeInOut, transition150 } from "../lib/motion";
import type { GasInfo } from "../lib/types";

const getGasInfoChildren = (opts: { gasInfo: GasInfo; isLoading: boolean }) => {
  if (opts.isLoading) {
    return {
      id: "loading",
      children: <Skeleton className="bg-foreground/25 h-4 w-20" />,
    };
  }

  if (opts.gasInfo) {
    return {
      id: "gas-info",
      children: (
        <span className="flex gap-1">
          {opts.gasInfo.gasFees.map((fee, index) => (
            <span key={index}>
              {fee.amount} {fee.symbol}
            </span>
          ))}
          {opts.gasInfo.fiatAmount && `(${opts.gasInfo.fiatAmount})`}
        </span>
      ),
    };
  }

  return {
    id: "no-gas-info",
    children: <span>-</span>,
  };
};

export const GasFee = (opts: { gasInfo: GasInfo; isLoading: boolean }) => {
  const { id, children } = getGasInfoChildren(opts);

  return (
    <div className="flex items-center gap-1">
      <GasPump className="size-4" />

      <div className="text-secondary-foreground text-xs font-medium">
        <AnimatePresence mode="wait">
          <motion.div
            key={id}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={transition150}
            variants={opacityFadeInOut}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
