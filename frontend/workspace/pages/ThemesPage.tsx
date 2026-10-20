import { useEffect, useMemo, useState } from "react";
import { navigateTo } from "../workspaceRoutes";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { HomeIcon } from "../../../apps/web/src/components/HomeIcon";
import { ThemePreview, type ThemePreviewVariant } from "../../../apps/web/src/components/ThemePreview";
import { listProjects } from "../projectStore";
import { listPptProjects, savePptProject, type PptProject } from "../pptStore";
import { allThemes, blankTheme, duplicateTheme, findTheme, useThemeStore } from "../themeStore";
import {
  THEME_FONTS,
  contrastRatio,
  validateDeckTheme,
  type DeckPalette,
  type DeckTheme,
} from "../../../shared/deckTheme";
import "./themes.css";

const PALETTE_FIELDS: { key: keyof DeckPalette; label: string }[] = [
  { key: "background", label: "背景" },
  { key: "surface", label: "表面" },
  { key: "text", label: "正文" },
  { key: "muted", label: "次要文字" },
  { key: "primary", label: "主色" },
  { key: "accent", label: "强调色" },
  { key: "border", label: "边框" },
  { key: "onPrimary", label: "主色上的文字" },
];

const STYLE_FILTERS = ["全部", "极简", "杂志", "科技", "深色", "品牌", "自然", "活力"];

export default function ThemesPage() {
  const custom = useThemeStore((state) => state.custom);
  const defaultThemeId = useThemeStore((state) => state.defaultThemeId);
  const saveCustom = useThemeStore((state) => state.saveCustom);
  const removeCustom = useThemeStore((state) => state.removeCustom);
  const setDefault = useThemeStore((state) => state.setDefault);

  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [styleFilter, setStyleFilter] = useState("全部");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<ThemePreviewVariant>("cover");
  const [editing, setEditing] = useState<DeckTheme | null>(null);
  const [editorErrors, setEditorErrors] = useState<string[]>([]);
  const [decks, setDecks] = useState<PptProject[]>([]);

  useEffect(() => {
    setDecks(listPptProjects());
  }, []);

  const themes = useMemo(() => allThemes(), [custom]);
  const selected = selectedId ? findTheme(selectedId) ?? null : null;
  const recentDeck = decks[0];

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return themes.filter((theme) => {
      if (styleFilter !== "全部" && !theme.tags.includes(styleFilter)) return false;
      if (!needle) return true;
      const haystack = `${theme.name} ${theme.tags.join(" ")} ${theme.kind}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [themes, query, styleFilter]);

  function applyToDeck(theme: DeckTheme) {
    const deck = listPptProjects()[0];
    if (!deck) {
      setNotice("还没有演示稿。先在首页输入「PPT制作」，或去演示稿页新建一份，再回来应用主题。");
      return;
    }
    savePptProject({ ...deck, themeId: theme.id, themeName: theme.name });
    setDecks(listPptProjects());
    setNotice(`已把「${theme.name}」应用到「${deck.title}」；文字和结构一个字都没改。`);
  }

  function editTheme(theme: DeckTheme) {
    setEditing(theme.kind === "preset" ? duplicateTheme(theme) : { ...theme });
    setEditorErrors([]);
  }

  function saveEditing() {
    if (!editing) return;
    const result = saveCustom(editing);
    if (result.ok) {
      setEditing(null);
      setEditorErrors([]);
      setNotice(
        result.warnings.length
          ? `已保存「${result.theme.name}」；有 ${result.warnings.length} 条对比度提醒，可按需调整。`
          : `已保存「${result.theme.name}」。`,
      );
    } else {
      setEditorErrors(result.errors);
    }
  }

  const warnings = editing ? validateDeckTheme(editing) : null;
  const editorWarnings = warnings?.ok ? warnings.warnings : [];
  const editorValid = warnings?.ok ?? false;

  return (
    <div className="workbuddy-app themes-workspace">
      <WorkBuddySidebar
        active="themes"
        projectCount={listProjects().length}
        go={navigateTo}
        setNotice={setNotice}
      />
      <main className="th-main">
        <header className="th-header">
          <div>
            <div className="th-kicker">DESIGNBUDDY / THEMES</div>
            <div className="th-heading-line">
              <h1>主题</h1>
              <span>换主题不动内容</span>
            </div>
          </div>
          <div className="th-header-actions">
            <button className="th-ghost" onClick={() => navigateTo("/ppt")}>
              打开演示稿 <span aria-hidden="true">→</span>
            </button>
            <button
              className="th-primary"
              onClick={() => {
                setEditing(blankTheme());
                setEditorErrors([]);
              }}
            >
              ＋ 新建主题
            </button>
          </div>
        </header>

        <div className="th-toolbar">
          <label className="th-search">
            <HomeIcon name="search" size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索主题风格或标签"
              aria-label="搜索主题"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="清除搜索">×</button>
            )}
          </label>
          <div className="th-filters" role="group" aria-label="按风格筛选">
            {STYLE_FILTERS.map((style) => (
              <button
                key={style}
                type="button"
                aria-pressed={styleFilter === style}
                className={styleFilter === style ? "is-active" : ""}
                onClick={() => setStyleFilter(style)}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        {notice && (
          <p className="th-notice" role="status">
            {notice}
            <button type="button" onClick={() => setNotice("")} aria-label="关闭提示">×</button>
          </p>
        )}

        <p className="th-context">
          {themes.length} 套主题 · {custom.length} 套自定义
          {defaultThemeId && findTheme(defaultThemeId) ? ` · 默认「${findTheme(defaultThemeId)!.name}」` : ""}
          {recentDeck ? ` · 当前演示稿「${recentDeck.title}」` : " · 还没有演示稿"}
        </p>

        {visible.length === 0 ? (
          <div className="th-empty" role="status">
            <strong>没有匹配的主题</strong>
            <p>换成「全部」，或清空搜索词。</p>
            <button className="th-ghost" onClick={() => { setQuery(""); setStyleFilter("全部"); }}>
              清除筛选
            </button>
          </div>
        ) : (
          <div className="th-grid">
            {visible.map((theme) => (
              <article
                key={theme.id}
                className={`th-card${defaultThemeId === theme.id ? " is-default" : ""}`}
                data-kind={theme.kind}
              >
                <button
                  type="button"
                  className="th-card-preview"
                  onClick={() => { setSelectedId(theme.id); setTab("cover"); }}
                  aria-label={`查看主题 ${theme.name}`}
                >
                  <ThemePreview theme={theme} variant="cover" />
                  <span className="th-card-hover">应用到当前演示稿</span>
                </button>
                <div className="th-card-foot">
                  <div className="th-card-meta">
                    <strong>{theme.name}</strong>
                    <span>
                      {theme.tags.slice(0, 2).join(" · ") || (theme.kind === "custom" ? "自定义" : "预设")}
                      {defaultThemeId === theme.id ? " · 默认" : ""}
                    </span>
                  </div>
                  <div className="th-swatches" aria-hidden="true">
                    {[theme.palette.primary, theme.palette.accent, theme.palette.background, theme.palette.text].map((color, index) => (
                      <i key={index} style={{ background: color }} />
                    ))}
                  </div>
                  <button type="button" className="th-card-apply" onClick={() => applyToDeck(theme)}>
                    应用
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="th-footnote">主题只管外观，不改变你的文字与结构。</p>
      </main>

      {selected && (
        <div
          className="th-drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}
        >
          <aside className="th-drawer" role="dialog" aria-modal="true" aria-label={`主题 ${selected.name}`}>
            <header>
              <div>
                <h2>{selected.name}</h2>
                <p>
                  {selected.tags.join(" · ") || "未分组"}
                  {selected.kind === "preset" ? " · 预设" : selected.kind === "custom" ? " · 自定义" : " · 迁移"}
                </p>
              </div>
              <button type="button" className="th-drawer-close" onClick={() => setSelectedId(null)} aria-label="关闭">×</button>
            </header>

            <div className="th-drawer-tabs" role="tablist" aria-label="预览版式">
              {(["cover", "cards", "chart"] as ThemePreviewVariant[]).map((variant) => (
                <button
                  key={variant}
                  role="tab"
                  aria-selected={tab === variant}
                  className={tab === variant ? "is-active" : ""}
                  onClick={() => setTab(variant)}
                >
                  {variant === "cover" ? "封面" : variant === "cards" ? "要点" : "图表"}
                </button>
              ))}
            </div>

            <div className="th-drawer-preview">
              <ThemePreview key={tab} theme={selected} variant={tab} />
            </div>

            <div className="th-tokens">
              <div>
                <span>字体</span>
                <strong>{selected.typography.headingFont} / {selected.typography.bodyFont}</strong>
              </div>
              <div>
                <span>圆角 · 密度</span>
                <strong>{selected.shape.radius}px · {selected.layout.density === "compact" ? "紧凑" : selected.layout.density === "airy" ? "宽松" : "默认"}</strong>
              </div>
              <div>
                <span>正文对比度</span>
                <strong>{contrastRatio(selected.palette.text, selected.palette.background).toFixed(1)}:1</strong>
              </div>
              <div>
                <span>强调色对比度</span>
                <strong>{contrastRatio(selected.palette.accent, selected.palette.background).toFixed(1)}:1</strong>
              </div>
            </div>

            <div className="th-drawer-actions">
              <button className="th-primary" onClick={() => applyToDeck(selected)}>
                应用到当前演示稿
              </button>
              <button className="th-ghost" onClick={() => { setDefault(selected.id); setNotice(`已把「${selected.name}」设为新建演示稿的默认主题。`); }}>
                设为默认
              </button>
              <button
                className="th-ghost"
                onClick={() => {
                  const copy = duplicateTheme(selected);
                  setDefault(copy.id);
                  setEditing(copy);
                  setEditorErrors([]);
                  setSelectedId(null);
                  setNotice(`已复制为「${copy.name}」，保存后即可使用。`);
                }}
              >
                复制为自定义
              </button>
              <button className="th-ghost" onClick={() => { editTheme(selected); setSelectedId(null); }}>
                编辑
              </button>
              {selected.kind === "custom" && (
                <button
                  className="th-ghost th-danger"
                  onClick={() => {
                    if (!confirm(`删除主题「${selected.name}」？已应用它的演示稿会回退到默认主题。`)) return;
                    removeCustom(selected.id);
                    setSelectedId(null);
                    setNotice(`已删除「${selected.name}」。`);
                  }}
                >
                  删除
                </button>
              )}
            </div>

            <p className="th-drawer-foot">
              {selected.kind === "preset"
                ? "预设主题只读；编辑会另存为自定义副本。"
                : "自定义主题保存在本机浏览器，换设备需要重新创建。"}
            </p>
          </aside>
        </div>
      )}

      {editing && (
        <div className="th-drawer-backdrop" role="presentation">
          <div className="th-editor" role="dialog" aria-modal="true" aria-label="编辑主题">
            <header>
              <div>
                <h2>{editing.kind === "custom" ? "编辑主题" : "新建主题"}</h2>
                <p>改的是外观，不会动演示稿里的任何文字。</p>
              </div>
              <button type="button" className="th-drawer-close" onClick={() => setEditing(null)} aria-label="关闭">×</button>
            </header>

            <div className="th-editor-body">
              <div className="th-editor-controls">
                <label className="th-field">
                  <span>名称</span>
                  <input
                    value={editing.name}
                    maxLength={40}
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  />
                </label>

                <fieldset className="th-field-group">
                  <legend>颜色</legend>
                  {PALETTE_FIELDS.map((field) => (
                    <label key={String(field.key)} className="th-color-row">
                      <input
                        type="color"
                        value={editing.palette[field.key]}
                        onChange={(event) =>
                          setEditing({ ...editing, palette: { ...editing.palette, [field.key]: event.target.value.toUpperCase() } })
                        }
                        aria-label={`${field.label}颜色`}
                      />
                      <span>{field.label}</span>
                      <input
                        className="th-hex"
                        value={editing.palette[field.key]}
                        maxLength={7}
                        onChange={(event) =>
                          setEditing({ ...editing, palette: { ...editing.palette, [field.key]: event.target.value.toUpperCase() } })
                        }
                        aria-label={`${field.label}色值`}
                      />
                    </label>
                  ))}
                </fieldset>

                <fieldset className="th-field-group">
                  <legend>字体</legend>
                  <label className="th-field">
                    <span>标题字体</span>
                    <select
                      value={editing.typography.headingFont}
                      onChange={(event) =>
                        setEditing({ ...editing, typography: { ...editing.typography, headingFont: event.target.value } })
                      }
                    >
                      {THEME_FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
                    </select>
                  </label>
                  <label className="th-field">
                    <span>正文字体</span>
                    <select
                      value={editing.typography.bodyFont}
                      onChange={(event) =>
                        setEditing({ ...editing, typography: { ...editing.typography, bodyFont: event.target.value } })
                      }
                    >
                      {THEME_FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
                    </select>
                  </label>
                </fieldset>

                <fieldset className="th-field-group">
                  <legend>图形</legend>
                  <label className="th-field">
                    <span>圆角 {editing.shape.radius}px</span>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      value={editing.shape.radius}
                      onChange={(event) =>
                        setEditing({ ...editing, shape: { ...editing.shape, radius: Number(event.target.value) } })
                      }
                    />
                  </label>
                  <div className="th-segmented" role="group" aria-label="信息密度">
                    {(["compact", "default", "airy"] as const).map((density) => (
                      <button
                        key={density}
                        type="button"
                        aria-pressed={editing.layout.density === density}
                        className={editing.layout.density === density ? "is-active" : ""}
                        onClick={() => setEditing({ ...editing, layout: { ...editing.layout, density } })}
                      >
                        {density === "compact" ? "紧凑" : density === "default" ? "默认" : "宽松"}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="th-editor-preview">
                <div className="th-editor-tabs" role="tablist" aria-label="预览版式">
                  {(["cover", "cards", "chart"] as ThemePreviewVariant[]).map((variant) => (
                    <button
                      key={variant}
                      role="tab"
                      aria-selected={tab === variant}
                      className={tab === variant ? "is-active" : ""}
                      onClick={() => setTab(variant)}
                    >
                      {variant === "cover" ? "封面" : variant === "cards" ? "要点" : "图表"}
                    </button>
                  ))}
                </div>
                <ThemePreview theme={editing} variant={tab} />
                {editorWarnings.length > 0 && (
                  <ul className="th-warnings" role="status">
                    {editorWarnings.map((warning) => (
                      <li key={warning.field + warning.message}>{warning.message}</li>
                    ))}
                  </ul>
                )}
                {editorErrors.length > 0 && (
                  <ul className="th-errors" role="alert">
                    {editorErrors.map((error) => <li key={error}>{error}</li>)}
                  </ul>
                )}
              </div>
            </div>

            <footer className="th-editor-foot">
              <span>{editorValid ? "保存后可在任何演示稿里切换。" : "还有未通过的字段，修正后才能保存。"}</span>
              <div>
                <button className="th-ghost" onClick={() => setEditing(null)}>取消</button>
                <button
                  className="th-ghost"
                  onClick={() => setEditing(duplicateTheme(editing))}
                  title="同一套主题保存另一个版本"
                >
                  另存为副本
                </button>
                <button className="th-primary" disabled={!editorValid} onClick={saveEditing}>保存</button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
