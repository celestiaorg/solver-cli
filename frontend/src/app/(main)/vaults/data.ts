import { isEdenMainnet } from '@/lib/constants/eden-network';
import { Vault } from '@/lib/types';

export type VaultRegistry = Record<string, Vault>;

export const testnetVaults: VaultRegistry = {
  '0x8DDaC2f9d79128A387B9F3170878a603B144436E': {
    name: 'Eden WETH MetaMorpho Vault',
    symbol: 'EDEN-WETH-MM-VAULT',
    curator: '0x7554ee28c15e61D9B3CEbcC9F5CAcE7742830B05',
    owner: '0x7554ee28c15e61D9B3CEbcC9F5CAcE7742830B05',
    assetAddress: '0xbA207113AAFbd1805786a953177eCdE780e5BbAB',
    decimals: 18,
    address: '0x8DDaC2f9d79128A387B9F3170878a603B144436E',
  },
};

export const mainnetVaults: VaultRegistry = {};

export const vaults: VaultRegistry = isEdenMainnet
  ? mainnetVaults
  : testnetVaults;
