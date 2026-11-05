import {departmentStatus} from '../collection-core.js'

// Only confirmed current versions are used as source material; status and omissions are explicit.
export function collectionSnapshot(task){
 const snapshot={title:task.title,deadline:task.deadline,departments:task.departments,requirements:task.requirements,replies:task.replies,files:task.files.map(f=>({id:f.id,name:f.name,department:f.department,requirement:f.requirement,confirmed:f.confirmed,final:f.final,size:f.size,error:f.error,partial:f.partial,text:f.text,...(f.issueReviewed?{issueReviewed:true}:{})}))}
 // Keep snapshots of existing tasks stable until a new delivery requirement is actually set.
 if(task.deliveryTo)snapshot.deliveryTo=task.deliveryTo;if(task.contact)snapshot.contact=task.contact;if(task.unspecifiedFormatsAllowed)snapshot.unspecifiedFormatsAllowed=true;if(task.noDeadline)snapshot.noDeadline=true
 return JSON.stringify(snapshot)
}
export function collectionReport(task){
 const rows=task.departments.map(department=>({department,...departmentStatus(task,department)}))
 const complete=rows.filter(r=>r.status==='已齐全').length, missing=rows.filter(r=>r.missing.length).length, pending=task.files.filter(f=>!f.confirmed).length
 const lines=[`收集任务：${task.title}`,`截止时间：${task.deadline?task.deadline.replace('T',' '):task.noDeadline?'已标记无固定截止':'未设置'}`,`交付对象：${task.deliveryTo||'未填写'}`,`部门总数：${rows.length}；按当前确认记录已齐全：${complete}；有缺项：${missing}；待确认文件：${pending}。`,'说明：未确认文件不计入；缺项可能包含待确认文件，不能据此断定对方未提交。格式与提取提示仅为基础检查，不代表内容已审核。','', '一、各部门收集情况']
 for(const r of rows){const state=r.pending&&r.missing.length?`有缺项，待核对（${r.pending} 个文件待确认）`:r.status;lines.push(`${r.department}：${state}${r.missing.length?`；当前确认记录缺：${r.missing.join('、')}`:''}${r.issues.length?`；检查提示：${r.issues.join('；')}`:''}`)}
 const current=task.files.filter(f=>f.confirmed&&f.final)
 lines.push('','二、已确认材料摘录（原文片段，非完整内容）')
 if(!current.length)lines.push('暂无已确认的当前版本材料。')
 for(const f of current){const text=String(f.text||'').trim();lines.push(`【${f.department} / ${f.requirement} / ${f.name}】`,text?text.slice(0,600)+(text.length>600?'……［摘录截断，请查看原文件］':''):'［未提取到正文，请查看原文件］');if(f.partial||f.error)lines.push('［提取不完整或存在检查提示，请人工核对原文件］')}
 lines.push('','三、待办','请核对待确认文件和缺项，必要时人工催办；对原文件内容、数字和最终报告进行审核。')
 return {title:`${task.title}收集情况汇总`,body:lines.join('\n'),snapshot:collectionSnapshot(task),current}
}
export function collectionReminder(task){
 const rows=task.departments.map(department=>({department,...departmentStatus(task,department)})).filter(row=>row.missing.length)
 if(!rows.length)return '当前确认记录中没有缺项。'
 return `关于“${task.title}”的材料核对提醒\n\n${rows.map(r=>`${r.department}：当前确认记录缺 ${r.missing.join('、')}${r.pending?`，另有 ${r.pending} 个文件待确认`:''}`).join('\n')}\n\n以上仅为当前登记情况，如已提交请协助核对。${task.deadline?`\n截止时间：${task.deadline.replace('T',' ')}。`:''}`
}
export function collectionAiReference(task,max=12000){
 const current=task.files.filter(f=>f.confirmed&&f.final),parts=[];let offset=0,hasText=false
 for(const f of current){const head=`【来源：${f.department} / ${f.requirement} / ${f.name}】\n`,source=String(f.text||''),part=head+(source||'［未提取到正文］')+(f.partial||f.error?'\n［提取不完整或存在检查提示］':'');if(source.slice(0,Math.max(0,max-offset-head.length)).trim())hasText=true;parts.push(part);offset+=part.length+2}
 const all=parts.join('\n\n')
 return {text:all.slice(0,max),truncated:all.length>max,count:current.length,hasText}
}

// Prepare without mutating: the caller must ask for confirmation before applying.
export function prepareExcelAppend(task,origin,text){
 if(!task||task.id!==origin?.taskId)return {error:'收集任务已切换，请返回原任务后重新核对。'}
 const snapshot=collectionSnapshot(task)
 if(snapshot!==origin.snapshot)return {error:'收集记录已变化，请返回收集任务重新核对表格。'}
 if(task.reportDraft?.trim()&&task.reportBasis!==snapshot)return {error:'现有汇总草稿可能过期或没有生成依据，请先在收集任务中核对并重新生成。'}
 const base=task.reportDraft?.trim()?task.reportDraft:collectionReport(task).body
 return {body:base+'\n\n'+text,basis:snapshot}
}
