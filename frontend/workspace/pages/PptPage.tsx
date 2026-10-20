import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { navigateTo } from "../workspaceRoutes";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { HomeIcon } from "../../../apps/web/src/components/HomeIcon";
import { listProjects } from "../projectStore";
import {
  createPptProject,
  deletePptProject,
  getPptProject,
  listPptProjects,
  listPptVersions,
  restorePptVersion,
  savePptProject,
  encodePptShare,
  updatePptProjectWorkspace,
  type PptProject,
  type PptSlide,
} from "../pptStore";
import { buildSlidesWithFramework, getFramework, pickSingleFramework } from "../pptFrameworks";
import { buildDefaultSlides } from "../pptStore";
import type { Slide } from "../../../apps/web/src/components/scene-demos/Slides";
import { exportPptx } from "../../../apps/web/src/components/scene-demos/Slides";
import "./ppt-page.css";
import "../../../apps/web/src/components/scene-demos/workspace.css";
import { listWorkspaces, type Workspace } from "../api/workspaces";
import { fetchAccount } from "../api/account";
import { listAssets, uploadAsset, fetchAssetRaw, assetToDataUrl, type Asset } from "../api/assets";
import { subscribeToProject, publishProjectEvent, type CollaborationEvent } from "../api/collaboration";

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

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((c) => c.trim()).filter((c) => c.length > 0))
    .filter((row) => row.length > 0);
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
  const [activeTab, setActiveTab] = useState<"content" | "data" | "assets" | "sources">("content");
  const [projectCount, setProjectCount] = useState(() => listProjects().length);
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [assetCount, setAssetCount] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const focusProjectRef = useRef<PptProject | null>(null);

  // Batch2: data/assets/sources local state
  const [csvText, setCsvText] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetThumbs, setAssetThumbs] = useState<Record<string, string>>({});
  const [assetLoading, setAssetLoading] = useState(false);
  const [newSourceLabel, setNewSourceLabel] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [commentText, setCommentText] = useState("");

  // Collaboration state
  const [presenceUsers, setPresenceUsers] = useState<string[]>([]);
  const [comments, setComments] = useState<Array<{ id: string; userId: string; text: string; slideId?: string; at: number }>>([]);

  // Versions
  const [versions, setVersions] = useState<ReturnType<typeof listPptVersions>>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  // 当通过 /ppt/:id 进入，加载对应项目；若无则尝试从 URL 参数创建
  useEffect(() => {
    if (!pptId) {
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
      const pending = sessionStorage.getItem(`designbuddy.ppt.pending.${pptId}`);
      if (pending) {
        try {
          const data = JSON.parse(pending) as { prompt: string; title?: string };
          const slides = buildDefaultSlides(data.prompt);
          const created = createPptProject(data.prompt, data.title, slides);
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

  // 同步计数 + workspaces
  useEffect(() => {
    void listWorkspaces()
      .then((ws) => {
        setWorkspaceCount(ws.length);
        setWorkspaces(ws);
      })
      .catch(() => setWorkspaceCount(0));
    void fetchAccount()
      .then(() => setProjectCount(listProjects().length))
      .catch(() => {});
  }, [pptId, tick]);

  // 版本列表
  useEffect(() => {
    if (!project) return;
    setVersions(listPptVersions(project.id));
  }, [project?.id, tick, message]);

  // 素材库加载（进入 assets 标签时或项目变化时）
  const refreshAssets = useCallback(async () => {
    setAssetLoading(true);
    try {
      const list = await listAssets();
      setAssets(list);
      setAssetCount(list.length);
      // 为图片素材拉取缩略
      const imageAssets = list.filter((a) => a.mime.startsWith("image/")).slice(0, 12);
      const thumbs: Record<string, string> = {};
      await Promise.all(
        imageAssets.map(async (a) => {
          try {
            const raw = await fetchAssetRaw(a.id);
            thumbs[a.id] = assetToDataUrl(raw.mime, raw.dataBase64);
          } catch {
            /* ignore */
          }
        }),
      );
      setAssetThumbs((prev) => ({ ...prev, ...thumbs }));
    } catch {
      // 离线或未登录时忽略
    } finally {
      setAssetLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "assets") void refreshAssets();
  }, [activeTab, refreshAssets]);

  // 协作订阅（Batch3）
  useEffect(() => {
    if (!project?.id) return;
    // 只有在项目有云端 id 时才尝试协作；本地离线演示仍静默失败
    let cleanup: (() => void) | undefined;
    try {
      cleanup = subscribeToProject(
        project.id,
        (event) => {
          if ((event as { type: string }).type === "presence.snapshot") {
            const snap = event as { type: "presence.snapshot"; users: CollaborationEvent[] };
            setPresenceUsers(snap.users.map((u) => u.userId));
            return;
          }
          const ev = event as CollaborationEvent;
          if (ev.type === "presence") {
            // presence 心跳由服务端聚合为 snapshot，这里可忽略单条
            return;
          }
          if (ev.type === "comment") {
            const payload = ev.payload as { text?: string; slideId?: string };
            const txt = payload?.text;
            if (typeof txt === "string" && txt.trim()) {
              setComments((prev) => [
                ...prev,
                { id: ev.id, userId: ev.userId, text: txt.trim().slice(0, 500), slideId: payload.slideId, at: Date.now() },
              ]);
            }
          }
        },
        () => {
          // 静默：未登录或无云端项目时 EventSource 会失败
        },
      );
    } catch {
      // ignore
    }
    return () => cleanup?.();
  }, [project?.id]);

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

  const currentSlide = project?.slides[Math.min(page, (project?.slides.length || 1) - 1)] as PptSlide | undefined;
  const index = Math.min(page, (project?.slides.length || 1) - 1);

  const updateSlide = (patch: Partial<PptSlide>) => {
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
      ...(currentSlide as Slide),
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
      // 导出时把“来源”写入备注，PPTX 备注区可溯源
      const exportSlides = project.slides.map((s) => {
        const ps = s as PptSlide;
        if (!ps.sources?.length) return s as Slide;
        const cites = ps.sources.map((src) => `${src.label}: ${src.url}`).join("\n");
        const notesWithCite = [ps.notes?.trim(), `引用来源：\n${cites}`].filter(Boolean).join("\n\n").slice(0, 3000);
        return { ...s, notes: notesWithCite } as Slide;
      });
      await exportPptx(exportSlides as Slide[], `${project.title || "presentation"}.pptx`);
      setMessage("PPTX 已导出，文字、表格和备注都可继续编辑（来源已写入备注）。");
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
      const prompt = `你是 PPT 助手。请把用户主题「${project.prompt}」扩展为 7 页演示文稿，按 cover/cards/split/chart/timeline/table/cover 结构，每页给 title(≤20字) 和 body(3行内，用“｜”分隔表格/图表数据)。只返回 JSON 数组，例如 [{\"title\":\"…\",\"body\":\"…\",\"layout\":\"cards\"}]，不要解释。`;
      const response = await apiFetch("/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, userId: "ppt-editor" }),
      });
      const data = (await response.json()) as { content?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "AI 服务未就绪");
      const text = data.content || "";
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

  const handleAiRewriteSingle = async () => {
    if (!project || !currentSlide) return;
    setAiBusy(true);
    setMessage(`正在用 AI 重写第 ${index + 1} 页…`);
    try {
      const { apiFetch } = await import("../../../apps/web/src/api/client");
      const prompt = `你是 PPT 单页改写助手。主题「${project.prompt}」，当前页标题「${currentSlide.title}」眉题「${currentSlide.eyebrow}」版式「${currentSlide.layout}」正文「${currentSlide.body.slice(0, 400)}」。请只优化本页，给 title(≤20字) 和 body(3行内，用“｜”分隔表格/图表)。只返回 JSON 如 {"title":"…","body":"…"}。`;
      const response = await apiFetch("/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, userId: "ppt-single" }) });
      const data = (await response.json()) as { content?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "AI 服务未就绪");
      const text = data.content || "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI 未返回 JSON，已保留原稿。");
      const parsed = JSON.parse(match[0]) as { title?: string; body?: string };
      updateSlide({
        title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim().slice(0, 36) : currentSlide.title,
        body: typeof parsed.body === "string" && parsed.body.trim() ? parsed.body.trim().slice(0, 800) : currentSlide.body,
      });
      setMessage("已用 AI 重写当前页，可继续微调。");
    } catch (e) {
      setMessage((e as Error).message || "AI 单页重写失败。");
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

  // ---- Data tab helpers ----
  const handleCsvImport = (text: string) => {
    if (!currentSlide) return;
    const rows = parseCsv(text);
    if (!rows.length) {
      setMessage("CSV 为空，请粘贴至少一行数据。");
      return;
    }
    if (currentSlide.layout === "chart") {
      // 期望 label,value
      const mapped = rows
        .map((r) => {
          const label = r[0] || "";
          const val = r[1] || r[r.length - 1] || "0";
          const num = Number(String(val).replace(/[^0-9.-]/g, "")) || 0;
          return `${label}｜${num}`;
        })
        .join("\n");
      updateSlide({ body: mapped, dataAssetId: currentSlide.dataAssetId });
      setMessage(`已从 CSV 导入 ${rows.length} 组柱图数据。`);
    } else if (currentSlide.layout === "table") {
      const mapped = rows.map((r) => r.join("｜")).join("\n");
      updateSlide({ body: mapped });
      setMessage(`已从 CSV 导入 ${rows.length} 行表格。`);
    } else {
      setMessage("当前版式不支持 CSV 直连，请先切换到「数据柱图」或「对比表格」。");
    }
  };

  const handleCsvFile = async (file: File) => {
    const text = await file.text();
    setCsvText(text.slice(0, 8000));
    handleCsvImport(text);
  };

  // ---- Assets tab helpers ----
  const handleAssetUpload = async (file: File) => {
    if (!currentSlide) return;
    try {
      // 本地压缩预览
      const { uploadImage } = await import("../../../apps/web/src/components/scene-demos/files");
      const dataUrl = await uploadImage(file);
      updateSlide({ image: dataUrl });
      setMessage("图片已替换，拖动焦点可调整裁切。");
      // 同时上传到服务端素材库
      try {
        const asset = await uploadAsset(file, "private");
        updateSlide({ image: dataUrl, dataAssetId: asset.id } as Partial<PptSlide>);
        setMessage(`图片已替换并上传到素材库「${asset.name}」。`);
        void refreshAssets();
      } catch {
        // 服务端未登录时仅本地生效
      }
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const applyAssetImage = async (asset: Asset) => {
    if (!currentSlide) return;
    try {
      const raw = await fetchAssetRaw(asset.id);
      const dataUrl = assetToDataUrl(raw.mime, raw.dataBase64);
      updateSlide({ image: dataUrl, dataAssetId: asset.id } as Partial<PptSlide>);
      setMessage(`已应用素材「${asset.name}」到当前页。`);
    } catch (e) {
      setMessage(`素材读取失败：${(e as Error).message}`);
    }
  };

  // ---- Sources tab helpers ----
  const addSource = () => {
    if (!currentSlide) return;
    const label = newSourceLabel.trim().slice(0, 80);
    const url = newSourceUrl.trim().slice(0, 500);
    if (!label || !url) {
      setMessage("请填写来源名称和链接。");
      return;
    }
    try {
      new URL(url);
    } catch {
      setMessage("链接格式不正确，需以 https:// 开头。");
      return;
    }
    const next = [...((currentSlide as PptSlide).sources || []), { label, url }];
    updateSlide({ sources: next } as Partial<PptSlide>);
    setNewSourceLabel("");
    setNewSourceUrl("");
    setMessage("已添加引用来源。");
  };

  const removeSource = (idx: number) => {
    if (!currentSlide) return;
    const next = ((currentSlide as PptSlide).sources || []).filter((_, i) => i !== idx);
    updateSlide({ sources: next } as Partial<PptSlide>);
  };

  const handleShare = async () => {
    if (!project) return;
    const url = encodePptShare(project);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("分享链接已复制：打开链接可预览只读版本。");
    } catch {
      setMessage(`分享链接：${url}`);
    }
  };

  const handleRestoreVersion = (versionId: string) => {
    if (!project) return;
    if (!confirm("恢复到该版本？当前未保存的修改将被覆盖。")) return;
    const restored = restorePptVersion(project.id, versionId);
    if (restored) {
      setProject(restored);
      setPage(0);
      setMessage("已恢复到历史版本。");
      setVersions(listPptVersions(project.id));
    } else {
      setMessage("恢复失败，版本不存在。");
    }
  };

  const handleWorkspaceChange = (workspaceId: string) => {
    if (!project) return;
    const ws = workspaces.find((w) => w.id === workspaceId);
    const next = updatePptProjectWorkspace(project.id, ws ? { id: ws.id, name: ws.name } : null);
    if (next) setProject(next);
    setMessage(ws ? `已移动到工作空间「${ws.name}」` : "已移出工作空间");
  };

  const handleSendComment = async () => {
    if (!project || !commentText.trim()) return;
    const text = commentText.trim().slice(0, 500);
    setCommentText("");
    // 本地先显示
    setComments((prev) => [...prev, { id: `local-${Date.now()}`, userId: "我", text, slideId: currentSlide?.id, at: Date.now() }]);
    try {
      await publishProjectEvent(project.id, "comment", { text, slideId: currentSlide?.id });
    } catch {
      // 离线时仅本地
    }
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
                  <small>{p.slides.length} 页 · {new Date(p.updatedAt).toLocaleString()} {p.workspaceName ? `· ${p.workspaceName}` : ""}</small>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!confirm(`删除「${p.title}」？`)) return;
                      deletePptProject(p.id);
                      setMessage("已删除。");
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
            {project.workspaceName && <span className="ppt-ws-badge" title={project.workspaceId || ""}>📁 {project.workspaceName}</span>}
            {presenceUsers.length > 0 && <span className="ppt-presence" title={presenceUsers.join(", ")}>● {presenceUsers.length} 人协作中</span>}
          </div>
          <div className="ppt-toolbar-right">
            {project.frameworkName && (
              <span className="ppt-framework-badge" title={getFramework(project.frameworkId || "")?.narrative || ""}>
                {project.frameworkName} · {project.slides.length}页
              </span>
            )}
            <select
              aria-label="移动到工作空间"
              value={project.workspaceId || ""}
              onChange={(e) => handleWorkspaceChange(e.target.value)}
              className="ppt-ghost"
              style={{ maxWidth: 140 }}
            >
              <option value="">无工作空间</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <button className="ppt-ghost" onClick={handleShuffleFramework} title="从10套框架池里随机换一套，骨架不同">换个框架 🔀</button>
            <button className="ppt-ghost" onClick={handleShare} title="复制只读分享链接">分享 🔗</button>
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
                {(slide as PptSlide).sources?.length ? <em style={{ fontSize: 10, color: "#0ea5e9" }}>🔗 {(slide as PptSlide).sources!.length} 引用</em> : null}
              </button>
            ))}
            <button className="ppt-add-page" disabled={project.slides.length >= 30} onClick={addSlide}>＋ 新增页面</button>
            <div className="ppt-thumbs-foot">
              <button className="ppt-ghost small" onClick={() => navigateTo("/")}>去首页</button>
              <button className="ppt-ghost small" onClick={() => navigateTo("/ppt")}>全部文稿</button>
              {versions.length > 0 && (
                <div className="ppt-versions">
                  <small>历史版本（{versions.length}）</small>
                  {versions.slice(0, 5).map((v) => (
                    <button key={v.id} className="ppt-ghost small" onClick={() => handleRestoreVersion(v.id)} title={new Date(v.createdAt).toLocaleString()}>
                      ↺ {new Date(v.createdAt).toLocaleTimeString()} · {v.slides.length}页
                    </button>
                  ))}
                </div>
              )}
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
                  {(currentSlide as PptSlide).sources?.length ? (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                      引用：{(currentSlide as PptSlide).sources!.map((s) => s.label).join(" · ")}
                    </div>
                  ) : null}
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
                <div className="ppt-tabs" role="tablist">
                  {(["content", "data", "assets", "sources"] as const).map((tab) => (
                    <button
                      key={tab}
                      role="tab"
                      aria-selected={activeTab === tab}
                      className={activeTab === tab ? "is-active" : ""}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab === "content" ? "内容" : tab === "data" ? "数据" : tab === "assets" ? "素材" : "来源"}
                    </button>
                  ))}
                  <div className="ppt-tab-actions">
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
                    <label>
                      图片焦点
                      <input aria-label="图片焦点" type="range" min={0} max={100} value={currentSlide!.focus} onChange={(e) => updateSlide({ focus: Number(e.target.value) })} />
                    </label>
                    <button disabled={!index} onClick={() => move(-1)}>前移</button>
                    <button disabled={index === project.slides.length - 1} onClick={() => move(1)}>后移</button>
                    <button disabled={project.slides.length <= 1} onClick={removeSlide}>删除页面</button>
                  </div>
                </div>

                {activeTab === "content" && (
                  <>
                    <div style={{ display: "flex", gap: 8, marginBottom: 4, flexWrap: "wrap", alignItems: "center" }}>
                      <button className="ppt-ghost" onClick={() => void handleAiRewriteSingle()} disabled={aiBusy} title="仅重写当前页标题与正文，保留版式">
                        {aiBusy ? "AI 思考中…" : `AI 重写本页 ✨（第 ${index + 1} 页）`}
                      </button>
                      <small style={{ color: "#64748b" }}>保留当前版式/图片，只优化文字；需配置 AI 服务</small>
                    </div>
                    <div className="ppt-two-cols">
                      <label>
                        正文 / 每行一个内容块；表格用「｜」分列；柱图用「标签｜数值」
                        <textarea aria-label="幻灯片正文" rows={5} value={currentSlide!.body} maxLength={3000} onChange={(e) => updateSlide({ body: e.target.value })} />
                      </label>
                      <label>
                        演讲者备注
                        <textarea aria-label="演讲者备注" rows={5} value={currentSlide!.notes} maxLength={3000} onChange={(e) => updateSlide({ notes: e.target.value })} />
                      </label>
                    </div>
                    <div className="ppt-two-cols">
                      <label>
                        顶部眉题 / 徽标文字
                        <input value={currentSlide!.eyebrow} maxLength={40} onChange={(e) => updateSlide({ eyebrow: e.target.value })} placeholder="AURA ONE · MINIMAL" />
                      </label>
                      <label>
                        数据指标（cover/split 页右上角数字，可选）
                        <input value={(currentSlide as PptSlide).metric || ""} maxLength={20} onChange={(e) => updateSlide({ metric: e.target.value } as Partial<PptSlide>)} placeholder="例如 42% 或 12,000" />
                      </label>
                    </div>
                    {(currentSlide as PptSlide).metric && <p style={{ fontSize: 12, color: "#64748b" }}>提示：指标会在封面/分栏版式中突出显示（hint：{(currentSlide as PptSlide).hint || "—"}）</p>}
                    <label style={{ marginTop: 8, display: "block" }}>
                      提示 / 副标题
                      <input value={(currentSlide as PptSlide).hint || ""} maxLength={80} onChange={(e) => updateSlide({ hint: e.target.value } as Partial<PptSlide>)} placeholder="一句话补充说明" />
                    </label>
                    <div className="ppt-prompt-preview">
                      <small>原始需求：</small>
                      <p>{project.prompt}</p>
                    </div>
                  </>
                )}

                {activeTab === "data" && (
                  <div className="ppt-data-panel">
                    <p style={{ fontSize: 13, color: "#475569" }}>
                      粘贴 CSV（逗号分隔）一键生成图表/表格。正文区当前为 <b>{currentSlide!.layout}</b> 版式。
                      {(currentSlide!.layout === "chart" || currentSlide!.layout === "table") ? " 支持导入。" : " 请先切换到 数据柱图 或 对比表格 再导入。"}
                    </p>
                    <div className="ppt-two-cols">
                      <label>
                        CSV 文本（示例：Q1,120↵ Q2,200）
                        <textarea aria-label="CSV 文本" rows={6} value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder={"标签,数值\nQ1,120\nQ2,200\nQ3,180"} />
                      </label>
                      <div>
                        <label>
                          当前 body 预览（保存格式：标签｜数值 / 表格用｜分列）
                          <textarea aria-label="Chart body" rows={6} value={currentSlide!.body} onChange={(e) => updateSlide({ body: e.target.value })} />
                        </label>
                        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                          <button className="ppt-ghost" onClick={() => handleCsvImport(csvText)} disabled={!csvText.trim()}>从 CSV 应用到当前页</button>
                          <label className="ppt-ghost" style={{ cursor: "pointer" }}>
                            上传 CSV 文件
                            <input ref={csvInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void handleCsvFile(f); }} />
                          </label>
                          {currentSlide!.layout === "chart" && (currentSlide as PptSlide).dataAssetId && <span style={{ fontSize: 12, color: "#64748b" }}>已关联素材：{(currentSlide as PptSlide).dataAssetId}</span>}
                        </div>
                        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                          <button className="ppt-ghost small" onClick={() => { const rows = parseCsv(csvText); if (!rows.length) return; const sample = rows[0]?.join("｜"); setMessage(`解析到 ${rows.length} 行，首行示例：${sample}`); }}>解析预览</button>
                          <button className="ppt-ghost small" onClick={() => setCsvText("")}>清空</button>
                        </div>
                      </div>
                    </div>
                    {currentSlide!.layout === "chart" && (
                      <div style={{ marginTop: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
                        <small style={{ color: "#64748b" }}>柱图预览（按最大归一化）</small>
                        <div className="ws-deck-bars" style={{ marginTop: 8 }}>
                          {currentSlide!.body.split("\n").filter(Boolean).map((line, i) => {
                            const [label, value] = line.split("｜");
                            const amount = Number(value) || 0;
                            const max = Math.max(1, ...currentSlide!.body.split("\n").map((l) => Number(l.split("｜")[1]) || 0));
                            return <article key={i}><span>{label}</span><i style={{ height: `${Math.max(0, amount / max) * 100}%` }} /><strong>{amount}</strong></article>;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "assets" && (
                  <div className="ppt-assets-panel">
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <label className="ppt-primary" style={{ cursor: "pointer", padding: "8px 12px", borderRadius: 8 }}>
                        上传图片到素材库
                        <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void handleAssetUpload(f); }} />
                      </label>
                      <label className="ws-upload" style={{ cursor: "pointer" }}>
                        更换本页图片
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          style={{ display: "none" }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file) return;
                            await handleAssetUpload(file);
                          }}
                        />
                      </label>
                      <button className="ppt-ghost" onClick={() => void refreshAssets()} disabled={assetLoading}>{assetLoading ? "加载中…" : "刷新素材库 ↻"}</button>
                      {currentSlide!.image && <button className="ppt-ghost" onClick={() => { updateSlide({ image: undefined }); setMessage("已移除本页图片。"); }}>移除图片</button>}
                    </div>
                    {currentSlide!.image && (
                      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
                        <img src={currentSlide!.image} alt="当前页图片预览" style={{ width: 160, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0", objectPosition: `${currentSlide!.focus}% center` }} />
                        <small style={{ color: "#64748b" }}>当前页图片 · 焦点 {currentSlide!.focus}% · 可拖动上方滑杆调整裁切</small>
                      </div>
                    )}
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>素材库（{assets.length}）</h4>
                      {assets.length === 0 ? (
                        <p style={{ fontSize: 13, color: "#64748b" }}>还没有素材。上传图片后会同时保存到服务器，刷新后可复用。</p>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                          {assets.slice(0, 24).map((a) => (
                            <div key={a.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                              {a.mime.startsWith("image/") && assetThumbs[a.id] ? (
                                <img src={assetThumbs[a.id]} alt={a.name} style={{ width: "100%", height: 90, objectFit: "cover" }} />
                              ) : (
                                <div style={{ height: 90, display: "grid", placeItems: "center", background: "#f8fafc", fontSize: 12, color: "#64748b" }}>{a.mime.split("/")[1] || a.mime}</div>
                              )}
                              <div style={{ padding: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={a.name}>{a.name}</div>
                                <div style={{ fontSize: 11, color: "#64748b" }}>{(a.size / 1024).toFixed(1)} KB</div>
                                {a.mime.startsWith("image/") && <button className="ppt-ghost small" style={{ marginTop: 6, width: "100%" }} onClick={() => void applyAssetImage(a)}>用到本页</button>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "sources" && (
                  <div className="ppt-sources-panel">
                    <p style={{ fontSize: 13, color: "#475569" }}>为当前页添加引用来源，导出后可作为脚注或可信度标注。支持多条来源。</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      <input aria-label="来源名称" placeholder="来源名称，如 2024 年报" value={newSourceLabel} onChange={(e) => setNewSourceLabel(e.target.value)} style={{ flex: "1 1 180px", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                      <input aria-label="来源链接" placeholder="https://..." value={newSourceUrl} onChange={(e) => setNewSourceUrl(e.target.value)} style={{ flex: "1 1 260px", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                      <button className="ppt-primary" onClick={addSource}>添加引用</button>
                    </div>
                    {((currentSlide as PptSlide).sources || []).length === 0 ? (
                      <p style={{ fontSize: 13, color: "#64748b" }}>暂无引用。添加后会在幻灯片底部显示来源标记。</p>
                    ) : (
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                        {((currentSlide as PptSlide).sources || []).map((s, i) => (
                          <li key={i} style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", background: "#f8fafc" }}>
                            <a href={s.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 13, color: "#0ea5e9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label} — {s.url}</a>
                            <button className="ppt-ghost small" onClick={() => removeSource(i)}>移除</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>协作评论（{comments.filter((c) => !c.slideId || c.slideId === currentSlide!.id).length}）</h4>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <input aria-label="评论" placeholder={`对第 ${index + 1} 页评论…`} value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void handleSendComment(); }} style={{ flex: 1, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                        <button className="ppt-primary" onClick={() => void handleSendComment()} disabled={!commentText.trim()}>发送</button>
                      </div>
                      <div style={{ display: "grid", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                        {comments.filter((c) => !c.slideId || c.slideId === currentSlide!.id).slice(-20).map((c) => (
                          <div key={c.id} style={{ fontSize: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                            <b>{c.userId}</b> <small style={{ color: "#64748b" }}>{new Date(c.at).toLocaleTimeString()}</small>
                            <div style={{ marginTop: 4 }}>{c.text}</div>
                          </div>
                        ))}
                        {comments.filter((c) => !c.slideId || c.slideId === currentSlide!.id).length === 0 && <small style={{ color: "#64748b" }}>还没有评论，输入后按回车发送。协作用户在线时会实时同步。</small>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
