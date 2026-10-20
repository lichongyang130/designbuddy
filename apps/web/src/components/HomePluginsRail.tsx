import { useEffect, useMemo, useState } from "react";
import { useWorkspaceStore } from "../../../../frontend/workspace/store";
import { HomeIcon } from "./HomeIcon";
import { invalidateHomePlugins, useHomePlugins } from "./useHomePlugins";
import { requirementAction } from "./pluginRequirements";

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

export type PluginRequirement = { kind: string; label: string; detail: string };

type Props = {
  onPick: (pick: HomePluginPick) => void;
  onNavigatePlugins: () => void;
  /**
   * Take the person to where a blocked skill's requirement is actually fixed.
   * The rail closes its dialog first; the homepage decides the destination.
   */
  onConfigureRequirement?: (requirement: PluginRequirement, skillId: string, skillName: string) => void;
};

/** Curated catalog picks shown when the user has nothing installed or saved yet. */
const FEATURED_PLUGIN_IDS = ["plugin-01", "plugin-02", "plugin-03", "plugin-05", "plugin-15", "plugin-18"];
const MAX_RAIL = 10;

/**
 * Copy without assuming `navigator.clipboard` exists: the preview and any plain
 * http origin do not expose it, and a config hint is exactly what people paste
 * into a deployment ticket.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the textarea path */ }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function HomePluginsRail({ onPick, onNavigatePlugins, onConfigureRequirement }: Props) {
  const assets = useWorkspaceStore((state) => state.assets);
  const { bundles, totals, loading } = useHomePlugins();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!blockedOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setBlockedOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blockedOpen]);

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

  // Skills the server already knows it cannot run: missing credentials, an
  // unwired renderer, or an environment the host does not provide.
  const blocked = useMemo(
    () => bundles.flatMap((bundle) =>
      bundle.skills
        .filter((skill) => skill.status !== "ready")
        .map((skill) => ({ bundle: bundle.name, skill })),
    ),
    [bundles],
  );

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
        <div className="hpr-head-actions">
          {blocked.length > 0 && (
            <button type="button" className="hpr-blocked" onClick={() => setBlockedOpen(true)} title="查看还需要配置什么">
              <HomeIcon name="shield" size={12} /> {blocked.length} 个待配置
            </button>
          )}
          <button type="button" className="hpr-manage" onClick={onNavigatePlugins}>
            管理插件 <span aria-hidden="true">→</span>
          </button>
        </div>
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

      {blockedOpen && (
        <div className="hpr-blocked-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBlockedOpen(false); }}>
          <div className="hpr-blocked-dialog" role="dialog" aria-modal="true" aria-label="待配置的技能">
            <header>
              <div>
                <h4>{blocked.length} 个技能还不能运行</h4>
                <p>这些技能所属的插件包已启用，但服务端缺少它们需要的条件。配置好之前，它们不会出现在一键入口里，也不会假装成功。</p>
              </div>
              <button type="button" className="hpr-blocked-close" onClick={() => setBlockedOpen(false)} aria-label="关闭">×</button>
            </header>
            <ul>
              {blocked.map(({ bundle, skill }) => (
                <li key={`${bundle}:${skill.id}`}>
                  <div className="hpr-blocked-title">
                    <strong>{skill.name}</strong>
                    <span>{bundle}</span>
                  </div>
                  {skill.unavailableReason && <p className="hpr-blocked-reason">{skill.unavailableReason}</p>}
                  {skill.requires.length > 0 && (
                    <ul className="hpr-blocked-needs">
                      {skill.requires.map((requirement) => {
                        const action = requirementAction(requirement.kind);
                        return (
                          <li key={requirement.label}>
                            <span>{requirement.label}</span>
                            <small>{requirement.detail}</small>
                            <div className="hpr-need-actions">
                              {action.kind !== "none" && (
                                <button
                                  type="button"
                                  className="hpr-need-go"
                                  title={action.hint}
                                  onClick={() => {
                                    setBlockedOpen(false);
                                    onConfigureRequirement?.(requirement, skill.id, skill.name);
                                  }}
                                >
                                  {action.label} <span aria-hidden="true">→</span>
                                </button>
                              )}
                              <button
                                type="button"
                                className="hpr-need-copy"
                                onClick={() => {
                                  const text = `${skill.name} · ${requirement.label}：${requirement.detail}`;
                                  void copyText(text).then((ok) => setCopied(ok ? requirement.label : `${requirement.label}:失败`));
                                }}
                              >
                                {copied === `${requirement.label}:失败` ? "复制失败，请手动选中" : copied === requirement.label ? "已复制" : "复制说明"}
                              </button>
                              <small className="hpr-need-hint">{action.hint}</small>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <footer className="hpr-blocked-foot">
              <span>改完配置不用重启服务；重新检测会再问一次服务端哪些技能已就绪。</span>
              <div>
                <button type="button" className="hpr-foot-recheck" onClick={() => { setBlockedOpen(false); invalidateHomePlugins(); }}>
                  重新检测
                </button>
                <button type="button" onClick={() => { setBlockedOpen(false); onNavigatePlugins(); }}>
                  在插件页查看 <span aria-hidden="true">→</span>
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
