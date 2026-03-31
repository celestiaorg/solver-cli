import { ProtocolType } from "@hyperlane-xyz/utils";

import React from "react";

import { useDestinationAddress } from "../../hooks/use-address";

import { Button } from "../ui/button";

import type { SupportedChain } from "../../lib/types";
import { cn } from "../../lib/utils";
import { useWalletConnectStore } from "../../store/wallet-connect";

import { ConnectButtonFull } from "./connect-wallet-button";

export const CTAWrapper: React.FC<{
  className?: string;
  connectButtonProps?: React.ComponentProps<typeof Button>;
  sourceChain?: SupportedChain;
  destinationChain?: SupportedChain;
  children?: React.ReactNode;
}> = (props) => {
  const { evm, solana, cosmos } = useWalletConnectStore();

  // Get destination chain metadata and address
  const destinationAddress = useDestinationAddress(props.destinationChain);

  const buttonProps = {
    size: "lg",
    ...props.connectButtonProps,
    className: cn(
      "w-full hover:scale-102 hover:disabled:scale-100 font-medium text-md",
      props.className,
    ),
  } as const;

  const connectButton = <ConnectButtonFull buttonProps={buttonProps} />;

  if (
    (props.sourceChain?.chainType === ProtocolType.Cosmos ||
      props.sourceChain?.chainType === ProtocolType.CosmosNative) &&
    !cosmos?.[props.sourceChain.chainId]
  ) {
    return connectButton;
  }

  if (props.sourceChain?.chainType === ProtocolType.Ethereum && !evm) {
    return connectButton;
  }

  if (props.sourceChain?.chainType === ProtocolType.Sealevel && !solana) {
    return connectButton;
  }

  if (!destinationAddress) {
    return (
      <ConnectButtonFull
        buttonProps={buttonProps}
        label={
          props.destinationChain?.displayName
            ? `Connect to ${props.destinationChain?.displayName}`
            : "Connect Wallet"
        }
      />
    );
  }
  return props.children;
};
