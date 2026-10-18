export {};

declare global {
  interface Window {
    /** Narrow preload API for native-only desktop capabilities. */
    designBuddyDesktop?: {
      setRuntimeSleepBlocker(active: boolean): Promise<void>;
    };
  }
}
