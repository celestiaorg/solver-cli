import {
  WidgetWalletConnectProvider,
  WidgetWalletConnectProviderProps,
} from "./wallet-connect";

export type WidgetProviderProps = WidgetWalletConnectProviderProps;

export const WidgetProvider: React.FC<WidgetProviderProps> = ({
  children,
  ...props
}) => {
  return (
    <WidgetWalletConnectProvider {...props}>
      {children}
    </WidgetWalletConnectProvider>
  );
};
