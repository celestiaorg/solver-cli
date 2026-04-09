import { Power } from '@phosphor-icons/react';

export const ConnectedMobile = () => {
  return (
    <span className="flex items-center gap-4">
      <span className="text-primary-foreground text-xs font-medium">
        Connected
      </span>
      <span className="text-destructive bg-destructive/10 grid size-6 place-items-center rounded-[6.86px] text-xs font-medium">
        <Power size={16} weight="bold" />
      </span>
    </span>
  );
};
