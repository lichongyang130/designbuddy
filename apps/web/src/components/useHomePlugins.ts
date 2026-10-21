import { useEffect, useState } from "react";
import {
  HOME_PLUGINS_CACHE_KEY,
  HOME_PLUGINS_CHANGED,
  fetchHomePlugins,
  type HomePlugins,
  type HomePluginBundle,
} from "../../../../frontend/workspace/api/plugins";

/**
 * Shared view of "which plugin bundles are enabled here".
 *
 * The homepage shows this in two places (the rail under the composer and the
 * per-mode picks inside the recommendations), so both read one cache instead of
 * asking the server twice. The payload is small by design: `GET
 * /api/plugins?scope=home` returns enabled bundles only.
 */

const TTL = 60_000;

type Snapshot = { at: number; data: HomePlugins };

let memory: Snapshot | null = null;
let inflight: Promise<HomePlugins> | null = null;
const listeners = new Set<() => void>();

export const emptyTotals = { enabled: 0, readySkills: 0, blockedSkills: 0 };

function readSession(): Snapshot | null {
  try {
    const raw = sessionStorage.getItem(HOME_PLUGINS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    if (!parsed || typeof parsed.at !== "number" || !Array.isArray(parsed.data?.bundles)) return null;
    if (Date.now() - parsed.at > TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(data: HomePlugins) {
  const snapshot = { at: Date.now(), data };
  memory = snapshot;
  try { sessionStorage.setItem(HOME_PLUGINS_CACHE_KEY, JSON.stringify(snapshot)); } catch { /* storage disabled */ }
}

/** Called by the plugin API after install/enable/disable/uninstall. */
export function invalidateHomePlugins() {
  memory = null;
  try { sessionStorage.removeItem(HOME_PLUGINS_CACHE_KEY); } catch { /* storage disabled */ }
  for (const listener of listeners) listener();
}

/** One request per page load, even though the rail and the picks both ask. */
function request(): Promise<HomePlugins> {
  if (!inflight) {
    inflight = fetchHomePlugins()
      .then((payload) => {
        writeSession(payload);
        return payload;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function resetHomePluginsCacheForTests() {
  memory = null;
  inflight = null;
  listeners.clear();
}

export function useHomePlugins(): {
  bundles: HomePluginBundle[];
  totals: HomePlugins["totals"];
  loading: boolean;
} {
  const cached = memory && Date.now() - memory.at <= TTL ? memory.data : readSession()?.data;
  const [data, setData] = useState<HomePlugins | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      request()
        .then((payload) => {
          if (cancelled) return;
          setData(payload);
        })
        .catch(() => { /* offline: keep whatever the cache had */ })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const onChange = () => {
      // A lifecycle change happened elsewhere (plugin page, another tab): the
      // cache was already dropped, so start from an empty view and reload.
      memory = null;
      setData(null);
      setLoading(true);
      load();
    };
    listeners.add(onChange);
    window.addEventListener(HOME_PLUGINS_CHANGED, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      cancelled = true;
      listeners.delete(onChange);
      window.removeEventListener(HOME_PLUGINS_CHANGED, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return {
    bundles: data?.bundles ?? [],
    totals: data?.totals ?? emptyTotals,
    loading,
  };
}
