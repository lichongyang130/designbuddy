import { useEffect, useMemo, useState } from "react";
import { fetchHomePlugins, type HomePluginBundle } from "../../../../frontend/workspace/api/plugins";
import { useWorkspaceStore } from "../../../../frontend/workspace/store";
import { HomeIcon } from "./HomeIcon";

type CatalogItem = { id: string; name: string; category: string; description: string };

export type HomePluginPick = {
  /** What the user clicked: an installed bundle or a catalog plugin. */
  kind: "bundle" | "plugin";
  id: string;
  name: string;
  /** Human name of the first runnable skill in a bundle; empty for catalog-only plugins. */
  skill?: string;
  hint: string;
};

type Props = {
  onPick: (pick: HomePluginPick) => void;
  onNavigatePlugins: () => void;
};

/** Curated catalog picks shown when the user has nothing installed or saved yet. */
const FEATURED_PLUGIN_IDS = ["plugin-01", "plugin-02", "plugin-03", "plugin-05", "plugin-15", "plugin-18"];
const MAX_RAIL = 10;
const CACHE_KEY = "designbuddy.home.plugins.v1";
const CACHE_TTL = 60_000;

type CacheBody = { at: number; bundles: HomePluginBundle[]; totals: { enabled: number; readySkills: number; blockedSkills: number } };

function readCache(): CacheBody | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheBody;
    if (!parsed || typeof parsed.at !== "number" || Date.now() - parsed.at > CACHE_TTL) return null;
    if (!Array.isArray(parsed.bundles)) return null;
    if (!parsed.totals) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(body: CacheBody) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(body)); } catch { /* private mode */ }
}

export function HomePluginsRail({ onPick, onNavigatePlugins }: Props) {
  const assets = useWorkspaceStore((state) => state.assets);
  const [bundles, setBundles] = useState<HomePluginBundle[]>([]);
  const [totals, setTotals] = useState<{ enabled: number; readySkills: number; blockedSkills: number }>({ enabled: 0, readySkills: 0, blockedSkills: 0 });
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Bundles: render from cache instantly, then revalidate once in the background.
  useEffect(() => {
    let cancelled = false;
    const cached = readCache();
    if (cached) {
      setBundles(cached.bundles);
      setTotals(cached.totals);
      setLoading(false);
    }
    fetchHomePlugins()
      .then((payload) => {
        if (cancelled) return;
        setBundles(payload.bundles);
        setTotals(payload.totals);
        writeCache({ at: Date.now(), bundles: payload.bundles, totals: payload.totals });
      })
      .catch(() => { /* offline: keep the cache, or fall back to curated picks */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const savedIds = useMemo(() => {
    const ids: string[] = [];
    for (const asset of assets) if (asset.type === "plugins" && !ids.includes(asset.id)) ids.push(asset.id);
    return ids;
  }, [assets]);

  const needsCatalog = savedIds.length > 0 || (!loading && bundles.length === 0);

  // The 480-item catalog is a separate chunk: the homepage never pays for it
  // unless there is something to resolve (saved plugin or the curated fallback).
  useEffect(() => {
    if (!needsCatalog || catalog.length) return;
    let cancelled = false;
    void import("../../../../plugins/_official/catalog.json")
      .then((mod) => {
        if (cancelled) return;
        const list = (mod.default ?? mod) as unknown as CatalogItem[];
        setCatalog(Array.isArray(list) ? list : []);
      })
      .catch(() => { /* catalog chunk missing: rail still shows bundles */ });
    return () => { cancelled = true; };
  }, [needsCatalog, catalog.length]);

  const byId = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    for (const item of catalog) map.set(item.id, item);
    return map;
  }, [catalog]);

  const items = useMemo(() => {
    const rows: Array<{ key: string; pick: HomePluginPick; meta: string; tone: "bundle" | "saved" | "featured"; }> = [];
    for (const bundle of bundles) {
      if (!bundle.enabled) continue;
      const first = bundle.skills.find((skill) => skill.status === "ready") ?? bundle.skills[0];
      rows.push({
        key: `bundle:${bundle.id}`,
        pick: { kind: "bundle", id: bundle.id, name: bundle.name, skill: first?.name, hint: bundle.description },
        meta: bundle.blockedSkills > 0
          ? `${bundle.readySkills}/${bundle.skills.length} 个技能可跑`
          : `${bundle.skills.length} 个技能 · 已启用`,
        tone: "bundle",
      });
      if (rows.length >= MAX_RAIL) return rows;
    }
    for (const id of savedIds) {
      const item = byId.get(id);
      if (!item) continue;
      if (rows.some((row) => row.pick.name === item.name)) continue;
      rows.push({
        key: `plugin:${item.id}`,
        pick: { kind: "plugin", id: item.id, name: item.name, hint: item.description },
        meta: item.description,
        tone: "saved",
      });
      if (rows.length >= MAX_RAIL) return rows;
    }
    if (rows.length === 0 && !loading) {
      for (const id of FEATURED_PLUGIN_IDS) {
        const item = byId.get(id);
        if (!item) continue;
        rows.push({
          key: `plugin:${item.id}`,
          pick: { kind: "plugin", id: item.id, name: item.name, hint: item.description },
          meta: "精选 · 点击试用",
          tone: "featured",
        });
      }
    }
    return rows;
  }, [bundles, savedIds, byId, loading]);

  return (
    <section className="home-plugins-rail" aria-label="我的插件">
      <header className="hpr-head">
        <div className="hpr-title">
          <HomeIcon name="bolt" size={13} />
          <h3>我的插件</h3>
          <span className="hpr-count">
            {loading
              ? "读取中…"
              : totals.enabled > 0
                ? `${totals.enabled} 个包 · ${totals.readySkills} 个技能可跑${totals.blockedSkills > 0 ? ` · ${totals.blockedSkills} 个待配置` : ""}`
                : items.length > 0
                  ? `${items.length} 个可选`
                  : "尚未启用"}
          </span>
        </div>
        <button type="button" className="hpr-manage" onClick={onNavigatePlugins}>
          管理插件 <span aria-hidden="true">→</span>
        </button>
      </header>

      {items.length > 0 ? (
        <div className="hpr-scroll" role="list">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="listitem"
              className={`hpr-chip is-${item.tone}`}
              title={item.meta}
              onClick={() => onPick(item.pick)}
            >
              <span className="hpr-dot" aria-hidden="true" />
              <span className="hpr-chip-text">
                <strong>{item.pick.name}</strong>
                <small>{item.meta}</small>
              </span>
              <span className="hpr-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
          <button type="button" className="hpr-chip is-more" onClick={onNavigatePlugins}>
            <HomeIcon name="search" size={13} />
            <span className="hpr-chip-text"><strong>发现更多</strong><small>480 个插件</small></span>
          </button>
        </div>
      ) : (
        <div className="hpr-empty">
          <p>在插件页启用一个包或收藏插件，这里就会变成一键入口。</p>
          <button type="button" onClick={onNavigatePlugins}>去挑选插件 <span aria-hidden="true">→</span></button>
        </div>
      )}

      <p className="hpr-foot">
        <HomeIcon name="shield" size={12} />
        点击只把示例需求填进输入框，不会安装或授权；权限在执行前二次确认。
      </p>
    </section>
  );
}
