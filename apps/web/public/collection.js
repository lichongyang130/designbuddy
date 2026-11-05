import {indexFile,SUPPORTED} from './file-buddy-core.js'
import {parseLines,matchFilename,fileIssues,departmentStatus,reminder,progressCsv,csvCell} from './collection-core.js'
const $=id=>document.getElementById(id), el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
let rpcCall=null,tasks=[],active='',ready=false,db=null,writeQueue=Promise.resolve(),busy=false
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`
const current=()=>tasks.find(t=>t.id===active)
function status(text){$('cmStatus').textContent=text}
async function openDB(){return new Promise((resolve,reject)=>{if(!globalThis.indexedDB)return reject(Error('浏览器不支持本地数据库'));const req=indexedDB.open('designbuddy-collection',1);req.onupgradeneeded=()=>req.result.createObjectStore('data');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function readDB(){return new Promise((resolve,reject)=>{const req=db.transaction('data').objectStore('data').get('tasks');req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)})}
function persist(){
 $('cmReminderText').dataset.generated='no'
 if(!db){status('本地数据库不可用；当前更改仅在本页面会话保留，请勿刷新。');return}
 let snapshot;try{snapshot=structuredClone(tasks)}catch(e){status('无法保存数据；当前更改仅在本页面会话保留。');return}
 writeQueue=writeQueue.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(snapshot,'tasks');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})).then(()=>status('已保存到当前浏览器的本地数据库。文件和台账不会自动同步到其他设备。')).catch(e=>status(`本地保存失败：${e?.message||e}。当前更改仅在本页面会话保留，请勿刷新。`))
}
function option(select,value,label=value){const n=el('option',label);n.value=value;select.append(n)}
function formatTime(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.valueOf())?'—':d.toLocaleString()}
function download(file,name,type){const url=URL.createObjectURL(new Blob([file],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}
function safeName(s){return String(s).replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').slice(0,80)||'资料收集'}
function render(){
 const selector=$('cmTask');selector.replaceChildren();option(selector,'','选择任务');for(const t of tasks)option(selector,t.id,t.title);selector.value=active
 const task=current();$('cmWorkspace').hidden=!task;if(!task)return
 $('cmTaskTitle').textContent=task.title;$('cmTaskMeta').textContent=`截止：${task.deadline?task.deadline.replace('T',' '):'未设置'} · ${task.departments.length} 个部门 · ${task.requirements.length} 类必交材料`
 const states=task.departments.map(d=>departmentStatus(task,d)), counts=[task.departments.length,states.filter(s=>s.status==='已齐全').length,states.filter(s=>s.missing.length).length,task.files.filter(f=>!f.confirmed).length]
 $('cmStats').replaceChildren(...counts.map((count,i)=>{const box=el('div',undefined,'cm-stat');box.append(el('strong',String(count)),el('span',['部门总数','已齐全','存在缺项','待确认文件'][i]));return box}))
 const body=$('cmDepartments');body.replaceChildren();for(const d of task.departments){const s=departmentStatus(task,d),tr=el('tr'),reply=el('select');for(const v of ['未确认','已回复'])option(reply,v);reply.value=task.replies[d]||'未确认';reply.setAttribute('aria-label',`${d}回复状态`);reply.onchange=()=>{task.replies[d]=reply.value;task.log.push({at:Date.now(),text:`${d}：回复状态改为${reply.value}（手动记录）`});persist();render()};const replyTd=el('td');replyTd.append(reply);const missing=s.missing.join('、')||'—',issues=s.issues.join('；')||'—';tr.append(el('td',d),replyTd,el('td',s.status),el('td',missing),el('td',issues),el('td',String(s.pending)));body.append(tr)}
 const files=$('cmFiles');files.replaceChildren();if(!task.files.length)files.append(el('p','尚未导入材料。文件名匹配仅作为建议，必须人工确认后才计入。','cm-small'))
 for(const f of task.files){
  const card=el('article',undefined,'cm-file'),head=el('div',undefined,'cm-file-head'),title=el('strong',f.name),tag=el('span',f.confirmed?(f.final?'已确认 · 当前版本':'已确认 · 历史版本'):'待人工确认','cm-tag');head.append(title,tag);card.append(head,el('p',`来源：${f.source} · 路径：${f.path} · 导入时间：${formatTime(f.importedAt)}（不是实际提交时间） · ${(f.size/1024).toFixed(1)} KB`,'cm-small'),el('p',f.reason,'cm-small'))
  const grid=el('div',undefined,'cm-file-grid'),ds=el('select'),rs=el('select');option(ds,'','选择部门');task.departments.forEach(x=>option(ds,x));ds.value=f.department||'';option(rs,'','选择材料');task.requirements.forEach(x=>option(rs,x.name));rs.value=f.requirement||'';ds.setAttribute('aria-label',`${f.name}所属部门`);rs.setAttribute('aria-label',`${f.name}材料类型`)
  const change=()=>{f.department=ds.value;f.requirement=rs.value;f.confirmed=false;f.final=false;f.reason='人工修改了归属，请重新确认。';f.aiReview='';persist();render()};ds.onchange=change;rs.onchange=change;grid.append(ds,rs);card.append(grid)
  const req=task.requirements.find(r=>r.name===f.requirement),issues=fileIssues(f,req);if(issues.length)card.append(el('p',`检查提示：${issues.join('；')}`,'cm-small cm-warning'))
  if(f.aiReview)card.append(el('pre',`AI 辅助检查（仅供审核，可能出错）：\n${f.aiReview}`,'cm-output'));
  const actions=el('div',undefined,'cm-actions'),confirm=el('button',f.confirmed?'设为当前版本':'确认归属并设为当前版本','primary');confirm.disabled=!f.department||!f.requirement;confirm.onclick=()=>{if(f.confirmed&&f.final)return;const existing=task.files.find(other=>other.id!==f.id&&other.department===f.department&&other.requirement===f.requirement&&other.final);if(existing&&!window.confirm(`将“${existing.name}”保留为历史版本，并把“${f.name}”设为当前版本？`))return;for(const other of task.files)if(other.department===f.department&&other.requirement===f.requirement)other.final=false;f.confirmed=true;f.final=true;task.log.push({at:Date.now(),text:`确认 ${f.name} 为 ${f.department} / ${f.requirement} 当前版本`});persist();render()};actions.append(confirm)
  const open=el('button','下载原文件');open.disabled=!f.file;open.onclick=()=>{const url=URL.createObjectURL(f.file),a=el('a');a.href=url;a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)};actions.append(open)
  const ai=el('button','AI 辅助检查');ai.disabled=!f.text||!f.requirement;ai.onclick=async()=>{if(!window.confirm('将材料提取的最多 12000 字和材料要求发送给所配置的模型服务。请确认有权处理这些内容，是否继续？'))return;ai.disabled=true;status('正在请求 AI 辅助检查…');try{const req=task.requirements.find(r=>r.name===f.requirement),answer=await rpcCall('word.assist',{kind:'报告',brief:`检查这份提交材料是否符合以下要求：材料名称 ${req?.name}，文件格式 ${req?.types||'不限'}，内容关键词 ${req?.keywords||'未指定'}。只根据参考文字指出已发现内容、疑似缺项和不能判断之处，不要编造事实；这是辅助意见，需要人工审核。`,reference:f.text},65000);f.aiReview=[answer.title,answer.body].filter(Boolean).join('\n');task.log.push({at:Date.now(),text:`AI 辅助检查 ${f.name}；结果待人工审核`});persist();render();status('AI 辅助检查已完成，不会自动更改提交状态，请人工审核。')}catch(e){status(`AI 辅助检查失败：${e?.message||e}。请检查模型配置或手动审核。`);ai.disabled=false}};actions.append(ai)
  const remove=el('button','移除记录');remove.onclick=()=>{if(!window.confirm(`确定移除“${f.name}”的记录及本地保存的副本？不会删除原文件。`))return;task.files=task.files.filter(x=>x.id!==f.id);task.log.push({at:Date.now(),text:`移除记录 ${f.name}`});persist();render()};actions.append(remove);card.append(actions);files.append(card)
 }
 $('cmLog').textContent=task.log.slice(-30).reverse().map(x=>`${formatTime(x.at)}  ${x.text}`).join('\n')||'暂无记录。'
}
async function addFiles(input,source='手动导入'){
 const task=current();if(!task||busy)return;const list=Array.from(input||[]);if(!list.length)return
 if(list.length+task.files.length>100){status('每个任务最多 100 个文件；未导入本次文件。');return}
 if(list.some(f=>f.size>10*1024*1024)||list.reduce((n,f)=>n+f.size,0)+task.files.reduce((n,f)=>n+f.size,0)>50*1024*1024){status('每个文件最多 10 MB，每个任务文件总计最多 50 MB；未导入本次文件。');return}
 busy=true;const taskId=task.id;let skipped=0;for(const file of list){
  if(!SUPPORTED.test(file.name)){skipped++;continue}status(`正在检查 ${file.name}…`)
  const row=await indexFile(file);const match=matchFilename(file.name,task.departments,task.requirements)
  task.files.push({id:uid(),file,name:file.name,size:file.size,source,path:file.webkitRelativePath||file.name,importedAt:Date.now(),department:match.department,requirement:match.requirement,reason:match.reason,confirmed:false,final:false,error:row.error||(!row.text?row.status:''),partial:!!row.partial||row.text.length>12000,text:row.text.slice(0,12000),aiReview:''})
 }
 task.log.push({at:Date.now(),text:`导入 ${list.length-skipped} 个文件（${source}）；自动匹配结果待确认`});busy=false;persist();if(active===taskId)render();status(`已导入 ${list.length-skipped} 个文件，${skipped} 个格式不支持；请逐一确认。导入时间不代表真实提交时间。`)
}
function resetOutputs(){$('cmReminderText').value='';$('cmReminderText').dataset.generated='no';$('cmSummary').value=''}
function createTask(update=false){
 const title=$('cmTitle').value.trim(),departments=parseLines($('cmDeptInput').value),raw=parseLines($('cmRequirementInput').value),requirements=raw.map(line=>{const [name,types='',keywords='']=line.split('|');return {name:name.trim(),types:types.trim(),keywords:keywords.trim()}})
 if(!title||!departments.length||!requirements.length||requirements.some(r=>!r.name)){status('请填写任务名称、至少一个部门和一项材料。');return}
 if(title.length>120||departments.length>100||requirements.length>30||departments.some(x=>x.length>80)||requirements.some(x=>x.name.length>80)||new Set(requirements.map(x=>x.name)).size!==requirements.length){status('任务名称最多 120 字，最多 100 个部门、30 类材料；名称不可重复或超过 80 字。');return}
 if(update){const task=current();if(!task){status('请先选择任务。');return}if(!window.confirm('更新任务设置？被移除的部门或材料关联将变为待确认；原文件保留。'))return;Object.assign(task,{title,deadline:$('cmDeadline').value,departments,requirements});for(const f of task.files)if(!departments.includes(f.department)||!requirements.some(r=>r.name===f.requirement)){if(!departments.includes(f.department))f.department='';if(!requirements.some(r=>r.name===f.requirement))f.requirement='';f.confirmed=false;f.final=false;f.aiReview='';f.reason='任务设置已变更，请重新确认归属。'}task.log.push({at:Date.now(),text:'更新任务设置'});resetOutputs();persist();render();status('任务设置已更新。');return}
 const task={id:uid(),title,deadline:$('cmDeadline').value,departments,requirements,replies:{},files:[],log:[{at:Date.now(),text:'创建任务'}]};tasks.push(task);active=task.id;resetOutputs();persist();render();status('任务已创建。请导入材料并确认归属。')
}
export function mountCollection(rpc){
 rpcCall=rpc
 $('cmCreate').disabled=true
 $('cmCreate').onclick=()=>createTask(false);$('cmUpdate').onclick=()=>createTask(true);$('cmTask').onchange=e=>{active=e.target.value;resetOutputs();render()}
 $('cmEdit').onclick=()=>{const t=current();if(!t)return;$('cmTitle').value=t.title;$('cmDeadline').value=t.deadline;$('cmDeptInput').value=t.departments.join('\n');$('cmRequirementInput').value=t.requirements.map(r=>`${r.name}${r.types||r.keywords?' | '+r.types:''}${r.keywords?' | '+r.keywords:''}`).join('\n');status('已载入任务设置到左侧，修改后点击更新当前任务。')};
 $('cmClone').onclick=()=>{const t=current();if(!t)return;$('cmTitle').value=t.title+'（新一期）';$('cmDeadline').value='';$('cmDeptInput').value=t.departments.join('\n');$('cmRequirementInput').value=t.requirements.map(r=>`${r.name}${r.types||r.keywords?' | '+r.types:''}${r.keywords?' | '+r.keywords:''}`).join('\n');status('已复制任务设置到左侧，请修改后点击创建；不会复制文件和回复状态。')}
 $('cmDelete').onclick=()=>{const t=current();if(!t||!window.confirm(`确定删除任务“${t.title}”及其本地文件副本？原文件不会删除。`))return;tasks=tasks.filter(x=>x.id!==active);active='';resetOutputs();persist();render()}
 $('cmPick').onclick=()=>$('cmInput').click();$('cmFolderPick').onclick=()=>$('cmFolderInput').click()
 for(const id of ['cmInput','cmFolderInput'])$(id).onchange=e=>{const files=Array.from(e.target.files||[]);e.target.value='';void addFiles(files,id==='cmFolderInput'?'本地文件夹导入':'手动导入')}
 window.addEventListener('collection:receive-files',e=>{if(!current()){status('请先创建或选择收集任务，再从文件管家添加文件。');return}void addFiles(e.detail,'文件管家（手动选择）')})
 $('cmExportFiles').onclick=()=>{const t=current();if(!t)return;const rows=[['文件名','来源','路径','导入时间（非提交时间）','建议或确认部门','材料类别','人工确认','当前版本','检查提示'],...t.files.map(f=>[f.name,f.source,f.path,formatTime(f.importedAt),f.department,f.requirement,f.confirmed?'是':'否',f.final?'是':'否',fileIssues(f,t.requirements.find(r=>r.name===f.requirement)).join('；')])];download('\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),safeName(t.title)+'-材料清单.csv','text/csv;charset=utf-8')}
 $('cmExport').onclick=()=>{const t=current();if(t)download(progressCsv(t),safeName(t.title)+'-进度.csv','text/csv;charset=utf-8')}
 $('cmNotice').onclick=()=>{const t=current();if(!t)return;$('cmReminderText').value=`关于“${t.title}”的通知\n\n${t.departments.join('、')}：\n\n请按要求提交以下材料：${t.requirements.map(r=>`${r.name}${r.types?`（${r.types}）`:''}${r.keywords?`，内容参考：${r.keywords}`:''}`).join('；')}。${t.deadline?`\n截止时间：${t.deadline.replace('T',' ')}。`:''}\n\n请各部门核对要求后办理。`; $('cmReminderText').dataset.generated='yes'}
 $('cmReminder').onclick=()=>{const t=current();if(!t)return;const mode=$('cmReminderMode').value,text=reminder(t,t.departments,mode);$('cmReminderText').value=text||'当前没有符合条件的部门。';$('cmReminderText').dataset.generated=text?'yes':'no'}
 $('cmCopy').onclick=async()=>{const text=$('cmReminderText').value;if(!text||$('cmReminderText').dataset.generated!=='yes')return;try{await navigator.clipboard.writeText(text);status('已复制催办内容；复制不代表已发送。')}catch{status('无法自动复制，请手动选择并复制催办内容。');$('cmReminderText').select()}}
 $('cmSummaryLocal').onclick=()=>{const t=current();if(!t)return;const rows=t.departments.map(d=>{const st=departmentStatus(t,d);return `${d}：${st.status}${st.missing.length?`，缺少${st.missing.join('、')}`:''}${st.issues.length?`；提示：${st.issues.join('；')}`:''}`});$('cmSummary').value=`${t.title} · 收集进度\n\n${rows.join('\n')}\n\n以上为台账统计，不代表材料内容或实际提交时间已核实。`}
 $('cmSummaryAI').onclick=async()=>{const t=current();if(!t)return;const selected=t.files.filter(f=>f.confirmed&&f.final);if(!selected.length){status('请先确认材料并设定当前版本。');return}if(selected.some(f=>!f.text)){status('部分当前版本没有可提取的文字，无法完整汇总，请先人工核查。');return}const reference=selected.map(f=>`部门：${f.department}；材料：${f.requirement}；文件：${f.name}\n${f.text}`).join('\n\n');if(reference.length>12000){status('当前已确认材料提取文字合计超过 12000 字；本版无法完整发送，请分任务或手动汇总。');return}if(!window.confirm(`将 ${selected.length} 份已确认材料的提取文字发送给配置的模型服务生成汇总初稿；部分材料可能只提取了前 12000 字或部分内容。请确认有权处理，是否继续？`))return;const btn=$('cmSummaryAI');btn.disabled=true;status('正在请求 AI 汇总…');try{const answer=await rpcCall('word.assist',{kind:'报告',brief:`基于参考材料撰写“${t.title}”汇总初稿，按部门标注信息来源和文件名，不得虚构事实；对于未提供的信息明确注明未提供，输出供人工核对的正文。`,reference},65000);if(current()?.id===t.id)$('cmSummary').value=[answer.title,answer.body].filter(Boolean).join('\n\n');t.log.push({at:Date.now(),text:`AI 汇总 ${selected.length} 份已确认材料；需人工核对`});persist();render();status('AI 汇总初稿已生成，请核对原文件、缺项和事实。')}catch(e){status(`AI 汇总失败：${e?.message||e}。`)}finally{btn.disabled=false}}
 $('cmRecord').onclick=()=>{const t=current(),text=$('cmReminderText').value;if(!t||!text||$('cmReminderText').dataset.generated!=='yes')return;if(!window.confirm('仅在你已通过其他渠道实际发送后记录。确定记为已催办？'))return;t.log.push({at:Date.now(),text:`手动记录催办：${text.slice(0,1000)}`});persist();render()}
 void (async()=>{try{db=await openDB();tasks=await readDB();if(!Array.isArray(tasks))throw Error('数据格式无效');active=tasks[0]?.id||'';status('任务及文件副本保存在本浏览器。清理浏览器数据可能导致丢失，请及时导出进度和备份原文件。')}catch(error){db=null;status(`无法读取本地数据库：${error?.message||error}；仅本页面会话可用，请勿刷新。`)}finally{ready=true;$('cmCreate').disabled=false;render()}})()
}
