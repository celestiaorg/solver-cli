import { type PropsWithChildren, useEffect, useRef, useState } from "react";

import { useReadyMultiProvider } from "../hooks/use-chains";
import { useTimeout } from "../hooks/use-timeout";
import { useHyperlaneStore } from "../store/hyperlane";

const INIT_TIMEOUT = 10_000; // 10 seconds

// A wrapper app to delay rendering children until the warp context is ready
export function WarpContextInitGate({ children }: PropsWithChildren<unknown>) {
  const initializeWarpContext = useHyperlaneStore(
    (s) => s.initializeWarpContext,
  );
  const isWarpContextReady = !!useReadyMultiProvider();
  const initializeWarpContextRef = useRef(false);

  const [isTimedOut, setIsTimedOut] = useState(false);
  useTimeout(() => setIsTimedOut(true), INIT_TIMEOUT);

  useEffect(() => {
    if (isWarpContextReady || initializeWarpContextRef.current) {
      // Warp context is already initialized, no need to call again
      return;
    }
    initializeWarpContextRef.current = true;
    initializeWarpContext().catch((error) => {
      console.error("Error initializing warp context:", error);
    });
  }, [initializeWarpContext, isWarpContextReady]);

  if (!isWarpContextReady) {
    if (isTimedOut) {
      // Fallback to outer error boundary
      throw new Error(
        "Failed to initialize warp context. Please check your registry URL and connection status.",
      );
    }
  }

  return <>{children}</>;
}
