import { WalletName } from '@solana/wallet-adapter-base';
import { Wallet as SolanaWallet } from '@solana/wallet-adapter-react';

import { tryCatch } from '@/lib/utils';

export async function disconnectSolanaWallet(disconnect: () => Promise<void>) {
  const [, error] = await tryCatch<void>(disconnect());
  if (error) {
    console.error(error);
  }
}

export async function connectSolanaWallet(
  wallet: SolanaWallet,
  select: (walletName: WalletName | null) => void
) {
  const connectLogic = async () => {
    await wallet.adapter.connect();
    select(wallet.adapter.name);
    localStorage.setItem('celestia-bridge-solana-wallet', wallet.adapter.name);
  };

  const [, error] = await tryCatch<void>(connectLogic());
  if (error) {
    console.error(error);
  }
}
