import { AnimatePresence, motion, Variants } from "framer-motion";

import { SelectType } from "../types";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

import { GenericFallbackIcon } from "../../icons";
import { transition150 } from "../../lib/motion";
import { ChainRef } from "../../lib/types";
import { cn } from "../../lib/utils";

const fadeUp: Variants = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
};

const fadeDown: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const selectTypeLabel = {
  source: "From",
  destination: "To",
} satisfies Record<SelectType, string>;

export function SideMini(props: {
  title: string;
  chainDetails?: ChainRef;
  selectType: "source" | "destination";
  onClick?: () => void;
}) {
  return (
    <button
      className={cn(
        "text-md bg-card-foreground rounded-md2 hover:bg-foreground/10 flex h-auto w-full flex-1 cursor-pointer items-center gap-3 overflow-hidden px-4 py-3 text-start transition-all hover:scale-105",
        props.selectType === "destination" && "flex-row-reverse text-end",
      )}
      onClick={props.onClick}
    >
      <AnimatePresence mode="wait">
        <Avatar className="h-6 w-6 rounded-full" asChild>
          <motion.div
            key={props.chainDetails?.logoURI}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={props.selectType === "source" ? fadeUp : fadeDown}
            transition={transition150}
          >
            <AvatarImage
              className="rounded-full"
              src={props.chainDetails?.logoURI}
            />
            <AvatarFallback className="rounded-full">
              <GenericFallbackIcon />
            </AvatarFallback>
          </motion.div>
        </Avatar>
      </AnimatePresence>

      <div className="flex max-w-full flex-col overflow-hidden">
        {/*  <span className="text-secondary-foreground text-sm font-medium">
          {selectTypeLabel[props.selectType]}
        </span> */}

        <AnimatePresence mode="wait">
          <motion.span
            key={props.chainDetails?.displayName}
            className="truncate font-bold text-foreground"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={props.selectType === "source" ? fadeDown : fadeUp}
            transition={transition150}
          >
            {props.chainDetails?.displayName ?? "Select Chain"}
          </motion.span>
        </AnimatePresence>
      </div>
    </button>
  );
}
