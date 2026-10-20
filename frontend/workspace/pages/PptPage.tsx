import { useEffect, useMemo, useRef, useState } from "react";
import { navigateTo } from "../workspaceRoutes";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { HomeIcon } from "../../../apps/web/src/components/HomeIcon";
import { listProjects } from "../projectStore";
import {
  createPptProject,
  deletePptProject,
  getPptProject,
  listPptProjects,
  savePptProject,
  type PptProject,
} from "../pptStore";
import { buildSlidesWithFramework, getFramework, pickSingleFramework } from "../pptFrameworks";
import { buildDefaultSlides } from "../pptStore";
import type { Slide } from "../../../apps/web/src/components/scene-demos/Slides";
import { exportPptx } from "../../../apps/web/src/components/scene-demos/Slides";
import "./ppt-page.css";
import "../../../apps/web/src/components/scene-demos/workspace.css";
import { listWorkspaces } from "../api/workspaces";
import { fetchAccount } from "../api/account";

type Props = { pptId?: string };

function usePptListTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((n) => n + 1);
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  return tick;
}

export default function PptPage({ pptId }: Props) {
  const tick = usePptListTick();
  const pptProjects = useMemo(() => listPptProjects(), [tick, pptId]);
  const [project, setProject] = useState<PptProject | null>(() => (pptId ? getPptProject(pptId) ?? null : null));
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [playing, setPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [projectCount, setProjectCount] = useState(() => listProjects().length);
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [assetCount, setAssetCount] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const focusProjectRef = useRef<PptProject | null>(null);

  // 当通过 /ppt/:id 进入，加载对应项目；若无则尝试从 URL 参数创建
  useEffect(() => {
    if (!pptId) {
      // /ppt 根路径：若有最近项目直接展示，否则展示引导
      const latest = listPptProjects()[0];
      if (latest) {
        navigateTo(`/ppt/${encodeURIComponent(latest.id)}`);
      }
      return;
    }
    const found = getPptProject(pptId);
    if (found) {
      setProject(found);
      focusProjectRef.current = found;
      setPage(0);
      setMessage("");
    } else {
      // 可能是从首页带着 prompt 跳来，但还没创建
      const pending = sessionStorage.getItem(`designbuddy.ppt.pending.${pptId}`);
      if (pending) {
        try {
          const data = JSON.parse(pending) as { prompt: string; title?: string };
          const slides = buildDefaultSlides(data.prompt);
          const created = createPptProject(data.prompt, data.title, slides);
          // 如果 id 不匹配，用新 id 替换路由
          if (created.id !== pptId) {
            navigateTo(`/ppt/${encodeURIComponent(created.id)}`);
            return;
          }
          setProject(created);
          setPage(0);
          sessionStorage.removeItem(`designbuddy.ppt.pending.${pptId}`);
        } catch {
          setProject(null);
        }
      } else {
        setProject(null);
      }
    }
  }, [pptId]);

  // 同步计数
  useEffect(() => {
    void listWorkspaces()
      .then((ws) => setWorkspaceCount(ws.length))
      .catch(() => setWorkspaceCount(0));
    void fetchAccount()
      .then(() => setProjectCount(listProjects().length))
      .catch(() => {});
  }, [pptId, tick]);

  // 保存防抖
  useEffect(() => {
    if (!project) return;
    const timer = setTimeout(() => {
      try {
        savePptProject(project);
      } catch {
        // 忽略存储失败
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [project]);

  const go = (path: string) => navigateTo(path);

  const currentSlide = project?.slides[Math.min(page, (project?.slides.length || 1) - 1)];
  const index = Math.min(page, (project?.slides.length || 1) - 1);

  const updateSlide = (patch: Partial<Slide>) => {
    if (!project || !currentSlide) return;
    const nextSlides = project.slides.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setProject({ ...project, slides: nextSlides });
  };

  const move = (delta: number) => {
    if (!project) return;
    const next = index + delta;
    if (next < 0 || next >= project.slides.length) return;
    const list = [...project.slides];
    [list[index], list[next]] = [list[next], list[index]] as [Slide, Slide];
    setProject({ ...project, slides: list });
    setPage(next);
  };

  const addSlide = () => {
    if (!project || !currentSlide) return;
    if (project.slides.length >= 30) {
      setMessage("已达到 30 页上限，请先删减。");
      return;
    }
    const newSlide: Slide = {
      ...currentSlide,
      id: crypto.randomUUID(),
      title: "新的想法，从这里开始。",
      body: "用一句话说清要点\n补充关键数据或示例\n留下下一步行动",
      layout: "split",
      notes: "",
    };
    const list = [...project.slides.slice(0, index + 1), newSlide, ...project.slides.slice(index + 1)];
    setProject({ ...project, slides: list });
    setPage(index + 1);
  };

  const removeSlide = () => {
    if (!project) return;
    if (project.slides.length <= 1) {
      setMessage("至少保留一页。");
      return;
    }
    if (!confirm("删除当前页？")) return;
    const list = project.slides.filter((_, i) => i !== index);
    setProject({ ...project, slides: list });
    setPage(Math.max(0, index - 1));
  };

  const handleExport = async () => {
    if (!project) return;
    setBusy(true);
    try {
      await exportPptx(project.slides, `${project.title || "presentation"}.pptx`);
      setMessage("PPTX 已导出，文字、表格和备注都可继续编辑。");
    } catch (e) {
      setMessage(`导出失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleAiFill = async () => {
    if (!project) return;
    setAiBusy(true);
    setMessage("正在调用 AI 优化逐页内容…");
    try {
      const { apiFetch } = await import("../../../apps/web/src/api/client");
      // 复用后端 AI 接口，用结构化 prompt 生成逐页要点
      const prompt = `你是 PPT 助手。请把用户主题「${project.prompt}」扩展为 7 页演示文稿，按 cover/cards/split/chart/timeline/table/cover 结构，每页给 title(≤20字) 和 body(3行内，用“｜”分隔表格/图表数据)。只返回 JSON 数组，例如 [{"title":"…","body":"…","layout":"cards"}]，不要解释。`;
      const response = await apiFetch("/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, userId: "ppt-editor" }),
      });
      const data = (await response.json()) as { content?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "AI 服务未就绪");
      const text = data.content || "";
      // 尝试解析 JSON 数组
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("AI 返回不是可用 JSON，已保留原稿。");
      const parsed = JSON.parse(match[0]) as Array<{ title?: string; body?: string; layout?: string }>;
      if (!Array.isArray(parsed) || !parsed.length) throw new Error("AI 内容为空。");
      const nextSlides = project.slides.map((s, i) => {
        const ai = parsed[i];
        if (!ai) return s;
        return {
          ...s,
          title: typeof ai.title === "string" && ai.title.trim() ? ai.title.trim().slice(0, 36) : s.title,
          body: typeof ai.body === "string" && ai.body.trim() ? ai.body.trim().slice(0, 800) : s.body,
          layout: typeof ai.layout === "string" && ["cover", "split", "cards", "table", "timeline", "chart"].includes(ai.layout) ? ai.layout : s.layout,
        };
      });
      setProject({ ...project, slides: nextSlides });
      setMessage("AI 已按你的主题重写逐页要点，可继续手动微调。");
    } catch (e) {
      setMessage((e as Error).message || "AI 填充失败，已保留本地草稿。");
    } finally {
      setAiBusy(false);
    }
  };

  const handleCreateFromPrompt = () => {
    const prompt = window.prompt("输入 PPT 主题，例如：Q4 季度汇报 · 运营总结", "");
    if (!prompt?.trim()) return;
    const outlineId = crypto.randomUUID();
    sessionStorage.setItem(`designbuddy.ppt.outline.${outlineId}`, JSON.stringify({ prompt: prompt.trim(), createdAt: Date.now() }));
    navigateTo(`/ppt/outline/${encodeURIComponent(outlineId)}`);
  };

  const handleShuffleFramework = () => {
    if (!project) return;
    const exclude = project.frameworkId ? [project.frameworkId] : [];
    const fw = pickSingleFramework(project.prompt, exclude);
    if (!fw) return;
    if (!confirm(`当前为「${project.frameworkName || "经典"}」框架，是否切换到「${fw.name}」？内容将按新框架重排，当前文字会被替换。`)) return;
    const newSlides = buildSlidesWithFramework(project.prompt, fw.id);
    setProject({ ...project, slides: newSlides, frameworkId: fw.id, frameworkName: fw.name });
    setPage(0);
    setMessage(`已切换到「${fw.name}」框架 · ${fw.narrative}`);
  };

  // 列表页：/ppt 无 id
  if (!pptId) {
    return (
      <div className="workbuddy-app">
        <WorkBuddySidebar active="home" projectCount={projectCount} workspaceCount={workspaceCount} assetCount={assetCount} go={go} setNotice={setMessage} />
        <main className="ppt-page ppt-list">
          <header className="ppt-header">
            <div>
              <h1>演示文稿</h1>
              <p>首页输入“PPT制作”直接来到这里，每份演示稿都可逐页编辑并导出可编辑 PPTX。</p>
            </div>
            <button className="ppt-primary" onClick={handleCreateFromPrompt}>新建演示文稿 +</button>
          </header>
          {message && <p className="ppt-notice" role="status">{message}</p>}
          <section className="ppt-list-grid">
            {pptProjects.length === 0 ? (
              <div className="ppt-empty">
                <h3>还没有演示文稿</h3>
                <p>回到首页，在输入框输入“PPT制作 团队季度总结”，发送后会自动生成 7 页初稿并来到编辑器。</p>
                <button className="ppt-primary" onClick={() => navigateTo("/")}>去首页创建</button>
              </div>
            ) : (
              pptProjects.map((p) => (
                <article key={p.id} onClick={() => navigateTo(`/ppt/${encodeURIComponent(p.id)}`)}>
                  <h3>{p.title}</h3>
                  <p>{p.prompt.slice(0, 80)}</p>
                  <small>{p.slides.length} 页 · {new Date(p.updatedAt).toLocaleString()}</small>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!confirm(`删除「${p.title}」？`)) return;
                      deletePptProject(p.id);
                      setMessage("已删除。");
                      // 强制刷新
                      window.dispatchEvent(new Event("storage"));
                    }}
                  >
                    删除
                  </button>
                </article>
              ))
            )}
          </section>
        </main>
      </div>
    );
  }

  // 详情不存在：引导重建
  if (!project) {
    return (
      <div className="workbuddy-app">
        <WorkBuddySidebar active="home" projectCount={projectCount} workspaceCount={workspaceCount} assetCount={assetCount} go={go} setNotice={setMessage} />
        <main className="ppt-page ppt-list">
          <header className="ppt-header">
            <h1>找不到这个演示文稿</h1>
            <button className="ppt-ghost" onClick={() => navigateTo("/ppt")}>返回列表</button>
          </header>
          <div className="ppt-empty">
            <p>可能是已删除或在别的浏览器创建。重新输入主题即可生成新的 PPT。</p>
            <button className="ppt-primary" onClick={handleCreateFromPrompt}>新建演示文稿</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="workbuddy-app">
      <WorkBuddySidebar active="home" projectCount={projectCount} workspaceCount={workspaceCount} assetCount={assetCount} go={go} setNotice={setMessage} />
      <main className={`ppt-page ${playing ? "is-playing" : ""}`} onKeyDown={(e) => {
        if (!playing) return;
        if (e.key === "ArrowRight") setPage(Math.min(index + 1, project.slides.length - 1));
        if (e.key === "ArrowLeft") setPage(Math.max(0, index - 1));
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setPlaying(false); }
      }}>
        <header className="ppt-toolbar">
          <div className="ppt-toolbar-left">
            <button className="ppt-ghost" onClick={() => navigateTo("/ppt")} aria-label="返回列表">← 列表</button>
            <input
              className="ppt-title-input"
              value={project.title}
              onChange={(e) => setProject({ ...project, title: e.target.value.slice(0, 48) })}
              placeholder="演示文稿标题"
              aria-label="演示文稿标题"
            />
            <span className="ppt-meta">{index + 1} / {project.slides.length} 页</span>
          </div>
          <div className="ppt-toolbar-right">
            {project.frameworkName && (
              <span className="ppt-framework-badge" title={getFramework(project.frameworkId || "")?.narrative || ""}>
                {project.frameworkName} · {project.slides.length}页
              </span>
            )}
            <button className="ppt-ghost" onClick={handleShuffleFramework} title="从10套框架池里随机换一套，骨架不同">换个框架 🔀</button>
            <button className="ppt-ghost" onClick={handleAiFill} disabled={aiBusy}>{aiBusy ? "AI 思考中…" : "AI 智能填充 ✨"}</button>
            <button className="ppt-ghost" onClick={() => setPlaying(!playing)}>{playing ? "退出播放" : "全屏播放"}</button>
            <button className="ppt-primary" disabled={busy} onClick={handleExport}>{busy ? "正在生成…" : "导出 PPTX ↓"}</button>
          </div>
        </header>

        {message && <p className="ppt-notice" role="status">{message}</p>}

        <div className="ppt-workspace ws-deck">
          <aside className="ppt-thumbs">
            {project.slides.map((slide, i) => (
              <button
                key={slide.id}
                aria-label={`第${i + 1}页 ${slide.title}`}
                aria-current={index === i ? "page" : undefined}
                className={index === i ? "is-active" : ""}
                onClick={() => setPage(i)}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <strong>{slide.title}</strong>
                <small>{slide.eyebrow}</small>
              </button>
            ))}
            <button className="ppt-add-page" disabled={project.slides.length >= 30} onClick={addSlide}>＋ 新增页面</button>
            <div className="ppt-thumbs-foot">
              <button className="ppt-ghost small" onClick={() => navigateTo("/")}>去首页</button>
              <button className="ppt-ghost small" onClick={() => navigateTo("/ppt")}>全部文稿</button>
            </div>
          </aside>

          <section className="ppt-stage">
            {currentSlide && (
              <div className={`ws-slide ws-slide-${currentSlide.layout}`}>
                {(currentSlide.layout === "cover" || currentSlide.layout === "split") && currentSlide.image && (
                  <img src={currentSlide.image} alt="当前页图片" style={{ objectPosition: `${currentSlide.focus}% center` }} />
                )}
                <div className="ws-slide-content">
                  <small>{currentSlide.eyebrow}</small>
                  <textarea
                    aria-label="幻灯片标题"
                    className="ws-slide-title"
                    rows={2}
                    value={currentSlide.title}
                    maxLength={80}
                    onChange={(e) => updateSlide({ title: e.target.value })}
                  />
                  {currentSlide.layout === "chart" ? (
                    <div className="ws-deck-bars">
                      {currentSlide.body.split("\n").map((line, i) => {
                        const [label, value] = line.split("｜");
                        const amount = Number(value) || 0;
                        const max = Math.max(1, ...currentSlide.body.split("\n").map((l) => Number(l.split("｜")[1]) || 0));
                        return (
                          <article key={i}>
                            <span>{label}</span>
                            <i style={{ height: `${Math.max(0, amount / max) * 100}%` }} />
                            <strong>{amount}</strong>
                          </article>
                        );
                      })}
                    </div>
                  ) : currentSlide.layout === "cards" || currentSlide.layout === "timeline" ? (
                    <div className="ws-slide-cards">
                      {currentSlide.body.split("\n").map((line, i) => (
                        <article key={i}>
                          <b>{String(i + 1).padStart(2, "0")}</b>
                          <p>{line.replaceAll("｜", "\n")}</p>
                        </article>
                      ))}
                    </div>
                  ) : currentSlide.layout === "table" ? (
                    <table aria-label="幻灯片表格">
                      <tbody>
                        {currentSlide.body.split("\n").map((line, i) => (
                          <tr key={i}>
                            {line.split("｜").map((v, j) => (
                              <td key={j}>{v}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ whiteSpace: "pre-wrap" }}>{currentSlide.body}</p>
                  )}
                  <footer>AURA ONE / CONCEPT PROPOSAL <span>{String(index + 1).padStart(2, "0")}</span></footer>
                </div>
              </div>
            )}

            {playing ? (
              <div className="ws-play-controls">
                <button disabled={!index} onClick={() => setPage(index - 1)}>← 上一页</button>
                <span>方向键翻页，Esc 退出</span>
                <button disabled={index === project.slides.length - 1} onClick={() => setPage(index + 1)}>下一页 →</button>
              </div>
            ) : (
              <div className="ppt-inspector">
                <div className="ppt-actions">
                  <label>
                    版式
                    <select aria-label="幻灯片版式" value={currentSlide!.layout} onChange={(e) => updateSlide({ layout: e.target.value })}>
                      {[
                        ["cover", "摄影封面"],
                        ["split", "图文分栏"],
                        ["cards", "观点卡片"],
                        ["table", "对比表格"],
                        ["timeline", "时间线"],
                        ["chart", "数据柱图"],
                      ].map(([v, t]) => (
                        <option key={v} value={v}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ws-upload">
                    更换图片
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        try {
                          const { uploadImage } = await import("../../../apps/web/src/components/scene-demos/files");
                          const dataUrl = await uploadImage(file);
                          updateSlide({ image: dataUrl });
                          setMessage("图片已替换，拖动焦点可调整裁切。");
                        } catch (err) {
                          setMessage((err as Error).message);
                        }
                      }}
                    />
                  </label>
                  <label>
                    图片焦点
                    <input aria-label="图片焦点" type="range" min={0} max={100} value={currentSlide!.focus} onChange={(e) => updateSlide({ focus: Number(e.target.value) })} />
                  </label>
                  <button disabled={!index} onClick={() => move(-1)}>前移</button>
                  <button disabled={index === project.slides.length - 1} onClick={() => move(1)}>后移</button>
                  <button disabled={project.slides.length <= 1} onClick={removeSlide}>删除页面</button>
                </div>
                <div className="ppt-two-cols">
                  <label>
                    正文 / 每行一个内容块；表格用「｜」分列；柱图用「标签｜数值」
                    <textarea aria-label="幻灯片正文" rows={4} value={currentSlide!.body} maxLength={3000} onChange={(e) => updateSlide({ body: e.target.value })} />
                  </label>
                  <label>
                    演讲者备注
                    <textarea aria-label="演讲者备注" rows={4} value={currentSlide!.notes} maxLength={3000} onChange={(e) => updateSlide({ notes: e.target.value })} />
                  </label>
                </div>
                <div className="ppt-prompt-preview">
                  <small>原始需求：</small>
                  <p>{project.prompt}</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
