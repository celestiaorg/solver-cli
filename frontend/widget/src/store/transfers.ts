import { create } from "zustand";

import {
  FinalTransferStatuses,
  TransferContext,
  TransferStatus,
} from "../lib/types";

export interface TransferState {
  // User history
  transfers: TransferContext[];
  addTransfer: (t: TransferContext) => void;
  resetTransfers: () => void;
  updateTransferStatus: (
    i: number,
    s: TransferStatus,
    options?: { msgId?: string; originTxHash?: string },
  ) => void;
  failUnconfirmedTransfers: () => void;

  // Shared component state
  transferLoading: boolean;
  setTransferLoading: (isLoading: boolean) => void;
}

export const useTransferStore = create<TransferState>((set) => ({
  transfers: [],
  addTransfer: (t) => {
    set((state) => ({ transfers: [...state.transfers, t] }));
  },
  resetTransfers: () => {
    set(() => ({ transfers: [] }));
  },
  updateTransferStatus: (i, s, options) => {
    set((state) => {
      if (i >= state.transfers.length) return state;
      const txs = [...state.transfers];
      txs[i].status = s;
      txs[i].msgId ||= options?.msgId;
      txs[i].originTxHash ||= options?.originTxHash;
      return {
        transfers: txs,
      };
    });
  },
  failUnconfirmedTransfers: () => {
    set((state) => ({
      transfers: state.transfers.map((t) =>
        FinalTransferStatuses.includes(t.status)
          ? t
          : { ...t, status: TransferStatus.Failed },
      ),
    }));
  },

  // Shared component state
  transferLoading: false,
  setTransferLoading: (isLoading) => {
    set(() => ({ transferLoading: isLoading }));
  },
}));
