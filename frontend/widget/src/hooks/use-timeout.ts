import { useEffect, useRef } from "react";

/**
 * useTimeout hook
 * Calls the callback after the specified delay (in ms).
 * Cleans up if the component unmounts or the delay changes.
 */
export function useTimeout(callback: () => void, delay: number) {
  const savedCallback = useRef(callback);

  // Remember the latest callback if it changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (typeof delay !== "number" || delay < 0) return;
    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}
