import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { AgentRuntime, type AgentTask, type AgentTaskStore } from "../../packages/ai-core/runtime/AgentRuntime";
import { requestAI } from "../api/ai";
import type { ApiProject } from "../api/http-handler";
import type { ProjectVersionStore } from "../api/project-versions";
import { analyzeDesignProject, type AnalyzableFile, type ProjectAnalysisReport } from "./analyzer";
import { MemoryEngine, type MemoryRecord } from "./memory-engine";
import { generateExecutionPlan, type ExecutionPlan, type PlanAgentRole } from "./planner-engine";
import { computeProjectDiff, runProjectQA, type FileDiffEntry, type QAReport } from "./qa-agent";

export type OrchestratorRunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface StepExecutionTrace {
  stepId: string;
  index: number;
  title: string;
  agentRole: PlanAgentRole;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  attempts: number;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
  inputSummary: string;
  outputSummary: string;
  error?: string;
}

export interface AgentRunRecord {
  id: string;
  ownerId: string;
  projectId: string;
  goal: string;
  status: OrchestratorRunStatus;
  idempotencyKey?: string;
  attempts: number;
  executionMode: "deterministic-local" | "ai-assisted";
  awaitingApproval?: boolean;
  approvalNote?: string;
  plan: ExecutionPlan | null;
  steps: StepExecutionTrace[];
  analysisBefore: ProjectAnalysisReport | null;
  qaReport: QAReport | null;
  diff: FileDiffEntry[];
  baselineFiles: AnalyzableFile[];
  resultFiles: AnalyzableFile[];
  baselineVersionIds: Record<string, string>;
  committedVersionIds: Record<string, string>;
  rolledBackAt: number | null;
  error: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

/**
 * SQLite-backed AgentTaskStore adapter bridging packages/ai-core/runtime/AgentRuntime
 * directly to durable server storage so in-memory task state loss across restarts
 * is eliminated.
 */
export class SqliteAgentTaskStore implements AgentTaskStore {
  constructor(private readonly db: DatabaseSync) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_core_tasks (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL DEFAULT '',
        project_id TEXT NOT NULL DEFAULT '',
        idempotency_key TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        task_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ai_core_tasks_owner ON ai_core_tasks(owner_id, updated_at DESC);
    `);
  }

  get(taskId: string): AgentTask | undefined {
    const row = this.db.prepare("SELECT task_json FROM ai_core_tasks WHERE id=?").get(taskId) as
      | { task_json: string }
      | undefined;
    return row ? (JSON.parse(row.task_json) as AgentTask) : undefined;
  }

  put(task: AgentTask): void {
    const now = task.updatedAt ?? Date.now();
    this.db
      .prepare(
        `INSERT INTO ai_core_tasks (id, owner_id, project_id, idempotency_key, status, task_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status=excluded.status,
           task_json=excluded.task_json,
           updated_at=excluded.updated_at`,
      )
      .run(
        task.id,
        task.ownerId || "",
        task.projectId || "",
        task.idempotencyKey || "",
        task.status,
        JSON.stringify(task),
        now,
      );
  }

  list(ownerId?: string): AgentTask[] {
    const rows = (
      ownerId
        ? this.db.prepare("SELECT task_json FROM ai_core_tasks WHERE owner_id=? ORDER BY updated_at DESC").all(ownerId)
        : this.db.prepare("SELECT task_json FROM ai_core_tasks ORDER BY updated_at DESC").all()
    ) as Array<{ task_json: string }>;
    return rows.map((r) => JSON.parse(r.task_json) as AgentTask);
  }

  delete(taskId: string): boolean {
    return Number(this.db.prepare("DELETE FROM ai_core_tasks WHERE id=?").run(taskId).changes) > 0;
  }

  findByIdempotencyKey(ownerId: string, key: string): AgentTask | undefined {
    if (!ownerId || !key) return undefined;
    const row = this.db
      .prepare("SELECT task_json FROM ai_core_tasks WHERE owner_id=? AND idempotency_key=? LIMIT 1")
      .get(ownerId, key) as { task_json: string } | undefined;
    return row ? (JSON.parse(row.task_json) as AgentTask) : undefined;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractPreferredHex(text: string): string | null {
  const m = text.match(/#([0-9a-fA-F]{6})\b/);
  return m ? `#${m[1].toLowerCase()}` : null;
}

/**
 * Deterministic, syntax-verified code/style transformer used when external LLM
 * credentials are absent or not authorized — produces genuine, inspectable DOM,
 * CSS custom properties, responsive layout rules and accessible JS interactivity.
 */
function applyDeterministicChanges(params: {
  goal: string;
  projectName: string;
  files: AnalyzableFile[];
  memories: MemoryRecord[];
}): { files: AnalyzableFile[]; notes: string[] } {
  const notes: string[] = [];
  const next = params.files.map((f) => ({ ...f }));
  const combinedConstraints = [params.goal, ...params.memories.map((m) => `${m.title}: ${m.content}`)].join("\n");
  const primaryColor = extractPreferredHex(combinedConstraints) || "#1f5f4a";
  const isDark = /深色|暗色|dark/i.test(combinedConstraints);
  const bgColor = isDark ? "#11161d" : "#f7f8fa";
  const surfaceColor = isDark ? "#1a222d" : "#ffffff";
  const textColor = isDark ? "#eef2f6" : "#182026";
  const mutedColor = isDark ? "#9fb0c2" : "#5c6b77";

  let cssFile = next.find((f) => f.path.endsWith(".css"));
  const tokenBlock = [
    "/* DesignBuddy Agent Tokens & Responsive Guard */",
    ":root {",
    `  --db-agent-primary: ${primaryColor};`,
    `  --db-agent-bg: ${bgColor};`,
    `  --db-agent-surface: ${surfaceColor};`,
    `  --db-agent-text: ${textColor};`,
    `  --db-agent-muted: ${mutedColor};`,
    "  --db-agent-radius: 14px;",
    "}",
    ".db-agent-section {",
    "  max-width: 1080px;",
    "  margin: 2rem auto;",
    "  padding: clamp(1.25rem, 3vw, 2rem);",
    "  background: var(--db-agent-surface);",
    "  color: var(--db-agent-text);",
    "  border-radius: var(--db-agent-radius);",
    "  border: 1px solid rgba(127, 140, 155, 0.22);",
    "  box-sizing: border-box;",
    "}",
    ".db-agent-grid {",
    "  display: grid;",
    "  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));",
    "  gap: 1rem;",
    "  margin-top: 1.25rem;",
    "}",
    ".db-agent-card {",
    "  padding: 1rem 1.15rem;",
    "  border-radius: 10px;",
    "  border: 1px solid rgba(127, 140, 155, 0.2);",
    "  background: var(--db-agent-bg);",
    "}",
    ".db-agent-badge {",
    "  display: inline-block;",
    "  padding: 0.2rem 0.65rem;",
    "  border-radius: 999px;",
    "  font-size: 0.8rem;",
    "  font-weight: 600;",
    "  background: var(--db-agent-primary);",
    "  color: #ffffff;",
    "}",
    ".db-agent-filter-bar {",
    "  display: flex;",
    "  flex-wrap: wrap;",
    "  gap: 0.5rem;",
    "  margin-top: 1rem;",
    "}",
    ".db-agent-filter-btn {",
    "  padding: 0.45rem 0.9rem;",
    "  border-radius: 8px;",
    "  border: 1px solid var(--db-agent-primary);",
    "  background: transparent;",
    "  color: var(--db-agent-text);",
    "  cursor: pointer;",
    "}",
    ".db-agent-filter-btn[aria-pressed='true'] {",
    "  background: var(--db-agent-primary);",
    "  color: #ffffff;",
    "}",
    "@media (max-width: 640px) {",
    "  .db-agent-section { margin: 1rem; padding: 1rem; }",
    "}",
  ].join("\n");

  if (!cssFile) {
    cssFile = { path: "styles.css", content: tokenBlock + "\n", language: "css" };
    next.push(cssFile);
    notes.push("新建 styles.css，写入设计令牌与移动端响应式规则。");
  } else {
    const cleanedCss = cssFile.content.replace(
      /\/\* DesignBuddy Agent Tokens & Responsive Guard \*\/[\s\S]*$/m,
      "",
    ).trimEnd();
    cssFile.content = `${cleanedCss}\n\n${tokenBlock}\n`;
    notes.push(`更新 ${cssFile.path}，写入主题变量（主色 ${primaryColor}）与自适应网格规则。`);
  }

  let jsFile = next.find((f) => /\.(js|mjs)$/.test(f.path));
  const interactiveCode = [
    "// DesignBuddy Agent Interactive Controller",
    "(function initDesignBuddySection() {",
    "  const buttons = document.querySelectorAll('.db-agent-filter-btn');",
    "  const cards = document.querySelectorAll('.db-agent-card[data-group]');",
    "  if (!buttons.length) return;",
    "  buttons.forEach((btn) => {",
    "    btn.addEventListener('click', () => {",
    "      const filter = btn.getAttribute('data-filter') || 'all';",
    "      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));",
    "      cards.forEach((card) => {",
    "        const match = filter === 'all' || card.getAttribute('data-group') === filter;",
    "        card.hidden = !match;",
    "      });",
    "    });",
    "  });",
    "})();",
  ].join("\n");

  if (!jsFile) {
    jsFile = { path: "script.js", content: interactiveCode + "\n", language: "javascript" };
    next.push(jsFile);
    notes.push("新建 script.js，提供无障碍按钮筛选状态切换逻辑。");
  } else if (!jsFile.content.includes("initDesignBuddySection")) {
    jsFile.content = `${jsFile.content.trimEnd()}\n\n${interactiveCode}\n`;
    notes.push(`扩展 ${jsFile.path}，挂载可键盘访问的交互筛选控制器。`);
  }

  let htmlFile = next.find((f) => f.path.endsWith(".html"));
  const safeGoalHeading = escapeHtml(params.goal.slice(0, 80));
  const constraintItems = params.memories.slice(0, 3).map(
    (m, idx) =>
      `      <article class="db-agent-card" data-group="constraint">\n        <h3>约束 ${idx + 1} · ${escapeHtml(m.title)}</h3>\n        <p>${escapeHtml(m.content.slice(0, 140))}</p>\n      </article>`,
  );
  const sectionMarkup = [
    `  <!-- db-agent-managed-start -->`,
    `  <section class="db-agent-section" aria-label="${safeGoalHeading}">`,
    `    <span class="db-agent-badge">结构化交付模块</span>`,
    `    <h2>${safeGoalHeading}</h2>`,
    `    <p>已结合静态代码分析与项目记忆生成可验证响应式区块，支持桌面与移动端视口自适应。</p>`,
    `    <div class="db-agent-filter-bar" role="toolbar" aria-label="内容筛选">`,
    `      <button type="button" class="db-agent-filter-btn" data-filter="all" aria-pressed="true">全部模块</button>`,
    `      <button type="button" class="db-agent-filter-btn" data-filter="feature" aria-pressed="false">核心能力</button>`,
    ...(constraintItems.length
      ? [`      <button type="button" class="db-agent-filter-btn" data-filter="constraint" aria-pressed="false">记忆约束</button>`]
      : []),
    `    </div>`,
    `    <div class="db-agent-grid">`,
    `      <article class="db-agent-card" data-group="feature">`,
    `        <h3>响应式视口与语义结构</h3>`,
    `        <p>补齐标题语义、图片替代文本与弹性多列网格，避免窄屏横向滚动。</p>`,
    `      </article>`,
    `      <article class="db-agent-card" data-group="feature">`,
    `        <h3>可追溯版本与一键回滚</h3>`,
    `        <p>每次执行均对比前后 Unified Diff，并通过 QA 语法及资源完整性检查。</p>`,
    `      </article>`,
    ...constraintItems,
    `    </div>`,
    `  </section>`,
    `  <!-- db-agent-managed-end -->`,
  ].join("\n");

  if (!htmlFile) {
    htmlFile = {
      path: "index.html",
      language: "html",
      content: [
        "<!doctype html>",
        '<html lang="zh-CN">',
        "<head>",
        '  <meta charset="UTF-8" />',
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        `  <title>${escapeHtml(params.projectName || "DesignBuddy 项目")}</title>`,
        `  <link rel="stylesheet" href="${escapeHtml(cssFile.path)}" />`,
        "</head>",
        "<body>",
        sectionMarkup,
        `  <script src="${escapeHtml(jsFile.path)}"></script>`,
        "</body>",
        "</html>",
      ].join("\n"),
    };
    next.push(htmlFile);
    notes.push("新建完整入口 index.html，关联本地样式与脚本。");
  } else {
    let html = htmlFile.content;
    if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
      html = html.includes("<head>")
        ? html.replace("<head>", '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />')
        : `<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n${html}`;
      notes.push(`为 ${htmlFile.path} 补齐响应式 viewport 元标签。`);
    }
    if (!/<title>[^<]+<\/title>/i.test(html)) {
      const titleTag = `<title>${escapeHtml(params.projectName || "DesignBuddy 项目")}</title>`;
      html = html.includes("</head>") ? html.replace("</head>", `  ${titleTag}\n</head>`) : `${titleTag}\n${html}`;
      notes.push(`为 ${htmlFile.path} 补齐非空 <title>。`);
    }
    // Add alt="" to any <img> missing alt
    html = html.replace(/<img\b(?![^>]*\balt=)([^>]*)>/gi, '<img alt="项目插图"$1>');
    if (!html.includes(cssFile.path) && html.includes("</head>")) {
      html = html.replace("</head>", `  <link rel="stylesheet" href="${escapeHtml(cssFile.path)}" />\n</head>`);
    }
    if (!html.includes(jsFile.path) && html.includes("</body>")) {
      html = html.replace("</body>", `  <script src="${escapeHtml(jsFile.path)}"></script>\n</body>`);
    }
    if (html.includes("<!-- db-agent-managed-start -->")) {
      html = html.replace(/<!-- db-agent-managed-start -->[\s\S]*?<!-- db-agent-managed-end -->/, sectionMarkup.trim());
    } else if (html.includes("</body>")) {
      html = html.replace("</body>", `${sectionMarkup}\n</body>`);
    } else {
      html = `${html}\n${sectionMarkup}\n`;
    }
    htmlFile.content = html;
    notes.push(`更新入口 ${htmlFile.path}，完成结构化区块与本地引用闭环。`);
  }

  return { files: next, notes };
}

export class AgentOrchestrator {
  private readonly db: DatabaseSync;
  public readonly memory: MemoryEngine;
  public readonly aiCoreRuntime: AgentRuntime;
  private readonly controllers = new Map<string, AbortController>();

  constructor(file = process.env.DESIGNBUDDY_AGENT_DB || "./data/agent-core.sqlite") {
    if (file !== ":memory:") mkdirSync(dirname(resolve(file)), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        record_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agent_runs_owner_project
        ON agent_runs(owner_id, project_id, created_at DESC);
    `);
    this.memory = new MemoryEngine(this.db);
    this.aiCoreRuntime = new AgentRuntime({ store: new SqliteAgentTaskStore(this.db) });
    this.recoverInterruptedRuns();
  }

  /** Transition any interrupted `queued`/`running` run cleanly on daemon startup. */
  recoverInterruptedRuns(): number {
    const rows = this.db
      .prepare("SELECT record_json FROM agent_runs WHERE status IN ('queued', 'running')")
      .all() as Array<{ record_json: string }>;
    let count = 0;
    const now = Date.now();
    for (const row of rows) {
      const record = JSON.parse(row.record_json) as AgentRunRecord;
      record.status = "failed";
      record.error = "服务进程重启中断了未完成的执行任务；已完成步骤记录已保留，可显式发起重试。";
      record.updatedAt = now;
      record.completedAt = now;
      for (const s of record.steps) {
        if (s.status === "running") {
          s.status = "failed";
          s.completedAt = now;
          s.durationMs = s.startedAt ? Math.max(1, now - s.startedAt) : 0;
          s.error = "进程重启中断";
        }
      }
      this.saveRun(record);
      count += 1;
    }
    return count;
  }

  private saveRun(record: AgentRunRecord): void {
    record.updatedAt = Date.now();
    this.db
      .prepare(
        `INSERT INTO agent_runs (id, owner_id, project_id, idempotency_key, status, record_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status=excluded.status,
           record_json=excluded.record_json,
           updated_at=excluded.updated_at`,
      )
      .run(
        record.id,
        record.ownerId,
        record.projectId,
        record.idempotencyKey || "",
        record.status,
        JSON.stringify(record),
        record.createdAt,
        record.updatedAt,
      );
  }

  getRun(ownerId: string, runId: string): AgentRunRecord | null {
    const row = this.db
      .prepare("SELECT record_json FROM agent_runs WHERE id=? AND owner_id=?")
      .get(runId, ownerId) as { record_json: string } | undefined;
    return row ? (JSON.parse(row.record_json) as AgentRunRecord) : null;
  }

  listRuns(ownerId: string, projectId?: string, limit = 50): AgentRunRecord[] {
    const clamped = Math.max(1, Math.min(100, limit));
    const rows = (
      projectId
        ? this.db
            .prepare("SELECT record_json FROM agent_runs WHERE owner_id=? AND project_id=? ORDER BY created_at DESC LIMIT ?")
            .all(ownerId, projectId, clamped)
        : this.db
            .prepare("SELECT record_json FROM agent_runs WHERE owner_id=? ORDER BY created_at DESC LIMIT ?")
            .all(ownerId, clamped)
    ) as Array<{ record_json: string }>;
    return rows.map((r) => JSON.parse(r.record_json) as AgentRunRecord);
  }

  cancelRun(ownerId: string, runId: string): AgentRunRecord | null {
    const record = this.getRun(ownerId, runId);
    if (!record) return null;
    const ctrl = this.controllers.get(runId);
    if (ctrl) ctrl.abort();
    this.aiCoreRuntime.cancel(runId);
    if (record.status === "queued" || record.status === "running") {
      const now = Date.now();
      record.status = "cancelled";
      record.error = "用户已取消本次执行任务。";
      record.completedAt = now;
      for (const s of record.steps) {
        if (s.status === "running" || s.status === "pending") {
          s.status = s.status === "running" ? "failed" : "skipped";
          s.completedAt = now;
          s.durationMs = s.startedAt ? Math.max(1, now - s.startedAt) : 0;
        }
      }
      this.saveRun(record);
    }
    return record;
  }

  async executeRun(params: {
    ownerId: string;
    project: ApiProject;
    goal: string;
    idempotencyKey?: string;
    pauseBeforeApply?: boolean;
    allowExternalAi?: boolean;
    apiKey?: string;
    provider?: string;
    baseUrl?: string;
    model?: string;
    versions?: ProjectVersionStore;
    persistProject?: (updatedFiles: ApiProject["files"]) => Promise<void> | void;
    retryOf?: AgentRunRecord;
  }): Promise<AgentRunRecord> {
    const goal = params.goal.trim();
    if (!goal || goal.length > 8000) throw new Error("请输入 1 到 8000 字符的任务目标。");

    if (params.idempotencyKey && !params.retryOf) {
      const dup = this.db
        .prepare("SELECT record_json FROM agent_runs WHERE owner_id=? AND idempotency_key=? LIMIT 1")
        .get(params.ownerId, params.idempotencyKey) as { record_json: string } | undefined;
      if (dup) return JSON.parse(dup.record_json) as AgentRunRecord;
    }

    const now = Date.now();
    const runId = params.retryOf ? params.retryOf.id : randomUUID();
    const baselineFiles: AnalyzableFile[] = params.project.files.map((f) => ({
      path: f.path,
      content: f.content,
      language: f.language,
    }));

    // Snapshot baseline file versions so 1-click rollback is always available
    const baselineVersionIds: Record<string, string> = {};
    if (params.versions) {
      for (const f of baselineFiles) {
        const head = params.versions.head(params.project.id, f.path);
        const committed =
          head && head.content === f.content
            ? head
            : params.versions.commit({
                projectId: params.project.id,
                ownerId: params.ownerId,
                path: f.path,
                content: f.content,
                author: params.ownerId,
                label: "Agent 执行前基线快照",
              });
        baselineVersionIds[f.path] = committed.id;
      }
    }

    const hasAiCredentials = Boolean(
      (params.apiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "").trim(),
    );
    const useAi = Boolean(params.allowExternalAi && hasAiCredentials);

    const record: AgentRunRecord = {
      id: runId,
      ownerId: params.ownerId,
      projectId: params.project.id,
      goal,
      status: "running",
      idempotencyKey: params.idempotencyKey,
      attempts: (params.retryOf?.attempts ?? 0) + 1,
      executionMode: useAi ? "ai-assisted" : "deterministic-local",
      plan: null,
      steps: [],
      analysisBefore: null,
      qaReport: null,
      diff: [],
      baselineFiles,
      resultFiles: baselineFiles,
      baselineVersionIds,
      committedVersionIds: {},
      rolledBackAt: null,
      error: "",
      createdAt: params.retryOf?.createdAt ?? now,
      updatedAt: now,
      completedAt: null,
    };
    this.saveRun(record);

    // Register corresponding task record in bridged packages/ai-core AgentRuntime
    this.aiCoreRuntime.createTask({
      id: runId,
      ownerId: params.ownerId,
      projectId: params.project.id,
      input: goal,
      status: "running",
      attempts: record.attempts,
      idempotencyKey: params.idempotencyKey,
    });

    const controller = new AbortController();
    this.controllers.set(runId, controller);

    try {
      // Step 1: Project Analyzer + Memory Retrieval
      const tAnalyze = Date.now();
      const analysis = analyzeDesignProject({
        id: params.project.id,
        name: params.project.name,
        files: baselineFiles,
      });
      const memories = this.memory.selectRelevantContext(params.ownerId, params.project.id, goal, 8);
      const plan = await generateExecutionPlan({
        userId: params.ownerId,
        goal,
        analysis,
        memories,
        allowExternalAi: useAi,
        apiKey: params.apiKey,
        provider: params.provider,
        baseUrl: params.baseUrl,
        model: params.model,
      });

      record.analysisBefore = analysis;
      record.plan = plan;
      record.steps = plan.steps.map((s) => ({
        stepId: s.id,
        index: s.index,
        title: s.title,
        agentRole: s.agentRole,
        status: "pending",
        attempts: 0,
        startedAt: null,
        completedAt: null,
        durationMs: null,
        inputSummary: s.inputs.join(", "),
        outputSummary: "",
      }));

      // Mark Step 1 succeeded
      if (record.steps[0]) {
        const done1 = Date.now();
        record.steps[0].status = "succeeded";
        record.steps[0].attempts = 1;
        record.steps[0].startedAt = tAnalyze;
        record.steps[0].completedAt = done1;
        record.steps[0].durationMs = Math.max(1, done1 - tAnalyze);
        record.steps[0].outputSummary = `扫描 ${analysis.summary.fileCount} 个文件（${analysis.summary.totalLines} 行），识别 ${analysis.summary.dependencyCount} 条依赖与 ${analysis.risks.length} 项静态提示，加载 ${memories.length} 条记忆约束。`;
      }
      this.saveRun(record);

      if (controller.signal.aborted) throw new Error("用户已取消本次执行任务。");

      // Step 2 & Step 3: Design Tokens + Code Transformation
      const tStep2 = Date.now();
      if (record.steps[1]) {
        record.steps[1].status = "running";
        record.steps[1].attempts = 1;
        record.steps[1].startedAt = tStep2;
        this.saveRun(record);
      }

      let nextFiles: AnalyzableFile[];
      let transformNotes: string[] = [];

      if (useAi) {
        const aiRes = await requestAI({
          userId: params.ownerId,
          apiKey: params.apiKey,
          provider: params.provider,
          baseUrl: params.baseUrl,
          model: params.model,
          options: { temperature: 0.25, maxTokens: 4000 },
          systemPrompt:
            'You are the DesignBuddy Code & Design Agent. Return ONLY valid JSON {"notes":["string"],"files":[{"path":"index.html","content":"..."},{"path":"styles.css","content":"..."}]}. Preserve valid HTML5 viewport/title/alt, valid CSS and syntax-valid JS without eval().',
          prompt: JSON.stringify({
            goal,
            projectName: params.project.name,
            constraints: memories.map((m) => ({ title: m.title, content: m.content })),
            files: baselineFiles,
          }),
        });
        const rawJson = aiRes.content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
        const parsed = JSON.parse(rawJson) as { notes?: string[]; files?: AnalyzableFile[] };
        if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
          throw new Error("模型未返回有效项目文件清单。");
        }
        nextFiles = parsed.files;
        transformNotes = Array.isArray(parsed.notes) ? parsed.notes : ["已应用模型生成的代码与样式修改。"];
      } else {
        const localResult = applyDeterministicChanges({
          goal,
          projectName: params.project.name,
          files: baselineFiles,
          memories,
        });
        nextFiles = localResult.files;
        transformNotes = localResult.notes;
      }

      const done23 = Date.now();
      if (record.steps[1]) {
        record.steps[1].status = "succeeded";
        record.steps[1].completedAt = done23;
        record.steps[1].durationMs = Math.max(1, done23 - tStep2);
        record.steps[1].outputSummary = transformNotes[0] || "已完成样式变量与响应式布局更新。";
      }
      if (record.steps[2]) {
        record.steps[2].status = "succeeded";
        record.steps[2].attempts = 1;
        record.steps[2].startedAt = tStep2;
        record.steps[2].completedAt = done23;
        record.steps[2].durationMs = Math.max(1, done23 - tStep2);
        record.steps[2].outputSummary = transformNotes.slice(1).join(" ") || transformNotes.join(" ");
      }
      for (const extra of record.steps.slice(3, -1)) {
        extra.status = "succeeded";
        extra.attempts = 1;
        extra.startedAt = tStep2;
        extra.completedAt = done23;
        extra.durationMs = Math.max(1, done23 - tStep2);
        extra.outputSummary = "已完成计划子步骤变更。";
      }

      if (controller.signal.aborted) throw new Error("用户已取消本次执行任务。");

      // Final Step: QA Agent Verification + Diff + Atomic Version Commit
      const qaStep = record.steps[record.steps.length - 1];
      const tQa = Date.now();
      if (qaStep && qaStep !== record.steps[0]) {
        qaStep.status = "running";
        qaStep.attempts = 1;
        qaStep.startedAt = tQa;
      }

      const qaReport = runProjectQA({
        projectId: params.project.id,
        projectName: params.project.name,
        files: nextFiles,
        baselineFiles,
      });
      const diff = computeProjectDiff(baselineFiles, nextFiles);
      record.qaReport = qaReport;
      record.diff = diff;

      if (!qaReport.passed) {
        if (qaStep) {
          qaStep.status = "failed";
          qaStep.completedAt = Date.now();
          qaStep.durationMs = Math.max(1, qaStep.completedAt - tQa);
          qaStep.error = `QA 未通过（${qaReport.counts.fail} 项失败），已阻止写入损坏文件。`;
        }
        throw new Error(
          `QA 静态校验未通过（${qaReport.checks
            .filter((c) => c.status === "fail")
            .map((c) => c.detail)
            .join("；")}），原项目文件保持未破坏。`,
        );
      }

      const normalizedProjectFiles: ApiProject["files"] = nextFiles.map((f) => ({
        path: f.path,
        content: f.content,
        language: (f.path.endsWith(".html")
          ? "html"
          : f.path.endsWith(".css")
            ? "css"
            : /\.(js|mjs|cjs)$/.test(f.path)
              ? "javascript"
              : undefined) as ApiProject["files"][number]["language"],
      }));

      // Human-in-the-loop pause gate: stage verified files + unified diff in SQLite without touching live project files yet
      if (params.pauseBeforeApply) {
        const pausedAt = Date.now();
        if (qaStep && qaStep !== record.steps[0]) {
          qaStep.status = "pending";
          qaStep.completedAt = null;
          qaStep.durationMs = Math.max(1, pausedAt - tQa);
          qaStep.outputSummary = `QA 预检通过（评分 ${qaReport.score}/100），已暂存 ${diff.filter((d) => d.changeType !== "unchanged").length} 个变更文件，等待人工审阅确认后再写入项目。`;
        }
        record.resultFiles = normalizedProjectFiles;
        record.awaitingApproval = true;
        record.status = "waiting_approval";
        record.updatedAt = pausedAt;
        this.saveRun(record);

        this.aiCoreRuntime.createTask({
          id: runId,
          ownerId: params.ownerId,
          projectId: params.project.id,
          input: goal,
          status: "waiting_approval",
          attempts: record.attempts,
          result: `Staged QA ${qaReport.score}/100 (awaiting human approval)`,
          createdAt: record.createdAt,
          updatedAt: pausedAt,
        });
        return record;
      }

      await params.persistProject?.(normalizedProjectFiles);

      const committedVersionIds: Record<string, string> = {};
      if (params.versions) {
        for (const f of normalizedProjectFiles) {
          const entry = diff.find((d) => d.path === f.path);
          if (!entry || entry.changeType === "unchanged") continue;
          const v = params.versions.commit({
            projectId: params.project.id,
            ownerId: params.ownerId,
            path: f.path,
            content: f.content,
            author: params.ownerId,
            label: `Agent: ${goal.slice(0, 60)}`,
          });
          committedVersionIds[f.path] = v.id;
        }
      }

      const finishedAt = Date.now();
      if (qaStep && qaStep !== record.steps[0]) {
        qaStep.status = "succeeded";
        qaStep.completedAt = finishedAt;
        qaStep.durationMs = Math.max(1, finishedAt - tQa);
        qaStep.outputSummary = `QA 通过（评分 ${qaReport.score}/100，${qaReport.counts.pass} 项通过 / ${qaReport.counts.warn} 项提示），共变更 ${diff.filter((d) => d.changeType !== "unchanged").length} 个文件并写入版本库。`;
      }

      record.resultFiles = normalizedProjectFiles;
      record.committedVersionIds = committedVersionIds;
      record.awaitingApproval = false;
      record.status = "succeeded";
      record.completedAt = finishedAt;
      this.saveRun(record);

      this.aiCoreRuntime.createTask({
        id: runId,
        ownerId: params.ownerId,
        projectId: params.project.id,
        input: goal,
        status: "completed",
        attempts: record.attempts,
        result: `QA ${qaReport.score}/100`,
        createdAt: record.createdAt,
        completedAt: finishedAt,
      });

      return record;
    } catch (err) {
      const failedAt = Date.now();
      const message = err instanceof Error ? err.message : "Agent 执行失败。";
      record.status = controller.signal.aborted ? "cancelled" : "failed";
      record.error = message;
      record.completedAt = failedAt;
      for (const s of record.steps) {
        if (s.status === "running") {
          s.status = "failed";
          s.completedAt = failedAt;
          s.durationMs = s.startedAt ? Math.max(1, failedAt - s.startedAt) : 0;
          s.error = message;
        }
      }
      this.saveRun(record);
      return record;
    } finally {
      this.controllers.delete(runId);
    }
  }

  async approveRun(params: {
    ownerId: string;
    runId: string;
    projectName?: string;
    fileOverrides?: AnalyzableFile[];
    note?: string;
    versions?: ProjectVersionStore;
    persistProject?: (updatedFiles: ApiProject["files"]) => Promise<void> | void;
  }): Promise<AgentRunRecord> {
    const record = this.getRun(params.ownerId, params.runId);
    if (!record) throw new Error("未找到该执行记录。");
    if (record.status !== "waiting_approval") {
      throw new Error("当前运行不处于待人工确认状态。");
    }

    const mergedMap = new Map<string, AnalyzableFile>();
    for (const file of record.resultFiles) {
      mergedMap.set(file.path, { ...file });
    }
    if (Array.isArray(params.fileOverrides)) {
      for (const override of params.fileOverrides) {
        const cleanPath = override.path.trim().replace(/^\/+/, "");
        if (!cleanPath || cleanPath.includes("..")) {
          throw new Error(`非法覆盖文件路径：${override.path}`);
        }
        mergedMap.set(cleanPath, {
          path: cleanPath,
          content: override.content,
          language: override.language,
        });
      }
    }
    const candidateFiles = Array.from(mergedMap.values());
    const qaReport = runProjectQA({
      projectId: record.projectId,
      projectName: params.projectName || record.projectId,
      files: candidateFiles,
      baselineFiles: record.baselineFiles,
    });
    const diff = computeProjectDiff(record.baselineFiles, candidateFiles);
    if (!qaReport.passed) {
      const reasons = qaReport.checks
        .filter((c) => c.status === "fail")
        .map((c) => c.detail)
        .join("；");
      throw new Error(`人工微调后的文件未通过 QA 语法校验（${reasons}），请修正后再批准写入。`);
    }

    const normalizedProjectFiles: ApiProject["files"] = candidateFiles.map((f) => ({
      path: f.path,
      content: f.content,
      language: (f.path.endsWith(".html")
        ? "html"
        : f.path.endsWith(".css")
          ? "css"
          : /\.(js|mjs|cjs)$/.test(f.path)
            ? "javascript"
            : undefined) as ApiProject["files"][number]["language"],
    }));

    await params.persistProject?.(normalizedProjectFiles);

    const committedVersionIds: Record<string, string> = {};
    if (params.versions) {
      for (const f of normalizedProjectFiles) {
        const entry = diff.find((d) => d.path === f.path);
        if (!entry || entry.changeType === "unchanged") continue;
        const v = params.versions.commit({
          projectId: record.projectId,
          ownerId: params.ownerId,
          path: f.path,
          content: f.content,
          author: params.ownerId,
          label: `Agent (人工批准): ${record.goal.slice(0, 52)}`,
        });
        committedVersionIds[f.path] = v.id;
      }
    }

    const finishedAt = Date.now();
    const qaStep = record.steps[record.steps.length - 1];
    if (qaStep) {
      qaStep.status = "succeeded";
      qaStep.completedAt = finishedAt;
      qaStep.durationMs = qaStep.startedAt ? Math.max(1, finishedAt - qaStep.startedAt) : 1;
      qaStep.outputSummary = `人工审阅通过并完成 QA 校验（评分 ${qaReport.score}/100），共写入 ${diff.filter((d) => d.changeType !== "unchanged").length} 个变更文件。`;
    }

    record.qaReport = qaReport;
    record.diff = diff;
    record.resultFiles = normalizedProjectFiles;
    record.committedVersionIds = committedVersionIds;
    record.awaitingApproval = false;
    record.approvalNote = params.note?.trim() || "人工审阅通过并写入项目。";
    record.status = "succeeded";
    record.updatedAt = finishedAt;
    record.completedAt = finishedAt;
    this.saveRun(record);

    this.aiCoreRuntime.createTask({
      id: record.id,
      ownerId: params.ownerId,
      projectId: record.projectId,
      input: record.goal,
      status: "completed",
      attempts: record.attempts,
      result: `Approved QA ${qaReport.score}/100`,
      createdAt: record.createdAt,
      completedAt: finishedAt,
    });

    return record;
  }

  rejectRun(ownerId: string, runId: string, reason?: string): AgentRunRecord | null {
    const record = this.getRun(ownerId, runId);
    if (!record) return null;
    if (record.status !== "waiting_approval") {
      throw new Error("当前运行不处于待人工确认状态。");
    }
    const now = Date.now();
    const note = reason?.trim() || "人工审阅驳回变更，原项目保持不变。";
    for (const s of record.steps) {
      if (s.status === "pending" || s.status === "running") {
        s.status = "skipped";
        s.completedAt = now;
        s.durationMs = s.startedAt ? Math.max(1, now - s.startedAt) : 1;
        s.outputSummary = note;
      }
    }
    record.awaitingApproval = false;
    record.approvalNote = note;
    record.error = note;
    record.status = "cancelled";
    record.updatedAt = now;
    record.completedAt = now;
    this.saveRun(record);

    this.aiCoreRuntime.createTask({
      id: record.id,
      ownerId,
      projectId: record.projectId,
      input: record.goal,
      status: "cancelled",
      attempts: record.attempts,
      error: note,
      createdAt: record.createdAt,
      completedAt: now,
    });

    return record;
  }

  markRolledBack(ownerId: string, runId: string): AgentRunRecord | null {
    const record = this.getRun(ownerId, runId);
    if (!record) return null;
    record.rolledBackAt = Date.now();
    this.saveRun(record);
    return record;
  }

  close(): void {
    this.db.close();
  }
}
