import { useEffect } from "react";

const useScrollIntoView = (
  elementRef: React.RefObject<HTMLElement>,
  delay = 250,
) => {
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      elementRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, delay);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [elementRef.current, delay]);
};

export default useScrollIntoView;
