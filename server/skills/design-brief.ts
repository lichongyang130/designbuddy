import type { SkillInput } from "./executors";
import { json, out, text, xml } from "./io";

type Brief = {
  project: string; audience: string; problem: string; objective: string;
  scope?: { include?: string[]; exclude?: string[] };
  deliverables: string[]; constraints?: string[]; successMetrics?: string[];
  stakeholders?: string[]; references?: string[];
};
const stringField = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const stringList = (value: unknown, limit: number, itemMax = 240): value is string[] => Array.isArray(value) && value.length <= limit && value.every(item => stringField(item, itemMax));
const escapeMarkdown = (value: string) => value.replace(/[\r\n]+/g, " ").replace(/([\\`*_{}\[\]()#+.!|>])/g, "\\$1");
function list(items: string[] | undefined, empty: string) {
  return items?.length ? items.map(item => `- ${escapeMarkdown(item)}`).join("\n") : `- ${empty}`;
}
function section(title: string, items: string[] | undefined, empty: string) {
  return `<section><h2>${xml(title)}</h2>${items?.length ? `<ul>${items.map(item => `<li>${xml(item)}</li>`).join("")}</ul>` : `<p class="empty">${xml(empty)}</p>`}</section>`;
}

export async function designBrief(input: SkillInput, event: (message: string) => void) {
  let source: unknown;
  try { source = JSON.parse(text(input.bytes)); } catch { throw Error("设计简报输入必须是有效JSON。"); }
  if (!source || typeof source !== "object" || Array.isArray(source)) throw Error("简报JSON根节点必须是对象。");
  const data = source as Record<string, unknown>;
  const allowed = ["project", "audience", "problem", "objective", "scope", "deliverables", "constraints", "successMetrics", "stakeholders", "references"];
  const unknown = Object.keys(data).filter(key => !allowed.includes(key));
  if (unknown.length) throw Error(`不支持的字段：${unknown.join("、")}。`);
  const limits: [keyof Brief, number][] = [["project", 120], ["audience", 1000], ["problem", 1600], ["objective", 1200]];
  for (const [key, limit] of limits) if (!stringField(data[key], limit)) throw Error(`${key} 必填，且最多${limit}字。`);
  if (!stringList(data.deliverables, 20, 240) || !data.deliverables.length) throw Error("deliverables 必须包含1至20条，每条最多240字。");
  for (const key of ["constraints", "successMetrics", "stakeholders", "references"] as const) if (data[key] !== undefined && !stringList(data[key], key === "references" ? 12 : 20, 500)) throw Error(`${key} 必须是符合长度限制的文字列表。`);
  let scope: Brief["scope"];
  if (data.scope !== undefined) {
    if (!data.scope || typeof data.scope !== "object" || Array.isArray(data.scope) || Object.keys(data.scope).some(k => !["include", "exclude"].includes(k))) throw Error("scope 只能包含 include 与 exclude 列表。");
    const raw = data.scope as Record<string, unknown>;
    if (raw.include !== undefined && !stringList(raw.include, 20, 240)) throw Error("scope.include 最多20条，每条最多240字。");
    if (raw.exclude !== undefined && !stringList(raw.exclude, 20, 240)) throw Error("scope.exclude 最多20条，每条最多240字。");
    scope = { include: raw.include as string[] | undefined, exclude: raw.exclude as string[] | undefined };
  }
  const brief: Brief = { project: data.project as string, audience: data.audience as string, problem: data.problem as string, objective: data.objective as string, scope, deliverables: data.deliverables as string[], constraints: data.constraints as string[] | undefined, successMetrics: data.successMetrics as string[] | undefined, stakeholders: data.stakeholders as string[] | undefined, references: data.references as string[] | undefined };
  const warnings: string[] = [];
  if (!brief.scope?.include?.length) warnings.push("尚未说明本项目的交付范围。");
  if (!brief.scope?.exclude?.length) warnings.push("尚未说明明确不包含的事项。");
  if (!brief.constraints?.length) warnings.push("未提供约束条件；请确认预算、时间、技术和内容限制。");
  if (!brief.successMetrics?.length) warnings.push("未提供可验证的成功指标。");
  const markdown = `# 设计简报：${escapeMarkdown(brief.project)}\n\n## 项目背景与受众\n\n${escapeMarkdown(brief.audience)}\n\n## 核心问题\n\n${escapeMarkdown(brief.problem)}\n\n## 项目目标\n\n${escapeMarkdown(brief.objective)}\n\n## 工作范围\n\n### 包含\n${list(brief.scope?.include, "待确认") }\n\n### 不包含\n${list(brief.scope?.exclude, "待确认") }\n\n## 交付成果\n${list(brief.deliverables, "无") }\n\n## 约束条件\n${list(brief.constraints, "待确认") }\n\n## 成功指标\n${list(brief.successMetrics, "待确认") }\n\n## 相关方\n${list(brief.stakeholders, "待确认") }\n\n## 参考资料\n${list(brief.references, "未提供") }\n`;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>设计简报：${xml(brief.project)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f2ed;color:#26352e;font:16px/1.75 system-ui,"Noto Sans CJK SC",sans-serif}main{max-width:920px;margin:48px auto;padding:48px;background:#fff;border-radius:20px;box-shadow:0 12px 40px #24382b12}header{border-bottom:1px solid #e3e8e1;padding-bottom:28px;margin-bottom:30px}h1{font-size:clamp(30px,5vw,48px);line-height:1.2;margin:0}h2{font-size:19px;margin:32px 0 10px;color:#497260}h3{font-size:15px;margin:18px 0 4px}p{margin:0 0 12px}ul{padding-left:1.3em;margin:8px 0}li{padding:2px 0}.empty{color:#77837b;font-style:italic}.warnings{background:#fff7e5;border-left:4px solid #cf8d2e;padding:16px 20px;margin:0 0 28px}@media(max-width:640px){main{margin:0;padding:28px 20px;border-radius:0}}</style></head><body><main><header><p>DESIGN BRIEF · VALIDATED STRUCTURE</p><h1>${xml(brief.project)}</h1></header>${warnings.length ? `<aside class="warnings"><strong>待补充信息</strong><ul>${warnings.map(w => `<li>${xml(w)}</li>`).join("")}</ul></aside>` : ""}<p><strong>目标受众：</strong>${xml(brief.audience)}</p><p><strong>核心问题：</strong>${xml(brief.problem)}</p><p><strong>目标：</strong>${xml(brief.objective)}</p>${section("工作范围 · 包含", brief.scope?.include, "待确认")}${section("工作范围 · 不包含", brief.scope?.exclude, "待确认")}${section("交付成果", brief.deliverables, "无")}${section("约束条件", brief.constraints, "待确认")}${section("成功指标", brief.successMetrics, "待确认")}${section("相关方", brief.stakeholders, "待确认")}${section("参考资料", brief.references, "未提供")}</main></body></html>`;
  const report = { skill: "design.brief", version: "1.0.0", project: brief.project, completeness: { requiredFieldsPresent: true, deliverableCount: brief.deliverables.length, warnings }, fieldsValidated: Object.keys(brief).filter(k => brief[k as keyof Brief] !== undefined), limitations: ["只做结构、类型和长度校验；不判断目标是否合理，不推断设计方案或用户需求。", "简报内容由用户提供；未调用AI、外部服务或资料检索。", "参考资料仅作为文字记录，不会抓取、核验链接或确认版权。"] };
  event(`已验证设计简报字段并生成HTML/Markdown；发现${warnings.length}项待补充信息，未推断缺失内容。`);
  return { summary: `设计简报结构校验完成；${warnings.length}项信息待补充。已生成可编辑Markdown与HTML。`, outputs: [out("design-brief.md", "text/markdown; charset=utf-8", markdown), out("design-brief.html", "text/html; charset=utf-8", html), json("design-brief-report.json", report)] };
}
