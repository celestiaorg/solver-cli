import { ChevronDown } from "lucide-react";

import { GenericFallbackIcon } from "../icons";
import { type ChainRef, InputType, type TokenRef } from "../lib/types";

import { FiatValueDisplay } from "./fiat-value";
import { PrevArrowIcon } from "./icons/arrow";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { ArrowLeft } from "@phosphor-icons/react";

export type ReviewProps = {
  fromAmount: string;
  fromToken?: TokenRef;
  fromChain?: ChainRef;
  toAmount: string;
  toToken?: TokenRef;
  toChain?: ChainRef;
  displayFormat?: InputType;
  onBack: () => void;
};

export const TxnReview: React.FC<ReviewProps> = (props) => {
  return (
    <div className="mb-5 text-foreground">
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={props.onBack}
          aria-label="Back"
          className="text-foreground/80 hover:bg-foreground/10 rounded-full p-1"
        >
          <ArrowLeft className="size-4 text-foreground" />
        </button>
        <div className="text-sm font-semibold">Review transaction</div>
      </div>

      <div className="relative flex flex-col gap-1">
        <ReviewRow
          title="You pay"
          amount={props.fromAmount || "0.00"}
          token={props.fromToken}
          chain={props.fromChain}
          displayFormat={props.displayFormat}
        />
        <div className="bg-card absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full">
          <Button
            size="icon"
            variant="secondary"
            className="border-card bg-card-foreground group hover:bg-foreground/10 h-auto w-auto cursor-pointer border-4 p-2 text-base disabled:opacity-100"
            disabled={true}
          >
            <ChevronDown className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-180 group-disabled:opacity-50" />
          </Button>
        </div>
        <ReviewRow
          title="You receive"
          amount={props.toAmount || "0.00"}
          token={props.toToken}
          chain={props.toChain}
          displayFormat={props.displayFormat}
        />
      </div>
    </div>
  );
};

export function ReviewRow(props: {
  title: string;
  amount: string;
  token?: TokenRef;
  chain?: ChainRef;
  displayFormat?: InputType;
}) {
  return (
    <div className="bg-card-foreground rounded-2xl p-4">
      <div className="text-muted-foreground text-xs">{props.title}</div>
      <div className="mt-1 flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold">
            {props.displayFormat === InputType.FIAT ? "$" : ""}
            {props.amount}{" "}
            {props.displayFormat === InputType.TOKEN ? props.token?.symbol : ""}
          </div>
          <div className="mt-1 flex items-center gap-1">
            <FiatValueDisplay
              selectedChain={props.chain}
              assetData={props.token}
              inputAmount={props.amount}
              inputType={props.displayFormat}
              showSwitch={false}
            />
            <Separator
              orientation="vertical"
              className="h-1 w-1 rounded-full border-2 border-foreground"
            />
            <div className="flex gap-2">
              <span className="text-secondary-foreground text-sm">From</span>
              <div className="flex items-center gap-1">
                <Avatar className="size-4 rounded-full">
                  <AvatarImage src={props.chain?.logoURI} />
                  <AvatarFallback>
                    <GenericFallbackIcon className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-bold">
                  {props.chain?.displayName}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <div className="relative">
            <Avatar className="size-12">
              <AvatarImage src={`${props.token?.logoURI}`} />
              <AvatarFallback>
                <GenericFallbackIcon className="size-12" />
              </AvatarFallback>
            </Avatar>

            <Avatar className="absolute right-0 bottom-0 size-4 rounded-full">
              <AvatarImage src={props.chain?.logoURI} />
              <AvatarFallback>
                <GenericFallbackIcon className="size-4" />
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </div>
  );
}
