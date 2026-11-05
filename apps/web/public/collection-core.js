// Explicit human confirmation is required before an imported file counts as submitted.
export function parseLines(text){return [...new Set(String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))]}
export function matchFilename(name,departments,requirements){
 const norm=x=>String(x).toLowerCase().replace(/[\s_\-（）()]/g,'')
 const n=norm(name), ds=departments.filter(x=>norm(x)&&n.includes(norm(x))), rs=requirements.filter(x=>norm(x.name)&&n.includes(norm(x.name)))
 return {department:ds.length===1?ds[0]:'',requirement:rs.length===1?rs[0].name:'',reason:`文件名匹配：${ds.length===1?ds[0]:ds.length?'多个部门':'未识别部门'}；${rs.length===1?rs[0].name:rs.length?'多个材料':'未识别材料'}`}
}
export function fileIssues(record,requirement){
 const issues=[];const extension=(record.name.split('.').pop()||'').toLowerCase();const expected=String(requirement?.types||'').toLowerCase().split(/[\s,，、/]+/).map(x=>x.replace(/^\./,'')).filter(Boolean)
 if(expected.length&&!expected.includes(extension))issues.push(`格式不符：要求 ${expected.join(' / ')}，实际 ${extension||'无后缀'}`)
 if(!record.size)issues.push('文件为空')
 if(record.error)issues.push(`无法验证文件：${record.error}`)
 if(record.partial)issues.push('只提取了部分内容，需人工核对')
 const keywords=String(requirement?.keywords||'').split(/[，,、]+/).map(x=>x.trim()).filter(Boolean)
 if(keywords.length&&!record.text)issues.push('无法检查内容关键词，需人工核对')
 else if(keywords.length){const missing=keywords.filter(k=>!record.text.includes(k));if(missing.length)issues.push(`未找到关键词：${missing.join('、')}（仅机械匹配，需人工核对）`)}
 return issues
}
export function departmentStatus(task,department){
 const confirmed=task.files.filter(f=>f.department===department&&f.confirmed), pending=task.files.filter(f=>f.department===department&&!f.confirmed)
 const missing=task.requirements.filter(r=>!confirmed.some(f=>f.requirement===r.name&&f.final))
 const issues=confirmed.filter(f=>f.final).flatMap(f=>fileIssues(f,task.requirements.find(r=>r.name===f.requirement)))
 let status=!confirmed.length?'未提交':missing.length?'部分提交':issues.length?'需补正':'已齐全'
 return {status,missing:missing.map(x=>x.name),issues,pending:pending.length}
}
export function reminder(task,departments,mode){
 const lines=[]
 for(const dept of departments){const s=departmentStatus(task,dept),reply=task.replies[dept]||'未确认';if(mode==='reply'&&reply==='未确认')lines.push(dept);if(mode==='missing'&&s.missing.length)lines.push(`${dept}（缺：${s.missing.join('、')}）`);if(mode==='issues'&&s.issues.length)lines.push(`${dept}（${s.issues.join('；')}）`)}
 if(!lines.length)return ''
 const action=mode==='reply'?'请确认是否收到通知':mode==='issues'?'请核对并补正材料':'请按要求提交尚缺材料'
 return `关于“${task.title}”的提醒\n\n${lines.join('、')}：\n\n${action}。${task.deadline?`截止时间：${task.deadline.replace('T',' ')}。`:''}\n材料要求：${task.requirements.map(r=>`${r.name}${r.types?`（${r.types}）`:''}`).join('、')}。\n\n请相关部门核实后办理。`
}
export function csvCell(value){const s=String(value??'');return '"'+(/^[\s\t\r\n]*[=+\-@]/.test(s)?"'"+s:s).replace(/"/g,'""')+'"'}
export function progressCsv(task){
 const rows=[['部门','回复状态','材料状态','缺少材料','检查问题','待确认文件数'],...task.departments.map(d=>{const s=departmentStatus(task,d);return [d,task.replies[d]||'未确认',s.status,s.missing.join('、'),s.issues.join('；'),s.pending]})]
 return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')
}
