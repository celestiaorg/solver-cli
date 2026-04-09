import { useMemo } from "react";

import { isMobileDevice } from "../utils/mobile-device";

export const useIsMobileDevice = () => {
  const isMobile = useMemo(() => {
    if (!window) {
      return false;
    }

    return isMobileDevice(window.navigator.userAgent);
  }, []);

  return isMobile;
};
