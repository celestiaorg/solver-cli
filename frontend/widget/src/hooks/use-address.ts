import { ProtocolType } from "@hyperlane-xyz/utils";

import { useMemo } from "react";

import { Tabs, type SupportedChain } from "../lib/types";
import { useWalletConnectStore } from "../store/wallet-connect";
import { useHyperlaneFlowStore } from "../store/bridge";
import { useInputStateStore } from "../store";
import { useRelayFlowStore } from "../store/swaps";

/**
 * Custom hook that returns the correct address for a given chain metadata
 * @param chainMetadata - The chain metadata containing protocol and chainId information
 * @returns The address for the specified chain, or undefined if not available
 */
export const useAddress = (chainMetadata?: SupportedChain | null) => {
  const { evm, solana, cosmos } = useWalletConnectStore();

  const address = useMemo(() => {
    if (!chainMetadata) return undefined;

    switch (chainMetadata.chainType) {
      case ProtocolType.Ethereum:
        return evm;
      case ProtocolType.Sealevel:
        return solana;
      case ProtocolType.Cosmos:
      case ProtocolType.CosmosNative:
        return cosmos?.[chainMetadata.chainId];
      default:
        return undefined;
    }
  }, [chainMetadata, evm, solana, cosmos]);

  return address;
};

export const useDestinationAddress = (
  chainMetadata?: SupportedChain | null,
) => {
  const tab = useInputStateStore((s) => s.inputState.tab);
  const customDestinationAddressAdvanced = useHyperlaneFlowStore(
    (store) => store.state.to.address,
  );
  const customDestinationAddressFast = useRelayFlowStore(
    (store) => store.state.to.address,
  );
  const defaultDestinationAddress = useAddress(chainMetadata);

  const address = useMemo(() => {
    if (customDestinationAddressAdvanced && tab === Tabs.ADVANCED)
      return customDestinationAddressAdvanced;
    if (customDestinationAddressFast && tab === Tabs.FAST)
      return customDestinationAddressFast;
    return defaultDestinationAddress;
  }, [
    customDestinationAddressAdvanced,
    customDestinationAddressFast,
    defaultDestinationAddress,
    tab,
  ]);

  return address;
};
