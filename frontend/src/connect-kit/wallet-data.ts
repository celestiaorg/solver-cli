import { WalletType } from 'graz';

export function getImageUrl(name: string) {
  return `/wallets/${name}.webp`;
}

export type WalletData = {
  name: WalletType;
  prettyName: string;
  icon: string;
  downloadUrl?: {
    desktop?: string;
    ios?: string;
    android?: string;
  };
};

export const walletData: Record<WalletType, WalletData> = {
  [WalletType.COMPASS]: {
    name: WalletType.COMPASS,
    prettyName: 'Compass',
    icon: getImageUrl('compass'),
    downloadUrl: {
      desktop:
        'https://chromewebstore.google.com/detail/compass-wallet-for-sei/anokgmphncpekkhclmingpimjmcooifb',
      ios: 'https://apps.apple.com/id/app/compass-wallet-for-sei/id6450257441',
      android:
        'https://play.google.com/store/apps/details?id=io.leapwallet.compass',
    },
  },
  [WalletType.COSMIFRAME]: {
    name: WalletType.COSMIFRAME,
    prettyName: 'Cosmiframe',
    icon: 'https://assets.leapwallet.io/wallets/cosmiframe/icon.svg',
  },
  [WalletType.COSMOSTATION]: {
    name: WalletType.COSMOSTATION,
    prettyName: 'Cosmostation',
    icon: getImageUrl('cosmostation'),
    downloadUrl: {
      desktop:
        'https://chromewebstore.google.com/detail/cosmostation-wallet/fpkhgmpbidmiogeglndfbkegfdlnajnf',
      android:
        'https://play.google.com/store/apps/details?id=wannabit.io.cosmostaion',
      ios: 'https://apps.apple.com/us/app/cosmostation/id1459830339',
    },
  },
  [WalletType.INITIA]: {
    name: WalletType.INITIA,
    prettyName: 'Initia',
    icon: getImageUrl('initia'),
    downloadUrl: {
      desktop:
        'https://chromewebstore.google.com/detail/initia-wallet/ffbceckpkpbcmgiaehlloocglmijnpmp',
    },
  },
  [WalletType.KEPLR]: {
    name: WalletType.KEPLR,
    prettyName: 'Keplr',
    icon: getImageUrl('keplr'),
    downloadUrl: {
      desktop:
        'https://chromewebstore.google.com/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap',
      android:
        'https://play.google.com/store/apps/details?id=com.chainapsis.keplr',
      ios: 'https://apps.apple.com/us/app/keplr-wallet/id1567851089',
    },
  },
  [WalletType.LEAP]: {
    name: WalletType.LEAP,
    prettyName: 'Leap Wallet',
    icon: getImageUrl('leap'),
    downloadUrl: {
      desktop:
        'https://chromewebstore.google.com/detail/leap-cosmos-wallet/fcfcfllfndlomdhbehjjcoimbgofdncg',
      android:
        'https://play.google.com/store/apps/details?id=io.leapwallet.cosmos',
      ios: 'https://apps.apple.com/us/app/leap-cosmos/id1642465549',
    },
  },
  [WalletType.METAMASK_SNAP_COSMOS]: {
    name: WalletType.METAMASK_SNAP_COSMOS,
    prettyName: 'Metamask Cosmos Snap',
    icon: getImageUrl('metamask'),
    downloadUrl: {
      desktop:
        'https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn',
    },
  },
  [WalletType.METAMASK_SNAP_LEAP]: {
    name: WalletType.METAMASK_SNAP_LEAP,
    prettyName: 'Metamask Leap Snap',
    icon: getImageUrl('metamask'),
    downloadUrl: {
      desktop:
        'https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn',
    },
  },
  [WalletType.OKX]: {
    name: WalletType.OKX,
    prettyName: 'OKX',
    icon: getImageUrl('okx'),
    downloadUrl: {
      desktop:
        'https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge',
      android:
        'https://play.google.com/store/apps/details?id=com.okinc.okex.gp',
      ios: 'https://apps.apple.com/us/app/okx-buy-bitcoin-btc-crypto/id1327268470',
    },
  },
  [WalletType.STATION]: {
    name: WalletType.STATION,
    prettyName: 'Station',
    icon: getImageUrl('station'),
    downloadUrl: {
      desktop:
        'https://chromewebstore.google.com/detail/station-wallet/aiifbnbfobpmeekipheeijimdpnlpgpp',
      android:
        'https://play.google.com/store/apps/details?id=money.terra.station',
      ios: 'https://apps.apple.com/us/app/station-wallet/id1548434735',
    },
  },
  [WalletType.VECTIS]: {
    name: WalletType.VECTIS,
    prettyName: 'Vectis',
    icon: getImageUrl('vectis'),
  },
  [WalletType.WALLETCONNECT]: {
    name: WalletType.WALLETCONNECT,
    prettyName: 'Wallet Connect',
    icon: getImageUrl('walletconnect'),
  },
  [WalletType.WC_CLOT_MOBILE]: {
    name: WalletType.WC_CLOT_MOBILE,
    prettyName: 'Clot',
    icon: getImageUrl('walletconnect'),
  },
  [WalletType.WC_COSMOSTATION_MOBILE]: {
    name: WalletType.WC_COSMOSTATION_MOBILE,
    prettyName: 'Cosmostation Mobile',
    icon: getImageUrl('cosmostation'),
  },
  [WalletType.WC_KEPLR_MOBILE]: {
    name: WalletType.WC_KEPLR_MOBILE,
    prettyName: 'Keplr Mobile',
    icon: getImageUrl('keplr'),
  },
  [WalletType.WC_LEAP_MOBILE]: {
    name: WalletType.WC_LEAP_MOBILE,
    prettyName: 'Leap Mobile',
    icon: getImageUrl('leap'),
  },
  [WalletType.XDEFI]: {
    name: WalletType.XDEFI,
    prettyName: 'Xdefi',
    icon: getImageUrl('xdefi'),
    downloadUrl: {
      desktop:
        'https://chromewebstore.google.com/detail/xdefi-wallet/hmeobnfnfcmdkdcmlblgagmfpfboieaf',
    },
  },
};
