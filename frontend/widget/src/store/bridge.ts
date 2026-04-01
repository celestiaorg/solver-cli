import { create } from "zustand";
import { persist } from "zustand/middleware";

import { ChainRef, InputType, Screen, SideState, TokenRef } from "../lib/types";
import { getImageSrc } from "../lib/utils";

export type HyperlaneFlowState = {
  screen: Screen;
  from: SideState;
  to: SideState;
  amountDisplayFormat: InputType;
};
interface HyperlaneFlowStore {
  state: HyperlaneFlowState;
  setScreen: (screen: Screen) => void;
  setFromChain: (chain: ChainRef) => void;
  setToChain: (chain: ChainRef) => void;
  switchChains: () => void;
  setFromToken: (token?: TokenRef) => void;
  setToToken: (token: TokenRef) => void;
  switchTokens: () => void;
  setFromAmount: (amount: string) => void;
  setToAddress: (address: string) => void;
  swapSides: () => void;
  setAmountDisplayFormat: (format: InputType) => void;
}

export const initialHyperlaneState: HyperlaneFlowState = {
  screen: "home",
  from: {
    chain: {
      key: "mocha-4",
      displayName: "Celestia Testnet",
      logoURI: getImageSrc("/chains/celestiatestnet/logo.svg") || undefined,
    },
    token: undefined,
    amount: "",
  },
  to: {
    chain: {
      key: "3735928814",
      displayName: "Eden Testnet",
      logoURI: getImageSrc("/chains/edentestnet/logo.svg") || undefined,
    },
    token: undefined,
    amount: "",
  },
  amountDisplayFormat: InputType.TOKEN,
};

export const useHyperlaneFlowStore = create(
  persist<HyperlaneFlowStore>(
    (set) => ({
      state: initialHyperlaneState,
      setScreen: (screen: Screen) =>
        set((prev) => ({
          state: { ...prev.state, screen },
        })),
      setFromChain: (chain: ChainRef) =>
        set((prev) => ({
          state: { ...prev.state, from: { ...prev.state.from, chain } },
        })),
      setToChain: (chain: ChainRef) =>
        set((prev) => ({
          state: { ...prev.state, to: { ...prev.state.to, chain } },
        })),
      switchChains: () =>
        set((prev) => ({
          state: {
            ...prev.state,
            from: {
              ...prev.state.from,
              chain: prev.state.to.chain,
            },
            to: { ...prev.state.to, chain: prev.state.from.chain },
          },
        })),
      setFromToken: (token?: TokenRef) =>
        set((prev) => ({
          state: { ...prev.state, from: { ...prev.state.from, token } },
        })),
      setToToken: (token: TokenRef) =>
        set((prev) => ({
          state: { ...prev.state, to: { ...prev.state.to, token } },
        })),
      switchTokens: () =>
        set((prev) => ({
          state: {
            ...prev.state,
            from: { ...prev.state.from, token: prev.state.to.token },
            to: { ...prev.state.to, token: prev.state.from.token },
          },
        })),
      setFromAmount: (amount: string) =>
        set((prev) => ({
          state: { ...prev.state, from: { ...prev.state.from, amount } },
        })),
      swapSides: () =>
        set((prev) => ({
          state: {
            ...prev.state,
            from: prev.state.to,
            to: prev.state.from,
          },
        })),
      setToAddress: (address: string) =>
        set((prev) => ({
          state: { ...prev.state, to: { ...prev.state.to, address } },
        })),
      setAmountDisplayFormat: (format: InputType) =>
        set((prev) => ({
          state: { ...prev.state, amountDisplayFormat: format },
        })),
    }),
    {
      name: "hyperlane-flow-state:v1",
      merge: (persisted, current) => {
        const merged = {
          ...current,
          ...(typeof persisted === "object" && persisted !== null
            ? persisted
            : {}),
        } as HyperlaneFlowStore;
        const state = merged.state as HyperlaneFlowState | undefined;
        if (state) {
          const fromChain = state.from?.chain?.key
            ? state.from.chain
            : initialHyperlaneState.from.chain;
          const toChain = state.to?.chain?.key
            ? state.to.chain
            : initialHyperlaneState.to.chain;
          merged.state = {
            ...state,
            from: { ...state.from, chain: fromChain },
            to: { ...state.to, chain: toChain },
          };
        }
        return merged;
      },
      partialize: (state) => ({
        state: {
          ...state.state,
          from: { ...state.state.from, amount: "" },
          to: { ...state.state.to, amount: "" },
        },
        setScreen: state.setScreen,
        setFromChain: state.setFromChain,
        setToChain: state.setToChain,
        switchChains: state.switchChains,
        setFromToken: state.setFromToken,
        setToToken: state.setToToken,
        switchTokens: state.switchTokens,
        setFromAmount: state.setFromAmount,
        swapSides: state.swapSides,
        setToAddress: state.setToAddress,
        setAmountDisplayFormat: state.setAmountDisplayFormat,
      }),
    },
  ),
);
