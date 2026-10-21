import { requestAI } from "../api/ai";
import type { ProjectAnalysisReport } from "./analyzer";
import type { MemoryRecord } from "./memory-engine";

export type PlanAgentRole = "analyzer" | "planner" | "designer" | "coder" | "qa";
export type FailurePolicy = "abort" | "retry_once" | "fallback_report";

export interface PlanStep {
  id: string;
  index: number;
  title: string;
  agentRole: PlanAgentRole;
  dependsOn: string[];
  inputs: string[];
  expectedOutputs: string[];
  targetFiles: string[];
  acceptanceCriteria: string[];
  failurePolicy: FailurePolicy;
}

export interface ExecutionPlan {
  id: string;
  goal: string;
  mode: "deterministic-local" | "ai-verified";
  rationale: string;
  constraintsApplied: Array<{ id: string; title: string; category: string }>;
  steps: PlanStep[];
  createdAt: number;
}

/** Verify steps form a non-empty valid DAG without unknown dependencies or cycles. */
export function validatePlanDag(steps: PlanStep[]): string | null {
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 12) {
    return "计划步骤数量必须在 1 到 12 步之间。";
  }
  const seen = new Set<string>();
  for (const step of steps) {
    if (!step.id || seen.has(step.id)) return `步骤 ID 无效或重复：${step.id}`;
    if (!step.title?.trim()) return `步骤 ${step.id} 缺少标题。`;
    if (!Array.isArray(step.acceptanceCriteria) || step.acceptanceCriteria.length === 0) {
      return `步骤 ${step.id} 缺少可验证的验收条件。`;
    }
    seen.add(step.id);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const map = new Map(steps.map((s) => [s.id, s]));

  const visit = (id: string): string | null => {
    if (visited.has(id)) return null;
    if (visiting.has(id)) return `计划步骤存在循环依赖：${id}`;
    const step = map.get(id);
    if (!step) return `计划步骤引用了不存在的前置步骤：${id}`;
    visiting.add(id);
    for (const dep of step.dependsOn) {
      const err = visit(dep);
      if (err) return err;
    }
    visiting.delete(id);
    visited.add(id);
    return null;
  };

  for (const s of steps) {
    const err = visit(s.id);
    if (err) return err;
  }
  return null;
}

function inferIntentTargets(goal: string, analysis: ProjectAnalysisReport): {
  htmlTargets: string[];
  cssTargets: string[];
  jsTargets: string[];
  needsInteractiveScript: boolean;
  needsVisualTokens: boolean;
} {
  const htmlTargets = analysis.files.filter((f) => f.role === "entry").map((f) => f.path);
  const cssTargets = analysis.files.filter((f) => f.role === "style").map((f) => f.path);
  const jsTargets = analysis.files.filter((f) => f.role === "script").map((f) => f.path);
  const lower = goal.toLowerCase();
  const needsInteractiveScript = /交互|筛选|搜索|切换|表单|计数|折叠|faq|tab|modal|按钮|点击|状态/.test(lower);
  const needsVisualTokens = /主题|配色|颜色|深色|暗色|字体|间距|样式|卡片|响应式|布局|hero|对比|视觉/.test(lower) || cssTargets.length > 0;
  return {
    htmlTargets: htmlTargets.length ? htmlTargets : ["index.html"],
    cssTargets: cssTargets.length ? cssTargets : ["styles.css"],
    jsTargets: jsTargets.length ? jsTargets : ["script.js"],
    needsInteractiveScript,
    needsVisualTokens,
  };
}

export function buildDeterministicPlan(
  goal: string,
  analysis: ProjectAnalysisReport,
  memories: MemoryRecord[],
): ExecutionPlan {
  const trimmedGoal = goal.trim();
  const targets = inferIntentTargets(trimmedGoal, analysis);
  const memorySummary = memories.map((m) => ({ id: m.id, title: m.title, category: m.category }));
  const stepList: PlanStep[] = [
    {
      id: "step-analyze",
      index: 1,
      title: "静态结构与风险基线分析",
      agentRole: "analyzer",
      dependsOn: [],
      inputs: analysis.files.map((f) => f.path),
      expectedOutputs: ["文件依赖拓扑图", "未解析引用清单", "基线风险报告"],
      targetFiles: analysis.files.map((f) => f.path),
      acceptanceCriteria: [
        `扫描全部 ${analysis.summary.fileCount} 个项目文件并输出依赖边`,
        "识别既有高危语法或断链问题供后续修复",
      ],
      failurePolicy: "abort",
    },
    {
      id: "step-design-tokens",
      index: 2,
      title: targets.needsVisualTokens ? "设计令牌与响应式样式更新" : "页面样式与布局一致性收敛",
      agentRole: "designer",
      dependsOn: ["step-analyze"],
      inputs: [
        "基线风险报告",
        ...memories.map((m) => `记忆约束:${m.title}`),
      ],
      expectedOutputs: ["更新后的 CSS 变量与响应式规则"],
      targetFiles: targets.cssTargets,
      acceptanceCriteria: [
        "PostCSS 解析通过，0 语法错误",
        "包含响应式断点规则且不引入超宽固定像素容器",
        ...(memories.length > 0 ? [`满足已加载的 ${memories.length} 条项目/用户约束`] : []),
      ],
      failurePolicy: "retry_once",
    },
    {
      id: "step-implement",
      index: 3,
      title: "结构化页面与交互代码变更",
      agentRole: "coder",
      dependsOn: ["step-design-tokens"],
      inputs: ["用户任务目标", "更新后的 CSS 变量与响应式规则", ...targets.htmlTargets],
      expectedOutputs: ["更新后的 HTML 结构与交互逻辑", "逐文件 Diff 摘要"],
      targetFiles: [
        ...targets.htmlTargets,
        ...(targets.needsInteractiveScript ? targets.jsTargets : []),
      ],
      acceptanceCriteria: [
        "目标区块与文案真实写入项目文件而非占位文本",
        "HTML 包含 viewport 声明、语义化标题与图片 alt 属性",
        "所有脚本通过 Acorn AST 语法检查，无 eval/new Function",
      ],
      failurePolicy: "retry_once",
    },
    {
      id: "step-qa-verify",
      index: 4,
      title: "QA 静态语法、无障碍与 Diff 回归核验",
      agentRole: "qa",
      dependsOn: ["step-implement"],
      inputs: ["修改前后完整项目文件快照"],
      expectedOutputs: ["QA 逐项检查报告", "Unified Diff 差异补丁", "可回滚项目版本快照"],
      targetFiles: [...new Set([...targets.htmlTargets, ...targets.cssTargets, ...targets.jsTargets])],
      acceptanceCriteria: [
        "HTML / CSS / JS 全部静态检查项无 fail 级别错误",
        "本地资源引用 100% 指向真实存在的文件",
        "生成可一键回滚的版本记录",
      ],
      failurePolicy: "abort",
    },
  ];

  const dagError = validatePlanDag(stepList);
  if (dagError) throw new Error(dagError);

  return {
    id: `plan-${Date.now().toString(36)}`,
    goal: trimmedGoal,
    mode: "deterministic-local",
    rationale: `基于对 ${analysis.summary.fileCount} 个文件（${analysis.summary.totalLines} 行代码，${analysis.summary.riskCounts.high} 项高风险）的静态分析与 ${memories.length} 条记忆约束生成确定性四步 DAG 执行计划。`,
    constraintsApplied: memorySummary,
    steps: stepList,
    createdAt: Date.now(),
  };
}

export async function generateExecutionPlan(options: {
  userId: string;
  goal: string;
  analysis: ProjectAnalysisReport;
  memories: MemoryRecord[];
  allowExternalAi?: boolean;
  apiKey?: string;
  provider?: string;
  baseUrl?: string;
  model?: string;
}): Promise<ExecutionPlan> {
  const goal = options.goal.trim();
  if (!goal || goal.length > 8000) {
    throw new Error("任务目标长度必须在 1 到 8000 字符之间。");
  }
  const hasCredentials = Boolean(
    (options.apiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "").trim(),
  );
  if (!options.allowExternalAi || !hasCredentials) {
    return buildDeterministicPlan(goal, options.analysis, options.memories);
  }

  try {
    const ai = await requestAI({
      userId: options.userId,
      apiKey: options.apiKey,
      provider: options.provider,
      baseUrl: options.baseUrl,
      model: options.model,
      options: { temperature: 0.2, maxTokens: 1400 },
      systemPrompt:
        'You are the DesignBuddy Planner Agent. Output ONLY valid JSON matching {"rationale":"string","steps":[{"id":"step-1","index":1,"title":"string","agentRole":"analyzer|planner|designer|coder|qa","dependsOn":[],"inputs":["string"],"expectedOutputs":["string"],"targetFiles":["string"],"acceptanceCriteria":["string"],"failurePolicy":"abort|retry_once|fallback_report"}]}. Steps must form a valid DAG of 3 to 6 steps.',
      prompt: JSON.stringify({
        goal,
        files: options.analysis.files.map((f) => ({ path: f.path, role: f.role, lines: f.lines })),
        risks: options.analysis.risks.slice(0, 10),
        constraints: options.memories.map((m) => ({ category: m.category, title: m.title, content: m.content })),
      }),
    });
    const cleaned = ai.content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const parsed = JSON.parse(cleaned) as { rationale?: string; steps?: PlanStep[] };
    if (Array.isArray(parsed.steps) && validatePlanDag(parsed.steps) === null) {
      return {
        id: `plan-${Date.now().toString(36)}`,
        goal,
        mode: "ai-verified",
        rationale: String(parsed.rationale || "由已配置模型生成并通过 DAG 契约核验。").slice(0, 600),
        constraintsApplied: options.memories.map((m) => ({ id: m.id, title: m.title, category: m.category })),
        steps: parsed.steps.map((s, idx) => ({ ...s, index: idx + 1 })),
        createdAt: Date.now(),
      };
    }
  } catch {
    // Fall back transparently to deterministic plan rather than failing planning when provider returns malformed output
  }
  return buildDeterministicPlan(goal, options.analysis, options.memories);
}
