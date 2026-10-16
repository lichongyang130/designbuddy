import { parse } from "csv-parse/sync";
import type { SkillInput } from "./executors";
import { validateSkillOptions } from "./contracts";
import { json, out, text, xml } from "./io";

const numberText = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
const csvSafe = (value: unknown) => {
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function dataReport(input: SkillInput, event: (message: string) => void) {
  const options = validateSkillOptions("data.report", { deduplicate: false, ...(input.parameters ? { parameters: input.parameters } : {}) });
  const p = options.parameters!;
  const source = text(input.bytes);
  if (source.length > 150_000) throw Error("CSV报告最多150000字符。");
  let rawRecords: string[][];
  try { rawRecords = parse(source, { bom: true, columns: false, skip_empty_lines: true, relax_column_count: true, trim: false, max_record_size: 10_000 }); }
  catch (error) { throw Error(`CSV解析失败：${String(error).slice(0, 220)}`); }
  if (rawRecords.length < 2 || rawRecords.length > 5001) throw Error("CSV须包含标题行及1至5000条数据行。");
  const headers = rawRecords[0];
  if (!headers.length || headers.length > 50 || headers.some(h => !h.trim() || h.length > 100) || new Set(headers).size !== headers.length) throw Error("CSV首行必须包含1至50个不重复且非空的字段名（每项≤100字）。");
  const rows: Record<string, string>[] = rawRecords.slice(1).map((cells, i) => {
    if (cells.length !== headers.length) throw Error(`第${i + 2}行列数与标题行不一致。`);
    return Object.fromEntries(headers.map((header, j) => [header, cells[j]]));
  });
  const groupBy = p.groupBy;
  const aggregation = p.aggregation;
  const metric = p.metric || "";
  const title = p.title || "分组数据报告";
  if (!headers.includes(groupBy)) throw Error(`分组字段不存在：${groupBy}。可选字段：${headers.join("、")}`);
  if (aggregation !== "count" && !headers.includes(metric)) throw Error(`指标字段不存在：${metric}。可选字段：${headers.join("、")}`);
  const groups = new Map<string, { label: string; count: number; total: number }>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = row[groupBy];
    if (!label.trim()) throw Error(`第${i + 2}行分组字段为空；请先处理空分组值。`);
    let group = groups.get(label);
    if (!group) { group = { label, count: 0, total: 0 }; groups.set(label, group); }
    group.count++;
    if (aggregation !== "count") {
      const raw = row[metric];
      if (!raw.trim() || !numberText.test(raw.trim())) throw Error(`第${i + 2}行指标字段 ${metric} 不是严格数字。`);
      const value = Number(raw.trim());
      if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw Error(`第${i + 2}行指标超出数值范围。`);
      group.total += value;
      if (!Number.isFinite(group.total) || Math.abs(group.total) > 1e15) throw Error(`分组 ${label.slice(0, 80)} 聚合值超出限制。`);
    }
  }
  if (groups.size > 100) throw Error("唯一分组值超过100个；请先筛选或归并类别。");
  const records = [...groups.values()].map(g => ({
    group: g.label, count: g.count,
    value: aggregation === "count" ? g.count : aggregation === "average" ? g.total / g.count : g.total,
  })).sort((a, b) => b.value - a.value || a.group.localeCompare(b.group, "zh-CN"));
  const maxAbs = Math.max(0, ...records.map(r => Math.abs(r.value)));
  const minValue = Math.min(0, ...records.map(r => r.value));
  const maxValue = Math.max(0, ...records.map(r => r.value));
  const valueRange = maxValue - minValue || 1;
  const chart = records.map(r => {
    const width = maxAbs ? Math.max(1, Math.abs(r.value) / (minValue < 0 ? valueRange : maxAbs) * 100) : 0;
    const left = minValue < 0 ? `${(-minValue / valueRange) * 100}%` : "0%";
    const positiveWidth = minValue < 0 && r.value >= 0 ? `${Math.abs(r.value) / valueRange * 100}%` : `${width}%`;
    const negativeWidth = minValue < 0 && r.value < 0 ? `${Math.abs(r.value) / valueRange * 100}%` : positiveWidth;
    const barStyle = minValue < 0 ? `left:${r.value < 0 ? `calc(${left} - ${negativeWidth})` : left};width:${r.value < 0 ? negativeWidth : positiveWidth}` : `left:0;width:${width}%`;
    return `<div class="row"><div class="label">${xml(r.group)}</div><div class="track"><i style="${barStyle}" class="${r.value < 0 ? "negative" : ""}"></i></div><strong>${r.value.toLocaleString("en-US", { maximumFractionDigits: 4 })}</strong><small>n=${r.count}</small></div>`;
  }).join("");
  const aggLabel = aggregation === "count" ? "记录数" : aggregation === "average" ? `${metric}平均值` : `${metric}合计`;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${xml(title)}</title><style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#f4f6f3;color:#263a32;font:15px/1.6 system-ui,"Noto Sans CJK SC",sans-serif}main{max-width:1000px;margin:auto;background:white;border:1px solid #e2e8e3;border-radius:18px;padding:30px}h1{margin:0 0 8px;font-size:28px}.meta{color:#6b7770;margin-bottom:24px}.row{display:grid;grid-template-columns:minmax(90px,220px) minmax(80px,1fr) minmax(60px,110px) 48px;gap:12px;align-items:center;margin:13px 0}.label{overflow-wrap:anywhere}.track{height:16px;border-radius:99px;background:#edf1ed;position:relative;overflow:hidden}.track i{position:absolute;top:0;height:100%;border-radius:99px;background:#43886a}.track i.negative{background:#c36a55}.row small{color:#7b867f}.note{color:#6b7770;font-size:13px;margin-top:25px}@media(max-width:640px){body{padding:10px}main{padding:18px}.row{grid-template-columns:minmax(74px,1fr) minmax(55px,1.2fr) 68px;gap:8px}.row small{display:none}}</style></head><body><main><h1>${xml(title)}</h1><div class="meta">分组：${xml(groupBy)} · 指标：${xml(aggLabel)} · ${rows.length}行数据 · ${records.length}个类别</div>${chart}<p class="note">仅对上传CSV执行指定分组与聚合；未推断业务口径、单位或因果关系。数值图表使用线性尺度。</p></main></body></html>`;
  const csv = ["group,value,record_count,aggregation,metric", ...records.map(r => [csvSafe(r.group), csvSafe(r.value), csvSafe(r.count), csvSafe(aggregation), csvSafe(metric)].join(","))].join("\r\n");
  const report = { skill: "data.report", version: "1.0.0", title, sourceRows: rows.length, groupBy, aggregation, metric: aggregation === "count" ? null : metric, groups: records, calculation: aggregation === "sum" ? "sum" : aggregation === "average" ? "arithmetic mean" : "row count", limitations: ["仅基于用户指定字段分组和聚合，不推断语义、单位、筛选条件或因果关系。", "空分组和非数值指标整批拒绝；最大100组。", "输出报告只是一份CSV快照；不会访问数据库、生成模型解释或验证来源准确性。"] };
  event(`实际解析${rows.length}行，按${groupBy}字段分成${records.length}组，并计算${aggLabel}。`);
  return { summary: `已按 ${groupBy} 分为${records.length}组，完成${aggLabel}汇总。`, outputs: [out("grouped-data-report.html", "text/html; charset=utf-8", html), out("grouped-data-report.csv", "text/csv; charset=utf-8", csv), json("grouped-data-report.json", report)] };
}
