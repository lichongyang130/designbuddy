import test from 'node:test'
import assert from 'node:assert/strict'
import {buildCollectionPlan,applyCollectionPlan} from '../apps/web/public/office-workspace/collection-automation.js'
function task(){const departments=Array.from({length:12},(_,i)=>`部门${String(i+1).padStart(2,'0')}`);return {title:'月度总结',deadline:'',departments,requirements:[{name:'工作总结',types:'txt',keywords:''}],replies:{},files:departments.map((d,i)=>({id:`f${i}`,name:`${d}-工作总结.txt`,department:d,requirement:'工作总结',confirmed:false,final:false,reason:'文件名匹配：自动建议',size:10,text:`${d} 内容`,error:'',partial:false}))}}
test('preview and apply only uniquely matched, issue-free files without modifying original',()=>{
 const t=task();t.files[8].error='无法提取';t.files[9].partial=true;t.files[10].reason='人工修改后，请重新确认';t.files[11].department='部门01'
 const plan=buildCollectionPlan(t);assert.equal(plan.candidates.length,8);assert.equal(plan.skipped.length,4);const result=applyCollectionPlan(t,plan)
 assert.equal(t.files.filter(x=>x.confirmed).length,0);assert.equal(result.files.filter(x=>x.confirmed&&x.final).length,8);assert.match(result.reportDraft,/部门01 内容/);assert.doesNotMatch(result.reportDraft,/部门09 内容/)
 assert.match(result.reminderDraft,/部门09/);assert.match(result.reminderDraft,/当前确认记录/);assert.equal(result.files[8].confirmed,false)
})
test('duplicates, existing versions, unknown formats and changed previews are never auto-confirmed',()=>{
 const t=task();t.files=t.files.slice(0,3);t.files.push({...t.files[0],id:'dup',name:'部门01-工作总结-副本.txt'});t.files[1].confirmed=true;t.files[1].final=true;t.files.push({...t.files[1],id:'replacement',confirmed:false,final:false,name:'部门02-工作总结-新版.txt'});t.requirements[0].types='';t.reportDraft='用户已有汇总';t.reminderDraft='用户已有催办'
 const plan=buildCollectionPlan(t);assert.equal(plan.candidates.length,0);assert.ok(plan.skipped.some(x=>x.reason.includes('多个待确认')));assert.ok(plan.skipped.some(x=>x.reason.includes('已有当前版本')));assert.ok(plan.skipped.some(x=>x.reason.includes('格式')))
 const next=applyCollectionPlan(t,plan);assert.equal(next.reportDraft,'用户已有汇总');assert.equal(next.reminderDraft,'用户已有催办')
 t.reportDraft='人工修改';assert.throws(()=>applyCollectionPlan(t,plan),/已变化/)
})
test('duplicate file identifiers and altered checklist invalidate a preview',()=>{
 const t=task();t.files[1].id=t.files[0].id;let plan=buildCollectionPlan(t);assert.ok(plan.skipped.filter(x=>x.reason.includes('标识')).length===2)
 t.deliveryChecks={recipient:true};assert.throws(()=>applyCollectionPlan(t,plan),/已变化/)
})
