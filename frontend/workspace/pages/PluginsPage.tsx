import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import catalog from "../../../plugins/_official/catalog.json";
import {
  HomeIcon,
  type HomeIconName,
} from "../../../apps/web/src/components/HomeIcon";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { listProjects } from "../projectStore";
import { navigateTo } from "../workspaceRoutes";
import { useWorkspaceStore } from "../store";
import "./plugins.css";

type Plugin = (typeof catalog)[number];
type View = "discover" | "all" | "saved";
const categories: {
  id: string;
  label: string;
  icon: HomeIconName;
  color: string;
  background: string;
}[] = [
  {
    id: "all",
    label: "全部",
    icon: "grid",
    color: "#426b54",
    background: "#eaf4ee",
  },
  {
    id: "design",
    label: "设计创意",
    icon: "palette",
    color: "#9265be",
    background: "#f1eafa",
  },
  {
    id: "developer",
    label: "开发工具",
    icon: "code",
    color: "#5377c0",
    background: "#eaf0fc",
  },
  {
    id: "office",
    label: "效率办公",
    icon: "document",
    color: "#b68039",
    background: "#faf0df",
  },
  {
    id: "media",
    label: "多媒体",
    icon: "slides",
    color: "#d2796c",
    background: "#fbece7",
  },
  {
    id: "data",
    label: "数据分析",
    icon: "chart",
    color: "#468e99",
    background: "#e4f3f5",
  },
  {
    id: "workflow",
    label: "工作流",
    icon: "bolt",
    color: "#578b68",
    background: "#e9f3e8",
  },
  {
    id: "quality",
    label: "测试与质量",
    icon: "shield",
    color: "#778552",
    background: "#f0f3e6",
  },
  {
    id: "deploy",
    label: "部署交付",
    icon: "update",
    color: "#88725c",
    background: "#f4eee6",
  },
  {
    id: "marketing",
    label: "营销增长",
    icon: "growth",
    color: "#b36c97",
    background: "#f8eaf3",
  },
  {
    id: "product",
    label: "产品管理",
    icon: "panel",
    color: "#6c76a8",
    background: "#eef0f8",
  },
  {
    id: "research",
    label: "研究采集",
    icon: "search",
    color: "#5e8a87",
    background: "#e7f2ef",
  },
  {
    id: "support",
    label: "客户支持",
    icon: "experts",
    color: "#aa8758",
    background: "#f6f0e5",
  },
];
const categoryOf = (id: string) =>
  categories.find((c) => c.id === id) || categories[0];
const featuredIds = [
  "plugin-01",
  "plugin-02",
  "plugin-05",
  "plugin-18",
  "plugin-20",
  "plugin-09",
  "plugin-03",
  "plugin-15",
  "plugin-19",
  "plugin-04",
  "plugin-24",
  "plugin-40",
];
const permissionCopy: Record<string, { label: string; description: string }> = {
  "workspace:read": {
    label: "读取工作区",
    description:
      "规格声明需要读取项目上下文；实际可读范围由适配器和授权策略决定。",
  },
  "workspace:write:approval": {
    label: "写入前确认",
    description: "写入工作区前应取得明确确认，加入清单不会授予写入权限。",
  },
  "network:allowlisted": {
    label: "白名单网络访问",
    description: "仅允许配置范围内的网络请求；加入清单不会连接第三方账号。",
  },
};
function PluginLogo({
  item,
  large = false,
}: {
  item: Plugin;
  large?: boolean;
}) {
  const c = categoryOf(item.category);
  return (
    <span
      className={`pm-logo ${large ? "pm-logo-large" : ""} ${item.id === "plugin-05" ? "pm-logo-dark" : ""}`}
      style={
        {
          "--pm-icon-ink": c.color,
          "--pm-icon-bg": c.background,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {item.id === "plugin-01" ? (
        <svg viewBox="0 0 24 36" width="22" height="31" aria-hidden="true">
          <path d="M12 0H6a6 6 0 0 0 0 12h6Z" fill="#f46b55" />
          <path d="M12 0h6a6 6 0 0 1 0 12h-6Z" fill="#ff9a83" />
          <path d="M12 12H6a6 6 0 0 0 0 12h6Z" fill="#a474e8" />
          <circle cx="18" cy="18" r="6" fill="#4cb5ed" />
          <path d="M12 24H6a6 6 0 1 0 6 6Z" fill="#55bb94" />
        </svg>
      ) : (
        <HomeIcon
          name={
            item.id === "plugin-02"
              ? "panel"
              : item.id === "plugin-05"
                ? "code"
                : item.id === "plugin-18"
                  ? "document"
                  : item.id === "plugin-20"
                    ? "palette"
                    : c.icon
          }
          size={large ? 30 : 25}
        />
      )}
    </span>
  );
}
function PluginDetails({
  item,
  saved,
  notice,
  onClose,
  onToggle,
}: {
  item: Plugin;
  saved: boolean;
  notice: string;
  onClose(): void;
  onToggle(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="pm-dialog"
      aria-labelledby="pm-detail-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const b = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            onClose();
        }
      }}
    >
      <div className="pm-detail-heading">
        <PluginLogo item={item} large />
        <div>
          <span>{categoryOf(item.category).label} / 插件能力规格</span>
          <h2 id="pm-detail-title">{item.name}</h2>
        </div>
        <button
          className="pm-icon-button"
          onClick={onClose}
          aria-label="关闭插件详情"
          autoFocus
        >
          ×
        </button>
      </div>
      <div className="pm-detail-body">
        {notice && (
          <p className="pm-detail-notice" role="status">
            {notice}
          </p>
        )}
        <p className="pm-detail-description">{item.description}</p>
        <div className="pm-detail-facts">
          <div>
            <span>版本</span>
            <strong>v{item.version}</strong>
          </div>
          <div>
            <span>目录风险标注</span>
            <strong>{item.risk}</strong>
          </div>
          <div>
            <span>接入状态</span>
            <strong>待配置适配器</strong>
          </div>
        </div>
        <h3>
          权限声明 <span>{item.permissions.length} 项</span>
        </h3>
        <div className="pm-permissions">
          {item.permissions.map((p) => (
            <article key={p}>
              <HomeIcon
                name={
                  p.includes("write")
                    ? "pencil"
                    : p.includes("network")
                      ? "link"
                      : "folder"
                }
                size={19}
              />
              <div>
                <strong>{permissionCopy[p]?.label || p}</strong>
                <p>
                  {permissionCopy[p]?.description ||
                    "使用前需核对具体权限及执行范围。"}
                </p>
                <code>{p}</code>
              </div>
            </article>
          ))}
        </div>
        <div className="pm-scope-note">
          <HomeIcon name="shield" size={18} />
          <p>
            <b>保存规格，不等于授权执行</b>
            加入清单仅将条目保存到当前浏览器，不会安装软件、连接账号或执行操作。实际使用需要配置对应服务端适配器，并按要求确认权限。目录风险标注不等于安全认证。
          </p>
        </div>
      </div>
      <footer>
        <button
          className="pm-detail-secondary"
          onClick={() => navigateTo("/connectors")}
        >
          查看连接器 <HomeIcon name="chevron" size={13} />
        </button>
        <button
          className={`pm-save-primary ${saved ? "is-saved" : ""}`}
          onClick={onToggle}
        >
          <HomeIcon name={saved ? "check" : "plus"} />
          {saved ? "从我的清单移除" : "加入我的清单"}
        </button>
      </footer>
    </dialog>
  );
}
export default function PluginsPage() {
  const [view, setView] = useState<View>("discover"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [more, setMore] = useState(false),
    [page, setPage] = useState(1),
    [sort, setSort] = useState("default"),
    [selected, setSelected] = useState<Plugin | null>(null),
    [notice, setNotice] = useState("");
  const detailTrigger = useRef<HTMLElement | null>(null);
  const search = useRef<HTMLInputElement>(null),
    results = useRef<HTMLElement>(null);
  const storedAssets = useWorkspaceStore((s) => s.assets),
    assets = Array.isArray(storedAssets) ? storedAssets : [];
  const savedIds = useMemo(
    () =>
      new Set(assets.filter((a) => a && a.type === "plugins").map((a) => a.id)),
    [storedAssets],
  );
  const savedCount = catalog.filter((item) => savedIds.has(item.id)).length;
  const normalized = query.trim().toLocaleLowerCase();
  const matches = catalog.filter(
    (item) =>
      (view !== "saved" || savedIds.has(item.id)) &&
      (view !== "discover" || featuredIds.includes(item.id)) &&
      (category === "all" || item.category === category) &&
      [
        item.name,
        item.description,
        item.category,
        categoryOf(item.category).label,
        ...item.permissions,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalized),
  );
  const ordered = [...matches].sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name, "zh-CN")
      : view === "discover"
        ? featuredIds.indexOf(a.id) - featuredIds.indexOf(b.id)
        : 0,
  );
  const pages = Math.max(1, Math.ceil(ordered.length / 24)),
    currentPage = Math.min(page, pages),
    visible = ordered.slice((currentPage - 1) * 24, currentPage * 24);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "k" &&
        !selected
      ) {
        e.preventDefault();
        search.current?.focus();
        search.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected]);
  function openDetails(item: Plugin) {
    detailTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setNotice("");
    setSelected(item);
  }
  function closeDetails() {
    setSelected(null);
    requestAnimationFrame(() => {
      if (detailTrigger.current?.isConnected) detailTrigger.current.focus();
    });
  }
  function switchView(next: View) {
    setView(next);
    setQuery("");
    setCategory("all");
    setPage(1);
    setSort("default");
  }
  function chooseCategory(id: string) {
    setCategory(id);
    setPage(1);
    if (view === "discover") setView("all");
  }
  function discoverDesign() {
    chooseCategory("design");
    results.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }
  function toggle(item: Plugin) {
    const previous = useWorkspaceStore.getState().assets;
    try {
      if (savedIds.has(item.id))
        useWorkspaceStore.getState().removeAsset(item.id, "plugins");
      else
        useWorkspaceStore
          .getState()
          .addAsset({
            id: item.id,
            name: item.name,
            type: "plugins",
            addedAt: new Date().toISOString(),
          });
      setNotice(
        savedIds.has(item.id)
          ? `已从清单移除「${item.name}」。`
          : `已将「${item.name}」加入本地清单，尚未安装或授权。`,
      );
    } catch {
      try {
        useWorkspaceStore.setState({ assets: previous });
      } catch {
        /* Storage can fail again; the in-memory state is restored first. */
      }
      setNotice("保存失败：浏览器存储不可用，请检查存储设置后重试。");
    }
  }
  return (
    <div className="workbuddy-app plugins-workspace">
      <WorkBuddySidebar
        active="plugins"
        projectCount={listProjects().length}
        go={navigateTo}
        setNotice={setNotice}
      />
      <main className="pm-main">
        <header className="pm-header">
          <div>
            <div className="pm-kicker">DESIGNBUDDY / TOOLBOX</div>
            <div className="pm-heading-line">
              <h1>插件</h1>
              <span>让创作，多一点可能。</span>
            </div>
          </div>
          <label className="pm-search">
            <HomeIcon name="search" size={17} />
            <input
              ref={search}
              aria-label="搜索插件"
              placeholder="搜索插件名称、类别或用途"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
                if (view === "discover") setView("all");
              }}
            />
            {query ? (
              <button
                onClick={() => {
                  setQuery("");
                  setPage(1);
                  search.current?.focus();
                }}
                aria-label="清空插件搜索"
              >
                ×
              </button>
            ) : (
              <kbd title="⌘ K / Ctrl K">⌘ K</kbd>
            )}
          </label>
        </header>
        <nav className="pm-tabs" aria-label="插件视图">
          {(
            [
              { id: "discover", label: "精选发现" },
              { id: "all", label: "全部插件" },
              { id: "saved", label: "我的清单" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              aria-pressed={view === t.id}
              onClick={() => switchView(t.id)}
            >
              {t.id === "saved" && <HomeIcon name="folder" size={15} />}{" "}
              {t.label}
              {t.id === "saved" && <span>{savedCount}</span>}
            </button>
          ))}
          <span className="pm-catalog-note">
            <i />
            {catalog.length} 项能力规格 · 接入后使用
          </span>
        </nav>
        {view === "discover" && (
          <section className="pm-featured" aria-label="插件精选专题">
            <article className="pm-feature-main">
              <div className="pm-feature-copy">
                <span className="pm-feature-label">
                  <HomeIcon name="palette" size={13} /> 为创作者准备
                </span>
                <h2>
                  好用的工具，
                  <br />
                  让灵感更进一步。
                </h2>
                <p>
                  从设计参考到页面交付，
                  <br />
                  找到适合你的下一项能力。
                </p>
                <button onClick={discoverDesign}>
                  探索设计插件 <span>↗</span>
                </button>
              </div>
              <div className="pm-feature-art" aria-hidden="true">
                <div className="pm-orbit pm-orbit-one" />
                <div className="pm-orbit pm-orbit-two" />
                <span className="pm-art-dot dot-one" />
                <span className="pm-art-dot dot-two" />
                <div className="pm-mini-window">
                  <div className="pm-mini-bar">
                    <i />
                    <i />
                    <i />
                    <span>YOUR NEXT IDEA</span>
                  </div>
                  <div className="pm-mini-canvas">
                    <div />
                    <span />
                    <span />
                    <span />
                    <b>Make it yours.</b>
                  </div>
                </div>
                <div className="pm-floating pm-floating-figma">
                  <PluginLogo item={catalog[0]} />
                  <span>
                    Figma 文件桥接<small>把设计带进工作区</small>
                  </span>
                </div>
                <div className="pm-floating pm-floating-token">
                  <span className="pm-token-swatches">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    设计 Token 同步<small>让每一处，保持一致</small>
                  </span>
                  <HomeIcon name="checkCircle" size={17} />
                </div>
                <div className="pm-cursor">
                  <svg viewBox="0 0 27 34" width="27" height="34">
                    <path
                      d="M2 2 24 20l-10 2-4 9Z"
                      fill="#355e45"
                      stroke="white"
                      strokeWidth="2"
                    />
                  </svg>
                  <span>DesignBuddy</span>
                </div>
              </div>
            </article>
            <article className="pm-feature-side">
              <span className="pm-side-eyebrow">BUILD YOUR TOOLBOX</span>
              <div className="pm-side-icons" aria-hidden="true">
                <PluginLogo item={catalog[8]} />
                <PluginLogo item={catalog[17]} />
                <PluginLogo item={catalog[4]} />
              </div>
              <h2>
                你的工具，
                <br />
                按你的节奏组合。
              </h2>
              <p>
                把值得留住的能力加入清单，
                <br />
                下次需要时，不必从头找起。
              </p>
              <button onClick={() => switchView("saved")}>
                整理我的清单 <HomeIcon name="chevron" size={15} />
              </button>
            </article>
          </section>
        )}
        <section ref={results} className="pm-results" aria-label="插件目录">
          <div className="pm-category-row">
            <div role="group" aria-label="插件分类">
              {categories.slice(0, more ? categories.length : 7).map((c) => (
                <button
                  key={c.id}
                  aria-pressed={category === c.id}
                  onClick={() => chooseCategory(c.id)}
                >
                  <HomeIcon name={c.icon} size={14} />
                  {c.label}
                </button>
              ))}
              <button
                className="pm-more-categories"
                aria-expanded={more}
                onClick={() => setMore(!more)}
              >
                {more ? "收起分类" : "更多分类"}
                <HomeIcon name="chevron" size={11} />
              </button>
            </div>
          </div>
          <div className="pm-results-heading">
            <div>
              <h2>
                {normalized
                  ? "搜索结果"
                  : view === "saved"
                    ? "我的插件清单"
                    : view === "discover"
                      ? "精选插件"
                      : category === "all"
                        ? "发现全部插件"
                        : categoryOf(category).label}
              </h2>
              <span>
                {view === "discover"
                  ? "为常见创作任务，精选实用能力"
                  : `共 ${ordered.length} 项${view === "saved" ? " · 仅保存在当前浏览器" : ""}`}
              </span>
            </div>
            <label>
              排序
              <select
                aria-label="插件排序"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
              >
                <option value="default">
                  {view === "discover" ? "编辑精选" : "目录顺序"}
                </option>
                <option value="name">名称排序</option>
              </select>
            </label>
          </div>
          {visible.length ? (
            <div className="pm-grid">
              {visible.map((item) => {
                const c = categoryOf(item.category),
                  saved = savedIds.has(item.id);
                return (
                  <article className="pm-card" key={item.id}>
                    <div className="pm-card-top">
                      <PluginLogo item={item} />
                      <button
                        className={`pm-add ${saved ? "is-saved" : ""}`}
                        aria-label={`${saved ? "移除" : "收藏"}${item.name}`}
                        aria-pressed={saved}
                        title={
                          saved
                            ? "从本地清单移除"
                            : "加入本地清单，不会安装或授权"
                        }
                        onClick={() => toggle(item)}
                      >
                        <HomeIcon name={saved ? "check" : "plus"} size={17} />
                      </button>
                    </div>
                    <button
                      className="pm-card-open"
                      onClick={() => openDetails(item)}
                      aria-label={`查看${item.name}详情`}
                    >
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                    </button>
                    <footer>
                      <span
                        className="pm-category-tag"
                        style={{ color: c.color }}
                      >
                        <i style={{ background: c.color }} />
                        {c.label}
                      </span>
                      <button
                        onClick={() => openDetails(item)}
                        aria-label={`查看${item.name}权限`}
                      >
                        <span>查看详情</span>
                        <HomeIcon name="chevron" size={12} />
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="pm-empty" role="status">
              <span>
                <HomeIcon
                  name={view === "saved" ? "folder" : "search"}
                  size={31}
                />
              </span>
              <h3>
                {view === "saved" && !savedCount
                  ? "给你的工具箱，添上第一项能力"
                  : "没有找到匹配的插件"}
              </h3>
              <p>
                {view === "saved" && !savedCount
                  ? "浏览插件，点击卡片右上角的加号，建立自己的能力清单。"
                  : "试试插件名称、中文分类，或缩短搜索关键词。"}
              </p>
              <button onClick={() => switchView("all")}>
                {view === "saved" && !savedCount
                  ? "去发现插件"
                  : "清除筛选，查看全部"}
                <HomeIcon name="chevron" size={13} />
              </button>
            </div>
          )}
          {pages > 1 && (
            <nav className="pm-pagination" aria-label="插件分页">
              <span>
                显示 {(currentPage - 1) * 24 + 1}–
                {Math.min(currentPage * 24, ordered.length)} / {ordered.length}{" "}
                项
              </span>
              <button
                disabled={currentPage === 1}
                aria-label="上一页插件"
                onClick={() => {
                  setPage(currentPage - 1);
                  results.current?.scrollIntoView({ block: "start" });
                }}
              >
                ←
              </button>
              <label>
                第{" "}
                <select
                  aria-label="插件页码"
                  value={currentPage}
                  onChange={(e) => {
                    setPage(Number(e.target.value));
                    results.current?.scrollIntoView({ block: "start" });
                  }}
                >
                  {Array.from({ length: pages }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>{" "}
                / {pages} 页
              </label>
              <button
                disabled={currentPage === pages}
                aria-label="下一页插件"
                onClick={() => {
                  setPage(currentPage + 1);
                  results.current?.scrollIntoView({ block: "start" });
                }}
              >
                →
              </button>
            </nav>
          )}
        </section>
        <footer className="pm-page-footer">
          <HomeIcon name="shield" size={15} />
          <p>
            选择工具，也保留控制权。
            <span>这里展示能力规格；加入清单不代表安装、授权或已可执行。</span>
          </p>
          <button onClick={() => navigateTo("/library")}>
            资产中心 <span>↗</span>
          </button>
        </footer>
      </main>
      {notice && !selected && (
        <div className="pm-notice" role="status">
          <HomeIcon name="checkCircle" size={18} />
          <span>{notice}</span>
          <button aria-label="关闭提示" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {selected && (
        <PluginDetails
          key={selected.id}
          item={selected}
          notice={notice}
          saved={savedIds.has(selected.id)}
          onClose={closeDetails}
          onToggle={() => toggle(selected)}
        />
      )}
    </div>
  );
}
