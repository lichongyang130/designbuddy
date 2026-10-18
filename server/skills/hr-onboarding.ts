import { randomUUID } from "node:crypto";
import type { SkillInput } from "./executors";
import { json, out, text, xml } from "./io";

const stringValue = (value: unknown, max: number, required = true): value is string => typeof value === "string" && value.length <= max && (!required || !!value.trim());
const dateOnly = (value: unknown): value is string => { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T00:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; };
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const icsEscape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const csvCell = (value: unknown) => { const raw = String(value ?? ""); const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw; return `"${safe.replace(/"/g, '""')}"`; };
const foldIcsLine = (line: string) => { const result: string[] = []; let current = "", bytes = 0; for (const char of line) { const charBytes = Buffer.byteLength(char); if (bytes + charBytes > 75) { result.push(current); current = ` ${char}`; bytes = 1 + charBytes; } else { current += char; bytes += charBytes; } } result.push(current); return result; };

export async function hrOnboarding(input: SkillInput, event: (message: string) => void) {
  let data: any;
  try { data = JSON.parse(text(input.bytes)); } catch { throw Error("入职计划必须是有效JSON。"); }
  if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).some(k => !["employee", "role", "team", "manager", "startDate", "tasks"].includes(k))) throw Error("入职计划根节点或字段不合法。");
  for (const [key, max] of [["employee", 100], ["role", 120], ["team", 120], ["manager", 100]] as [string, number][]) if (!stringValue(data[key], max)) throw Error(`${key}必填且最多${max}字。`);
  if (!dateOnly(data.startDate)) throw Error("startDate须为有效日期，格式YYYY-MM-DD。");
  if (!Array.isArray(data.tasks) || data.tasks.length < 1 || data.tasks.length > 80) throw Error("tasks须包含1至80项。");
  const ids = new Set<string>();
  const tasks = data.tasks.map((task: any, i: number) => {
    if (!task || typeof task !== "object" || Array.isArray(task) || Object.keys(task).some(k => !["id", "title", "dayOffset", "owner", "category", "details"].includes(k))) throw Error(`第${i + 1}项任务含有不支持字段。`);
    if (typeof task.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(task.id) || ids.has(task.id)) throw Error(`第${i + 1}项任务ID无效或重复。`);
    if (!stringValue(task.title, 180) || !Number.isInteger(task.dayOffset) || task.dayOffset < 0 || task.dayOffset > 90 || !stringValue(task.owner, 100) || (task.category !== undefined && !stringValue(task.category, 40, false)) || (task.details !== undefined && !stringValue(task.details, 600, false))) throw Error(`任务${task.id}需要有效标题、0至90天的偏移量及负责人。`);
    ids.add(task.id);
    return { id: task.id as string, title: task.title as string, dayOffset: task.dayOffset as number, dueDate: addDays(data.startDate, task.dayOffset), owner: task.owner as string, category: (task.category || "入职安排") as string, details: (task.details || "") as string };
  }).sort((a: any, b: any) => a.dayOffset - b.dayOffset || a.id.localeCompare(b.id));
  const calendarLines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DesignBuddy//Onboarding plan//ZH", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const task of tasks) calendarLines.push("BEGIN:VEVENT", `UID:${randomUUID()}@designbuddy.local`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`, `DTSTART;VALUE=DATE:${task.dueDate.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${addDays(task.dueDate, 1).replace(/-/g, "")}`, `SUMMARY:${icsEscape(`[入职] ${task.title}`)}`, `DESCRIPTION:${icsEscape(`新员工：${data.employee}；岗位：${data.role}；团队：${data.team}；负责人：${task.owner}${task.details ? `；说明：${task.details}` : ""}`)}`, "END:VEVENT");
  calendarLines.push("END:VCALENDAR");
  const ics = `${calendarLines.flatMap(foldIcsLine).join("\r\n")}\r\n`;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>入职计划｜${xml(data.employee)}</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#f3f6f4;color:#273a31;font:15px/1.65 system-ui,"Noto Sans CJK SC",sans-serif}main{max-width:980px;margin:auto}.hero,.task{background:#fff;border:1px solid #e2e9e4;border-radius:14px;padding:22px;margin-bottom:14px}.hero h1{margin:4px 0 10px;font-size:30px}.meta{color:#6b7971}.task{display:grid;grid-template-columns:110px 1fr 170px;gap:14px}.day{color:#36775b;font-weight:700}.task h2{font-size:17px;margin:0 0 4px}.owner{color:#64736a}.tag{display:inline-block;color:#36775b;background:#edf5ef;border-radius:20px;padding:2px 9px;font-size:12px;margin-bottom:6px}.details{color:#56655c;margin-top:6px}@media(max-width:640px){body{padding:12px}.task{grid-template-columns:1fr;gap:4px}.hero h1{font-size:25px}}</style></head><body><main><header class="hero"><p>ONBOARDING PLAN · ${xml(data.startDate)}</p><h1>${xml(data.employee)} · ${xml(data.role)}</h1><div class="meta">团队：${xml(data.team)} · 直属负责人：${xml(data.manager)} · 共${tasks.length}项安排</div></header>${tasks.map((task: any) => `<article class="task"><div class="day">第${task.dayOffset}天<br>${xml(task.dueDate)}</div><div><span class="tag">${xml(task.category)}</span><h2>${xml(task.title)}</h2>${task.details ? `<div class="details">${xml(task.details).replace(/\r?\n/g, "<br>")}</div>` : ""}</div><div class="owner">负责人：${xml(task.owner)}</div></article>`).join("")}</main></body></html>`;
  const csv = ["id,title,day_offset,due_date,owner,category,details", ...tasks.map((task: any) => [task.id,task.title,task.dayOffset,task.dueDate,task.owner,task.category,task.details].map(csvCell).join(","))].join("\r\n");
  const report = { skill: "hr.onboarding", version: "1.0.0", employee: data.employee, role: data.role, team: data.team, manager: data.manager, startDate: data.startDate, taskCount: tasks.length, tasks, outputs: ["HTML计划", "CSV任务清单", "全天日历ICS文件"], limitations: ["生成本地入职计划与ICS日历文件，不创建云端日程、不通知负责人、不连接HR系统。", "日期按UTC日历日计算，ICS采用全天事件；用户需确认地区日历显示是否符合预期。", "任务内容由用户/组织提供；不推断劳动法规、隐私要求、公司政策或安全培训。"] };
  event(`已校验${tasks.length}项入职任务日期并生成HTML、CSV及全天ICS；未写入外部日历或发送通知。`);
  return { summary: `已为${data.employee}生成${tasks.length}项入职计划及日历导入文件。`, outputs: [out("onboarding-plan.html", "text/html; charset=utf-8", html), out("onboarding-tasks.csv", "text/csv; charset=utf-8", csv), out("onboarding-calendar.ics", "text/calendar; charset=utf-8", ics), json("onboarding-plan.json", report)] };
}
