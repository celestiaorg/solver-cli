const hasWindow = typeof window !== 'undefined';

const isLeapBrowser =
  hasWindow &&
  'leap' in window &&
  'navigator' in window &&
  /LeapCosmos/i.test(window.navigator.userAgent);
const isKeplrBrowser =
  hasWindow && 'keplr' in window && window.keplr?.mode === 'mobile-web';

export const dappBrowserName = isLeapBrowser
  ? 'Leap Wallet'
  : isKeplrBrowser
    ? 'Keplr'
    : null;
