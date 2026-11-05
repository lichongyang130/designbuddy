import {departmentStatus,fileIssues} from '../collection-core.js'
import {collectionSnapshot} from './collection-report.js'
export const DELIVERY_CHECKS=[['recipient','已人工核对交付对象和发送方式'],['content','已人工核对汇总内容、数据与来源'],['files','已人工核对最终版本及附件'],['confidentiality','已人工核对保密要求和外发权限']]
export const APPROVALS=['未确认','待审批','已批准','无需审批']
export function deliveryBasis(t){return JSON.stringify({source:collectionSnapshot(t),report:t.reportDraft||'',reportBasis:t.reportBasis||'',approval:t.approvalStatus||'未确认',reviews:(t.reviewItems||[]).map(x=>({id:x.id,text:x.text,done:!!x.done}))})}
export function handoverBasis(t){return JSON.stringify({delivery:deliveryBasis(t),checksBasis:t.deliveryChecksBasis||'',checks:t.deliveryChecks||{}})}
export function workflowState(t){
 const incomplete=[];if(!t.departments?.length)incomplete.push('部门名单未设置');if(!t.requirements?.length)incomplete.push('材料要求未设置');else if(t.requirements.some(r=>!String(r.types||'').trim())&&!t.unspecifiedFormatsAllowed)incomplete.push('部分材料未指定格式，请确认是否不限');if(!String(t.deliveryTo||'').trim())incomplete.push('交付对象未填写');if(!t.deadline&&!t.noDeadline)incomplete.push('截止时间未填写，也未标明无固定截止')
 const rows=t.departments.map(department=>({department,...departmentStatus(t,department)})),pending=t.files.filter(f=>!f.confirmed).length,missing=rows.filter(r=>r.missing.length),issues=rows.filter(r=>r.issues.length),unreviewedIssues=t.files.filter(f=>f.confirmed&&f.final&&!f.issueReviewed&&fileIssues(f,t.requirements.find(r=>r.name===f.requirement)).length),reviews=(t.reviewItems||[]).filter(x=>!x.done),approval=APPROVALS.includes(t.approvalStatus)?t.approvalStatus:'未确认'
 const report=!!String(t.reportDraft||'').trim(),reportCurrent=report&&t.reportBasis===collectionSnapshot(t),basis=deliveryBasis(t),checksCurrent=t.deliveryChecksBasis===basis,checks=checksCurrent?(t.deliveryChecks||{}):{},checksDone=DELIVERY_CHECKS.every(([key])=>checks[key]===true)
 let stage=incomplete.length?'待补充要求':pending?'待核对材料':missing.length?'等待材料':unreviewedIssues.length?'待处理材料问题':reviews.length?'待处理修改意见':!report?'待形成汇总':!reportCurrent?'待核对汇总':approval==='待审批'?'等待审批（人工记录）':approval==='未确认'?'待确认审批情况':!checksDone?'待人工交付检查':'人工检查已确认'
 return {stage,incomplete,rows,pending,missing,issues,unreviewedIssues,reviews,approval,report,reportCurrent,checksCurrent,checksDone}
}
export function handoverText(t){
 const s=workflowState(t),lines=[`工作交接：${t.title}`,`当前状态：${s.stage}`,`交付对象：${String(t.deliveryTo||'').trim()||'未填写'}`,`工作联系人：${String(t.contact||'').trim()||'未填写'}`,`截止时间：${t.deadline?t.deadline.replace('T',' '):t.noDeadline?'已标记无固定截止':'未填写'}`,`审批情况：${s.approval}（人工记录，未连接审批系统）`,`部门总数：${s.rows.length}；当前确认记录有缺项的部门：${s.missing.length}；待确认文件：${s.pending}。`,`材料要求：${t.requirements.map(r=>`${r.name}（${r.types|| (t.unspecifiedFormatsAllowed?'已确认不限格式':'格式未明确')}）`).join('、')||'未填写'}`]
 if(s.incomplete.length)lines.push(`待补充要求：${s.incomplete.join('；')}。`)
 if(s.missing.length){lines.push('','当前确认记录中的缺项（可能有待确认文件，请人工核对）：');for(const r of s.missing)lines.push(`${r.department}：${r.missing.join('、')}${r.pending?`；${r.pending} 个文件待确认`:''}`)}
 if(s.issues.length){lines.push('','基础检查提示：');for(const r of s.issues)lines.push(`${r.department}：${r.issues.join('；')}${s.unreviewedIssues.some(f=>f.department===r.department)?'（仍有提示未人工复核）':'（已人工复核，不代表问题已解决）'}`)}
 lines.push('','修改意见（人工记录）：');if(!(t.reviewItems||[]).length)lines.push('尚未记录修改意见。');else for(const x of t.reviewItems)lines.push(`${x.done?'已标记处理':'待处理'}：${x.text}`)
 lines.push('',`汇总草稿：${s.report?s.reportCurrent?'已生成或编辑，仍需人工核对':'已有草稿，但记录已变化或无生成依据':'尚未形成'}`,`交付检查：${s.checksCurrent&&s.checksDone?'已逐项人工确认':'未全部确认或记录已变化'}`,'','下一步（基于记录的提示）：')
 const next=[];if(s.incomplete.length)next.push('补充或确认尚不明确的交付要求。');if(s.pending)next.push('人工核对待确认文件的归属与版本。');if(s.missing.length)next.push('核实当前登记缺项，必要时手动催办。');if(s.unreviewedIssues.length)next.push('人工核对材料基础检查提示。');if(s.reviews.length)next.push('处理并人工标记尚未完成的修改意见。');if(!s.report||!s.reportCurrent)next.push('形成或重新核对汇总草稿。');if(s.approval==='待审批')next.push('手动跟进审批进度。');else if(s.approval==='未确认')next.push('确认是否需要审批。');if(!s.checksCurrent||!s.checksDone)next.push('逐项人工完成交付前检查。');if(!next.length)next.push('按确认的对象和方式自行交付，并核实对方是否收到。')
 lines.push(...next,'','说明：以上仅依据当前本机记录生成，其他页面的更改不会实时同步；不代表实际提交、审批或发送情况，交接前请人工核对。')
 return lines.join('\n')
}
