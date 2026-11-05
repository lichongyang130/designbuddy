import {matchFilename,fileIssues,departmentStatus} from '../collection-core.js'
import {collectionReport,collectionReminder} from './collection-report.js'
import {deliveryBasis} from './collection-workflow.js'

export function automationBasis(task){
 return JSON.stringify({delivery:deliveryBasis(task),reminder:task.reminderDraft||'',checks:task.deliveryChecks||{},checksBasis:task.deliveryChecksBasis||'',handover:task.handoverDraft||'',handoverBasis:task.handoverBasis||'',reasons:task.files.map(f=>({id:f.id,reason:f.reason||''}))})
}
export function buildCollectionPlan(task){
 const pending=task.files.filter(f=>!f.confirmed),pairs=new Map(),matches=new Map(),ids=new Map();for(const f of task.files)ids.set(f.id,(ids.get(f.id)||0)+1)
 for(const f of pending){const match=matchFilename(f.name,task.departments,task.requirements);matches.set(f,match);if(match.department&&match.requirement){const key=JSON.stringify([match.department,match.requirement]);pairs.set(key,(pairs.get(key)||0)+1)}}
 const candidates=[],skipped=[]
 for(const f of pending){
  const m=matches.get(f),req=task.requirements.find(r=>r.name===m.requirement),key=JSON.stringify([m.department,m.requirement]);let reason=''
  if(!f.id||ids.get(f.id)!==1)reason='文件记录标识缺失或重复，需人工核对'
  else if(!m.department||!m.requirement)reason='文件名无法唯一匹配部门和材料'
  else if(!String(f.reason||'').startsWith('文件名匹配：')||f.department!==m.department||f.requirement!==m.requirement)reason='归属已人工调整或与当前建议不一致'
  else if(pairs.get(key)>1)reason='同一部门和材料有多个待确认文件'
  else if(task.files.some(x=>x.confirmed&&x.final&&x.department===m.department&&x.requirement===m.requirement))reason='已有当前版本，不能自动替换'
  else if(!String(req?.types||'').trim()&&!task.unspecifiedFormatsAllowed)reason='未明确允许该材料的格式'
  else {const issues=fileIssues(f,req);if(issues.length)reason='基础检查提示：'+issues.join('；')}
  if(reason)skipped.push({id:f.id,name:f.name,reason});else candidates.push({id:f.id,name:f.name,department:m.department,requirement:m.requirement})
 }
 return {basis:automationBasis(task),candidates,skipped,createReport:!String(task.reportDraft||'').trim(),createReminder:!String(task.reminderDraft||'').trim()}
}
export function applyCollectionPlan(task,plan){
 if(automationBasis(task)!==plan.basis)throw Error('收集记录或已有草稿已变化，请重新预览。')
 const current=buildCollectionPlan(task)
 if(JSON.stringify(current.candidates)!==JSON.stringify(plan.candidates)||JSON.stringify(current.skipped)!==JSON.stringify(plan.skipped)||current.createReport!==plan.createReport||current.createReminder!==plan.createReminder)throw Error('处理条件已变化，请重新预览。')
 const ids=new Set(plan.candidates.map(x=>x.id)),next={...task,files:task.files.map(f=>ids.has(f.id)?{...f,confirmed:true,final:true,reason:'根据文件名建议，经用户批量确认'}:{...f})}
 if(plan.createReport){const generated=collectionReport(next);next.reportDraft=generated.body;next.reportBasis=generated.snapshot}
 if(plan.createReminder&&next.departments.some(d=>departmentStatus(next,d).missing.length))next.reminderDraft=collectionReminder(next)
 return next
}
