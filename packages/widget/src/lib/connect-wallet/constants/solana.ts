import {
  CoinbaseWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TrustWalletAdapter,
} from "@solana/wallet-adapter-wallets";

export const solanaEndpoint =
  "https://mainnet.helius-rpc.com/?api-key=5175da47-fc80-456d-81e2-81e6e7459f73";
export const solanaWalletAdapters = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
  new CoinbaseWalletAdapter(),
  new TrustWalletAdapter(),
];
