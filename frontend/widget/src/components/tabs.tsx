import { Gear, Lightning } from "@phosphor-icons/react";

import { useEffect } from "react";

import { Tabs } from "../lib/types";
import { cn } from "../lib/utils";
import { useInputStateStore } from "../store";

import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { useWidgetWalletClientContext } from "../contexts/wallet-connect";

type TabSwitchProps = {
  defaultTab?: Tabs;
};
const TabItem: React.FC<{
  icon?: React.ReactNode;
  title: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, title, isActive, onClick }) => {
  return (
    <Button
      className={cn(
        "flex items-center gap-2 rounded-[12px] text-foreground border px-4 py-3 transition-all hover:scale-105",
        {
          "bg-primary text-primary-foreground hover:bg-primary dark:hover:bg-primary hover:text-primary-foreground":
            isActive,
        },
      )}
      onClick={onClick}
      variant="ghost"
    >
      {icon}
      <p className="text-sm font-medium">{title}</p>
    </Button>
  );
};

export const TabSwitch = (props: TabSwitchProps) => {
  const { inputState, setInputState } = useInputStateStore();
  const { isTestnet, showDefaultTabOnly } = useWidgetWalletClientContext();

  const setActiveTab = (tab: Tabs) => {
    setInputState({ tab });
  };
  const handleTabClick = (checked: boolean) => {
    const newTab = checked ? Tabs.FAST : Tabs.ADVANCED;
    setActiveTab(newTab);
  };

  useEffect(() => {
    if (isTestnet) {
      setActiveTab(Tabs.ADVANCED);
      return;
    }
    if (props.defaultTab) {
      setActiveTab(props.defaultTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.defaultTab, isTestnet]);

  if (showDefaultTabOnly) {
    return null;
  }
  return (
    <div className="mb-6 flex items-center gap-3">
      <Label htmlFor="airplane-mode" className="flex items-center gap-1">
        <Lightning size={16} weight="fill" />
        <span>Fast</span>
      </Label>
      <Switch
        id="fast-advanced-switch"
        disabled={isTestnet}
        onCheckedChange={handleTabClick}
        className="data-[state=checked]:bg-primary"
        checked={inputState.tab === Tabs.FAST}
      />
    </div>
  );
};
