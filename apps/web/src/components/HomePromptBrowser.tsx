import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { HomeMode, HomeShortcut } from "./homeScenes";
import { modeLabels } from "./homeScenes";
import { categoriesForMode, chineseCharacterCount, readPromptUsage, recommendPrompts, recordPromptUse, type PromptCategory, type PromptGroup } from "./promptLibrary";
import "./home-prompts.css";

function CategoryMenu({ category, activeGroupId, onSelect, allCategories }: { category: PromptCategory; activeGroupId: string; onSelect(id: string): void; allCategories?: PromptCategory[] }) {
  const [browsing, setBrowsing] = useState<PromptCategory | null>(null);
  const current = browsing || category;
  const showingAll = !!allCategories && !browsing;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  function close(focus = false) { setOpen(false); setBrowsing(null); if (focus) trigger.current?.focus({ preventScroll: true }); }
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !menu.current) return;
      const anchor = trigger.current.getBoundingClientRect(), box = menu.current.getBoundingClientRect();
      const v = window.visualViewport, x = v?.offsetLeft || 0, y = v?.offsetTop || 0;
      const width = v?.width || window.innerWidth, height = v?.height || window.innerHeight;
      const below = anchor.bottom + 8;
      setPosition({ left: Math.max(x + 8, Math.min(anchor.left + (anchor.width - box.width) / 2, x + width - box.width - 8)), top: Math.max(y + 8, Math.min(below + box.height <= y + height - 8 ? below : anchor.top - box.height - 8, y + height - box.height - 8)) });
    };
    const outside = (event: Event) => { if (event.target instanceof Node && !trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(true); } };
    place();
    menu.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus({ preventScroll: true });
    const observer = new ResizeObserver(place); if (menu.current) observer.observe(menu.current);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    document.addEventListener("pointerdown", outside); document.addEventListener("focusin", outside); document.addEventListener("keydown", escape);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); window.visualViewport?.removeEventListener("resize", place); document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", escape); };
  }, [open, browsing]);
  return <>
    <button ref={trigger} className="home27-shortcut" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} data-active={category.groups.some(g => g.id === activeGroupId)} onClick={() => { setBrowsing(null); setOpen(v => !v); }} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }}>{category.title}</button>
    {open && createPortal(<div ref={menu} id={id} role="menu" aria-label={showingAll ? `${modeLabels[category.mode]}全部分类` : `${current.title}下级栏目`} className="home-category-menu" style={position} onKeyDown={event => {
      if (event.key === "ArrowLeft" && allCategories && browsing) { event.preventDefault(); setBrowsing(null); return; }
      const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") || []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : event.key === "ArrowUp" ? (index + buttons.length - 1) % buttons.length : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
    }}><p>{showingAll ? `${modeLabels[category.mode]} · ${allCategories!.length} 个分类` : current.title}</p>
      {allCategories && browsing && <button role="menuitem" onClick={() => setBrowsing(null)}>返回全部分类</button>}
      {showingAll ? allCategories!.map(c => <button key={c.id} role="menuitem" aria-haspopup="menu" aria-current={c.groups.some(g => g.id === activeGroupId) ? "true" : undefined} onClick={() => setBrowsing(c)}><span>{c.title}</span><small>{c.groups.reduce((sum, g) => sum + g.tasks.length, 0)} 个任务 ›</small></button>) : current.groups.map(g => <button key={g.id} role="menuitem" aria-current={g.id === activeGroupId ? "true" : undefined} onClick={() => { onSelect(g.id); close(true); }}><span>{g.title}</span><small>{g.tasks.length} 个场景</small></button>)}</div>, document.body)}
  </>;
}
export function HomeShortcuts({ mode, activeGroupId, onGroupSelect }: { mode: HomeMode; activeGroupId: string; onGroupSelect(id: string): void }) {
  const categories = categoriesForMode(mode);
  const all: PromptCategory = { id: `${mode}-all`, mode, title: "全部分类", groups: categories.slice(5).flatMap(c => c.groups) };
  return <section className="home27-shortcuts" aria-label={`${modeLabels[mode]}快捷任务场景`}>
    {categories.slice(0, 5).map(category => <CategoryMenu key={category.id} category={category} activeGroupId={activeGroupId} onSelect={onGroupSelect} />)}
    <CategoryMenu key={`${mode}-all`} category={all} allCategories={categories} activeGroupId={activeGroupId} onSelect={onGroupSelect} />
  </section>;
}

export function PromptRecommendations({ group, categoryTitle, prompt, onSelect }: { group: PromptGroup; categoryTitle: string; prompt: string; onSelect(scene: HomeShortcut): boolean }) {
  const [batch, setBatch] = useState(() => recommendPrompts(group.tasks, prompt, readPromptUsage()));
  const [seen, setSeen] = useState(() => batch.map(t => t.id));
  const [round, setRound] = useState(1);
  const [chosen, setChosen] = useState("");
  function rotate() {
    const next = recommendPrompts(group.tasks, prompt, readPromptUsage(), seen, batch.map(t => t.id));
    setBatch(next); setSeen([...new Set([...seen, ...next.map(t => t.id)])]); setRound(n => n + 1);
  }
  return <section className="home27-scenes home-prompt-recommendations" aria-labelledby="home27-scenes-title">
    <header className="home27-section-heading"><h2 id="home27-scenes-title">热门场景 <span className="prompt-breadcrumb">/ {categoryTitle} · {group.title}</span></h2><button className="prompt-refresh" onClick={rotate}>换一批 <span aria-hidden="true">↻</span></button></header>
    <div className="prompt-recommendation-context"><span title="在本机按当前输入的关键词、所选栏目和使用记录排序；换批时重新匹配，不调用云端 AI。">按输入与本机使用记录推荐</span><span>{group.tasks.length} 个场景</span></div>
    <ul className="home-prompt-list" aria-label="推荐场景">{batch.map((task, index) => <li key={task.id}><button aria-label={`使用提示词：${task.title}`} onClick={() => {
      if (onSelect({ title: task.title, mode: task.mode, icon: "document", prompt: task.prompt })) { recordPromptUse(task.id); setChosen(task.title); }
    }}><span className="prompt-row-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="prompt-row-content"><strong>{task.title}</strong><span>{task.description}</span></span><span className="prompt-row-end"><small>{chineseCharacterCount(task.prompt)} 字提示词</small><span aria-hidden="true">↗</span></span></button></li>)}</ul>
    <span className="prompt-sr-only" role="status">{categoryTitle}，{group.title}，第 {round} 批推荐，共 {batch.length} 条。{chosen && `已填入「${chosen}」的完整提示词，尚未发送。`}</span>
  </section>;
}
