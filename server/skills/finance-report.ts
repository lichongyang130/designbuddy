import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import type { SkillInput } from "./executors";
import { validateSkillOptions } from "./contracts";
import { json, out, text, xml } from "./io";

const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const amountPattern = /^\+?(?:\d+\.?\d*|\.\d+)$/;
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const cell = (v: unknown) => { const value = String(v ?? ""); const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value; return `"${safe.replace(/"/g, '""')}"`; };
const fixed = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

type Tx = { date: string; category: string; type: "income" | "expense"; amount: Decimal; description: string };

export async function financeReport(input: SkillInput, event: (message: string) => void) {
  const options = validateSkillOptions("finance.report", { deduplicate: false, ...(input.parameters ? { parameters: input.parameters } : {}) });
  const p = options.parameters!;
  const source = text(input.bytes);
  if (source.length > 150_000) throw Error("财务报告CSV最多150000字符。");
  let records: string[][];
  try { records = parse(source, { bom: true, columns: false, skip_empty_lines: true, relax_column_count: true, max_record_size: 10_000 }); }
  catch (error) { throw Error(`CSV解析失败：${String(error).slice(0, 220)}`); }
  if (records.length < 2 || records.length > 5001) throw Error("CSV须包含标题行及1至5000条交易记录。");
  const headers = records[0];
  if (!headers.length || headers.length > 50 || headers.some(h => !h.trim() || h.length > 100) || new Set(headers).size !== headers.length) throw Error("CSV首行必须包含1至50个不重复且非空的字段名。");
  const idx = (field: string) => { const i = headers.indexOf(field); if (i < 0) throw Error(`CSV缺少字段：${field}`); return i; };
  const dateI = idx(p.dateField), categoryI = idx(p.categoryField), typeI = idx(p.typeField), amountI = idx(p.amountField);
  const descriptionI = p.descriptionField ? idx(p.descriptionField) : -1;
  if ([dateI, categoryI, typeI, amountI].some(i => records.slice(1).some(row => row.length !== headers.length))) throw Error("CSV部分记录列数与标题行不一致。");
  const types = new Set([p.incomeValue, p.expenseValue]);
  if (types.size !== 2) throw Error("收入与支出的分类值必须不同。");
  if ((p.startDate && !isDate(p.startDate)) || (p.endDate && !isDate(p.endDate)) || (p.startDate && p.endDate && p.startDate > p.endDate)) throw Error("报告起止日期必须是有效的YYYY-MM-DD，且开始日期不晚于结束日期。");
  const transactions: Tx[] = [];
  const excluded: { row: number; date: string }[] = [];
  for (let i = 1; i < records.length; i++) {
    const row = records[i];
    if (row.length !== headers.length) throw Error(`第${i + 1}行列数与标题行不一致。`);
    const date = row[dateI].trim(), category = row[categoryI].trim(), typeValue = row[typeI].trim(), rawAmount = row[amountI].trim();
    if (!isDate(date)) throw Error(`第${i + 1}行日期无效，须为YYYY-MM-DD。`);
    if (p.startDate && date < p.startDate || p.endDate && date > p.endDate) { excluded.push({ row: i + 1, date }); continue; }
    if (!category || category.length > 120) throw Error(`第${i + 1}行分类为空或超过120字。`);
    if (typeValue !== p.incomeValue && typeValue !== p.expenseValue) throw Error(`第${i + 1}行收支类型“${typeValue}”不匹配已选分类。`);
    if (!amountPattern.test(rawAmount) || rawAmount.length > 32) throw Error(`第${i + 1}行金额必须是正的十进制数，不含货币符号或千位分隔符。`);
    const amount = new Money(rawAmount);
    if (!amount.isFinite() || amount.lte(0) || amount.gt("1e12") || amount.decimalPlaces() > 6) throw Error(`第${i + 1}行金额超出范围（须>0、≤1e12且最多6位小数）。`);
    transactions.push({ date, category, type: typeValue === p.incomeValue ? "income" : "expense", amount, description: descriptionI >= 0 ? row[descriptionI].slice(0, 300) : "" });
  }
  if (!transactions.length) throw Error("所选日期范围内没有交易记录。");
  if (transactions.length > 5000) throw Error("交易记录超过5000条。");
  const income = transactions.filter(t => t.type === "income").reduce((sum, t) => sum.plus(t.amount), new Money(0));
  const expenses = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum.plus(t.amount), new Money(0));
  const net = income.minus(expenses);
  const margin = income.gt(0) ? net.div(income).times(100) : null;
  const categories = new Map<string, { income: Decimal; expenses: Decimal; count: number }>();
  for (const t of transactions) {
    const item = categories.get(t.category) || { income: new Money(0), expenses: new Money(0), count: 0 };
    if (t.type === "income") item.income = item.income.plus(t.amount); else item.expenses = item.expenses.plus(t.amount);
    item.count++; categories.set(t.category, item);
  }
  if (categories.size > 100) throw Error("唯一分类超过100个；请先筛选或归并分类。");
  const breakdown = [...categories.entries()].map(([category, v]) => ({ category, income: fixed(v.income), expenses: fixed(v.expenses), net: fixed(v.income.minus(v.expenses)), count: v.count })).sort((a,b) => Number(b.net)-Number(a.net) || a.category.localeCompare(b.category, "zh-CN"));
  const currency = p.currency;
  const maxValue = Math.max(1, ...breakdown.flatMap(v => [Math.abs(Number(v.income)), Math.abs(Number(v.expenses))]));
  const rowsHtml = breakdown.map(v => `<tr><th scope="row">${xml(v.category)}</th><td>${v.count}</td><td>${fixed(new Money(v.income))}</td><td>${fixed(new Money(v.expenses))}</td><td>${fixed(new Money(v.net))}</td><td><div class="bars"><i class="inc" style="width:${Math.min(100, Number(v.income)/maxValue*100)}%"></i><i class="exp" style="width:${Math.min(100, Number(v.expenses)/maxValue*100)}%"></i></div></td></tr>`).join("");
  const range = [p.startDate || transactions.reduce((a,t) => t.date<a?t.date:a, transactions[0].date), p.endDate || transactions.reduce((a,t) => t.date>a?t.date:a, transactions[0].date)];
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${xml(p.title)}</title><style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#f4f6f3;color:#273931;font:15px/1.6 system-ui,"Noto Sans CJK SC",sans-serif}main{max-width:1100px;margin:auto}.hero,.card,.table-wrap,.notice{background:#fff;border:1px solid #e2e8e3;border-radius:16px;padding:22px;margin-bottom:16px}.hero h1{margin:0 0 4px;font-size:28px}.muted{color:#6e7b73}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card strong{display:block;font-size:27px;margin-top:6px}.income{color:#286e4d}.expense{color:#a34838}.net{color:${net.gte(0)?"#286e4d":"#a34838"}}table{width:100%;border-collapse:collapse;min-width:650px}th,td{text-align:left;padding:11px;border-bottom:1px solid #edf0ed;font-variant-numeric:tabular-nums}thead{color:#66756c;font-size:13px}.table-wrap{overflow:auto;padding:10px 18px}.bars{width:110px}.bars i{display:block;height:6px;border-radius:10px;margin:2px 0}.inc{background:#4c9970}.exp{background:#cf8172}.legend{font-size:12px;color:#6e7b73}.notice{font-size:13px;color:#69776f}@media(max-width:700px){body{padding:12px}.cards{grid-template-columns:1fr}.hero h1{font-size:23px}}</style></head><body><main><header class="hero"><div class="muted">财务汇总快照 · ${xml(range[0])} 至 ${xml(range[1])}</div><h1>${xml(p.title)}</h1><div class="muted">币种/单位：${xml(currency)} · 纳入${transactions.length}笔，筛除${excluded.length}笔</div></header><section class="cards"><div class="card">总收入<strong class="income">${fixed(income)} ${xml(currency)}</strong></div><div class="card">总支出<strong class="expense">${fixed(expenses)} ${xml(currency)}</strong></div><div class="card">净额<strong class="net">${fixed(net)} ${xml(currency)}</strong>${margin === null ? "" : `<div class="muted">净额/收入 ${margin.toDecimalPlaces(2).toFixed(2)}%</div>`}</div></section><section class="table-wrap"><h2>分类明细</h2><table><thead><tr><th>分类</th><th>笔数</th><th>收入</th><th>支出</th><th>净额</th><th>收入/支出相对量</th></tr></thead><tbody>${rowsHtml}</tbody></table><p class="legend">绿色=收入，红色=支出；条长按本报告最大类别金额线性缩放。</p></section><aside class="notice">仅按指定字段与分类值进行汇总。净额定义为收入减支出；未推断税务、应计/现金口径、退款、折旧或会计科目。请由财务人员复核。</aside></main></body></html>`;
  const csv = ["category,income,expenses,net,transaction_count,currency", ...breakdown.map(v => [v.category,v.income,v.expenses,v.net,v.count,currency].map(cell).join(","))].join("\r\n");
  const report = { skill: "finance.report", version: "1.0.0", title: p.title, currency, period: { start: range[0], end: range[1] }, sourceTransactions: records.length-1, includedTransactions: transactions.length, excludedTransactions: excluded.length, excludedRows: excluded, income: fixed(income), expenses: fixed(expenses), net: fixed(net), netMarginPercent: margin === null ? null : margin.toDecimalPlaces(2).toFixed(2), categoryCount: breakdown.length, categories: breakdown, calculationRules: { incomeValue: p.incomeValue, expenseValue: p.expenseValue, net: "income - expenses", aggregation: "decimal.js precision 40, output rounded to 2 decimal places" }, limitations: ["按用户指定字段、收支标记、日期范围进行明细汇总，不推断会计口径。", "只接受正数金额；负数退款、冲销、税费及多币种折算须预先处理。", "输入来源与单位不经独立核验；该报告不是审计、税务、投资或会计意见。"] };
  event(`核算${transactions.length}笔交易、${breakdown.length}个分类：收入${fixed(income)}，支出${fixed(expenses)}，净额${fixed(net)} ${currency}；未访问外部系统。`);
  return { summary: `财务汇总已完成：收入${fixed(income)}、支出${fixed(expenses)}、净额${fixed(net)} ${currency}。`, outputs: [out("financial-report.html", "text/html; charset=utf-8", html), out("financial-category-summary.csv", "text/csv; charset=utf-8", csv), json("financial-report.json", report)] };
}
