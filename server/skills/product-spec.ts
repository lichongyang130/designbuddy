import type { SkillInput } from "./executors";
import { json, out, text, xml } from "./io";

const str = (v: unknown, max: number, required = true): v is string => typeof v === "string" && v.length <= max && (!required || !!v.trim());
const idOK = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(v);
const md = (v: string) => v.replace(/[\r\n]+/g, " ").replace(/([\\`*_{}\[\]()#+.!|>])/g, "\\$1");
const esc = (v: unknown) => xml(String(v ?? ""));

export async function productSpec(input: SkillInput, event: (message: string) => void) {
  let raw: any;
  try { raw = JSON.parse(text(input.bytes)); } catch { throw Error("产品规格配置必须是有效JSON。"); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("产品规格根节点必须是对象。");
  const allowed = ["project", "owner", "problem", "goals", "nonGoals", "requirements", "acceptance", "risks", "openQuestions"];
  if (Object.keys(raw).some(k => !allowed.includes(k))) throw Error("产品规格包含不支持的字段。");
  if (!str(raw.project, 120) || !str(raw.problem, 2000)) throw Error("project必填且≤120字，problem必填且≤2000字。");
  if (raw.owner !== undefined && !str(raw.owner, 100, false)) throw Error("owner最多100字。");
  const listOfText = (value: unknown, name: string, max: number, itemMax: number) => {
    if (!Array.isArray(value) || value.length > max || value.some(v => !str(v, itemMax))) throw Error(`${name}须为最多${max}条的有效文字列表，每条≤${itemMax}字。`);
    return value as string[];
  };
  const goals = listOfText(raw.goals, "goals", 30, 300);
  const nonGoals = listOfText(raw.nonGoals, "nonGoals", 30, 300);
  const openQuestions = raw.openQuestions === undefined ? [] : listOfText(raw.openQuestions, "openQuestions", 50, 500);
  if (!Array.isArray(raw.requirements) || raw.requirements.length < 1 || raw.requirements.length > 100) throw Error("须提供1至100项requirements。");
  if (!Array.isArray(raw.acceptance) || raw.acceptance.length > 200) throw Error("acceptance最多200项。");
  if (raw.risks !== undefined && (!Array.isArray(raw.risks) || raw.risks.length > 50)) throw Error("risks最多50项。");
  const reqs: { id: string; title: string; priority: string; dependsOn: string[] }[] = raw.requirements.map((r: any, i: number) => {
    if (!r || typeof r !== "object" || Array.isArray(r) || Object.keys(r).some(k => !["id", "title", "priority", "dependsOn"].includes(k))) throw Error(`第${i + 1}项需求格式错误。`);
    if (!idOK(r.id) || !str(r.title, 500) || (r.priority !== undefined && !["must", "should", "could"].includes(r.priority)) || (r.dependsOn !== undefined && (!Array.isArray(r.dependsOn) || r.dependsOn.length > 100 || r.dependsOn.some((v: unknown) => !idOK(v))))) throw Error(`第${i + 1}项需求ID、标题、优先级或依赖字段无效。`);
    return { id: r.id as string, title: r.title as string, priority: (r.priority || "should") as string, dependsOn: (r.dependsOn || []) as string[] };
  });
  const reqMap = new Map<string, typeof reqs[number]>();
  for (const req of reqs) { if (reqMap.has(req.id)) throw Error(`需求ID重复：${req.id}`); reqMap.set(req.id, req); }
  for (const req of reqs) for (const dependency of req.dependsOn) if (!reqMap.has(dependency) || dependency === req.id) throw Error(`${req.id}依赖了不存在或自身的需求：${dependency}`);
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string) => { if (visiting.has(id)) throw Error(`需求依赖存在循环：${id}`); if (visited.has(id)) return; visiting.add(id); for (const d of reqMap.get(id)!.dependsOn) visit(d); visiting.delete(id); visited.add(id); };
  for (const req of reqs) visit(req.id);
  const acceptance: { id: string; requirementId: string; check: string }[] = raw.acceptance.map((a: any, i: number) => {
    if (!a || typeof a !== "object" || Array.isArray(a) || Object.keys(a).some(k => !["id", "requirementId", "check"].includes(k)) || !idOK(a.id) || !idOK(a.requirementId) || !str(a.check, 800)) throw Error(`第${i + 1}项验收条件格式错误。`);
    if (!reqMap.has(a.requirementId)) throw Error(`验收条件${a.id}引用了不存在的需求：${a.requirementId}`);
    return { id: a.id as string, requirementId: a.requirementId as string, check: a.check as string };
  });
  const acceptanceIds = new Set<string>();
  for (const item of acceptance) { if (acceptanceIds.has(item.id)) throw Error(`验收ID重复：${item.id}`); acceptanceIds.add(item.id); }
  const risks: { id: string; description: string; mitigation: string }[] = (raw.risks || []).map((r: any, i: number) => {
    if (!r || typeof r !== "object" || Array.isArray(r) || Object.keys(r).some(k => !["id", "description", "mitigation"].includes(k)) || !idOK(r.id) || !str(r.description, 700) || !str(r.mitigation, 700, false)) throw Error(`第${i + 1}项风险格式错误。`);
    return { id: r.id as string, description: r.description as string, mitigation: (r.mitigation || "待补充") as string };
  });
  if (new Set(risks.map((r: any) => r.id)).size !== risks.length) throw Error("风险ID重复。");
  const covered = new Set(acceptance.map(a => a.requirementId));
  const uncovered = reqs.filter(r => !covered.has(r.id)).map(r => r.id);
  const warnings = [...uncovered.map(id => `需求${id}尚无关联验收条件。`)];
  if (!goals.length) warnings.push("未列出项目目标。");
  if (!nonGoals.length) warnings.push("未明确非目标/范围外事项。");
  if (!risks.length) warnings.push("未登记风险；请确认是否需要补充。");
  const priorityName: Record<string, string> = { must: "必须", should: "应该", could: "可选" };
  const acceptanceByReq = new Map<string, typeof acceptance>();
  for (const item of acceptance) acceptanceByReq.set(item.requirementId, [...(acceptanceByReq.get(item.requirementId) || []), item]);
  const markdown = `# 产品规格：${md(raw.project)}\n\n**负责人：** ${md(raw.owner || "待指定")}\n\n## 问题陈述\n\n${md(raw.problem)}\n\n## 目标\n${goals.map(g => `- ${md(g)}`).join("\n") || "- 待补充"}\n\n## 非目标\n${nonGoals.map(g => `- ${md(g)}`).join("\n") || "- 待补充"}\n\n## 功能需求\n\n${reqs.map(r => `### ${md(r.id)} · ${priorityName[r.priority]}\n\n${md(r.title)}\n\n依赖：${r.dependsOn.length ? r.dependsOn.map(md).join("、") : "无"}\n\n验收条件：\n${(acceptanceByReq.get(r.id) || []).map(a => `- ${md(a.id)}：${md(a.check)}`).join("\n") || "- 待补充"}`).join("\n\n")}\n\n## 风险与缓解\n\n${risks.map(r => `- **${md(r.id)}：** ${md(r.description)}；缓解：${md(r.mitigation)}`).join("\n") || "- 待补充"}\n\n## 待决问题\n\n${openQuestions.map(q => `- ${md(q)}`).join("\n") || "- 无"}\n`;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>产品规格｜${esc(raw.project)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f6f3;color:#27352f;font:16px/1.75 system-ui,"Noto Sans CJK SC",sans-serif}main{max-width:980px;margin:38px auto;padding:42px;background:#fff;border:1px solid #e1e7e2;border-radius:18px}header{border-bottom:1px solid #e7ebe7;padding-bottom:22px}h1{font-size:34px;line-height:1.25;margin:0 0 8px}h2{font-size:22px;color:#367358;margin:32px 0 10px}h3{font-size:17px;margin:18px 0 6px}.meta,.muted{color:#728078;font-size:14px}.req,.risk{padding:14px 16px;border:1px solid #e8ede9;border-radius:12px;margin:10px 0}.priority{display:inline-block;border-radius:20px;background:#eef5ef;padding:2px 9px;font-size:12px;color:#397054}.warn{background:#fff7e8;border-left:4px solid #d1983a;padding:14px 18px;margin:20px 0}ul{padding-left:1.3em}@media(max-width:640px){main{padding:24px 18px;margin:0;border-radius:0}h1{font-size:28px}}</style></head><body><main><header><h1>${esc(raw.project)}</h1><div class="meta">负责人：${esc(raw.owner || "待指定")} · ${reqs.length}项需求 · ${acceptance.length}项验收条件</div></header>${warnings.length ? `<aside class="warn"><strong>待补充 / 覆盖提示</strong><ul>${warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul></aside>` : ""}<h2>问题陈述</h2><p>${esc(raw.problem)}</p><h2>目标</h2>${goals.length ? `<ul>${goals.map((g: string) => `<li>${esc(g)}</li>`).join("")}</ul>` : `<p class="muted">待补充</p>`}<h2>非目标</h2>${nonGoals.length ? `<ul>${nonGoals.map((g: string) => `<li>${esc(g)}</li>`).join("")}</ul>` : `<p class="muted">待补充</p>`}<h2>功能需求与验收</h2>${reqs.map(r => `<article class="req"><h3>${esc(r.id)} · ${esc(r.title)} <span class="priority">${esc(priorityName[r.priority])}</span></h3><div class="muted">依赖：${r.dependsOn.length ? r.dependsOn.map(esc).join("、") : "无"}</div>${(acceptanceByReq.get(r.id) || []).map(a => `<p><strong>${esc(a.id)}</strong> ${esc(a.check)}</p>`).join("") || `<p class="muted">验收条件待补充</p>`}</article>`).join("")}<h2>风险与缓解</h2>${risks.map((r: any) => `<article class="risk"><strong>${esc(r.id)} · ${esc(r.description)}</strong><p>缓解：${esc(r.mitigation)}</p></article>`).join("") || `<p class="muted">待补充</p>`}<h2>待决问题</h2>${openQuestions.length ? `<ul>${openQuestions.map((q: string) => `<li>${esc(q)}</li>`).join("")}</ul>` : `<p class="muted">无</p>`}</main></body></html>`;
  const report = { skill: "product.spec", version: "1.0.0", project: raw.project, requirementCount: reqs.length, acceptanceCount: acceptance.length, coveredRequirementCount: covered.size, uncoveredRequirements: uncovered, dependencyOrder: [...visited], warnings, checks: ["ID唯一性", "需求依赖存在性", "依赖循环", "验收引用", "需求验收覆盖"] , limitations: ["仅对结构与引用做机器校验，不判断需求语义、可行性、法规或业务正确性。", "依赖顺序是拓扑遍历结果，不代表排期或工作量估算。", "文档内容来自用户输入；待补项未由模型推断或补写。"] };
  event(`校验${reqs.length}项需求、${acceptance.length}项验收条件与依赖关系；${warnings.length}项待补充。`);
  return { summary: `产品规格已生成；${reqs.length}项需求中${uncovered.length}项没有验收覆盖，另有${warnings.length - uncovered.length}项待补充。`, outputs: [out("product-spec.md", "text/markdown; charset=utf-8", markdown), out("product-spec.html", "text/html; charset=utf-8", html), json("product-spec-report.json", report)] };
}
