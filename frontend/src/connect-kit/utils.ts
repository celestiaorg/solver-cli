import { WalletType } from 'graz';

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

const androidUA = /Android/i;
export function checkUAIsAndroid(ua: string) {
  return androidUA.test(ua);
}

const iosUA = /iPad|iPhone|iPod/i;
export function checkUAIsIOS(ua: string) {
  return iosUA.test(ua);
}

export function checkUAIsMobile(ua: string) {
  return checkUAIsAndroid(ua) || checkUAIsIOS(ua);
}

export function checkUAIsDesktop(ua: string) {
  return !checkUAIsAndroid(ua) && !checkUAIsIOS(ua);
}

const leapDappBrowserUA = /LeapCosmos/i;
export function checkUAIsLeapDappBrowser(ua: string) {
  return leapDappBrowserUA.test(ua);
}

const keplrDappBrowserUA = /KeplrWallet/i;
export function checkUAIsKeplrDappBrowser(ua: string) {
  return keplrDappBrowserUA.test(ua);
}

const cosmostationDappBrowserUA = /Cosmostation/i;
export function checkUAIsCosmostationDappBrowser(ua: string) {
  return cosmostationDappBrowserUA.test(ua);
}

export function checkUAIsDappBrowser(ua: string) {
  return (
    checkUAIsLeapDappBrowser(ua) ||
    checkUAIsKeplrDappBrowser(ua) ||
    checkUAIsCosmostationDappBrowser(ua)
  );
}

export const mobileWallets = [
  WalletType.LEAP,
  WalletType.KEPLR,
  WalletType.COSMOSTATION,
  WalletType.STATION,
  WalletType.INITIA,
  WalletType.OKX,
  WalletType.COMPASS,
];

export const wcMobileWallets = new Set([
  WalletType.WC_LEAP_MOBILE,
  WalletType.WC_KEPLR_MOBILE,
  WalletType.WC_COSMOSTATION_MOBILE,
  WalletType.WC_CLOT_MOBILE,
]);
