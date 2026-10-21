import { useCallback, useEffect, useMemo, useState } from "react";
import { WorkBuddySidebar } from "../../../apps/web/src/components/WorkBuddySidebar";
import { listProjects } from "../projectStore";
import { navigateTo } from "../workspaceRoutes";
import {
  analyzeServerProject,
  approveAgentRun,
  cancelAgentRun,
  createMemory,
  createServerStarterProject,
  deleteMemory,
  executeAgentRun,
  fetchArchitectureSnapshot,
  generateServerPlan,
  listAgentRuns,
  listMemories,
  listServerProjects,
  rejectAgentRun,
  retryAgentRun,
  rollbackAgentRun,
  type AgentRunRecord,
  type ExecutionPlan,
  type MemoryCategory,
  type MemoryRecord,
  type ProjectAnalysisReport,
  type ServerProjectSummary,
  type WorkspaceArchitectureSnapshot,
} from "../api/agentCore";
import "./agent-workbench.css";

type WorkbenchTab = "plan" | "diff" | "preview" | "memory";

function buildSandboxedSrcDoc(files: Array<{ path: string; content: string }>): string {
  const htmlFile = files.find((f) => f.path.endsWith(".html"));
  const cssContent = files
    .filter((f) => f.path.endsWith(".css"))
    .map((f) => f.content)
    .join("\n");
  const jsContent = files
    .filter((f) => /\.(js|mjs)$/.test(f.path))
    .map((f) => f.content)
    .join("\n");
  let doc =
    htmlFile?.content ||
    "<!doctype html><html><head><title>Preview</title></head><body><p>暂无 HTML 入口文件</p></body></html>";
  if (cssContent) {
    doc = doc.includes("</head>")
      ? doc.replace("</head>", `<style>\n${cssContent}\n</style>\n</head>`)
      : `<style>${cssContent}</style>\n${doc}`;
  }
  if (jsContent) {
    doc = doc.includes("</body>")
      ? doc.replace("</body>", `<script>\n${jsContent}\n</script>\n</body>`)
      : `${doc}\n<script>${jsContent}</script>`;
  }
  return doc;
}

export default function AgentWorkbenchPage() {
  const [projects, setProjects] = useState<ServerProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [goal, setGoal] = useState("补充响应式特性展示模块、修正视口与语义标签并套用项目品牌主色");
  const [pauseBeforeApply, setPauseBeforeApply] = useState(false);
  const [stagedEditPath, setStagedEditPath] = useState("");
  const [stagedEditContent, setStagedEditContent] = useState("");
  const [tab, setTab] = useState<WorkbenchTab>("plan");
  const [viewport, setViewport] = useState<"100%" | "768px" | "375px">("100%");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [analysis, setAnalysis] = useState<ProjectAnalysisReport | null>(null);
  const [draftPlan, setDraftPlan] = useState<ExecutionPlan | null>(null);
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [activeRunId, setActiveRunId] = useState("");
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [architecture, setArchitecture] = useState<WorkspaceArchitectureSnapshot | null>(null);

  const [memCategory, setMemCategory] = useState<MemoryCategory>("constraint");
  const [memTitle, setMemTitle] = useState("");
  const [memContent, setMemContent] = useState("");

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const activeRun = useMemo(
    () => runs.find((r) => r.id === activeRunId) ?? runs[0] ?? null,
    [runs, activeRunId],
  );

  const reloadProjects = useCallback(async (preferId?: string) => {
    const list = await listServerProjects();
    setProjects(list);
    setSelectedProjectId((curr) => {
      if (preferId && list.some((p) => p.id === preferId)) return preferId;
      if (curr && list.some((p) => p.id === curr)) return curr;
      return list[0]?.id ?? "";
    });
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([reloadProjects(), fetchArchitectureSnapshot()])
      .then(([, arch]) => {
        if (!cancelled) setArchitecture(arch);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载工作台数据失败。");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadProjects]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listAgentRuns(selectedProjectId || undefined),
      listMemories(selectedProjectId || undefined),
      selectedProjectId ? analyzeServerProject(selectedProjectId).catch(() => null) : Promise.resolve(null),
    ])
      .then(([runRes, memRes, analysisRes]) => {
        if (cancelled) return;
        setRuns(runRes.runs);
        setActiveRunId((curr) => (runRes.runs.some((r) => r.id === curr) ? curr : runRes.runs[0]?.id ?? ""));
        setMemories(memRes.memories);
        setAnalysis(analysisRes);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "读取项目运行状态失败。");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  async function handleCreateStarterProject() {
    setBusy(true);
    setError("");
    try {
      const created = await createServerStarterProject(
        "DesignBuddy 验证项目",
        "用于验证项目分析、分步计划、QA 语法校验、Diff 审阅与一键回滚的真实网页项目。",
      );
      await reloadProjects(created.id);
      setNotice(`已创建服务端持久化项目「${created.name}」。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建项目失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handlePreviewPlan() {
    if (!selectedProjectId) {
      setError("请先选择项目，或点击「新建验证项目」。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await generateServerPlan(selectedProjectId, goal);
      setDraftPlan(res.plan);
      setAnalysis(res.analysis);
      setTab("plan");
      setNotice(`已生成 ${res.plan.steps.length} 步有向无环（DAG）执行计划。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成计划失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handleExecuteRun() {
    if (!selectedProjectId) {
      setError("请先选择项目，或点击「新建验证项目」。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { run } = await executeAgentRun({
        projectId: selectedProjectId,
        goal,
        pauseBeforeApply,
      });
      await reloadProjects(selectedProjectId);
      const [runRes, nextAnalysis] = await Promise.all([
        listAgentRuns(selectedProjectId),
        analyzeServerProject(selectedProjectId),
      ]);
      setRuns(runRes.runs);
      setActiveRunId(run.id);
      setAnalysis(nextAnalysis);
      if (run.status === "waiting_approval") {
        const firstChanged = run.resultFiles[0];
        if (firstChanged) {
          setStagedEditPath(firstChanged.path);
          setStagedEditContent(firstChanged.content);
        }
        setTab("diff");
        setNotice(`已暂存变更并通过 QA 预检（评分 ${run.qaReport?.score ?? "--"}/100），请审阅 Diff 后确认批准写入或驳回。`);
      } else {
        setNotice(`任务执行完成（状态：${run.status}，QA 评分 ${run.qaReport?.score ?? "--"}/100）。`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "执行任务失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handleApproveRun(runId: string) {
    setBusy(true);
    setError("");
    try {
      const overrides = stagedEditPath
        ? [{ path: stagedEditPath, content: stagedEditContent }]
        : undefined;
      const { run } = await approveAgentRun(runId, { files: overrides });
      await reloadProjects(selectedProjectId);
      const [runRes, nextAnalysis] = await Promise.all([
        listAgentRuns(selectedProjectId),
        analyzeServerProject(selectedProjectId),
      ]);
      setRuns(runRes.runs);
      setActiveRunId(run.id);
      setAnalysis(nextAnalysis);
      setNotice(`已批准并写入项目文件（QA 评分 ${run.qaReport?.score ?? "--"}/100）。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "批准写入失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectRun(runId: string) {
    setBusy(true);
    setError("");
    try {
      const { run } = await rejectAgentRun(runId, "人工审阅驳回本次暂存变更");
      const runRes = await listAgentRuns(selectedProjectId);
      setRuns(runRes.runs);
      setActiveRunId(run.id);
      setNotice("已驳回本次暂存变更，原项目文件保持未修改。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "驳回失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handleRollback(runId: string) {
    setBusy(true);
    setError("");
    try {
      await rollbackAgentRun(runId);
      await reloadProjects(selectedProjectId);
      const [runRes, nextAnalysis] = await Promise.all([
        listAgentRuns(selectedProjectId),
        analyzeServerProject(selectedProjectId),
      ]);
      setRuns(runRes.runs);
      setAnalysis(nextAnalysis);
      setNotice("已回滚到本次执行前的基线文件版本，并记录版本历史。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "回滚失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handleRetry(runId: string) {
    setBusy(true);
    setError("");
    try {
      const { run } = await retryAgentRun(runId);
      await reloadProjects(selectedProjectId);
      const runRes = await listAgentRuns(selectedProjectId);
      setRuns(runRes.runs);
      setActiveRunId(run.id);
      setNotice(`已完成重试（第 ${run.attempts} 次执行）。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "重试失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMemory(event: React.FormEvent) {
    event.preventDefault();
    if (!memTitle.trim() || !memContent.trim()) {
      setError("请填写记忆标题与具体约束内容。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createMemory({
        projectId: selectedProjectId || "",
        category: memCategory,
        title: memTitle.trim(),
        content: memContent.trim(),
        pinned: true,
      });
      setMemTitle("");
      setMemContent("");
      const memRes = await listMemories(selectedProjectId || undefined);
      setMemories(memRes.memories);
      setNotice("已保存项目记忆约束，后续计划与代码生成将自动引用。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存记忆失败。");
    } finally {
      setBusy(false);
    }
  }

  const previewFiles =
    activeRun?.status === "waiting_approval"
      ? activeRun.resultFiles
      : activeProject?.files ?? activeRun?.resultFiles ?? [];
  const displayedPlan = activeRun?.plan ?? draftPlan;

  return (
    <div className="workbuddy-app">
      <WorkBuddySidebar
        active="agent"
        projectCount={listProjects().length}
        go={navigateTo}
        setNotice={setNotice}
      />
      <main className="agent-workbench-main" aria-label="Agent 工程工作台">
        <header className="aw-header">
          <div>
            <h1>Agent 工程工作台</h1>
            <p>
              真实持久化状态机（SQLite）：静态项目分析 → 有向无环计划（DAG） → 受控代码与样式变更 → QA 语法及差异校验 → 一键版本回滚。
            </p>
          </div>
          <div className="aw-toolbar">
            <label htmlFor="aw-project-select" style={{ fontSize: "0.86rem", fontWeight: 600 }}>
              目标项目
            </label>
            <select
              id="aw-project-select"
              aria-label="目标项目"
              className="aw-select"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.length === 0 ? (
                <option value="">暂无服务端项目</option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（{p.files.length} 个文件）
                  </option>
                ))
              )}
            </select>
            <button type="button" className="aw-btn" disabled={busy} onClick={() => void handleCreateStarterProject()}>
              新建验证项目
            </button>
          </div>
        </header>

        {notice ? (
          <div className="aw-notice" role="status">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="aw-notice is-error" role="alert">
            {error}
          </div>
        ) : null}

        <section className="aw-composer" aria-label="任务目标与执行控制">
          <label htmlFor="aw-goal-input" style={{ fontWeight: 600, fontSize: "0.9rem" }}>
            任务目标（支持提取色值如 #2a6f97、深色模式与项目记忆约束）
          </label>
          <textarea
            id="aw-goal-input"
            aria-label="任务目标"
            className="aw-textarea"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="输入要分析并执行的页面结构或设计修改需求…"
          />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.86rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={pauseBeforeApply}
              onChange={(e) => setPauseBeforeApply(e.target.checked)}
            />
            写入前暂停人工确认（暂存 Diff 并支持在线微调代码后再写入）
          </label>
          <div className="aw-toolbar">
            <button type="button" className="aw-btn" disabled={busy} onClick={() => void handlePreviewPlan()}>
              仅生成计划
            </button>
            <button
              type="button"
              className="aw-btn aw-btn-primary"
              disabled={busy}
              onClick={() => void handleExecuteRun()}
            >
              {busy ? "正在执行…" : "执行分析、修改与 QA 验收"}
            </button>
            {activeRun && !activeRun.rolledBackAt && activeRun.status !== "waiting_approval" ? (
              <button
                type="button"
                className="aw-btn aw-btn-danger"
                disabled={busy}
                onClick={() => void handleRollback(activeRun.id)}
              >
                回滚到执行前版本
              </button>
            ) : null}
            {activeRun ? (
              <button type="button" className="aw-btn" disabled={busy} onClick={() => void handleRetry(activeRun.id)}>
                重试该任务
              </button>
            ) : null}
            {activeRun && activeRun.status === "running" ? (
              <button
                type="button"
                className="aw-btn aw-btn-danger"
                onClick={() => void cancelAgentRun(activeRun.id)}
              >
                取消运行
              </button>
            ) : null}
          </div>
          {activeRun && activeRun.status === "waiting_approval" ? (
            <div
              className="aw-card"
              role="region"
              aria-label="待人工审阅确认"
              style={{ marginTop: 10, borderColor: "#2a6f97" }}
            >
              <div className="aw-row-between">
                <strong>待人工确认写入（暂存状态 waiting_approval · 原项目尚未修改）</strong>
                <div className="aw-toolbar">
                  <button
                    type="button"
                    className="aw-btn aw-btn-primary"
                    disabled={busy}
                    onClick={() => void handleApproveRun(activeRun.id)}
                  >
                    批准并写入项目
                  </button>
                  <button
                    type="button"
                    className="aw-btn aw-btn-danger"
                    disabled={busy}
                    onClick={() => void handleRejectRun(activeRun.id)}
                  >
                    驳回变更
                  </button>
                </div>
              </div>
              <div className="aw-toolbar">
                <label htmlFor="aw-staged-file" style={{ fontSize: "0.84rem" }}>
                  暂存文件微调
                </label>
                <select
                  id="aw-staged-file"
                  aria-label="暂存文件选择"
                  className="aw-select"
                  value={stagedEditPath}
                  onChange={(e) => {
                    const nextPath = e.target.value;
                    setStagedEditPath(nextPath);
                    const found = activeRun.resultFiles.find((f) => f.path === nextPath);
                    if (found) setStagedEditContent(found.content);
                  }}
                >
                  {activeRun.resultFiles.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.path}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                aria-label="暂存文件内容编辑"
                className="aw-textarea"
                rows={5}
                value={stagedEditContent}
                onChange={(e) => setStagedEditContent(e.target.value)}
              />
            </div>
          ) : null}
        </section>

        <div className="aw-tabs" role="tablist" aria-label="工作台视图">
          {(
            [
              ["plan", "计划与步骤追踪"],
              ["diff", "Unified Diff 与 QA 报告"],
              ["preview", "实时沙箱预览"],
              ["memory", "项目记忆与仓库架构"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              className="aw-tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "plan" ? (
          <div className="aw-grid">
            <section className="aw-card" aria-label="执行步骤">
              <div className="aw-row-between">
                <h2>分步计划与状态追踪</h2>
                {displayedPlan ? (
                  <span className="aw-badge">
                    {displayedPlan.generatedBy === "model" ? "在线模型规划" : "确定性 DAG 规划"}
                  </span>
                ) : null}
              </div>
              {activeRun ? (
                <ul className="aw-list">
                  {activeRun.steps.map((s) => (
                    <li key={s.stepId} className="aw-step-item">
                      <div className="aw-row-between">
                        <strong>
                          {s.index}. [{s.agentRole}] {s.title}
                        </strong>
                        <span
                          className={`aw-badge ${
                            s.status === "succeeded" ? "is-ok" : s.status === "failed" ? "is-fail" : "is-warn"
                          }`}
                        >
                          {s.status} · {s.durationMs ?? 0}ms
                        </span>
                      </div>
                      <span style={{ fontSize: "0.85rem", color: "#5c6672" }}>
                        {s.outputSummary || s.error || s.inputSummary}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : displayedPlan ? (
                <ul className="aw-list">
                  {displayedPlan.steps.map((s) => (
                    <li key={s.id} className="aw-step-item">
                      <div className="aw-row-between">
                        <strong>
                          {s.index}. [{s.agentRole}] {s.title}
                        </strong>
                        <span className="aw-badge">待执行</span>
                      </div>
                      <span style={{ fontSize: "0.85rem", color: "#5c6672" }}>{s.description}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, color: "#5c6672" }}>选择项目后点击「仅生成计划」或「执行分析、修改与 QA 验收」。</p>
              )}
            </section>

            <section className="aw-card" aria-label="静态分析与运行历史">
              <h2>项目静态分析与持久化历史（{runs.length}）</h2>
              {analysis ? (
                <div style={{ fontSize: "0.88rem", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div>
                    文件数：<strong>{analysis.summary.fileCount}</strong> · 总行数：
                    <strong>{analysis.summary.totalLines}</strong> · 入口：
                    <strong>{analysis.summary.entryPoints.join(", ") || "无"}</strong>
                  </div>
                  <div>
                    语法错误：<strong>{analysis.summary.syntaxErrorCount}</strong> · 断链引用：
                    <strong>{analysis.summary.brokenReferenceCount}</strong> · 风险提示：
                    <strong>{analysis.summary.riskCount}</strong>
                  </div>
                </div>
              ) : null}
              <ul className="aw-list">
                {runs.map((r) => (
                  <li key={r.id} className="aw-step-item">
                    <div className="aw-row-between">
                      <button
                        type="button"
                        className="aw-btn"
                        style={{ padding: "4px 10px" }}
                        onClick={() => setActiveRunId(r.id)}
                      >
                        {r.goal.slice(0, 32)}
                      </button>
                      <span className={`aw-badge ${r.status === "succeeded" ? "is-ok" : "is-warn"}`}>
                        {r.status} · 第 {r.attempts} 次{r.rolledBackAt ? " · 已回滚" : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}

        {tab === "diff" ? (
          <div className="aw-grid">
            <section className="aw-card" aria-label="代码差异">
              <h2>文件级 Unified Diff</h2>
              {activeRun && activeRun.diff.some((d) => d.changeType !== "unchanged") ? (
                activeRun.diff
                  .filter((d) => d.changeType !== "unchanged")
                  .map((d) => (
                    <div key={d.path} data-diff-path={d.path} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div className="aw-row-between">
                        <strong>{d.path}</strong>
                        <span className="aw-badge is-ok">
                          {d.changeType} (+{d.addedLines} / -{d.removedLines})
                        </span>
                      </div>
                      <pre className="aw-diff-pre">{d.unifiedPatch}</pre>
                    </div>
                  ))
              ) : (
                <p style={{ margin: 0, color: "#5c6672" }}>执行一次任务后即可查看逐行 Unified Diff。</p>
              )}
            </section>

            <section className="aw-card" aria-label="QA 检查报告">
              <div className="aw-row-between">
                <h2>QA 静态与质量验收</h2>
                {activeRun?.qaReport ? (
                  <span className={`aw-badge ${activeRun.qaReport.passed ? "is-ok" : "is-fail"}`}>
                    评分 {activeRun.qaReport.score}/100 · {activeRun.qaReport.passed ? "通过" : "阻断"}
                  </span>
                ) : null}
              </div>
              {activeRun?.qaReport ? (
                <ul className="aw-list">
                  {activeRun.qaReport.checks.map((c) => (
                    <li key={c.id} className="aw-step-item">
                      <div className="aw-row-between">
                        <strong>{c.rule}</strong>
                        <span
                          className={`aw-badge ${
                            c.status === "pass" ? "is-ok" : c.status === "fail" ? "is-fail" : "is-warn"
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.85rem", color: "#5c6672" }}>{c.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, color: "#5c6672" }}>暂无 QA 报告。</p>
              )}
            </section>
          </div>
        ) : null}

        {tab === "preview" ? (
          <section className="aw-card" aria-label="实时预览">
            <div className="aw-row-between">
              <h2>隔离沙箱实时预览</h2>
              <div className="aw-toolbar">
                {(["100%", "768px", "375px"] as const).map((vp) => (
                  <button
                    key={vp}
                    type="button"
                    className="aw-btn"
                    aria-pressed={viewport === vp}
                    onClick={() => setViewport(vp)}
                  >
                    视口 {vp}
                  </button>
                ))}
              </div>
            </div>
            <div className="aw-preview-frame-wrap">
              <iframe
                title="项目实时沙箱预览"
                className="aw-preview-iframe"
                style={{ width: viewport }}
                sandbox="allow-scripts"
                srcDoc={buildSandboxedSrcDoc(previewFiles)}
              />
            </div>
          </section>
        ) : null}

        {tab === "memory" ? (
          <div className="aw-grid">
            <section className="aw-card" aria-label="项目记忆库">
              <h2>持久化项目记忆（用户与项目级隔离）</h2>
              <form onSubmit={(e) => void handleAddMemory(e)} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="aw-toolbar">
                  <select
                    aria-label="记忆类型"
                    className="aw-select"
                    value={memCategory}
                    onChange={(e) => setMemCategory(e.target.value as MemoryCategory)}
                  >
                    <option value="constraint">硬性约束 (constraint)</option>
                    <option value="preference">视觉偏好 (preference)</option>
                    <option value="decision">架构决策 (decision)</option>
                    <option value="fact">业务事实 (fact)</option>
                    <option value="error-fix">修复经验 (error-fix)</option>
                  </select>
                  <input
                    aria-label="记忆标题"
                    className="aw-input"
                    placeholder="标题，如：品牌主色调"
                    value={memTitle}
                    onChange={(e) => setMemTitle(e.target.value)}
                  />
                </div>
                <textarea
                  aria-label="记忆内容"
                  className="aw-textarea"
                  placeholder="详细约束，如：全站主色统一采用 #2a6f97…"
                  value={memContent}
                  onChange={(e) => setMemContent(e.target.value)}
                />
                <button type="submit" className="aw-btn aw-btn-primary" disabled={busy}>
                  保存记忆条目
                </button>
              </form>
              <ul className="aw-list">
                {memories.map((m) => (
                  <li key={m.id} className="aw-step-item">
                    <div className="aw-row-between">
                      <strong>
                        [{m.category}] {m.title}
                      </strong>
                      <button
                        type="button"
                        className="aw-btn aw-btn-danger"
                        style={{ padding: "3px 10px" }}
                        onClick={() =>
                          void deleteMemory(m.id).then(() =>
                            listMemories(selectedProjectId || undefined).then((r) => setMemories(r.memories)),
                          )
                        }
                      >
                        删除
                      </button>
                    </div>
                    <span style={{ fontSize: "0.85rem", color: "#5c6672" }}>{m.content}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="aw-card" aria-label="仓库静态模块关系">
              <h2>仓库模块边界实时扫描（{architecture?.totalSourceFiles ?? 0} 个源文件）</h2>
              <ul className="aw-list">
                {(architecture?.layers ?? []).map((layer) => (
                  <li key={layer.layer} className="aw-step-item">
                    <div className="aw-row-between">
                      <strong>
                        {layer.layer}（{layer.fileCount}）
                      </strong>
                      <span
                        className={`aw-badge ${
                          layer.classification === "skeleton-unreferenced"
                            ? "is-warn"
                            : layer.classification === "active-coupled"
                              ? "is-warn"
                              : "is-ok"
                        }`}
                      >
                        {layer.classification} · 入 {layer.inboundEdges} / 出 {layer.outboundEdges}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.83rem", color: "#5c6672" }}>{layer.note}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
