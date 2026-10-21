import { useEffect } from "react";
import { setWakeLock, usePreferences } from "../../../../../frontend/workspace/settingsStore";
import { useRuntimeActivity, useRuntimeActivityState } from "../../../../../frontend/workspace/runtimeActivity";

/**
 * Synchronizes user appearance, locale/RTL, and runtime sleep-prevention
 * preferences onto documentElement and the optional Electron bridge.
 */
export function useAppDocumentPreferences(busy: boolean) {
  const theme = usePreferences((state) => state.theme);
  const density = usePreferences((state) => state.density);
  const consoleTheme = usePreferences((state) => state.consoleTheme);
  const fontStyle = usePreferences((state) => state.fontStyle);
  const contentWidth = usePreferences((state) => state.contentWidth);
  const fileIcons = usePreferences((state) => state.fileIcons);
  const glassEffects = usePreferences((state) => state.glassEffects);
  const locale = usePreferences((state) => state.locale);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.locale = locale;
    root.lang = locale;
    root.dir = locale === "ar" || locale === "fa" ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark =
        theme === "dark" ||
        (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.dataset.theme = dark ? "dark" : "light";
      root.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const osDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const interfaceDark = theme === "dark" || (theme === "system" && osDark);
      root.dataset.consoleTheme =
        consoleTheme === "dark" || (consoleTheme === "system" && interfaceDark)
          ? "dark"
          : "light";
    };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [consoleTheme, theme]);

  useEffect(() => {
    document.documentElement.dataset.fontStyle = fontStyle;
  }, [fontStyle]);

  useEffect(() => {
    document.documentElement.dataset.contentWidth = contentWidth;
  }, [contentWidth]);

  useEffect(() => {
    document.documentElement.dataset.fileIcons = fileIcons;
  }, [fileIcons]);

  useEffect(() => {
    document.documentElement.dataset.glass = glassEffects ? "on" : "off";
  }, [glassEffects]);

  useRuntimeActivity(busy);
  const runtimeActivityCount = useRuntimeActivityState((state) => state.activeCount);
  const wakeLockWanted = usePreferences((state) => state.wakeLock);
  const shouldPreventSleep = wakeLockWanted && runtimeActivityCount > 0;

  useEffect(() => {
    let cancelled = false;
    const reportFailure = () => {
      window.dispatchEvent(new Event("designbuddy:wake-lock-failed"));
      try {
        setWakeLock(false);
      } catch {
        // Keep the UI error visible even if storage itself is unavailable.
      }
    };
    const desktop = window.designBuddyDesktop;
    if (desktop) {
      try {
        void desktop.setRuntimeSleepBlocker(shouldPreventSleep).catch(() => {
          if (!cancelled && shouldPreventSleep) reportFailure();
        });
      } catch {
        if (shouldPreventSleep) reportFailure();
      }
      return () => {
        cancelled = true;
        void desktop.setRuntimeSleepBlocker(false).catch(() => {});
      };
    }
    if (!shouldPreventSleep) return;

    type WakeLockSentinelLike = {
      release: () => Promise<void>;
      addEventListener?: (type: string, listener: () => void, options?: unknown) => void;
    };
    const nav = navigator as Navigator & {
      wakeLock?: { request: (kind: "screen") => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) {
      reportFailure();
      return;
    }

    let sentinel: WakeLockSentinelLike | null = null;
    let requesting = false;
    const release = () => {
      const held = sentinel;
      sentinel = null;
      if (held) void held.release().catch(() => {});
    };
    const acquire = async () => {
      if (cancelled || sentinel || requesting || !nav.wakeLock || document.visibilityState !== "visible") return;
      requesting = true;
      let retryAfterRelease = false;
      try {
        const held = await nav.wakeLock.request("screen");
        if (cancelled || document.visibilityState !== "visible") {
          await held.release().catch(() => {});
          retryAfterRelease = !cancelled && document.visibilityState === "visible";
          return;
        }
        sentinel = held;
        held.addEventListener?.(
          "release",
          () => {
            const wasCurrent = sentinel === held;
            if (wasCurrent) sentinel = null;
            if (wasCurrent && !cancelled && document.visibilityState === "visible") reportFailure();
          },
          { once: true },
        );
      } catch {
        if (!cancelled) reportFailure();
      } finally {
        requesting = false;
        if (retryAfterRelease && !cancelled && !sentinel && document.visibilityState === "visible") void acquire();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
      else release();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [shouldPreventSleep]);

  return { locale };
}
