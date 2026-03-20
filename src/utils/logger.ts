export const debugLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

export const debugWarn = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
};

export const debugError = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
};
