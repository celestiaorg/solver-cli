import { ecosystemLogo } from '@/lib/constants/wallets';

export type WalletEcosystem = 'all' | 'cosmos' | 'evm' | 'solana';

export const walletEcosystems: {
  id: WalletEcosystem;
  ecosystem: WalletEcosystem;
  name: string;
  icon: string;
  iconClassName?: string;
  connected: boolean;
}[] = [
  {
    id: 'all',
    ecosystem: 'all',
    name: 'All Wallets',
    icon: ecosystemLogo.all,
    connected: false,
  },
  {
    id: 'cosmos',
    ecosystem: 'cosmos',
    name: 'Cosmos',
    icon: ecosystemLogo.cosmos,
    iconClassName: 'rounded-full',
    connected: false,
  },
  {
    id: 'evm',
    ecosystem: 'evm',
    name: 'EVM',
    icon: ecosystemLogo.evm,
    connected: false,
  },
  {
    id: 'solana',
    ecosystem: 'solana',
    name: 'Solana',
    icon: ecosystemLogo.solana,
    connected: false,
  },
];
