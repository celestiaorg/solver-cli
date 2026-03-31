'use client';

import React from 'react';

import { useWalletConnectStore } from '@/store/wallet-connect';

export const NativeTokenMetadata = {
  name: 'TIA',
  symbol: 'TIA',
  decimals: 18,
  logoURI: 'https://assets.leapwallet.io/filled-celestia.svg',
  verified: true,
  isNative: true,
};

export const BalanceDisplay = () => {
  const { evm } = useWalletConnectStore();

  return (
    <span className="text-4.5xl text-primary-foreground">
      {evm ? '$0' : '-'}
    </span>
  );
};
