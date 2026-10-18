import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { json, out, text } from "./io";
import type { SkillInput, Output } from "./executors";
type Finding = { code: string; subject: string; message: string };
function cycles(graph: Map<string,string[]>) {
  const active=new Set<string>(),done=new Set<string>(),result=new Set<string>();
  function visit(id:string,path:string[]) { if(active.has(id)){path.slice(path.indexOf(id)).forEach(n=>result.add(n));return;}if(done.has(id))return;active.add(id);for(const next of graph.get(id)||[])if(graph.has(next))visit(next,[...path,id]);active.delete(id);done.add(id); }
  for(const id of graph.keys())visit(id,[]);return [...result].sort();
}
function timestamp(value:string) {
  const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if(!m || +m[2]>23 || +m[3]>59 || +(m[4]||0)>59) return NaN;
  const day=new Date(m[1]+"T00:00:00Z");if(!Number.isFinite(+day)||day.toISOString().slice(0,10)!==m[1])return NaN;
  if(m[5]!=="Z") {const [h,min]=m[5].slice(1).split(":").map(Number);if(h>14||min>59||(h===14&&min!==0))return NaN;}
  return Date.parse(value);
}
const icsText=(value:string)=>value.replace(/\\/g,"\\\\").replace(/\r\n?|\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
function fold(value:string) { const lines:string[]=[];let line="";for(const c of value){if(Buffer.byteLength(line+c)>75){lines.push(line);line=" ";}line+=c;}lines.push(line);return lines.join("\r\n"); }
export async function schedule(input:SkillInput,event:(m:string)=>void) {
  const rows:string[][]=parse(text(input.bytes),{bom:true,skip_empty_lines:true,max_record_size:10000,to:502});
  const headers=["id","task","owner","start","end","dependsOn"];
  if(rows.length<2||rows.length>501||rows[0].join(",")!==headers.join(","))throw Error("请使用示例CSV字段 id,task,owner,start,end,dependsOn，最多500条任务；时间必须包含时区。");
  if(rows.some(r=>r.length!==6||r.some(s=>s.length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s))))throw Error("排期字段数量不一致、内容过长或包含控制字符。");
  const tasks=rows.slice(1).map((r,i)=>({id:r[0].trim(),task:r[1].trim(),owner:r[2].trim(),start:r[3].trim(),end:r[4].trim(),dependsOn:r[5].split(";").map(s=>s.trim()).filter(Boolean),sourceRecord:i+2}));
  const findings:Finding[]=[];const ids=new Set<string>();
  for(const t of tasks){
    if(!/^[a-zA-Z0-9_-]{1,64}$/.test(t.id)||ids.has(t.id))findings.push({code:"INVALID_ID",subject:t.id,message:"任务ID必须唯一且为1–64位字母/数字/下划线/连字符。"});ids.add(t.id);
    if(!t.task||!t.owner)findings.push({code:"MISSING_FIELD",subject:t.id,message:"缺少任务名称或负责人。"});
    const start=timestamp(t.start),end=timestamp(t.end);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)findings.push({code:"INVALID_TIME",subject:t.id,message:"时间无效、缺时区或结束不晚于开始。"});
  }
  for(const t of tasks)for(const id of t.dependsOn){
    const dep=tasks.find(x=>x.id===id);
    if(!dep)findings.push({code:"MISSING_DEPENDENCY",subject:t.id,message:`依赖任务 ${id} 不存在。`});
    else if(timestamp(dep.end)>timestamp(t.start))findings.push({code:"DEPENDENCY_ORDER",subject:t.id,message:`开始早于依赖任务 ${id} 完成。`});
  }
  const cycle=cycles(new Map(tasks.map(t=>[t.id,t.dependsOn])));if(cycle.length)findings.push({code:"DEPENDENCY_CYCLE",subject:cycle.join(","),message:"任务存在循环依赖。"});
  for(let i=0;i<tasks.length;i++)for(let j=i+1;j<tasks.length;j++)if(tasks[i].owner&&tasks[i].owner===tasks[j].owner&&timestamp(tasks[i].start)<timestamp(tasks[j].end)&&timestamp(tasks[j].start)<timestamp(tasks[i].end))findings.push({code:"OWNER_OVERLAP",subject:`${tasks[i].id},${tasks[j].id}`,message:"同一负责人有时间重叠；未评估工时容量。"});
  event(`实际校验 ${tasks.length} 条任务，发现 ${findings.length} 个排期/依赖问题。`);
  const outputs:Output[]=[json("schedule-report.json",{tasks,findings,calendarExported:findings.length===0,timePolicy:"输入显式时区，导出统一UTC；不推断节假日或工时。"})];
  if(!findings.length) {
    const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");const utc=(s:string)=>new Date(timestamp(s)).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
    const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//DesignBuddy//Schedule//ZH","CALSCALE:GREGORIAN",...tasks.flatMap(t=>["BEGIN:VEVENT",`UID:${createHash("sha256").update(JSON.stringify(t)).digest("hex")}@designbuddy.local`,`DTSTAMP:${stamp}`,`DTSTART:${utc(t.start)}`,`DTEND:${utc(t.end)}`,`SUMMARY:${icsText(t.task)}`,`DESCRIPTION:${icsText(`负责人：${t.owner}；来源任务：${t.id}；依赖：${t.dependsOn.join(",")||"无"}`)}`,"END:VEVENT"]),"END:VCALENDAR"];
    outputs.push(out("schedule.ics","text/calendar; charset=utf-8",lines.map(fold).join("\r\n")+"\r\n"));
  }
  return {summary:findings.length?`已检查 ${tasks.length} 条任务，发现 ${findings.length} 个问题。仅交付问题报告，未导出日历或同步外部系统。`:`${tasks.length} 条任务通过已实现的字段/时间/依赖校验，已生成可导入日历ICS。没有创建外部日历事件或发送通知。`,outputs};
}
export async function requirements(input:SkillInput,event:(m:string)=>void) {
  let spec:unknown;try{spec=JSON.parse(text(input.bytes));}catch{throw Error("需求文件必须是有效JSON。");}
  if(!spec||typeof spec!=="object"||Array.isArray(spec))throw Error("需求文件需要对象结构。");
  const raw=spec as Record<string,unknown>;
  if(Object.keys(raw).some(k=>!["project","requirements","acceptance"].includes(k))||typeof raw.project!=="string"||!raw.project.trim()||raw.project.length>100||!Array.isArray(raw.requirements)||!Array.isArray(raw.acceptance)||raw.requirements.length>300||raw.acceptance.length>600||!raw.requirements.length)throw Error("请使用示例JSON：project、requirements（1–300项）、acceptance（最多600项）。");
  const validId=(s:unknown):s is string=>typeof s==="string"&&/^[A-Za-z0-9_-]{1,64}$/.test(s);
  const reqs=raw.requirements.map((v:any)=>{if(!v||typeof v!=="object"||!validId(v.id)||typeof v.title!=="string"||!v.title.trim()||v.title.length>300||!Array.isArray(v.dependsOn)||v.dependsOn.some((id:unknown)=>!validId(id))||v.dependsOn.length>300)throw Error("需求项须包含有效id、title和dependsOn数组。");return {id:v.id as string,title:v.title as string,dependsOn:v.dependsOn as string[]};});
  const acceptance=raw.acceptance.map((v:any)=>{if(!v||typeof v!=="object"||!validId(v.id)||!validId(v.requirementId)||typeof v.check!=="string"||!v.check.trim()||v.check.length>1000)throw Error("验收项须包含有效id、requirementId和check。");return {id:v.id as string,requirementId:v.requirementId as string,check:v.check as string};});
  const findings:Finding[]=[];
  for(const [kind,items] of [["需求",reqs],["验收",acceptance]] as const){const seen=new Set<string>();for(const item of items){if(seen.has(item.id))findings.push({code:"DUPLICATE_ID",subject:item.id,message:`${kind}ID重复。`});seen.add(item.id);}}
  const ids=new Set(reqs.map(r=>r.id));
  for(const r of reqs){for(const dep of r.dependsOn)if(!ids.has(dep))findings.push({code:"MISSING_DEPENDENCY",subject:r.id,message:`依赖需求 ${dep} 不存在。`});if(!acceptance.some(a=>a.requirementId===r.id))findings.push({code:"NO_ACCEPTANCE",subject:r.id,message:"没有关联验收条目。"});}
  for(const a of acceptance)if(!ids.has(a.requirementId))findings.push({code:"ORPHAN_ACCEPTANCE",subject:a.id,message:`引用的需求 ${a.requirementId} 不存在。`});
  const cycle=cycles(new Map(reqs.map(r=>[r.id,r.dependsOn])));if(cycle.length)findings.push({code:"DEPENDENCY_CYCLE",subject:cycle.join(","),message:"需求依赖存在循环。"});
  const lines=[`# ${raw.project.replace(/[\r\n]/g," ")}`,"","结构校验结果（未验证业务正确性或执行验收）：",...findings.map(f=>`- ${f.code} / ${f.subject}: ${f.message}`),"","## 需求与验收关联",...reqs.flatMap(r=>[`\n### ${r.id} ${r.title}`,`依赖：${r.dependsOn.join("、")||"无"}`,...acceptance.filter(a=>a.requirementId===r.id).map(a=>`- ${a.id}: ${a.check}`)])];
  event(`真实校验 ${reqs.length} 个需求、${acceptance.length} 个验收项，发现 ${findings.length} 个结构问题。`);
  return {summary:`已校验 ${reqs.length} 个需求与 ${acceptance.length} 个验收项，发现 ${findings.length} 个结构问题。没有执行验收测试，也未判断业务方案是否正确。`,outputs:[json("requirements-report.json",{project:raw.project,requirements:reqs,acceptance,findings,checks:["ID唯一性","引用存在性","验收覆盖","循环依赖"],notExecuted:"业务验收、语义质量、系统测试"}),out("traceability.md","text/markdown; charset=utf-8",lines.join("\n"))]};
}
