const iosRegex = /iPad|iPhone|iPod/i;

const isIOSDevice = (ua: string) => {
  return iosRegex.test(ua);
};

const windowsPhoneRegex = /Windows Phone/i;

const isWindowsPhoneDevice = (ua: string) => {
  return windowsPhoneRegex.test(ua);
};

const androidRegex = /Android/i;

const isAndroidDevice = (ua: string) => {
  return androidRegex.test(ua);
};

const blackberryRegex = /BlackBerry/i;

const isBlackberryDevice = (ua: string) => {
  return blackberryRegex.test(ua);
};

export const isMobileDevice = (ua: string) => {
  return (
    isIOSDevice(ua) ||
    isWindowsPhoneDevice(ua) ||
    isAndroidDevice(ua) ||
    isBlackberryDevice(ua)
  );
};
