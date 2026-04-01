import { X } from "lucide-react";

import * as React from "react";

import { SearchIcon } from "../icons/search";

import { cn } from "../../lib/utils";

import { Button } from "./button";

export type InputStatus = "error" | "success" | "warning" | "default";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingElement?: React.ReactNode;
  trailingElement?: React.ReactNode;
  status?: InputStatus;
  inputClassName?: string;
}

export const inputStatusOutlineClassMap = {
  error: "ring-destructive focus-within:ring-destructive ring-1",
  success: "ring-accent-success focus-within:ring-accent-success ring-1",
  warning: "ring-accent-warning focus-within:ring-accent-warning ring-1",
  default:
    "ring-border ring-1 data-[disabled=true]:ring-0 hover:ring-foreground/25",
} as const;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      leadingElement,
      trailingElement,
      status,
      inputClassName,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        data-disabled={props.disabled}
        className={cn(
          "md:text-md bg-secondary-200 placeholder:text-muted-foreground flex h-12 w-full items-center gap-2 truncate rounded-xl px-5 text-xs font-medium caret-blue-200 shadow-sm outline-0 transition-shadow placeholder-shown:truncate disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          inputStatusOutlineClassMap[status || "default"] ??
            inputStatusOutlineClassMap.default,
          className,
        )}
      >
        {leadingElement}

        <input
          ref={ref}
          className={cn(
            "placeholder:text-muted-foreground no-appearance-search flex-1 rounded-md rounded-l-md border-none bg-transparent py-1 text-base outline-none placeholder-shown:font-sans",
            inputClassName,
          )}
          {...props}
        />

        {trailingElement}
      </div>
    );
  },
);

Input.displayName = "Input";

export const SearchInput = React.forwardRef<
  HTMLInputElement,
  Omit<InputProps, "leadingElement"> & {
    onClear?: () => void;
  }
>((props, ref) => {
  return (
    <Input
      {...props}
      type="search"
      ref={ref}
      trailingElement={
        props.onClear ? (
          <Button
            type="button"
            title="Clear"
            size="icon"
            variant="secondary"
            className="size-7.5"
            onClick={(e) => {
              (e.target as HTMLButtonElement).closest("input")?.blur();
              props.onClear?.();
            }}
          >
            <X />
          </Button>
        ) : (
          <SearchIcon className="size-4 shrink-0" />
        )
      }
    />
  );
});

SearchInput.displayName = "SearchInput";
