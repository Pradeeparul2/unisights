export {};

declare global {
  interface Window {
    unisights: {
      flushNow: () => void;
      init: () => void;
      log: () => void;
      registerEvent: () => void;
    };
    unisightsq: [() => void];
  }
}
