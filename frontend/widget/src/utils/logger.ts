/* eslint-disable @typescript-eslint/no-explicit-any */
export const logger = {
  debug: (...args: any[]) => console.debug(...args),
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (message: string, err: any, ...args: any[]) => {
    console.error(message, err, ...args);
  },
};
