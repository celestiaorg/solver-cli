import React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

import { GenericFallbackIcon } from "../../icons";
import type { SupportedChain } from "../../lib/types";

import { Button } from "../ui/button";

export const ChainItemChip: React.FC<{
  chain: SupportedChain;
  isSelected?: boolean;
  onSelect?: () => void;
}> = (props) => {
  return (
    <Button
      key={props.chain.chainId}
      className="bg-secondary/40 h-auto min-w-[100px] items-center justify-start rounded-2xl border border-border/25 px-4 py-3"
      size="sm"
      variant="ghost"
      disabled={props.isSelected}
      onClick={props.onSelect}
    >
      <Avatar className="size-5 shrink-0 rounded-none">
        <AvatarImage src={props.chain.logoURI} />
        <AvatarFallback>
          <GenericFallbackIcon className="size-5" />
        </AvatarFallback>
      </Avatar>
      <span className="text-md font-bold">{props.chain.displayName}</span>
    </Button>
  );
};
