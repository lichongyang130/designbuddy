import { useEffect, useState } from "react";
import { navigateTo } from "../workspaceRoutes";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { HomeIcon } from "../../../apps/web/src/components/HomeIcon";
import { listProjects } from "../projectStore";
import { createPptProject } from "../pptStore";
import {
  buildAiOutlinePrompt,
  buildLocalOutlines,
  buildSlidesFromCandidate,
  frameworks,
  pickRandomFrameworks,
  type OutlineCandidate,
} from "../pptFrameworks";
import { listWorkspaces } from "../api/workspaces";
import "./ppt-outline.css";

type Props = { outlineId: string };

export default function PptOutlinePicker({ outlineId }: Props) {
  const [prompt, setPrompt] = useState<string>("");
  const [candidates, setCandidates] = useState<OutlineCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [aiStatus, setAiStatus] = useState<string>("正在按不同框架构思 3 套大纲…");
  const [error, setError] = useState<string>("");
  const [projectCount, setProjectCount] = useState(() => listProjects().length);
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");

  useEffect(() => {
    void listWorkspaces()
      .then((ws) => {
        setWorkspaceCount(ws.length);
        setWorkspaces(ws.map((w) => ({ id: w.id, name: w.name })));
        if (ws[0]) setSelectedWorkspace(ws[0].id);
      })
      .catch(() => 0);
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem(`designbuddy.ppt.outline.${outlineId}`);
    if (!raw) {
      setPrompt("");
      setLoading(false);
      setError("找不到本次大纲任务，可能是刷新导致。请回首页重新输入主题。");
      return;
    }
    try {
      const data = JSON.parse(raw) as { prompt: string };
      const p = String(data.prompt || "").trim();
      if (!p) throw new Error("empty prompt");
      setPrompt(p);
      void generateCandidates(p);
    } catch {
      setError("大纲任务解析失败，请回首页重试。");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlineId]);

  async function generateCandidates(p: string) {
    setLoading(true);
    setError("");
    setAiStatus("正在按不同框架构思 3 套大纲…");
    // 先尝试 AI，超时 12s 回退本地
    try {
      const aiCandidates = await fetchAiCandidates(p);
      if (aiCandidates && aiCandidates.length >= 2) {
        setCandidates(aiCandidates);
        setSelectedId(aiCandidates[0].id);
        setAiStatus(`AI 已按 3 种叙事生成大纲，可直接选用`);
        setLoading(false);
        return;
      }
    } catch (e) {
      setAiStatus(`AI 暂不可用，已用本地框架生成：${(e as Error).message}`);
    }
    // 本地回退
    const local = buildLocalOutlines(p, 3, []);
    setCandidates(local);
    setSelectedId(local[0]?.id || "");
    setAiStatus("已用本地 10 套框架池生成 3 套候选（每次都不同）");
    setLoading(false);
  }

  async function fetchAiCandidates(p: string): Promise<OutlineCandidate[] | null> {
    const { apiFetch } = await import("../../../apps/web/src/api/client");
    const chosenFrameworks = pickRandomFrameworks(p, 3, []);
    const systemPrompt = buildAiOutlinePrompt(p, frameworks);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await apiFetch("/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: systemPrompt, userId: "ppt-outline" }),
        signal: controller.signal,
      });
      const data = (await res.json()) as { content?: string; error?: string };
      if (!res.ok) throw new Error(data.error || `AI ${res.status}`);
      const text = data.content || "";
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("AI 未返回 JSON");
      const parsed = JSON.parse(match[0]) as Array<{
        frameworkId?: string;
        frameworkName?: string;
        narrative?: string;
        slides?: Array<{ title?: string; body?: string; layout?: string; eyebrow?: string; notes?: string }>;
      }>;
      if (!Array.isArray(parsed) || parsed.length < 2) throw new Error("AI 大纲不足");
      const mapped: OutlineCandidate[] = parsed.slice(0, 3).map((item) => {
        const fw = frameworks.find((f) => f.id === item.frameworkId) || frameworks[0];
        const slides = (Array.isArray(item.slides) ? item.slides : []).slice(0, 10).map((s) => ({
          title: String(s.title || "未命名").slice(0, 30),
          body: String(s.body || "要点").slice(0, 400),
          layout: ["cover", "quote", "cards", "bullets", "split", "chart", "metrics", "timeline", "table"].includes(String(s.layout)) ? String(s.layout) : "cards",
          eyebrow: String(s.eyebrow || fw.eyebrowPrefix).slice(0, 30),
          notes: String(s.notes || "").slice(0, 200),
        }));
        if (!slides.length) throw new Error("AI 单套大纲为空");
        return {
          id: crypto.randomUUID(),
          frameworkId: fw.id,
          frameworkName: item.frameworkName || fw.name,
          narrative: item.narrative || fw.narrative,
          description: fw.description,
          theme: fw.theme,
          eyebrowPrefix: fw.eyebrowPrefix,
          slides,
        };
      });
      return mapped;
    } finally {
      clearTimeout(timeout);
    }
  }

  function handleConfirm() {
    const chosen = candidates.find((c) => c.id === selectedId);
    if (!chosen || !prompt) return;
    const slides = buildSlidesFromCandidate(chosen);
    const ws = workspaces.find((w) => w.id === selectedWorkspace);
    const project = createPptProject(
      prompt,
      `${extractTitle(prompt)} · ${chosen.frameworkName}`,
      slides,
      ws ? { id: ws.id, name: ws.name } : undefined,
      { id: chosen.frameworkId, name: chosen.frameworkName },
    );
    sessionStorage.removeItem(`designbuddy.ppt.outline.${outlineId}`);
    navigateTo(`/ppt/${encodeURIComponent(project.id)}`);
  }

  function extractTitle(p: string): string {
    let t = p.replace(/^.*?主题是[：:]\s*/s, "").trim().split("\n")[0].slice(0, 24);
    if (!t) t = p.slice(0, 24);
    return t;
  }

  const go = (path: string) => navigateTo(path);

  if (loading) {
    return (
      <div className="workbuddy-app">
        <WorkBuddySidebar active="home" projectCount={projectCount} workspaceCount={workspaceCount} go={go} setNotice={() => {}} />
        <main className="ppt-outline-page">
          <header className="ppt-outline-header">
            <button className="ppt-ghost" onClick={() => go("/")}>← 返回首页</button>
            <h1>正在构思大纲…</h1>
            <p>{aiStatus}</p>
          </header>
          <div className="ppt-outline-skeleton">
            {[0, 1, 2].map((i) => (
              <article key={i} className="outline-card skeleton">
                <div className="skeleton-line w-60" />
                <div className="skeleton-line w-90" />
                <div className="skeleton-line w-40" />
                <div className="skeleton-pages">
                  {[0, 1, 2, 3, 4].map((j) => (
                    <div key={j} className="skeleton-page" />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workbuddy-app">
        <WorkBuddySidebar active="home" projectCount={projectCount} workspaceCount={workspaceCount} go={go} setNotice={() => {}} />
        <main className="ppt-outline-page">
          <header className="ppt-outline-header">
            <button className="ppt-ghost" onClick={() => go("/")}>← 返回首页</button>
            <h1>大纲生成遇到问题</h1>
            <p>{error}</p>
          </header>
          <div className="ppt-outline-actions">
            <button className="ppt-primary" onClick={() => go("/")}>回首页重建</button>
            {prompt && (
              <button
                className="ppt-ghost"
                onClick={() => generateCandidates(prompt)}
              >
                重试生成
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="workbuddy-app">
      <WorkBuddySidebar active="home" projectCount={projectCount} workspaceCount={workspaceCount} go={go} setNotice={() => {}} />
      <main className="ppt-outline-page">
        <header className="ppt-outline-header">
          <div className="ppt-outline-header-left">
            <button className="ppt-ghost" onClick={() => go("/")}>← 返回首页</button>
            <div>
              <h1>为你构思了 3 套不同框架</h1>
              <p>
                主题：<strong>{prompt.slice(0, 80)}</strong> · {aiStatus}
              </p>
              <small>每套框架的叙事逻辑、页数和版式都不同，点卡片预览，选中后一键生成可编辑 PPTX</small>
            </div>
          </div>
          <div className="ppt-outline-header-actions">
            {workspaces.length > 0 && (
              <label className="ppt-ws-select">
                <HomeIcon name="folder" size={12} />
                <select value={selectedWorkspace} onChange={(e) => setSelectedWorkspace(e.target.value)} aria-label="选择工作空间">
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button className="ppt-ghost" onClick={() => generateCandidates(prompt)}>换一批 🔀</button>
            <button className="ppt-primary" disabled={!selectedId} onClick={handleConfirm}>
              确认并生成演示文稿 →
            </button>
          </div>
        </header>

        <section className="outline-grid">
          {candidates.map((candidate) => (
            <article
              key={candidate.id}
              className={`outline-card ${selectedId === candidate.id ? "is-selected" : ""}`}
              onClick={() => setSelectedId(candidate.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(candidate.id);
                }
              }}
            >
              <div className="outline-card-head" style={{ borderTopColor: candidate.theme.primary }}>
                <div className="outline-framework-badge" style={{ background: candidate.theme.primary }}>
                  {candidate.eyebrowPrefix}
                </div>
                <div>
                  <h3>{candidate.frameworkName}</h3>
                  <p>{candidate.narrative}</p>
                  <small>
                    {candidate.slides.length} 页 · {candidate.description}
                  </small>
                </div>
                <span className="outline-radio" aria-hidden="true">
                  {selectedId === candidate.id ? "●" : "○"}
                </span>
              </div>

              <ol className="outline-pages">
                {candidate.slides.map((slide, idx) => (
                  <li key={idx}>
                    <span className="outline-page-index">{String(idx + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{slide.title}</strong>
                      <span className="outline-layout-tag">{slide.layout}</span>
                      <p>{slide.body.split("\n")[0].slice(0, 48)}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="outline-theme-preview">
                <span style={{ background: candidate.theme.primary }} />
                <span style={{ background: candidate.theme.accent }} />
                <span style={{ background: candidate.theme.background, border: "1px solid #e5e7eb" }} />
                <span style={{ background: candidate.theme.surface, border: "1px solid #e5e7eb" }} />
                <small>
                  {candidate.theme.primary} 主色 · {candidate.theme.accent} 强调
                </small>
              </div>
            </article>
          ))}
        </section>

        <footer className="ppt-outline-footer">
          <p>
            <HomeIcon name="bulb" size={12} /> 提示：每次“换一批”都会从 10 套框架池里抽不同组合，同一主题也能讲出 3 种故事。选中后进入的编辑器仍可逐页换版式、增删页、AI 重写单页。
          </p>
        </footer>
      </main>
    </div>
  );
}
