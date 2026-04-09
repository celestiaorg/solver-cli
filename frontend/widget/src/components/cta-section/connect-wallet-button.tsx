import { Button } from "../ui/button";

//import { useConnectKitContext, useConnectKitModal } from '../../connect-kit';
import { useWidgetWalletClientContext } from "../../contexts/wallet-connect";

export const ConnectButtonFull = ({
  buttonProps,
  label = "Connect Wallet",
}: {
  buttonProps?: React.ComponentProps<typeof Button>;
  label?: string;
}) => {
  const { connectWallet } = useWidgetWalletClientContext();

  return (
    <Button {...buttonProps} onClick={connectWallet}>
      {label}
    </Button>
  );
};
