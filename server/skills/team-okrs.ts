import type { SkillInput } from "./executors";
import { json, out, text, xml } from "./io";

const cleanText = (v: unknown, max: number, required = true): v is string => typeof v === "string" && v.length <= max && (!required || !!v.trim());
const validId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(v);
const validMetric = (v: unknown) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e12;
const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

type KeyResultInput = { id: string; title: string; baseline: number; current: number; target: number; unit?: string };

export async function teamOKRs(input: SkillInput, event: (message: string) => void) {
  let data: any;
  try { data = JSON.parse(text(input.bytes)); } catch { throw Error("OKR工作簿配置必须是有效JSON。"); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("OKR配置根节点必须是对象。");
  if (Object.keys(data).some(key => !["period", "organization", "objectives"].includes(key))) throw Error("OKR配置包含不支持的字段。");
  if (!cleanText(data.period, 40) || (data.organization !== undefined && !cleanText(data.organization, 100, false))) throw Error("period必填且最多40字；organization最多100字。");
  if (!Array.isArray(data.objectives) || data.objectives.length < 1 || data.objectives.length > 30) throw Error("须提供1至30个目标。");
  const objectiveIds = new Set<string>(), keyResultIds = new Set<string>();
  const issues: string[] = [];
  const objectives = data.objectives.map((objective: any, oi: number) => {
    if (!objective || typeof objective !== "object" || Array.isArray(objective) || Object.keys(objective).some(key => !["id", "title", "owner", "keyResults"].includes(key))) throw Error(`第${oi + 1}个目标格式错误或包含不支持的字段。`);
    if (!validId(objective.id) || objectiveIds.has(objective.id)) throw Error(`第${oi + 1}个目标ID无效或重复。`);
    if (!cleanText(objective.title, 180) || (objective.owner !== undefined && !cleanText(objective.owner, 80, false))) throw Error(`目标${objective.id}标题必填且≤180字，负责人≤80字。`);
    objectiveIds.add(objective.id);
    if (!Array.isArray(objective.keyResults) || objective.keyResults.length < 1 || objective.keyResults.length > 10) throw Error(`目标${objective.id}必须有1至10个关键结果。`);
    const keyResults = objective.keyResults.map((kr: any, ki: number) => {
      if (!kr || typeof kr !== "object" || Array.isArray(kr) || Object.keys(kr).some(key => !["id", "title", "baseline", "current", "target", "unit"].includes(key))) throw Error(`${objective.id}的第${ki + 1}个关键结果格式错误。`);
      if (!validId(kr.id) || keyResultIds.has(kr.id)) throw Error(`关键结果ID ${String(kr.id)} 无效或重复。`);
      if (!cleanText(kr.title, 180) || !validMetric(kr.baseline) || !validMetric(kr.current) || !validMetric(kr.target) || kr.target === kr.baseline) throw Error(`关键结果${kr.id}必须包含标题、有效数值，且目标值不能等于基线值。`);
      if (kr.unit !== undefined && !cleanText(kr.unit, 24, false)) throw Error(`关键结果${kr.id}的单位最多24字。`);
      keyResultIds.add(kr.id);
      const rawPercent = (kr.current - kr.baseline) / (kr.target - kr.baseline) * 100;
      const progress = Math.max(0, Math.min(100, rawPercent));
      if (rawPercent < 0) issues.push(`${kr.id}当前值相对基线倒退（原始进度${rawPercent.toFixed(1)}%）。`);
      if (rawPercent > 100) issues.push(`${kr.id}已超过目标（原始进度${rawPercent.toFixed(1)}%）；展示进度封顶100%。`);
      return { id: kr.id, title: kr.title, baseline: kr.baseline, current: kr.current, target: kr.target, unit: kr.unit || "", rawPercent, progress, status: rawPercent < 0 ? "回退" : rawPercent < 60 ? "需关注" : "进展中" };
    });
    const progress = keyResults.reduce((sum: number, kr: any) => sum + kr.progress, 0) / keyResults.length;
    return { id: objective.id, title: objective.title, owner: objective.owner || "未指定", progress, keyResults };
  });
  const allKRs = objectives.flatMap((o: any) => o.keyResults);
  const overall = allKRs.reduce((sum: number, kr: any) => sum + kr.progress, 0) / allKRs.length;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OKR记分卡｜${xml(data.period)}</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#f4f6f3;color:#263a32;font:15px/1.6 system-ui,"Noto Sans CJK SC",sans-serif}main{max-width:1100px;margin:auto}header,.objective{background:white;border:1px solid #e2e8e3;border-radius:16px;padding:24px;margin-bottom:18px}h1{margin:0 0 4px;font-size:28px}.muted{color:#738078}.overall{font-size:36px;font-weight:750;color:#277451}.objective-head{display:flex;justify-content:space-between;gap:16px;align-items:start}h2{font-size:19px;margin:0}.meter{height:8px;background:#e8eee9;border-radius:99px;overflow:hidden;margin:10px 0 18px}.meter i{display:block;height:100%;background:#33845e}.kr{border-top:1px solid #edf0ed;padding:14px 0}.krhead{display:flex;justify-content:space-between;gap:12px}.badge{font-size:12px;padding:3px 9px;border-radius:99px;background:#edf5ee}.regression{background:#fff0ed;color:#983f2f}.numbers{color:#64716a;font-size:13px}.issue{padding:10px 14px;background:#fff8e8;border-radius:10px;margin:6px 0}@media(max-width:600px){body{padding:14px}.objective-head{display:block}.overall{font-size:30px}}</style></head><body><main><header><div class="muted">团队OKR记分卡 · ${xml(data.period)}</div><h1>${xml(data.organization || "团队")}</h1><div>总体关键结果进度 <span class="overall">${overall.toFixed(1)}%</span></div></header>${issues.length ? `<section class="objective"><h2>计算提示</h2>${issues.map(issue => `<div class="issue">${xml(issue)}</div>`).join("")}</section>` : ""}${objectives.map((o: any) => `<article class="objective"><div class="objective-head"><div><h2>${xml(o.title)}</h2><div class="muted">${xml(o.id)} · 负责人：${xml(o.owner)}</div></div><strong>${o.progress.toFixed(1)}%</strong></div><div class="meter"><i style="width:${o.progress.toFixed(1)}%"></i></div>${o.keyResults.map((kr: any) => `<div class="kr"><div class="krhead"><strong>${xml(kr.title)}</strong><span class="badge ${kr.status === "回退" ? "regression" : ""}">${kr.progress.toFixed(1)}% · ${xml(kr.status)}</span></div><div class="numbers">${xml(kr.id)} · 基线 ${kr.baseline}${xml(kr.unit)} → 当前 ${kr.current}${xml(kr.unit)} → 目标 ${kr.target}${xml(kr.unit)}</div></div>`).join("")}</article>`).join("")}</main></body></html>`;
  const csv = ["objective_id,objective,owner,key_result_id,key_result,baseline,current,target,unit,raw_progress_percent,display_progress_percent,status", ...objectives.flatMap((o: any) => o.keyResults.map((kr: any) => [o.id,o.title,o.owner,kr.id,kr.title,kr.baseline,kr.current,kr.target,kr.unit,kr.rawPercent.toFixed(2),kr.progress.toFixed(2),kr.status].map(csvCell).join(",")))].join("\r\n");
  const report = { skill: "team.okrs", version: "1.0.0", period: data.period, organization: data.organization || null, objectiveCount: objectives.length, keyResultCount: allKRs.length, overallProgressPercent: Number(overall.toFixed(2)), aggregation: "unweighted arithmetic mean of clamped key-result progress", objectives, calculationIssues: issues, limitations: ["进度仅根据输入的基线、当前值与目标值线性计算；不判断目标质量、数据来源或业务价值。", "每个关键结果等权，超目标按100%计，负进度按0%展示并另报原始进度。", "结果是用户输入的时间点快照，不是持续同步的OKR管理系统。"] };
  event(`已计算${objectives.length}个目标与${allKRs.length}个关键结果；总体按关键结果等权平均为${overall.toFixed(1)}%。`);
  return { summary: `OKR记分卡已生成：${objectives.length}个目标、${allKRs.length}个关键结果，整体进度${overall.toFixed(1)}%。`, outputs: [out("okr-scorecard.html", "text/html; charset=utf-8", html), out("okr-scorecard.csv", "text/csv; charset=utf-8", csv), json("okr-scorecard.json", report)] };
}
