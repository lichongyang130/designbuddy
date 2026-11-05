import test from 'node:test'
import assert from 'node:assert/strict'
import {collectionSnapshot} from '../apps/web/public/office-workspace/collection-report.js'
import {DELIVERY_CHECKS,deliveryBasis,handoverBasis,workflowState,handoverText} from '../apps/web/public/office-workspace/collection-workflow.js'
function makeTask(){return {title:'月度收集',deadline:'',departments:['财务部'],requirements:[{name:'总结',types:'txt'}],replies:{},files:[],reportDraft:'',reviewItems:[]}}
test('workflow never treats missing data or unchecked human assertions as completed',()=>{
 const t=makeTask();assert.equal(workflowState(t).stage,'待补充要求');assert.match(handoverText(t),/工作联系人：未填写/)
 t.deliveryTo='办公室';t.noDeadline=true;assert.equal(workflowState(t).stage,'等待材料')
 t.files.push({id:'1',name:'总结.txt',department:'财务部',requirement:'总结',confirmed:false,final:false,size:10,text:'内容',error:'',partial:false})
 assert.equal(workflowState(t).stage,'待核对材料');t.files[0].confirmed=true;t.files[0].final=true
 t.files[0].partial=true;assert.equal(workflowState(t).stage,'待处理材料问题');t.files[0].issueReviewed=true;assert.equal(workflowState(t).stage,'待形成汇总');assert.match(handoverText(t),/已人工复核，不代表问题已解决/);t.files[0].partial=false;t.files[0].issueReviewed=false
 t.reviewItems=[{id:'r',text:'补充说明',done:false}];assert.equal(workflowState(t).stage,'待处理修改意见')
 t.reviewItems[0].done=true;assert.equal(workflowState(t).stage,'待形成汇总');t.reportDraft='报告正文';t.reportBasis=collectionSnapshot(t)
 assert.equal(workflowState(t).stage,'待确认审批情况');t.approvalStatus='待审批';assert.equal(workflowState(t).stage,'等待审批（人工记录）')
 t.approvalStatus='无需审批';t.deliveryChecksBasis=deliveryBasis(t);t.deliveryChecks=Object.fromEntries(DELIVERY_CHECKS.map(([key])=>[key,true]));assert.equal(workflowState(t).stage,'人工检查已确认')
 const handover=handoverText(t);assert.match(handover,/不代表实际提交、审批或发送情况/);assert.match(handover,/已标记处理：补充说明/)
 const basis=handoverBasis(t);t.reportDraft+='变更';assert.equal(workflowState(t).stage,'待人工交付检查');assert.notEqual(basis,handoverBasis(t))
 t.deliveryTo='其他对象';assert.equal(workflowState(t).stage,'待核对汇总')
})
test('existing collection snapshots remain compatible until new requirements are set',()=>{
 const t=makeTask(),legacy=JSON.stringify({title:t.title,deadline:t.deadline,departments:t.departments,requirements:t.requirements,replies:t.replies,files:[]})
 assert.equal(collectionSnapshot(t),legacy);t.deliveryTo='办公室';assert.notEqual(collectionSnapshot(t),legacy)
})

test('unspecified formats require explicit human confirmation',()=>{
 const t=makeTask();t.deliveryTo='办公室';t.noDeadline=true;t.requirements[0].types=''
 assert.match(workflowState(t).incomplete.join('；'),/未指定格式/);t.unspecifiedFormatsAllowed=true
 assert.doesNotMatch(workflowState(t).incomplete.join('；'),/未指定格式/)
})
