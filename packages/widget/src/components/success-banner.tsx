import { GenericFallbackIcon } from "../icons";
import type { ChainRef, TokenRef } from "../lib/types";
import { formatAmount } from "../lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export const SuccessBanner: React.FC<{
  recivedAmount: string;
  toChain?: ChainRef;
  toToken?: TokenRef;
  explorerLink?: string;
}> = ({ recivedAmount, toChain, toToken, explorerLink }) => {
  return (
    <div className="my-auto flex flex-col items-center gap-3 rounded-xl px-5 py-6">
      <div className="text-sm font-semibold">Txn Successful!</div>
      <div className="relative mb-3">
        <Avatar className="size-24">
          <AvatarImage src={`${toToken?.logoURI}`} />
          <AvatarFallback>
            <GenericFallbackIcon className="size-24" />
          </AvatarFallback>
        </Avatar>

        <Avatar className="absolute right-0 bottom-0 size-8 rounded-full">
          <AvatarImage src={toChain?.logoURI} />
          <AvatarFallback>
            <GenericFallbackIcon className="size-8" />
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="text-center">
        <p className="text-3.5xl font-bold">
          {" "}
          {formatAmount(recivedAmount)} {toToken?.symbol}
        </p>
        <p className="text-sm font-normal">
          Received on {toChain?.displayName}
        </p>
      </div>
      {explorerLink && (
        <a
          className="text-sm underline"
          href={explorerLink}
          target="_blank"
          rel="noreferrer"
        >
          View on Explorer
        </a>
      )}
    </div>
  );
};
