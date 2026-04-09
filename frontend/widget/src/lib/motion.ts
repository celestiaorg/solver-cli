import { Transition, Variants } from "framer-motion";

export const transition350: Transition = { duration: 0.35, type: "easeInOut" };
export const transition250: Transition = { duration: 0.25, type: "easeInOut" };
export const transition200: Transition = { duration: 0.2, type: "easeInOut" };
export const transition150: Transition = { duration: 0.15, type: "easeInOut" };
export const transition100: Transition = { duration: 0.1, type: "easeInOut" };
export const transition50: Transition = { duration: 0.05, type: "easeInOut" };

export const errorVariants: Variants = {
  hidden: { opacity: 0, transition: { duration: 0.1 } },
  visible: { opacity: 1, transition: { duration: 0.1 } },
};

export const opacityFadeInOut: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const scaleInOut: Variants = {
  hidden: { scale: 0 },
  visible: { scale: 1 },
};
