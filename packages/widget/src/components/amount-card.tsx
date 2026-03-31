import { ChevronDown } from "lucide-react";

import { GenericFallbackIcon } from "../icons";
import {
  type ChainRef,
  InputType,
  type SupportedAsset,
  type TokenRef,
} from "../lib/types";
import { cn, getImageSrc } from "../lib/utils";

import { FiatValueDisplay } from "./fiat-value";
import { TokenBalance } from "./token-balance";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Skeleton } from "./ui/skeleton";

export function AmountCard(props: {
  label: string;
  value: string;
  assets?: SupportedAsset[];
  assetDetails?: TokenRef;
  selectedChain?: ChainRef;
  onChange?: (v: string) => void;
  onOpenSelector?: () => void;
  disabled?: boolean;
  showDropdownIcon?: boolean;
  selectType: "source" | "destination";
  setFromAmount?: (v: string) => void;
  isLoading?: boolean;
  displayFormat?: InputType;
  setDisplayFormat?: (v: InputType) => void;
}) {
  const handleDisplayFormatChange = (
    args: Record<string, string | undefined>,
  ) => {
    if (!props.setDisplayFormat) return;
    props.setDisplayFormat(args.type as InputType);
    if (args.inputAmount) {
      props.setFromAmount?.(args.inputAmount);
    }
  };
  return (
    <div className="bg-card-foreground flex w-full flex-col rounded-xl px-4 py-6">
      <div className="text-muted-foreground font-medium mb-3 text-xs">
        {props.label}
      </div>
      <div className="flex w-full items-end justify-between gap-2">
        <div className="flex flex-1 items-center gap-1">
          {props?.displayFormat === InputType.FIAT ? (
            <span className="text-3.5xl">$</span>
          ) : null}
          <input
            inputMode="decimal"
            disabled={props.disabled}
            value={props.value}
            onChange={(e) => props.onChange?.(e.target.value)}
            placeholder="0.00"
            className="text-3.5xl w-full flex-1 border-none bg-transparent outline-none text-foreground"
          />
        </div>

        {props.isLoading ? (
          <Skeleton className="h-9 w-22 rounded-full" />
        ) : (
          <button
            className={cn(
              "text-base-lg bg-foreground/10 hover:bg-foreground/25 text-foreground flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-1.5 py-1 font-medium transition-all hover:scale-105",
              !props.assetDetails && "ps-3",
            )}
            onClick={props.onOpenSelector}
          >
            {props.assetDetails ? (
              <Avatar className="mr-1 size-6 shrink-0">
                <AvatarImage
                  src={getImageSrc(props.assetDetails?.logoURI) ?? ""}
                />
                <AvatarFallback>
                  <GenericFallbackIcon className="size-6" />
                </AvatarFallback>
              </Avatar>
            ) : null}

            <span className="flex-1 truncate">
              {props.assetDetails ? props.assetDetails.symbol : "Select Token"}
            </span>

            {props?.showDropdownIcon ? (
              <ChevronDown size={16} className="shrink-0" />
            ) : null}
          </button>
        )}
      </div>
      <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
        <FiatValueDisplay
          showSwitch={props.selectType === "source"}
          selectedChain={props.selectedChain}
          assetData={props.assetDetails}
          inputAmount={props.value}
          inputType={props.displayFormat || InputType.TOKEN}
          setDisplayFormat={handleDisplayFormatChange}
        />
        <TokenBalance
          assets={props.assets}
          sourceChain={props.selectedChain}
          selectedAssetData={props.assetDetails}
          inputAmount={props.value}
          inputType={props.displayFormat || InputType.TOKEN}
          showMaxButton={props.selectType === "source"}
          setFromAmount={props.setFromAmount}
        />
      </div>
    </div>
  );
}
