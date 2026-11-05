export function localDate(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`}
export function isOverdue(task,today=localDate()){return task.status!=='已完成'&&/^\d{4}-\d{2}-\d{2}$/.test(task.due||'')&&task.due<today}
export function taskSnapshot(tasks,today=localDate()){return JSON.stringify({today,tasks:tasks.map(t=>({id:t.id,title:t.title,owner:t.owner,due:t.due,status:t.status,notes:t.notes}))}) }
export function taskReport(tasks,today=localDate()){
 const lines=['工作任务进度（基于本机记录）',`任务总数：${tasks.length}；已完成：${tasks.filter(t=>t.status==='已完成').length}；未完成：${tasks.filter(t=>t.status!=='已完成').length}。`,'','一、任务明细']
 if(!tasks.length)lines.push('暂无任务记录。')
 for(const t of tasks)lines.push(`${t.title}；状态：${t.status}；责任人：${t.owner||'未填写'}；截止日期：${t.due||'未填写'}${isOverdue(t,today)?'（已超过所填日期，请人工核实）':''}${t.notes?`；备注：${t.notes}`:''}`)
 lines.push('','说明：仅根据本机记录汇总，不代表实际完成情况；请人工核对。')
 return lines.join('\n')
}
