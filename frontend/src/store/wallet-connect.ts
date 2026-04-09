import { create } from 'zustand';

export type SetAddress =
  | {
      chain: 'cosmos';
      address: Record<string, string> | null;
    }
  | {
      chain: Exclude<keyof WalletConnectState, 'cosmos'>;
      address: string | null;
    };

export type WalletConnectState = {
  cosmos: Record<string, string> | null;
  evm: string | null;
  solana: string | null;
  isConnected: boolean;
  setAddress: (args: SetAddress) => void;
};

export const useWalletConnectStore = create<WalletConnectState>(set => ({
  cosmos: null,
  evm: null,
  solana: null,
  isConnected: false,
  setAddress: args =>
    set(state => {
      const { chain, address } = args;
      if (state[chain] === address) return state;

      const newState = {
        ...state,
        [chain]: address,
      };

      const isConnected =
        (!!newState.cosmos && Object.values(newState.cosmos).some(Boolean)) ||
        !!newState.evm ||
        !!newState.solana;

      return {
        ...newState,
        isConnected,
      };
    }),
}));
