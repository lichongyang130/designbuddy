import test from 'node:test'
import assert from 'node:assert/strict'
import {collectionReport,collectionSnapshot,collectionReminder,collectionAiReference,prepareExcelAppend} from '../apps/web/public/office-workspace/collection-report.js'
const task=()=>({title:'月度总结',deadline:'2026-11-30T12:00',departments:['财务部','人事部'],requirements:[{name:'工作总结',types:'txt'}],replies:{},files:[
 {id:'one',name:'财务部-工作总结.txt',department:'财务部',requirement:'工作总结',confirmed:true,final:true,text:'本月收入100元',size:100,error:'',partial:false},
 {id:'old',name:'财务部-旧版.txt',department:'财务部',requirement:'工作总结',confirmed:true,final:false,text:'不应出现的旧版',size:100,error:'',partial:false},
 {id:'pending',name:'人事部-工作总结.txt',department:'人事部',requirement:'工作总结',confirmed:false,final:false,text:'不应出现的待确认内容',size:100,error:'',partial:false},
]})
test('collection report only excerpts confirmed current versions and explicitly shows pending and missing',()=>{
 const t=task(),result=collectionReport(t)
 assert.match(result.body,/财务部：已齐全/);assert.match(result.body,/人事部：有缺项，待核对（1 个文件待确认）/);assert.match(result.body,/不能据此断定对方未提交/)
 assert.match(result.body,/本月收入100元/);assert.doesNotMatch(result.body,/不应出现的旧版|不应出现的待确认内容/)
 assert.match(collectionReminder(t),/另有 1 个文件待确认/);assert.match(collectionReminder(t),/如已提交请协助核对/)
 assert.equal(result.snapshot,collectionSnapshot(t));t.files[0].final=false;assert.notEqual(result.snapshot,collectionSnapshot(t))
})
test('AI reference is bounded, source-labelled, and excludes old or unconfirmed material',()=>{
 const t=task();t.files[0].text='A'.repeat(13000);const ref=collectionAiReference(t)
 assert.equal(ref.text.length,12000);assert.equal(ref.truncated,true);assert.equal(ref.count,1);assert.equal(ref.hasText,true)
 assert.match(ref.text,/财务部-工作总结.txt/);assert.doesNotMatch(ref.text,/不应出现/)
 t.files[0].text='';assert.equal(collectionAiReference(t).hasText,false)
})

test('Excel check appends only to the matching, current report without mutating it',()=>{
 const t=task(),snapshot=collectionSnapshot(t),origin={taskId:t.id,snapshot};t.id='task-1';origin.taskId=t.id
 t.reportDraft='人工编辑的草稿';t.reportBasis=snapshot
 const result=prepareExcelAppend(t,origin,'【表格核对结果】\n综合部：100 元')
 assert.match(result.body,/人工编辑的草稿/);assert.match(result.body,/综合部：100 元/);assert.equal(t.reportDraft,'人工编辑的草稿')
 assert.match(prepareExcelAppend(t,{taskId:'other',snapshot},'x').error,/已切换/)
 t.files[0].final=false;assert.match(prepareExcelAppend(t,origin,'x').error,/已变化/)
 t.files[0].final=true;t.reportBasis='old';assert.match(prepareExcelAppend(t,origin,'x').error,/过期/)
})
