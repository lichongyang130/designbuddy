import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { runtimeCatalog } from "../skills/runtime-catalog";
import { skillPermissions } from "../skills/skill-permissions";
import type { SkillService } from "../skills/service";
import type { TaskBackend } from "./task-backend";
import type { AssetStore } from "./assets";
import type { SkillArtifact, SkillRun } from "../../shared/skillRuntime";

/**
 * Workflows: a fixed recipe that turns a few answers into a finished result.
 *
 * A workflow is not a new kind of automation. It is a named, versioned list of
 * steps that each call a **registered skill** through the real skill service,
 * so the permissions, the consent rules, the limits and the artifacts are the
 * ones the platform already enforces. A workflow never invents a result: a step
 * that cannot run says why.
 */
export type WorkflowFieldType = "text" | "textarea" | "choice" | "number" | "file" | "rows";

export type WorkflowField = {
  key: string;
  label: string;
  type: WorkflowFieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  default?: string;
  choices?: { value: string; label: string }[];
  /** Accepted file extensions for a file field. */
  accept?: string[];
  /** The columns of one repeated row. */
  columns?: { key: string; label: string; type: "text" | "number" }[];
  minRows?: number;
  maxRows?: number;
  /** Only show the field when another field has this value. */
  visibleWhen?: { field: string; equals: string };
};

export type WorkflowStep = {
  id: string;
  title: string;
  skill: string;
  expertId: string;
  /** Where the step gets its input from. */
  source:
    | { kind: "file"; field: string }
    | { kind: "form"; builder: string }
    | { kind: "artifact"; stepId: string; artifactName: string };
  /** Static skill parameters. */
  parameters?: Record<string, string>;
  /** The step may be skipped when it cannot run. */
  optional?: boolean;
  /** What the step delivers, in plain words. */
  outputs: string[];
};

export type Workflow = {
  id: string;
  version: string;
  name: string;
  goal: string;
  icon: string;
  /** Rough time in minutes, for the person deciding. */
  minutes: number;
  expertId: string;
  fields: WorkflowField[];
  steps: WorkflowStep[];
  outputs: string[];
  /** What the platform cannot obtain on its own. */
  requires: string[];
};

export type WorkflowStepAvailability = { ready: boolean; reason: string };

export type WorkflowStepRun = {
  id: string;
  title: string;
  skill: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped" | "unavailable";
  skillRunId?: string;
  summary?: string;
  error?: string;
  note?: string;
  outputs: SkillArtifact[];
  startedAt?: number;
  finishedAt?: number;
};

export type WorkflowRun = {
  id: string;
  ownerId: string;
  workflowId: string;
  workflowVersion: string;
  workflowName: string;
  status: "running" | "succeeded" | "failed" | "partial";
  steps: WorkflowStepRun[];
  taskId: string;
  createdAt: number;
  updatedAt: number;
  error?: string;
  /** The answers, without the file bytes. */
  inputs: {
    fields: Record<string, string>;
    rows: Record<string, Record<string, string>[]>;
    files: Record<string, { assetId: string; name: string }>;
  };
};

export class WorkflowInputError extends Error {}

/** The answers of one run. */
export type WorkflowInputs = {
  fields?: Record<string, unknown>;
  files?: Record<string, { assetId: string; name?: string }>;
};

const MAX_FIELD_LENGTH = 400;
const MAX_ROWS = 24;
const MAX_VALUE_LENGTH = 200;

/* ------------------------------------------------------------------ *
 * The built-in recipes.
 *
 * They only use skills that run locally today, so a person can finish a
 * task without any account, key or network access.
 * ------------------------------------------------------------------ */

export function builtinWorkflows(): Workflow[] {
  return [
    {
      id: "business-infographic",
      version: "1.0.0",
      name: "业务对比信息图",
      goal: "填几个数字，得到一张可交付的对比/趋势/构成信息图与计算说明",
      icon: "chart",
      minutes: 3,
      expertId: "infographics",
      requires: [],
      outputs: ["转曲 SVG", "实际渲染 PNG", "选图与来源 JSON"],
      fields: [
        { key: "title", label: "图表标题", type: "text", required: true, placeholder: "例如：9 月渠道收入对比" },
        {
          key: "purpose", label: "图表目的", type: "choice", required: true, default: "comparison",
          choices: [
            { value: "comparison", label: "比较：不同类别比高低" },
            { value: "trend", label: "趋势：按日期看变化" },
            { value: "composition", label: "构成：看各类别占比" },
          ],
          help: "程序只按你选的目的选图，不会替你猜业务口径。",
        },
        { key: "metric", label: "指标名", type: "text", required: true, placeholder: "例如：确认收入" },
        { key: "unit", label: "单位", type: "text", required: true, placeholder: "例如：万元" },
        { key: "scope", label: "统计口径", type: "textarea", required: true, placeholder: "例如：2026年9月已确认收入；各渠道采用相同记账口径" },
        { key: "source", label: "数据来源", type: "text", required: true, placeholder: "例如：财务系统导出（示例）" },
        {
          key: "rows", label: "数据点", type: "rows", required: true, minRows: 2, maxRows: 24,
          columns: [
            { key: "label", label: "类别或日期", type: "text" },
            { key: "value", label: "数值", type: "number" },
          ],
          help: "至少 2 条；趋势图的“类别”请填 YYYY-MM-DD 日期。",
        },
        {
          key: "compositionConfirmed", label: "构成确认", type: "choice", default: "no",
          choices: [
            { value: "no", label: "尚未确认" },
            { value: "yes", label: "我确认各类别互斥且覆盖上述总体" },
          ],
          visibleWhen: { field: "purpose", equals: "composition" },
          help: "构成图必须明确确认，程序不能替你验证业务事实。",
        },
      ],
      steps: [
        {
          id: "compose",
          title: "按目的选图并计算",
          skill: "infographic.compose",
          expertId: "infographics",
          source: { kind: "form", builder: "infographic" },
          outputs: ["转曲 SVG", "实际渲染 PNG", "选图/计算/来源 JSON"],
        },
      ],
    },
    {
      id: "faq-page",
      version: "1.0.0",
      name: "FAQ 帮助页",
      goal: "写好问答，生成可搜索、可筛选、可离线打开的静态帮助页",
      icon: "document",
      minutes: 3,
      expertId: "documents",
      requires: [],
      outputs: ["HTML 帮助页", "离线 ZIP", "生成报告 JSON"],
      fields: [
        { key: "title", label: "页面标题", type: "text", required: true, placeholder: "例如：活动报名帮助中心" },
        { key: "brand", label: "品牌或栏目名", type: "text", placeholder: "例如：社区活动" },
        { key: "intro", label: "页面说明", type: "textarea", placeholder: "例如：这里收集了报名与参与的全部常见问题。" },
        { key: "primary", label: "主色", type: "text", required: true, default: "#28634D", help: "六位十六进制颜色，例如 #28634D" },
        { key: "surface", label: "背景色", type: "text", required: true, default: "#F2F5F1" },
        { key: "text", label: "文字色", type: "text", required: true, default: "#24352D" },
        {
          key: "rows", label: "问答", type: "rows", required: true, minRows: 1, maxRows: MAX_ROWS,
          columns: [
            { key: "category", label: "类别", type: "text" },
            { key: "question", label: "问题", type: "text" },
            { key: "answer", label: "回答", type: "text" },
          ],
          help: "答案由你提供，程序不会核实或改写；页面搜索只匹配页面文本。",
        },
      ],
      steps: [
        {
          id: "page",
          title: "生成可搜索帮助页",
          skill: "faq.page",
          expertId: "documents",
          source: { kind: "form", builder: "faq" },
          outputs: ["HTML 帮助页", "离线 ZIP", "生成报告 JSON"],
        },
      ],
    },
    {
      id: "table-insights",
      version: "1.0.0",
      name: "表格清洗与统计",
      goal: "上传一份表格，得到清洗后的工作簿、数值统计与图表",
      icon: "grid",
      minutes: 2,
      expertId: "data",
      requires: [],
      outputs: ["XLSX 工作簿", "统计 JSON", "SVG 图表", "处理记录"],
      fields: [
        {
          key: "file", label: "表格文件", type: "file", required: true, accept: [".csv", ".xlsx"],
          help: "UTF-8 CSV 或无公式 XLSX；≤2 MB、5000 行、50 列。首行必须是唯一字段名。",
        },
      ],
      steps: [
        {
          id: "analyze",
          title: "清洗、统计并出图",
          skill: "table.analyze",
          expertId: "data",
          source: { kind: "file", field: "file" },
          outputs: ["XLSX 工作簿", "统计 JSON", "SVG 图表", "处理记录"],
        },
      ],
    },
    {
      id: "doc-brief",
      version: "1.0.0",
      name: "文档要点与成品",
      goal: "上传一份文档，整理成可编辑 DOCX 与 PDF，再提炼要点",
      icon: "document",
      minutes: 5,
      expertId: "documents",
      requires: ["AI_API_KEY 或 OPENAI_API_KEY（服务端配置，用于提炼要点）"],
      outputs: ["整理稿 DOCX", "内嵌字体 PDF", "来源段落 JSON", "要点摘要 Markdown（需要 AI 凭据）"],
      fields: [
        {
          key: "file", label: "源文档", type: "file", required: true, accept: [".docx", ".txt", ".md"],
          help: "≤2 MB、60000 字、1000 段落；DOCX 只处理主文档正文。",
        },
        {
          key: "externalConsent", label: "第三方模型授权", type: "choice", default: "",
          choices: [
            { value: "", label: "暂不授权：只整理格式，不提炼要点" },
            { value: "yes", label: "我单次同意把正文发送给服务端配置的第三方 AI 模型" },
          ],
          help: "没有授权时，提要这一步会被明确跳过并写明原因，不会用占位摘要代替。",
        },
      ],
      steps: [
        {
          id: "format",
          title: "整理成可编辑文档",
          skill: "document.format",
          expertId: "documents",
          source: { kind: "file", field: "file" },
          outputs: ["整理稿 DOCX", "内嵌字体 PDF", "来源段落 JSON"],
        },
        {
          id: "brief",
          title: "提炼要点（需要第三方模型授权）",
          skill: "document.summarize",
          expertId: "documents",
          source: { kind: "artifact", stepId: "format", artifactName: "organized.docx" },
          optional: true,
          parameters: { externalConsent: "{{externalConsent}}" },
          outputs: ["要点摘要 Markdown", "模型/输入哈希及限制 JSON"],
        },
      ],
    },
    {
      id: "doc-structure",
      version: "1.0.0",
      name: "文档结构提取",
      goal: "上传一份 DOCX，得到正文结构、表格与内嵌图片",
      icon: "document",
      minutes: 3,
      expertId: "documents",
      requires: [],
      outputs: ["正文结构 JSON/TXT", "结构预览 HTML", "含表格时的 XLSX", "含图片时的原图 ZIP"],
      fields: [
        {
          key: "file", label: "DOCX 文件", type: "file", required: true, accept: [".docx"],
          help: "≤2 MB、60000 字、2000 段落、30 表；只处理主文档正文。",
        },
      ],
      steps: [
        {
          id: "structure",
          title: "提取正文结构",
          skill: "document.structure",
          expertId: "documents",
          source: { kind: "file", field: "file" },
          outputs: ["正文结构 JSON/TXT", "结构预览 HTML", "含表格时的 XLSX", "含图片时的原图 ZIP"],
        },
      ],
    },
  ];
}

/** The builders turn the answers into the exact JSON a skill expects. */
const builders: Record<string, (values: Record<string, unknown>, rows: Record<string, string>[]) => unknown> = {
  infographic: (values, rows) => {
    const purpose = String(values.purpose ?? "comparison");
    const data = rows.map((row) => ({ label: row.label ?? "", value: row.value ?? "" }));
    const base = {
      title: String(values.title ?? ""),
      metric: String(values.metric ?? ""),
      unit: String(values.unit ?? ""),
      source: String(values.source ?? ""),
      scope: String(values.scope ?? ""),
      purpose,
      data,
    };
    return purpose === "composition" ? { ...base, compositionConfirmed: true } : base;
  },
  faq: (values, rows) => {
    const brand = String(values.brand ?? "").trim();
    const intro = String(values.intro ?? "").trim();
    return {
      title: String(values.title ?? ""),
      ...(brand ? { brand } : {}),
      ...(intro ? { intro } : {}),
      theme: {
        primary: String(values.primary ?? ""),
        surface: String(values.surface ?? ""),
        text: String(values.text ?? ""),
      },
      faqs: rows.map((row) => {
        const category = String(row.category ?? "").trim();
        return {
          ...(category ? { category } : {}),
          question: String(row.question ?? ""),
          answer: String(row.answer ?? ""),
        };
      }),
    };
  },
};

/**
 * Say exactly what is missing when a skill cannot run here.
 * The runtime catalogue puts the reason in front of the description, so the
 * person reading the run learns which credential or channel is missing.
 */
function unavailableReason(skill: { description: string }): string {
  const head = skill.description.split("。")[0]?.trim() ?? "";
  if (!head) return "该步骤所需的执行环境没有接通；没有用占位结果代替。";
  return `${head}；这一步没有执行，也没有生成结果。`;
}

/* ------------------------------------------------------------------ *
 * The catalogue: the recipes with the real availability of every step.
 * ------------------------------------------------------------------ */

export function workflowCatalog(): Array<Workflow & { steps: Array<WorkflowStep & { availability: WorkflowStepAvailability }> }> {
  const catalog = runtimeCatalog();
  return builtinWorkflows().map((workflow) => ({
    ...workflow,
    steps: workflow.steps.map((step) => {
      const skill = catalog.find((item) => item.id === step.skill);
      if (!skill) return { ...step, availability: { ready: false, reason: "技能未登记，无法执行。" } };
      if (skill.status !== "ready")
        return { ...step, availability: { ready: false, reason: unavailableReason(skill) } };
      return { ...step, availability: { ready: true, reason: "" } };
    }),
  }));
}

/* ------------------------------------------------------------------ *
 * The run store.
 * ------------------------------------------------------------------ */

export class WorkflowRunStore {
  private db: DatabaseSync;

  constructor(file = process.env.DESIGNBUDDY_WORKFLOWS_SQLITE_PATH || "./data/workflows.sqlite") {
    const path = resolve(file);
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS workflow_runs(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,workflow_id TEXT NOT NULL,record TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS workflow_runs_owner ON workflow_runs(owner_id, created_at DESC);`);
  }

  close() {
    this.db.close();
  }

  save(run: WorkflowRun) {
    this.db
      .prepare("INSERT INTO workflow_runs(id,owner_id,workflow_id,record,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record")
      .run(run.id, run.ownerId, run.workflowId, JSON.stringify(run), run.createdAt);
  }

  get(ownerId: string, id: string): WorkflowRun | null {
    const row = this.db.prepare("SELECT record FROM workflow_runs WHERE id=? AND owner_id=?").get(id, ownerId) as { record: string } | undefined;
    return row ? (JSON.parse(row.record) as WorkflowRun) : null;
  }

  list(ownerId: string): WorkflowRun[] {
    const rows = this.db
      .prepare("SELECT record FROM workflow_runs WHERE owner_id=? ORDER BY created_at DESC LIMIT 50")
      .all(ownerId) as { record: string }[];
    return rows.map((row) => JSON.parse(row.record) as WorkflowRun);
  }
}

/* ------------------------------------------------------------------ *
 * The engine: it runs the steps for real.
 * ------------------------------------------------------------------ */

const STEP_TIMEOUT_MS = Number(process.env.DESIGNBUDDY_WORKFLOW_STEP_TIMEOUT_MS || 180_000);
const POLL_INTERVAL_MS = 400;

export class WorkflowEngine {
  private running = new Set<string>();

  constructor(
    private skills: SkillService,
    private assets: AssetStore,
    private tasks: TaskBackend,
    private store: WorkflowRunStore = new WorkflowRunStore(),
  ) {}

  list(ownerId: string): WorkflowRun[] {
    return this.store.list(ownerId);
  }

  get(ownerId: string, runId: string): WorkflowRun | null {
    return this.store.get(ownerId, runId);
  }

  /**
   * Start a workflow. The answers are checked before anything runs, so a
   * missing field is reported instead of failing halfway through.
   */
  async start(ownerId: string, workflowId: string, inputs: WorkflowInputs): Promise<WorkflowRun> {
    const workflow = builtinWorkflows().find((item) => item.id === workflowId);
    if (!workflow) throw new WorkflowInputError("没有这条工作流。");
    const { fields, rows, files } = this.readInputs(workflow, inputs);
    for (const field of workflow.fields) {
      if (field.required && !this.hasValue(field, fields, rows, files)) {
        throw new WorkflowInputError(`请先填写「${field.label}」。`);
      }
    }
    const now = Date.now();
    const run: WorkflowRun = {
      id: randomUUID(),
      ownerId,
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      workflowName: workflow.name,
      status: "running",
      steps: workflow.steps.map((step) => ({
        id: step.id,
        title: step.title,
        skill: step.skill,
        status: "pending" as const,
        outputs: [],
      })),
      taskId: `workflow-${workflow.id}-${now.toString(36)}`,
      createdAt: now,
      updatedAt: now,
      inputs: { fields, rows, files },
    };
    this.store.save(run);
    this.tasks.saveTask(ownerId, {
      id: run.taskId,
      projectId: `workflow:${workflow.id}`,
      kind: "skill",
      title: `工作流 · ${workflow.name}`,
      status: "running",
      payload: JSON.stringify({ workflowId: workflow.id, runId: run.id, inputs: { fields, rows, files } }),
      summary: "已提交工作流，正在按步骤执行。",
    });
    void this.execute(ownerId, run.id);
    return run;
  }

  /** Run one step again after it failed. */
  async retryStep(ownerId: string, runId: string, stepId: string): Promise<WorkflowRun> {
    const run = this.store.get(ownerId, runId);
    if (!run) throw new WorkflowInputError("没有这次工作流运行记录。");
    const step = run.steps.find((item) => item.id === stepId);
    if (!step) throw new WorkflowInputError("没有这一步。");
    if (step.status === "running") throw new WorkflowInputError("这一步正在执行，不能重复提交。");
    step.status = "pending";
    step.error = undefined;
    step.skillRunId = undefined;
    step.outputs = [];
    run.status = "running";
    run.error = undefined;
    this.store.save(run);
    void this.execute(ownerId, run.id, stepId);
    return run;
  }

  /** Wait until the run is finished. Used by the tests and by the server. */
  async waitFor(ownerId: string, runId: string, timeoutMs = STEP_TIMEOUT_MS): Promise<WorkflowRun | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const run = this.store.get(ownerId, runId);
      if (!run) return null;
      if (run.status !== "running" || !this.running.has(runId)) return run;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    return this.store.get(ownerId, runId);
  }

  private readInputs(workflow: Workflow, inputs: WorkflowInputs) {
    const fields: Record<string, string> = {};
    const rows: Record<string, Record<string, string>[]> = {};
    const files: Record<string, { assetId: string; name: string }> = {};
    for (const field of workflow.fields) {
      if (field.type === "rows") {
        const value = inputs.fields?.[field.key];
        const list = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
        rows[field.key] = list.slice(0, field.maxRows ?? MAX_ROWS).map((item) => {
          const row: Record<string, string> = {};
          for (const column of field.columns ?? []) {
            const raw = item?.[column.key];
            row[column.key] = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.slice(0, MAX_VALUE_LENGTH) : "";
          }
          return row;
        });
        continue;
      }
      if (field.type === "file") {
        const value = inputs.files?.[field.key];
        if (value?.assetId) files[field.key] = { assetId: value.assetId, name: value.name ?? "" };
        continue;
      }
      const raw = inputs.fields?.[field.key];
      if (raw === undefined || raw === null) continue;
      fields[field.key] = String(raw).slice(0, MAX_FIELD_LENGTH);
    }
    return { fields, rows, files };
  }

  private hasValue(
    field: WorkflowField,
    fields: Record<string, string>,
    rows: Record<string, Record<string, string>[]>,
    files: Record<string, { assetId: string; name: string }>,
  ): boolean {
    if (field.type === "rows") {
      const list = rows[field.key] ?? [];
      const min = field.minRows ?? 1;
      if (list.length < min) return false;
      return list.every((row) => Object.values(row).some((value) => value.trim().length > 0));
    }
    if (field.type === "file") return Boolean(files[field.key]?.assetId);
    return (fields[field.key] ?? "").trim().length > 0;
  }

  /** Run the steps of a run, in order. */
  private async execute(ownerId: string, runId: string, onlyStep?: string) {
    if (this.running.has(runId)) return;
    this.running.add(runId);
    try {
      const run = this.store.get(ownerId, runId);
      if (!run) return;
      const workflow = builtinWorkflows().find((item) => item.id === run.workflowId);
      if (!workflow) return;
      for (const step of workflow.steps) {
        const record = run.steps.find((item) => item.id === step.id);
        if (!record) continue;
        if (onlyStep && step.id !== onlyStep) continue;
        if (record.status !== "pending") continue;
        await this.runStep(ownerId, run, workflow, step);
        this.store.save(run);
      }
      const succeeded = run.steps.filter((item) => item.status === "succeeded").length;
      const unfinished = run.steps.filter((item) => item.status === "failed" || item.status === "unavailable" || item.status === "skipped");
      // A step that was skipped or could not run is never reported as a full success.
      run.status = unfinished.length === 0 ? "succeeded" : succeeded > 0 ? "partial" : "failed";
      if (run.status !== "succeeded" && !run.error) {
        const reason = unfinished.find((item) => item.error)?.error;
        run.error = reason ?? "工作流没有全部完成。";
      }
      run.updatedAt = Date.now();
      this.store.save(run);
      this.tasks.saveTask(ownerId, {
        id: run.taskId,
        projectId: `workflow:${run.workflowId}`,
        kind: "skill",
        title: `工作流 · ${run.workflowName}`,
        status: run.status === "succeeded" ? "succeeded" : run.status === "failed" ? "failed" : "running",
        payload: JSON.stringify({ workflowId: run.workflowId, runId: run.id }),
        summary: run.status === "succeeded"
          ? `已完成 ${run.steps.filter((item) => item.status === "succeeded").length} 个步骤。`
          : run.error ?? "工作流没有全部完成。",
        error: run.status === "succeeded" ? "" : run.error ?? "",
      });
    } finally {
      this.running.delete(runId);
    }
  }

  /** Run one step for real through the skill service. */
  private async runStep(ownerId: string, run: WorkflowRun, workflow: Workflow, step: WorkflowStep) {
    const record = run.steps.find((item) => item.id === step.id)!;
    record.status = "running";
    record.startedAt = Date.now();
    this.store.save(run);

    const skill = runtimeCatalog().find((item) => item.id === step.skill);
    if (!skill) {
      record.status = "unavailable";
      record.error = "技能未登记，无法执行。";
      record.finishedAt = Date.now();
      return;
    }
    if (skill.status !== "ready") {
      record.status = "unavailable";
      record.error = unavailableReason(skill);
      record.note = skill.description.slice(0, 300);
      record.finishedAt = Date.now();
      return;
    }

    const parameters = this.resolveParameters(step, run);
    const needsExternalConsent = skillPermissions(step.skill).some((permission) => permission.startsWith("external."));
    if (needsExternalConsent && parameters.externalConsent !== "yes") {
      record.status = "skipped";
      record.error = "这一步要把内容发送给第三方服务，本次没有单次授权，因此没有执行，也没有生成结果。";
      record.finishedAt = Date.now();
      return;
    }
    let bytes: Uint8Array;
    let filename: string;
    try {
      if (step.source.kind === "file") {
        const file = run.inputs.files[step.source.field];
        if (!file) throw new WorkflowInputError("没有收到文件。");
        const asset = this.assets.get(file.assetId);
        if (!asset || asset.ownerId !== ownerId) throw new WorkflowInputError("找不到这份文件，或它不属于当前账号。");
        const content = this.assets.read(asset);
        if (!content) throw new WorkflowInputError("服务器上找不到这份文件的副本，请重新上传。");
        bytes = content;
        filename = asset.name;
      } else if (step.source.kind === "artifact") {
        const source = step.source;
        const previous = run.steps.find((item) => item.id === source.stepId);
        if (!previous?.skillRunId) throw new WorkflowInputError("上一步没有产物可用。");
        const artifact = previous.outputs.find((item) => item.name === source.artifactName);
        if (!artifact) throw new WorkflowInputError(`上一步没有产出「${step.source.artifactName}」。`);
        const response = await this.skills.handle(
          new Request(`http://local/api/skill-runs/${previous.skillRunId}/artifacts/${artifact.id}`),
          ownerId,
        );
        if (!response.ok) throw new WorkflowInputError("上一步的产物取不到。");
        bytes = new Uint8Array(await response.arrayBuffer());
        filename = artifact.name;
      } else {
        const builder = builders[step.source.builder];
        if (!builder) throw new WorkflowInputError("这一步的输入没有配置。");
        const rows = this.readRows(workflow, run);
        bytes = new TextEncoder().encode(JSON.stringify(builder(run.inputs.fields, rows), null, 2));
        filename = `${workflow.id}-${step.id}.json`;
      }
    } catch (cause) {
      record.status = step.optional ? "skipped" : "failed";
      record.error = cause instanceof Error ? cause.message : "准备输入失败。";
      record.finishedAt = Date.now();
      return;
    }

    const extension = /\.([a-z0-9]+)$/i.exec(filename)?.[0].toLowerCase() ?? "";
    if (!extension || !skill.accepts.includes(extension)) {
      record.status = step.optional ? "skipped" : "failed";
      record.error = `这一步不支持 ${extension || "这种文件"} 格式；支持的格式：${skill.accepts.join("、")}。`;
      record.finishedAt = Date.now();
      return;
    }

    try {
      const form = new FormData();
      form.set("skillId", step.skill);
      form.set("expertId", step.expertId);
      form.set("consent", "true");
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      form.set("file", new File([copy.buffer as ArrayBuffer], filename, { type: this.mimeFor(extension) }));
      if (Object.keys(parameters).length) form.set("parameters", JSON.stringify(parameters));
      const created = await this.skills.handle(new Request("http://local/api/skill-runs", { method: "POST", body: form }), ownerId);
      const body = (await created.json().catch(() => ({}))) as SkillRun & { error?: string };
      if (!created.ok || !body || typeof body.id !== "string") {
        record.status = step.optional ? "skipped" : "failed";
        record.error = body?.error ?? "步骤没有启动。";
        record.finishedAt = Date.now();
        return;
      }
      record.skillRunId = body.id;
      const finished = await this.waitForSkill(ownerId, body.id);
      record.finishedAt = Date.now();
      if (finished.status === "succeeded") {
        record.status = "succeeded";
        record.summary = finished.summary ?? "";
        record.outputs = finished.artifacts ?? [];
      } else {
        record.status = step.optional ? "skipped" : "failed";
        record.error = finished.error ?? "步骤没有完成。";
      }
    } catch (cause) {
      record.status = step.optional ? "skipped" : "failed";
      record.error = cause instanceof Error ? cause.message : "步骤执行失败。";
      record.finishedAt = Date.now();
    }
  }

  /** Fill the step parameters from the answers. `{{field}}` becomes the answer. */
  private resolveParameters(step: WorkflowStep, run: WorkflowRun): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, raw] of Object.entries(step.parameters ?? {})) {
      resolved[key] = raw.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, field) => run.inputs.fields[field] ?? "");
    }
    return resolved;
  }

  private readRows(workflow: Workflow, run: WorkflowRun): Record<string, string>[] {
    for (const field of workflow.fields) {
      if (field.type !== "rows") continue;
      const stored = run.inputs.rows?.[field.key];
      if (stored && stored.length) return stored;
    }
    return [];
  }

  /** Poll the skill run until it is finished. */
  private async waitForSkill(ownerId: string, skillRunId: string): Promise<SkillRun> {
    const deadline = Date.now() + STEP_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const response = await this.skills.handle(new Request(`http://local/api/skill-runs/${skillRunId}`), ownerId);
      const record = (await response.json().catch(() => ({}))) as SkillRun;
      if (!record || typeof record.status !== "string") break;
      if (["succeeded", "failed", "cancelled"].includes(record.status)) return record;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    return { status: "failed", error: "步骤超时，没有产出结果。" } as SkillRun;
  }

  private mimeFor(extension: string): string {
    if (extension === ".csv") return "text/csv";
    if (extension === ".json") return "application/json";
    if (extension === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (extension === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (extension === ".pdf") return "application/pdf";
    if (extension === ".txt" || extension === ".md") return "text/plain";
    if (extension === ".zip") return "application/zip";
    return "application/octet-stream";
  }
}
