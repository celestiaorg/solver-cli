import type { TokenRef } from "../lib/types";
import { cn } from "../lib/utils";

export const ListMessage: React.FC<{
  message: string;
  icon?: React.ReactNode;
  subtext?: React.ReactNode;
  className?: string;
}> = ({ message, subtext, icon = null, className }) => {
  return (
    <div className="text-foreground [&>svg]:text-foreground bg-background-2/40 rounded-md2 mx-auto flex h-auto w-fit flex-none flex-col items-center px-20 py-12 backdrop-blur-sm">
      <div className="bg-secondary flex size-16 items-center justify-center rounded-full [&>svg]:size-6">
        {icon}
      </div>

      <h2
        className={cn(
          "text-center text-lg font-bold break-all",
          !!icon && "mt-4",
          className,
        )}
      >
        {message}
      </h2>

      {subtext ? (
        <p className="mt-3 max-w-3xs text-center text-sm">{subtext}</p>
      ) : null}
    </div>
  );
};

export const ZeroState: React.FC<{
  message: string;
  icon?: React.ReactNode;
  subtext?: React.ReactNode;
  className?: string;
}> = ({ message, subtext, icon = null, className }) => {
  return (
    <div className="text-foreground [&>svg]:text-foreground mt-2 flex flex-col items-center justify-center">
      <div className="bg-secondary flex size-16 items-center justify-center rounded-full [&>svg]:size-6">
        {icon}
      </div>

      <h2
        className={cn(
          "text-center text-lg font-bold break-all",
          !!icon && "mt-4",
          className,
        )}
      >
        {message}
      </h2>

      {subtext ? (
        <p className="mt-3 max-w-3xs text-center text-sm">{subtext}</p>
      ) : null}
    </div>
  );
};

export const ConversionRateDisplayForTransfer: React.FC<{
  fromToken: TokenRef | undefined;
}> = ({ fromToken }) => {
  return (
    <div className="text-xs">
      {`1 ${fromToken?.symbol} = 1 ${fromToken?.symbol}`}
    </div>
  );
};
