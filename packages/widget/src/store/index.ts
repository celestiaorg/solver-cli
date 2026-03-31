import { create } from "zustand";
import { persist } from "zustand/middleware";

import { Tabs } from "../lib/types";

type GlobalState = {
  tab?: Tabs;
};

interface GlobalStateStore {
  inputState: GlobalState;
  setInputState: (newState: Partial<GlobalState>) => void;
}

export const defaultValues: GlobalState = {
  tab: Tabs.FAST,
};

export const useInputStateStore = create(
  persist<GlobalStateStore>(
    (set, get) => ({
      inputState: defaultValues,
      setInputState: (newState) =>
        set((state) => ({
          inputState: { ...state.inputState, ...newState },
        })),
    }),
    {
      name: "global-state:v1",
      partialize: (state) => ({
        inputState: {
          tab: state.inputState.tab,
        },
        setInputState: state.setInputState,
      }),
    },
  ),
);
