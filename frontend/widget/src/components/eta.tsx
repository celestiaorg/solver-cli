import { Timer } from "lucide-react";

import { useMemo } from "react";

const DEFAULT_ETA_SECONDS = 100;

export const ETAEstimate = (props: { seconds?: number }) => {
  const seconds = props.seconds ?? DEFAULT_ETA_SECONDS;

  const formatted = useMemo(() => {
    if (seconds < 60) {
      return `${seconds} sec`;
    }

    const minutes = Math.floor(seconds / 60);

    return `${minutes} min`;
  }, [seconds]);

  return (
    <div className="flex items-center gap-1">
      <Timer className="size-4" />
      <span className="text-secondary-foreground text-xs">{formatted}</span>
    </div>
  );
};
