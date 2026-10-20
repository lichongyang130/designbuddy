import { useEffect, useMemo, useRef, useState } from "react";
import type { RuntimeSkill } from "../../../../shared/skillRuntime";
import { modeLabels, scenesByMode, type HomeMode, type HomeScene } from "./homeScenes";
import { HomeIcon } from "./HomeIcon";
import { loadRuntimeSkills } from "./useRuntimeSkill";

type CatalogPlugin = { id: string; name: string; category: string; description: string };

type Item = {
  key: string;
  group: "场景" | "插件" | "技能" | "页面";
  title: string;
  subtitle: string;
  badge?: string;
  run: () => void;
};

type Props = {
  open: boolean;
  mode: HomeMode;
  onClose: () => void;
  onSelectScene: (scene: HomeScene) => void;
  onSelectSkill: (name: string) => void;
  onNavigate: (path: string) => void;
};

const PAGES: Array<{ title: string; path: string; hint: string }> = [
  { title: "插件市场", path: "/plugins", hint: "480 项能力规格与插件包管理" },
  { title: "工作流", path: "/workflows", hint: "可复用的执行配方" },
  { title: "素材库", path: "/library", hint: "设计系统 / 模板 / 技能目录" },
  { title: "我的项目", path: "/projects", hint: "历史任务与成果" },
  { title: "灵感", path: "/inspiration", hint: "参考与样例" },
];

/**
 * One search box for scenes, plugins, skills and pages.
 *
 * The 480-item catalogue and the skill declarations are fetched only after the
 * palette is opened, so the homepage pays nothing for a feature it may never use.
 */
export function HomeCommandPalette({ open, mode, onClose, onSelectScene, onSelectSkill, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [plugins, setPlugins] = useState<CatalogPlugin[]>([]);
  const [skills, setSkills] = useState<RuntimeSkill[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    requestAnimationFrame(() => inputRef.current?.focus());
    let cancelled = false;
    if (!plugins.length) {
      void import("../../../../plugins/_official/catalog.json")
        .then((module) => {
          if (cancelled) return;
          const list = (module.default ?? module) as unknown as CatalogPlugin[];
          if (Array.isArray(list)) setPlugins(list);
        })
        .catch(() => { /* palette still works without the catalogue */ });
    }
    if (!skills.length) {
      void loadRuntimeSkills()
        .then((list) => { if (!cancelled) setSkills(list); })
        .catch(() => { /* ditto */ });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const items = useMemo<Item[]>(() => {
    const scenes: Item[] = (Object.keys(scenesByMode) as HomeMode[]).flatMap((sceneMode) =>
      scenesByMode[sceneMode].map((scene) => ({
        key: `scene:${sceneMode}:${scene.id}`,
        group: "场景" as const,
        title: scene.title,
        subtitle: scene.description,
        badge: `${modeLabels[sceneMode]} · ${scene.tag}`,
        run: () => onSelectScene(scene),
      })),
    );
    const pluginItems: Item[] = plugins.map((plugin) => ({
      key: `plugin:${plugin.id}`,
      group: "插件" as const,
      title: plugin.name,
      subtitle: plugin.description,
      badge: plugin.category,
      // A catalogue entry has no executor of its own; go where it can be managed.
      run: () => onNavigate("/plugins"),
    }));
    const skillItems: Item[] = skills.map((skill) => ({
      key: `skill:${skill.id}`,
      group: "技能" as const,
      title: skill.name,
      subtitle: skill.description,
      badge: skill.status === "ready" ? "可运行" : "待配置",
      run: () => onSelectSkill(skill.name),
    }));
    const pageItems: Item[] = PAGES.map((page) => ({
      key: `page:${page.path}`,
      group: "页面" as const,
      title: page.title,
      subtitle: page.hint,
      run: () => onNavigate(page.path),
    }));
    const all = [...scenes, ...skillItems, ...pluginItems, ...pageItems];

    const needle = query.trim().toLowerCase();
    if (!needle) {
      // Empty query: the current mode's scenes first, then this mode's skills.
      const own = all.filter((item) => item.group === "场景" && item.badge?.startsWith(modeLabels[mode]));
      const rest = all.filter((item) => item.group === "技能" && item.badge === "可运行").slice(0, 6);
      return [...own, ...rest, ...pageItems];
    }
    const terms = needle.split(/\s+/).filter(Boolean);
    return all
      .map((item) => {
        const title = item.title.toLowerCase();
        const haystack = `${title} ${item.subtitle.toLowerCase()} ${(item.badge ?? "").toLowerCase()}`;
        if (!terms.every((term) => haystack.includes(term))) return null;
        let score = 0;
        if (title === needle) score += 100;
        else if (title.startsWith(needle)) score += 60;
        else if (title.includes(needle)) score += 30;
        if (item.group === "技能" && item.badge === "可运行") score += 6;
        if (item.group === "场景") score += 4;
        return { item, score };
      })
      .filter((entry): entry is { item: Item; score: number } => entry !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 24)
      .map((entry) => entry.item);
  }, [plugins, skills, query, mode, onSelectScene, onSelectSkill, onNavigate]);

  useEffect(() => setCursor(0), [query]);
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(".hcp-item.is-active");
    node?.scrollIntoView({ block: "nearest" });
  }, [cursor, items]);

  if (!open) return null;

  const run = (item: Item) => {
    onClose();
    item.run();
  };

  return (
    <div className="hcp-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="hcp" role="dialog" aria-modal="true" aria-label="搜索场景、插件、技能">
        <div className="hcp-search">
          <HomeIcon name="search" size={15} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCursor((value) => (items.length ? (value + 1) % items.length : 0));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setCursor((value) => (items.length ? (value - 1 + items.length) % items.length : 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const item = items[cursor];
                if (item) run(item);
              }
            }}
            placeholder="搜索场景、插件、技能，或输入页面名…"
            aria-label="搜索场景、插件、技能"
            autoComplete="off"
          />
          <kbd>esc</kbd>
        </div>

        <div className="hcp-list" ref={listRef} role="listbox" aria-label="搜索结果">
          {items.length === 0 && (
            <p className="hcp-empty" role="status">
              没有匹配项。试试「表格」「海报」「插件」或页面名。
            </p>
          )}
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              role="option"
              aria-selected={index === cursor}
              className={`hcp-item${index === cursor ? " is-active" : ""}`}
              onMouseEnter={() => setCursor(index)}
              onClick={() => run(item)}
            >
              <span className="hcp-group">{item.group}</span>
              <span className="hcp-text">
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </span>
              {item.badge && <span className="hcp-badge">{item.badge}</span>}
            </button>
          ))}
        </div>

        <footer className="hcp-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
          <span><kbd>↵</kbd> 填入或打开</span>
          <span>插件与技能目录仅在搜索时加载</span>
        </footer>
      </div>
    </div>
  );
}
