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
export type WorkflowFieldType =
  | "text"
  | "textarea"
  | "choice"
  | "number"
  | "file"
  | "rows";

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
  /** Fail closed on a named real report; diagnostic artifacts remain downloadable. */
  qualityGate?: "html" | "css" | "javascript" | "project";
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
  status:
    | "pending"
    | "running"
    | "succeeded"
    | "failed"
    | "skipped"
    | "unavailable";
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
  /** Execution/automated checks are never commercial approval. Older records may lack this field. */
  delivery?: { classification:"draft"|"diagnostic"; automatedChecks:"running"|"passed"|"blocked"|"not-requested"; commercialAcceptance:"pending-human-review" };
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
  const recipes: Workflow[] = [
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
        {
          key: "title",
          label: "图表标题",
          type: "text",
          required: true,
          placeholder: "例如：9 月渠道收入对比",
        },
        {
          key: "purpose",
          label: "图表目的",
          type: "choice",
          required: true,
          default: "comparison",
          choices: [
            { value: "comparison", label: "比较：不同类别比高低" },
            { value: "trend", label: "趋势：按日期看变化" },
            { value: "composition", label: "构成：看各类别占比" },
          ],
          help: "程序只按你选的目的选图，不会替你猜业务口径。",
        },
        {
          key: "metric",
          label: "指标名",
          type: "text",
          required: true,
          placeholder: "例如：确认收入",
        },
        {
          key: "unit",
          label: "单位",
          type: "text",
          required: true,
          placeholder: "例如：万元",
        },
        {
          key: "scope",
          label: "统计口径",
          type: "textarea",
          required: true,
          placeholder: "例如：2026年9月已确认收入；各渠道采用相同记账口径",
        },
        {
          key: "source",
          label: "数据来源",
          type: "text",
          required: true,
          placeholder: "例如：财务系统导出（示例）",
        },
        {
          key: "rows",
          label: "数据点",
          type: "rows",
          required: true,
          minRows: 2,
          maxRows: 24,
          columns: [
            { key: "label", label: "类别或日期", type: "text" },
            { key: "value", label: "数值", type: "number" },
          ],
          help: "至少 2 条；趋势图的“类别”请填 YYYY-MM-DD 日期。",
        },
        {
          key: "compositionConfirmed",
          label: "构成确认",
          type: "choice",
          default: "no",
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
        {
          key: "title",
          label: "页面标题",
          type: "text",
          required: true,
          placeholder: "例如：活动报名帮助中心",
        },
        {
          key: "brand",
          label: "品牌或栏目名",
          type: "text",
          placeholder: "例如：社区活动",
        },
        {
          key: "intro",
          label: "页面说明",
          type: "textarea",
          placeholder: "例如：这里收集了报名与参与的全部常见问题。",
        },
        {
          key: "primary",
          label: "主色",
          type: "text",
          required: true,
          default: "#28634D",
          help: "六位十六进制颜色，例如 #28634D",
        },
        {
          key: "surface",
          label: "背景色",
          type: "text",
          required: true,
          default: "#F2F5F1",
        },
        {
          key: "text",
          label: "文字色",
          type: "text",
          required: true,
          default: "#24352D",
        },
        {
          key: "rows",
          label: "问答",
          type: "rows",
          required: true,
          minRows: 1,
          maxRows: MAX_ROWS,
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
          key: "file",
          label: "表格文件",
          type: "file",
          required: true,
          accept: [".csv", ".xlsx"],
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
      id: "landing-page",
      version: "1.0.0",
      name: "网页落地页",
      goal: "写清楚卖点，生成可部署的响应式静态站点（HTML/CSS/JS + ZIP）",
      icon: "code",
      minutes: 4,
      expertId: "web-design",
      requires: [],
      outputs: [
        "静态站点 ZIP",
        "index.html",
        "styles.css",
        "app.js",
        "生成报告 JSON",
      ],
      fields: [
        {
          key: "title",
          label: "站点名称",
          type: "text",
          required: true,
          placeholder: "例如：林间工作室",
        },
        {
          key: "description",
          label: "一句话介绍",
          type: "text",
          required: true,
          placeholder: "例如：为社区空间提供真实的导视与设计服务",
        },
        {
          key: "language",
          label: "页面语言",
          type: "text",
          required: true,
          default: "zh-CN",
          help: "简短语言代码，例如 zh-CN 或 en。",
        },
        {
          key: "primary",
          label: "主色",
          type: "text",
          required: true,
          default: "#335C4A",
        },
        {
          key: "surface",
          label: "背景色",
          type: "text",
          required: true,
          default: "#F5F4EF",
        },
        {
          key: "text",
          label: "文字色",
          type: "text",
          required: true,
          default: "#202720",
        },
        {
          key: "accent",
          label: "强调色",
          type: "text",
          required: true,
          default: "#D8774A",
        },
        {
          key: "heroTitle",
          label: "首屏标题",
          type: "text",
          required: true,
          placeholder: "例如：设计清晰的数字体验",
        },
        {
          key: "heroEyebrow",
          label: "首屏小标题",
          type: "text",
          placeholder: "例如：DESIGN STUDIO",
        },
        {
          key: "heroBody",
          label: "首屏说明",
          type: "textarea",
          required: true,
          placeholder: "介绍你实际提供的服务。",
        },
        {
          key: "heroButton",
          label: "首屏按钮文字",
          type: "text",
          required: true,
          placeholder: "例如：了解服务",
        },
        {
          key: "featuresTitle",
          label: "服务区块标题",
          type: "text",
          required: true,
          placeholder: "例如：服务项目",
        },
        {
          key: "rows",
          label: "服务条目",
          type: "rows",
          required: true,
          minRows: 1,
          maxRows: 12,
          columns: [
            { key: "title", label: "条目标题", type: "text" },
            { key: "body", label: "条目说明", type: "text" },
          ],
          help: "至少 1 条；每条都要有标题和说明。",
        },
        {
          key: "navFeatures",
          label: "导航：服务",
          type: "text",
          default: "服务",
        },
        {
          key: "contactTitle",
          label: "联系区块标题",
          type: "text",
          required: true,
          placeholder: "例如：联系我们",
        },
        {
          key: "contactBody",
          label: "联系说明",
          type: "textarea",
          required: true,
          placeholder: "请在此提供真实联系方式。",
        },
        {
          key: "contactEmail",
          label: "联系邮箱",
          type: "text",
          placeholder: "例如：studio@example.com",
        },
        {
          key: "navContact",
          label: "导航：联系",
          type: "text",
          default: "联系",
        },
      ],
      steps: [
        {
          id: "scaffold",
          title: "生成响应式静态站点",
          skill: "web.scaffold",
          expertId: "web-design",
          source: { kind: "form", builder: "landing" },
          outputs: [
            "静态站点 ZIP",
            "index.html",
            "styles.css",
            "app.js",
            "生成报告 JSON",
          ],
        },
      ],
    },
    {
      id: "social-card",
      version: "1.0.0",
      name: "社媒封面卡片",
      goal: "写好标题与要点，渲染一张 1080×1440 的 3:4 封面 PNG",
      icon: "palette",
      minutes: 2,
      expertId: "visual",
      requires: [],
      outputs: ["1080×1440 PNG 封面", "生成报告 JSON"],
      fields: [
        {
          key: "title",
          label: "主标题",
          type: "text",
          required: true,
          placeholder: "最多 30 字",
        },
        {
          key: "subtitle",
          label: "副标题",
          type: "text",
          placeholder: "最多 44 字",
        },
        {
          key: "category",
          label: "角标",
          type: "text",
          placeholder: "例如：设计笔记",
        },
        {
          key: "brand",
          label: "署名",
          type: "text",
          placeholder: "例如：林间工作室",
        },
        {
          key: "background",
          label: "背景色",
          type: "text",
          required: true,
          default: "#F4F1E9",
        },
        {
          key: "ink",
          label: "文字色",
          type: "text",
          required: true,
          default: "#264C3B",
        },
        {
          key: "accent",
          label: "强调色",
          type: "text",
          required: true,
          default: "#C96D42",
        },
        {
          key: "rows",
          label: "要点",
          type: "rows",
          required: true,
          minRows: 2,
          maxRows: 5,
          columns: [{ key: "point", label: "要点文字", type: "text" }],
          help: "2 至 5 条，每条最多 42 字；文案由你提供，程序不生成文案。",
        },
      ],
      steps: [
        {
          id: "card",
          title: "渲染封面卡片",
          skill: "social.card",
          expertId: "visual",
          source: { kind: "form", builder: "socialCard" },
          outputs: ["1080×1440 PNG 封面", "生成报告 JSON"],
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
      outputs: [
        "整理稿 DOCX",
        "内嵌字体 PDF",
        "来源段落 JSON",
        "要点摘要 Markdown（需要 AI 凭据）",
      ],
      fields: [
        {
          key: "file",
          label: "源文档",
          type: "file",
          required: true,
          accept: [".docx", ".txt", ".md"],
          help: "≤2 MB、60000 字、1000 段落；DOCX 只处理主文档正文。",
        },
        {
          key: "externalConsent",
          label: "第三方模型授权",
          type: "choice",
          default: "",
          choices: [
            { value: "", label: "暂不授权：只整理格式，不提炼要点" },
            {
              value: "yes",
              label: "我单次同意把正文发送给服务端配置的第三方 AI 模型",
            },
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
          source: {
            kind: "artifact",
            stepId: "format",
            artifactName: "organized.docx",
          },
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
      outputs: [
        "正文结构 JSON/TXT",
        "结构预览 HTML",
        "含表格时的 XLSX",
        "含图片时的原图 ZIP",
      ],
      fields: [
        {
          key: "file",
          label: "DOCX 文件",
          type: "file",
          required: true,
          accept: [".docx"],
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
          outputs: [
            "正文结构 JSON/TXT",
            "结构预览 HTML",
            "含表格时的 XLSX",
            "含图片时的原图 ZIP",
          ],
        },
      ],
    },
  ];
  const landing = recipes.find((recipe) => recipe.id === "landing-page")!;
  return [
    ...recipes,
    {
      id: "project-delivery",
      version: "1.0.0",
      name: "项目规格与验收交付",
      icon: "clock",
      minutes: 4,
      expertId: "product",
      goal: "填写真实目标和逐项验收条件，生成规格与覆盖报告，再自动检查交付 HTML。不是可行性审查、排期承诺或代发任务。",
      requires: ["真实范围、负责人和逐项验收口径；未提供的风险不视为不存在"],
      outputs: [
        "可编辑 Markdown / HTML",
        "需求验收覆盖 JSON",
        "HTML 静态检查报告",
      ],
      fields: [
        {
          key: "project",
          label: "项目名称",
          type: "text",
          required: true,
          help: "最多120字",
        },
        {
          key: "owner",
          label: "负责人",
          type: "text",
          help: "最多100字；未确定请留空，不编造",
        },
        { key: "problem", label: "实际问题", type: "textarea", required: true },
        {
          key: "goals",
          label: "项目目标",
          type: "textarea",
          required: true,
          help: "一行一项，每项最多300字",
        },
        {
          key: "nonGoals",
          label: "明确不做什么",
          type: "textarea",
          required: true,
          help: "一行一项，每项最多300字",
        },
        {
          key: "priority",
          label: "本批需求优先级",
          type: "choice",
          required: true,
          default: "should",
          choices: [
            { value: "must", label: "必须" },
            { value: "should", label: "应该" },
            { value: "could", label: "可选" },
          ],
        },
        {
          key: "rows",
          label: "需求与验收条件",
          type: "rows",
          required: true,
          minRows: 1,
          maxRows: 24,
          columns: [
            { key: "title", label: "需求描述", type: "text" },
            { key: "check", label: "怎样算完成", type: "text" },
          ],
          help: "每行两项都必填，程序只生成技术引用 R1 / A1，不猜业务内容；复杂依赖请使用本技能内的结构化规格场景。",
        },
        {
          key: "risk",
          label: "已知风险",
          type: "textarea",
          help: "可留空，但报告会标记风险待补充",
        },
        {
          key: "mitigation",
          label: "风险缓解措施",
          type: "textarea",
          help: "没确定请留空",
        },
        {
          key: "openQuestions",
          label: "待确认问题",
          type: "textarea",
          help: "一行一项；未提供会明确标记需要复核",
        },
      ],
      steps: [
        {
          id: "spec",
          title: "生成规格并核对验收覆盖",
          skill: "product.spec",
          expertId: "product",
          source: { kind: "form", builder: "project" },
          outputs: ["规格 Markdown / HTML", "需求与验收覆盖报告"],
          qualityGate: "project",
        },
        {
          id: "html",
          title: "检查规格 HTML",
          skill: "web.audit",
          expertId: "qa",
          source: {
            kind: "artifact",
            stepId: "spec",
            artifactName: "product-spec.html",
          },
          outputs: ["HTML 静态检查报告"],
          qualityGate: "html",
        },
      ],
    },
    {
      ...landing,
      id: "web-delivery",
      version: "1.0.0",
      name: "网页制作与静态质量交付",
      goal: "填写一次，实际制作站点并自动检查生成的 HTML、CSS 与 JavaScript；不是浏览器或上线验收。",
      outputs: [...landing.outputs, "HTML / CSS / JavaScript 静态报告"],
      steps: [
        ...landing.steps,
        {
          id: "html",
          title: "检查生成的 HTML",
          skill: "web.audit",
          expertId: "web-design",
          source: {
            kind: "artifact",
            stepId: "scaffold",
            artifactName: "index.html",
          },
          outputs: ["HTML 静态检查报告"],
          qualityGate: "html",
        },
        {
          id: "css",
          title: "检查生成的 CSS",
          skill: "web.css-audit",
          expertId: "web-design",
          source: {
            kind: "artifact",
            stepId: "scaffold",
            artifactName: "styles.css",
          },
          outputs: ["CSS 静态检查报告"],
          qualityGate: "css",
        },
        {
          id: "javascript",
          title: "检查生成的 JavaScript",
          skill: "code.inspect",
          expertId: "developer",
          source: {
            kind: "artifact",
            stepId: "scaffold",
            artifactName: "app.js",
          },
          outputs: ["JavaScript 静态检查报告"],
          qualityGate: "javascript",
        },
      ],
    },
    {
      id: "marketing-delivery",
      version: "1.0.0",
      name: "营销海报与网页图片交付",
      icon: "speaker",
      minutes: 3,
      expertId: "visual",
      goal: "用真实图片与文案制作两种比例海报，再将竖版海报自动生成 WebP 适配；不生成新图片，SVG 文字转曲。",
      requires: ["你有权使用的真实 PNG / JPEG / WebP 图片；核对两种版式与裁切"],
      outputs: [
        "方形和竖版 PNG / SVG",
        "多尺寸 WebP",
        "布局参数、来源及字体许可",
      ],
      fields: [
        {
          key: "file",
          label: "实际图片",
          type: "file",
          required: true,
          accept: [".png", ".jpg", ".jpeg", ".webp"],
        },
        {
          key: "title",
          label: "海报标题",
          type: "text",
          required: true,
          help: "最多36字",
        },
        { key: "subtitle", label: "副标题", type: "text", help: "最多80字" },
        { key: "action", label: "行动提示", type: "text", help: "最多16字" },
      ],
      steps: [
        {
          id: "poster",
          title: "制作两种比例的图文海报",
          skill: "image.marketing",
          expertId: "visual",
          source: { kind: "file", field: "file" },
          outputs: [
            "poster-square.png / .svg",
            "poster-portrait.png / .svg",
            "布局参数与字体许可",
          ],
        },
        {
          id: "web-images",
          title: "自动适配竖版海报到网页",
          skill: "image.web-pack",
          expertId: "visual",
          source: {
            kind: "artifact",
            stepId: "poster",
            artifactName: "poster-portrait.png",
          },
          outputs: ["多尺寸 WebP", "真实尺寸、来源与 srcset 示例"],
        },
      ],
    },
    {
      id: "brand-delivery",
      version: "1.0.0",
      name: "品牌系统与规范检查",
      icon: "palette",
      minutes: 3,
      expertId: "brand",
      goal: "从明确的品牌信息生成系列资产，再自动检查品牌 CSS 和规范 HTML。确定性品牌草案，不含商标或商业审定。",
      requires: ["品牌名称、文案及使用权确认；品牌负责人复核"],
      outputs: [
        "标志 SVG / PNG",
        "品牌规范 HTML / CSS / JSON",
        "静态检查与字体许可",
      ],
      fields: [
        {
          key: "brandName",
          label: "品牌名",
          type: "text",
          required: true,
          help: "最多32字",
        },
        {
          key: "description",
          label: "品牌简介",
          type: "textarea",
          required: true,
        },
        {
          key: "concept",
          label: "品牌理念",
          type: "textarea",
          required: true,
          help: "最多240字",
        },
        { key: "tagline", label: "品牌口号", type: "text", help: "最多60字" },
        {
          key: "voice",
          label: "表达语气",
          type: "text",
          required: true,
          help: "最多240字",
        },
        {
          key: "logoShape",
          label: "标志构形",
          type: "choice",
          required: true,
          default: "seed",
          choices: [
            { value: "seed", label: "种子" },
            { value: "orbit", label: "轨道" },
            { value: "spark", label: "星芒" },
          ],
        },
        {
          key: "primary",
          label: "主色",
          type: "text",
          required: true,
          default: "#294C3B",
        },
        {
          key: "secondary",
          label: "辅助色",
          type: "text",
          required: true,
          default: "#F4F1E9",
        },
        {
          key: "accent",
          label: "强调色",
          type: "text",
          required: true,
          default: "#D2744C",
        },
      ],
      steps: [
        {
          id: "brand",
          title: "生成统一品牌资产与规范",
          skill: "brand.system",
          expertId: "brand",
          source: { kind: "form", builder: "brand" },
          outputs: ["8份品牌资产、规范与许可"],
        },
        {
          id: "css",
          title: "检查品牌 CSS 变量",
          skill: "web.css-audit",
          expertId: "web-design",
          source: {
            kind: "artifact",
            stepId: "brand",
            artifactName: "brand-system.css",
          },
          outputs: ["CSS 静态检查报告"],
          qualityGate: "css",
        },
        {
          id: "html",
          title: "检查品牌规范 HTML",
          skill: "web.audit",
          expertId: "web-design",
          source: {
            kind: "artifact",
            stepId: "brand",
            artifactName: "brand-guidelines.html",
          },
          outputs: ["HTML 静态检查报告"],
          qualityGate: "html",
        },
      ],
    },
  ];
}

/** The builders turn the answers into the exact JSON a skill expects. */
const builders: Record<
  string,
  (values: Record<string, unknown>, rows: Record<string, string>[]) => unknown
> = {
  project: (values, rows) => {
    const lines = (value: unknown) =>
      String(value ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    if (rows.some((row) => !row.title?.trim() || !row.check?.trim()))
      throw new WorkflowInputError(
        "每项需求必须提供实际描述与验收条件，未生成规格。",
      );
    return {
      project: String(values.project ?? ""),
      owner: String(values.owner ?? ""),
      problem: String(values.problem ?? ""),
      goals: lines(values.goals),
      nonGoals: lines(values.nonGoals),
      requirements: rows.map((row, index) => ({
        id: `R${index + 1}`,
        title: row.title,
        priority: String(values.priority ?? "should"),
        dependsOn: [],
      })),
      acceptance: rows.map((row, index) => ({
        id: `A${index + 1}`,
        requirementId: `R${index + 1}`,
        check: row.check,
      })),
      risks: values.risk
        ? [
            {
              id: "K1",
              description: String(values.risk),
              mitigation: String(values.mitigation ?? ""),
            },
          ]
        : [],
      openQuestions: lines(values.openQuestions).length
        ? lines(values.openQuestions)
        : ["未提供待确认问题，请项目方复核，不能据此认定没有未知事项。"],
    };
  },
  brand: (values) => ({
    brandName: String(values.brandName ?? ""),
    description: String(values.description ?? ""),
    concept: String(values.concept ?? ""),
    tagline: String(values.tagline ?? ""),
    voice: String(values.voice ?? ""),
    logoShape: String(values.logoShape ?? "seed"),
    colors: [
      { name: "主色", role: "primary", hex: String(values.primary ?? "") },
      {
        name: "辅助色",
        role: "secondary",
        hex: String(values.secondary ?? ""),
      },
      { name: "强调色", role: "accent", hex: String(values.accent ?? "") },
    ],
  }),
  infographic: (values, rows) => {
    const purpose = String(values.purpose ?? "comparison");
    const data = rows.map((row) => ({
      label: row.label ?? "",
      value: row.value ?? "",
    }));
    const base = {
      title: String(values.title ?? ""),
      metric: String(values.metric ?? ""),
      unit: String(values.unit ?? ""),
      source: String(values.source ?? ""),
      scope: String(values.scope ?? ""),
      purpose,
      data,
    };
    return purpose === "composition"
      ? { ...base, compositionConfirmed: true }
      : base;
  },
  landing: (values, rows) => {
    const featuresTitle = String(values.featuresTitle ?? "");
    const contactTitle = String(values.contactTitle ?? "");
    const navigation: { label: string; section: string }[] = [];
    if (featuresTitle)
      navigation.push({
        label: String(values.navFeatures ?? "服务"),
        section: featuresTitle,
      });
    if (contactTitle)
      navigation.push({
        label: String(values.navContact ?? "联系"),
        section: contactTitle,
      });
    const email = String(values.contactEmail ?? "").trim();
    return {
      title: String(values.title ?? ""),
      description: String(values.description ?? ""),
      language: String(values.language ?? "zh-CN"),
      theme: {
        primary: String(values.primary ?? ""),
        surface: String(values.surface ?? ""),
        text: String(values.text ?? ""),
        accent: String(values.accent ?? ""),
      },
      navigation,
      sections: [
        {
          type: "hero",
          title: String(values.heroTitle ?? ""),
          eyebrow: String(values.heroEyebrow ?? ""),
          body: String(values.heroBody ?? ""),
          button: String(values.heroButton ?? ""),
        },
        {
          type: "features",
          title: featuresTitle,
          items: rows.map((row) => ({
            title: String(row.title ?? ""),
            body: String(row.body ?? ""),
          })),
        },
        {
          type: "contact",
          title: contactTitle,
          body: String(values.contactBody ?? ""),
          ...(email ? { email } : {}),
        },
      ],
    };
  },
  socialCard: (values, rows) => {
    const subtitle = String(values.subtitle ?? "").trim();
    const category = String(values.category ?? "").trim();
    const brand = String(values.brand ?? "").trim();
    return {
      title: String(values.title ?? ""),
      ...(subtitle ? { subtitle } : {}),
      ...(category ? { category } : {}),
      ...(brand ? { brand } : {}),
      points: rows.map((row) => String(row.point ?? "")),
      palette: {
        background: String(values.background ?? ""),
        ink: String(values.ink ?? ""),
        accent: String(values.accent ?? ""),
      },
    };
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

export function workflowCatalog(): Array<
  Workflow & {
    steps: Array<WorkflowStep & { availability: WorkflowStepAvailability }>;
  }
> {
  const catalog = runtimeCatalog();
  return builtinWorkflows().map((workflow) => ({
    ...workflow,
    steps: workflow.steps.map((step) => {
      const skill = catalog.find((item) => item.id === step.skill);
      if (!skill)
        return {
          ...step,
          availability: { ready: false, reason: "技能未登记，无法执行。" },
        };
      if (skill.status !== "ready")
        return {
          ...step,
          availability: { ready: false, reason: unavailableReason(skill) },
        };
      return { ...step, availability: { ready: true, reason: "" } };
    }),
  }));
}

/* ------------------------------------------------------------------ *
 * The run store.
 * ------------------------------------------------------------------ */

export class WorkflowRunStore {
  private db: DatabaseSync;

  constructor(
    file = process.env.DESIGNBUDDY_WORKFLOWS_SQLITE_PATH ||
      "./data/workflows.sqlite",
  ) {
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
      .prepare(
        "INSERT INTO workflow_runs(id,owner_id,workflow_id,record,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record",
      )
      .run(
        run.id,
        run.ownerId,
        run.workflowId,
        JSON.stringify(run),
        run.createdAt,
      );
  }

  get(ownerId: string, id: string): WorkflowRun | null {
    const row = this.db
      .prepare("SELECT record FROM workflow_runs WHERE id=? AND owner_id=?")
      .get(id, ownerId) as { record: string } | undefined;
    return row ? (JSON.parse(row.record) as WorkflowRun) : null;
  }

  list(ownerId: string): WorkflowRun[] {
    const rows = this.db
      .prepare(
        "SELECT record FROM workflow_runs WHERE owner_id=? ORDER BY created_at DESC LIMIT 50",
      )
      .all(ownerId) as { record: string }[];
    return rows.map((row) => JSON.parse(row.record) as WorkflowRun);
  }
}

/* ------------------------------------------------------------------ *
 * The engine: it runs the steps for real.
 * ------------------------------------------------------------------ */

const STEP_TIMEOUT_MS = Number(
  process.env.DESIGNBUDDY_WORKFLOW_STEP_TIMEOUT_MS || 180_000,
);
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
  async start(
    ownerId: string,
    workflowId: string,
    inputs: WorkflowInputs,
  ): Promise<WorkflowRun> {
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
      taskId: `workflow-${workflow.id}-${randomUUID()}`,
      createdAt: now,
      updatedAt: now,
      inputs: { fields, rows, files },
      delivery:{classification:"draft",automatedChecks:workflow.steps.some(step=>step.qualityGate)?"running":"not-requested",commercialAcceptance:"pending-human-review"},
    };
    this.store.save(run);
    this.tasks.saveTask(ownerId, {
      id: run.taskId,
      projectId: `workflow:${workflow.id}`,
      kind: "skill",
      title: `工作流 · ${workflow.name}`,
      status: "running",
      payload: JSON.stringify({
        workflowId: workflow.id,
        runId: run.id,
        inputs: { fields, rows, files },
      }),
      summary: "已提交工作流，正在按步骤执行。",
    });
    void this.execute(ownerId, run.id);
    return run;
  }

  /** Run one step again after it failed. */
  async retryStep(
    ownerId: string,
    runId: string,
    stepId: string,
  ): Promise<WorkflowRun> {
    const run = this.store.get(ownerId, runId);
    if (!run) throw new WorkflowInputError("没有这次工作流运行记录。");
    const step = run.steps.find((item) => item.id === stepId);
    if (!step) throw new WorkflowInputError("没有这一步。");
    if (run.status === "running" || this.running.has(runId))
      throw new WorkflowInputError("流程正在执行，不能同时重试工序。");
    const workflow = builtinWorkflows().find(
      (item) => item.id === run.workflowId,
    );
    if (!workflow || workflow.version !== run.workflowVersion)
      throw new WorkflowInputError("流程版本不匹配，请保留历史并创建新任务。");
    // Invalidate the full dependency closure, not unrelated sibling checks.
    const reset = new Set([stepId]);
    for (const candidate of workflow.steps)
      if (
        candidate.source.kind === "artifact" &&
        reset.has(candidate.source.stepId)
      )
        reset.add(candidate.id);
    for (const record of run.steps)
      if (reset.has(record.id)) {
        record.status = "pending";
        record.error = undefined;
        record.note = undefined;
        record.summary = undefined;
        record.skillRunId = undefined;
        record.outputs = [];
        record.startedAt = undefined;
        record.finishedAt = undefined;
      }
    run.status = "running";
    if(run.delivery)run.delivery.automatedChecks="running";
    run.error = undefined;
    this.store.save(run);
    // The retried step runs first, the steps that were still waiting continue
    // after it, so a run can be continued instead of restarted.
    void this.execute(ownerId, run.id);
    return run;
  }

  /** Wait until the run is finished. Used by the tests and by the server. */
  async waitFor(
    ownerId: string,
    runId: string,
    timeoutMs = STEP_TIMEOUT_MS,
  ): Promise<WorkflowRun | null> {
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
        const list = Array.isArray(value)
          ? (value as Record<string, unknown>[])
          : [];
        if (list.length > (field.maxRows ?? MAX_ROWS))
          throw new WorkflowInputError(
            `「${field.label}」行数超限，未截断或执行。`,
          );
        rows[field.key] = list.map((item) => {
          const row: Record<string, string> = {};
          for (const column of field.columns ?? []) {
            const raw = item?.[column.key];
            if (typeof raw === "string" && raw.length > MAX_VALUE_LENGTH)
              throw new WorkflowInputError(
                `「${field.label} / ${column.label}」超过${MAX_VALUE_LENGTH}字，未截断或执行。`,
              );
            row[column.key] =
              typeof raw === "number"
                ? String(raw)
                : typeof raw === "string"
                  ? raw
                  : "";
          }
          return row;
        });
        continue;
      }
      if (field.type === "file") {
        const value = inputs.files?.[field.key];
        if (value?.assetId)
          files[field.key] = { assetId: value.assetId, name: value.name ?? "" };
        continue;
      }
      const raw = inputs.fields?.[field.key];
      if (raw === undefined || raw === null) continue;
      if (typeof raw !== "string" && typeof raw !== "number")
        throw new WorkflowInputError(`「${field.label}」需要文本。`);
      if (String(raw).length > MAX_FIELD_LENGTH)
        throw new WorkflowInputError(
          `「${field.label}」超过${MAX_FIELD_LENGTH}字，未截断或执行。`,
        );
      if (
        field.type === "choice" &&
        field.choices &&
        !field.choices.some((choice) => choice.value === String(raw))
      )
        throw new WorkflowInputError(`「${field.label}」选项无效。`);
      fields[field.key] = String(raw);
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
      return list.every((row) =>
        Object.values(row).some((value) => value.trim().length > 0),
      );
    }
    if (field.type === "file") return Boolean(files[field.key]?.assetId);
    return (fields[field.key] ?? "").trim().length > 0;
  }

  /** Run the steps of a run, in order. */
  private async execute(ownerId: string, runId: string) {
    if (this.running.has(runId)) return;
    this.running.add(runId);
    try {
      const run = this.store.get(ownerId, runId);
      if (!run) return;
      const workflow = builtinWorkflows().find(
        (item) => item.id === run.workflowId,
      );
      if (!workflow) return;
      for (const step of workflow.steps) {
        const record = run.steps.find((item) => item.id === step.id);
        if (!record) continue;
        if (record.status !== "pending") continue;
        await this.runStep(ownerId, run, workflow, step);
        this.store.save(run);
      }
      const succeeded = run.steps.filter(
        (item) => item.status === "succeeded",
      ).length;
      const unfinished = run.steps.filter(
        (item) =>
          item.status === "failed" ||
          item.status === "unavailable" ||
          item.status === "skipped",
      );
      // A step that was skipped or could not run is never reported as a full success.
      run.status =
        unfinished.length === 0
          ? "succeeded"
          : succeeded > 0
            ? "partial"
            : "failed";
      const gates=workflow.steps.filter(step=>step.qualityGate);
      run.delivery={classification:run.status==="succeeded"?"draft":"diagnostic",automatedChecks:gates.length?(gates.every(step=>run.steps.find(record=>record.id===step.id)?.status==="succeeded")?"passed":"blocked"):"not-requested",commercialAcceptance:"pending-human-review"};
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
        status: run.status === "succeeded" ? "succeeded" : "failed",
        payload: JSON.stringify({ workflowId: run.workflowId, runId: run.id }),
        summary:
          run.status === "succeeded"
            ? `已完成 ${run.steps.filter((item) => item.status === "succeeded").length} 个步骤。`
            : (run.error ?? "工作流没有全部完成。"),
        error: run.status === "succeeded" ? "" : (run.error ?? ""),
      });
    } finally {
      this.running.delete(runId);
    }
  }

  /** Run one step for real through the skill service. */
  private async runStep(
    ownerId: string,
    run: WorkflowRun,
    workflow: Workflow,
    step: WorkflowStep,
  ) {
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
    const needsExternalConsent = skillPermissions(step.skill).some(
      (permission) => permission.startsWith("external."),
    );
    if (needsExternalConsent && parameters.externalConsent !== "yes") {
      record.status = "skipped";
      record.error =
        "这一步要把内容发送给第三方服务，本次没有单次授权，因此没有执行，也没有生成结果。";
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
        if (!asset || asset.ownerId !== ownerId)
          throw new WorkflowInputError("找不到这份文件，或它不属于当前账号。");
        const content = this.assets.read(asset);
        if (!content)
          throw new WorkflowInputError(
            "服务器上找不到这份文件的副本，请重新上传。",
          );
        bytes = content;
        filename = asset.name;
      } else if (step.source.kind === "artifact") {
        const source = step.source;
        const previous = run.steps.find((item) => item.id === source.stepId);
        if (previous?.status !== "succeeded" || !previous.skillRunId)
          throw new WorkflowInputError("上一步没有产物可用。");
        const artifact = previous.outputs.find(
          (item) => item.name === source.artifactName,
        );
        if (!artifact)
          throw new WorkflowInputError(
            `上一步没有产出「${step.source.artifactName}」。`,
          );
        const response = await this.skills.handle(
          new Request(
            `http://local/api/skill-runs/${previous.skillRunId}/artifacts/${artifact.id}`,
          ),
          ownerId,
        );
        if (!response.ok) throw new WorkflowInputError("上一步的产物取不到。");
        bytes = new Uint8Array(await response.arrayBuffer());
        filename = artifact.name;
      } else {
        const builder = builders[step.source.builder];
        if (!builder) throw new WorkflowInputError("这一步的输入没有配置。");
        const rows = this.readRows(workflow, run);
        bytes = new TextEncoder().encode(
          JSON.stringify(builder(run.inputs.fields, rows), null, 2),
        );
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
      form.set(
        "file",
        new File([copy.buffer as ArrayBuffer], filename, {
          type: this.mimeFor(extension),
        }),
      );
      if (Object.keys(parameters).length)
        form.set("parameters", JSON.stringify(parameters));
      if (step.skill === "image.marketing")
        form.set(
          "parameters",
          JSON.stringify({
            title: run.inputs.fields.title ?? "",
            subtitle: run.inputs.fields.subtitle ?? "",
            action: run.inputs.fields.action ?? "",
          }),
        );
      const created = await this.skills.handle(
        new Request("http://local/api/skill-runs", {
          method: "POST",
          body: form,
        }),
        ownerId,
      );
      const body = (await created.json().catch(() => ({}))) as SkillRun & {
        error?: string;
      };
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
        if (step.qualityGate) {
          const name = {
            html: "html-audit.json",
            css: "css-audit.json",
            javascript: "javascript-report.json",
            project: "product-spec-report.json",
          }[step.qualityGate];
          const artifact = record.outputs.find((item) => item.name === name);
          if (!artifact)
            throw new WorkflowInputError(
              `缺少质量报告 ${name}，不能认定静态门槛通过。`,
            );
          const response = await this.skills.handle(
            new Request(
              `http://local/api/skill-runs/${body.id}/artifacts/${artifact.id}`,
            ),
            ownerId,
          );
          if (!response.ok)
            throw new WorkflowInputError("质量报告无法读取，不能认定通过。");
          const report: unknown = await response.json();
          const verdict = evaluateWorkflowQuality(step.qualityGate, report);
          record.note = verdict.message;
          if (!verdict.passed) {
            record.status = "failed";
            record.error = verdict.message;
          }
        }
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
  private resolveParameters(
    step: WorkflowStep,
    run: WorkflowRun,
  ): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, raw] of Object.entries(step.parameters ?? {})) {
      resolved[key] = raw.replace(
        /\{\{([a-zA-Z0-9_]+)\}\}/g,
        (_match, field) => run.inputs.fields[field] ?? "",
      );
    }
    return resolved;
  }

  private readRows(
    workflow: Workflow,
    run: WorkflowRun,
  ): Record<string, string>[] {
    for (const field of workflow.fields) {
      if (field.type !== "rows") continue;
      const stored = run.inputs.rows?.[field.key];
      if (stored && stored.length) return stored;
    }
    return [];
  }

  /** Poll the skill run until it is finished. */
  private async waitForSkill(
    ownerId: string,
    skillRunId: string,
  ): Promise<SkillRun> {
    const deadline = Date.now() + STEP_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const response = await this.skills.handle(
        new Request(`http://local/api/skill-runs/${skillRunId}`),
        ownerId,
      );
      const record = (await response.json().catch(() => ({}))) as SkillRun;
      if (!record || typeof record.status !== "string") break;
      if (["succeeded", "failed", "cancelled"].includes(record.status))
        return record;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    return { status: "failed", error: "步骤超时，没有产出结果。" } as SkillRun;
  }

  private mimeFor(extension: string): string {
    if (extension === ".csv") return "text/csv";
    if (extension === ".json") return "application/json";
    if (extension === ".xlsx")
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (extension === ".docx")
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (extension === ".pdf") return "application/pdf";
    if (extension === ".txt" || extension === ".md") return "text/plain";
    if (extension === ".zip") return "application/zip";
    return "application/octet-stream";
  }
}

/** Narrow static gates, never a claim of commercial/browser approval. */
export function evaluateWorkflowQuality(
  gate: "html" | "css" | "javascript" | "project",
  value: unknown,
): { passed: boolean; message: string } {
  if (gate === "project") {
    const report = value as {
      uncoveredRequirements?: unknown[];
      requirementCount?: number;
      acceptanceCount?: number;
      warnings?: unknown[];
    } | null;
    const passed =
      !!report &&
      Array.isArray(report.uncoveredRequirements) &&
      report.uncoveredRequirements.length === 0 &&
      Number.isSafeInteger(report.requirementCount) &&
      (report.requirementCount ?? 0) > 0 &&
      Number.isSafeInteger(report.acceptanceCount) &&
      (report.acceptanceCount ?? 0) > 0 &&
      Array.isArray(report.warnings);
    return {
      passed,
      message: passed
        ? `结构与逐项验收引用未发现阻断；另有 ${report!.warnings!.length} 项待补充。未做业务语义、可行性或商业验收。`
        : "缺少有效验收覆盖报告或有未覆盖需求，仅交付诊断草稿。",
    };
  }
  const report = value as {
    findings?: { severity?: string }[];
    syntaxValid?: boolean;
    truncated?: boolean;
  } | null;
  if (
    !report ||
    !Array.isArray(report.findings) ||
    report.truncated === true ||
    report.findings.some((f) => !f || typeof f !== "object")
  )
    return {
      passed: false,
      message:
        "静态质量报告缺失、不完整或被截断，需要人工复核；未通过交付门槛。",
    };
  if (gate !== "html" && typeof report.syntaxValid !== "boolean")
    return { passed: false, message: "静态报告缺少语法结果，不能认定通过。" };
  const failures =
    gate === "html"
      ? report.findings.length
      : report.findings.filter(
          (f) =>
            gate === "javascript" ||
            (f.severity !== "info" && f.severity !== "warning"),
        ).length;
  const passed =
    (gate === "html" || report.syntaxValid === true) && failures === 0;
  return {
    passed,
    message: passed
      ? `已实现的静态门槛未发现阻断；保留 ${report.findings.length} 条提示。未做浏览器或商业验收。`
      : `静态质量门槛未通过（${failures} 项问题或语法错误）；仅保留诊断草稿和报告，修复后复测。`,
  };
}
