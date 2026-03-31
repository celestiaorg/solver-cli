import { ProgressData } from "@relayprotocol/relay-sdk";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { ChainRef, InputType, Screen, SideState, TokenRef } from "../lib/types";
import { getImageSrc } from "../lib/utils";

export type RelayFlowState = {
  screen: Screen;
  from: SideState;
  to: SideState;
  amountDisplayFormat: InputType;
  txData?: ProgressData;
};

interface RelayFlowStore {
  state: RelayFlowState;
  setScreen: (screen: Screen) => void;
  setFromChain: (chain: ChainRef) => void;
  setToChain: (chain: ChainRef) => void;
  switchChains: () => void;
  setFromToken: (token?: TokenRef) => void;
  setToToken: (token?: TokenRef) => void;
  switchTokens: () => void;
  setFromAmount: (amount: string) => void;
  setToAddress: (address: string) => void;
  setTxData: (txData: ProgressData) => void;
  swapSides: () => void;
  setAmountDisplayFormat: (format: InputType) => void;
}

export const initialRelayState: RelayFlowState = {
  screen: "home",
  from: {
    chain: {
      key: "1",
      displayName: "Ethereum",
      logoURI: getImageSrc("/chains/ethereum/logo.svg") || undefined,
    },
    token: undefined,
    amount: "",
  },
  to: {
    chain: {
      key: "9286185",
      displayName: "Eclipse",
      logoURI: getImageSrc("/chains/eclipsemainnet/logo.svg") || undefined,
    },
    token: undefined,
    amount: "",
  },
  amountDisplayFormat: InputType.TOKEN,
  txData: undefined,
};

export const useRelayFlowStore = create(
  persist<RelayFlowStore>(
    (set) => ({
      state: initialRelayState,
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
            from: prev.state.to,
            to: prev.state.from,
          },
        })),
      setFromToken: (token?: TokenRef) =>
        set((prev) => ({
          state: { ...prev.state, from: { ...prev.state.from, token } },
        })),
      setToToken: (token?: TokenRef) =>
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
      setTxData: (txData: ProgressData) =>
        set((prev) => ({
          state: { ...prev.state, txData },
        })),
      setToAddress: (address: string) =>
        set((prev) => ({
          state: { ...prev.state, to: { ...prev.state.to, address } },
        })),
      setAmountDisplayFormat: (format: InputType) =>
        set((prev) => ({
          state: { ...prev.state, amountDisplayFormat: format },
        })),
      swapSides: () =>
        set((prev) => ({
          state: {
            ...prev.state,
            from: prev.state.to,
            to: prev.state.from,
          },
        })),
    }),
    {
      name: "relay-flow-state:v1",
      partialize: (state) => ({
        state: {
          ...state.state,
          from: { ...state.state.from, amount: "" },
          to: { ...state.state.to, amount: "" },
          txData: undefined,
          screen: "home",
        },
        setScreen: state.setScreen,
        setFromChain: state.setFromChain,
        setToChain: state.setToChain,
        switchChains: state.switchChains,
        setFromToken: state.setFromToken,
        setToToken: state.setToToken,
        switchTokens: state.switchTokens,
        setFromAmount: state.setFromAmount,
        setTxData: state.setTxData,
        swapSides: state.swapSides,
        setToAddress: state.setToAddress,
        setAmountDisplayFormat: state.setAmountDisplayFormat,
      }),
    },
  ),
);
