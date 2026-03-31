'use client';

import Image from 'next/image';

export type IsConnectingWallet =
  | {
      isConnecting: true;
      params: {
        walletIcon: string;
        walletName: string;
      };
    }
  | {
      isConnecting: false;
    };

export const ConnectingWalletDialog = ({
  isConnectingWallet,
}: {
  isConnectingWallet: Extract<IsConnectingWallet, { isConnecting: true }>;
}) => {
  const { walletIcon, walletName } = isConnectingWallet.params;

  return (
    <div className="mx-auto flex flex-col items-center gap-4">
      <Image
        src={walletIcon}
        alt={walletName}
        width={72}
        height={72}
        className="rounded-md"
      />

      <div className="flex flex-col items-center gap-2">
        <p className="text-foreground text-xl font-bold">
          Waiting for {walletName}
        </p>
        <p className="text-muted-foreground text-center text-xs font-medium">
          Click connect in your wallet popup. Don&apos;t see your wallet? Check
          your other browser windows.
        </p>
      </div>
    </div>
  );
};
