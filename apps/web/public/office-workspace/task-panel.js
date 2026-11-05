import {el,button,label,option,copyEditable} from './ui.js'
import {isOverdue,taskSnapshot,taskReport} from './task-core.js'
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`
function openDB(){return new Promise((resolve,reject)=>{if(!globalThis.indexedDB)return reject(Error('本地存储不可用'));const req=indexedDB.open('designbuddy-office-tasks',1);req.onupgradeneeded=()=>req.result.createObjectStore('tasks',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function getAll(db){return new Promise((resolve,reject)=>{const req=db.transaction('tasks').objectStore('tasks').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
export function mountTasks(root,ctx){
 let db=null,items=[],loading=true,queue=Promise.resolve(),basis='',blocked=new Set()
 const title=el('input'),owner=el('input'),due=el('input'),notes=el('textarea'),notice=el('p','正在读取本机任务…','status'),list=el('div'),report=el('textarea'),reportNote=el('p','汇总草稿仅在当前页面保留，请复制或转到 Word 保存。','hint')
 title.placeholder='例如：收齐各部门月度总结';title.maxLength=200;owner.placeholder='选填，例如财务部';owner.maxLength=100;due.type='date';notes.rows=2;notes.maxLength=2000;notes.placeholder='选填，记录已知要求'
 report.rows=6;report.placeholder='生成后可编辑，核对后自行发送。'
 function save(t){
  if(!db){notice.textContent='本地存储不可用，任务只保留在当前页面，请勿刷新。';return}
  if(blocked.has(t.id)){notice.textContent='该任务存在保存冲突，请先复制当前内容并刷新。';return}
  queue=queue.then(()=>new Promise((resolve,reject)=>{const tx=db.transaction('tasks','readwrite'),store=tx.objectStore('tasks'),get=store.get(t.id);let conflict=false,next;get.onsuccess=()=>{if((get.result?.revision||0)!==t.revision){conflict=true;tx.abort();return}next={...t,revision:t.revision+1};store.put(next)};tx.oncomplete=()=>{t.revision=next.revision;resolve()};tx.onerror=()=>reject(tx.error||Error('保存失败'));tx.onabort=()=>reject(Error(conflict?'任务已在其他页面修改':'保存被中止'))})).then(()=>{notice.textContent='任务已保存到本浏览器；清理浏览器数据可能丢失。'}).catch(error=>{blocked.add(t.id);notice.textContent=`保存失败：${error.message}。当前内容仅在页面中，请先复制并刷新。`})
 }
 async function remove(t){
  if(!confirm(`删除任务“${t.title}”？`))return
  await queue;if(blocked.has(t.id)){notice.textContent='任务存在保存冲突，请先复制当前内容并刷新。';return}
  if(!db){items=items.filter(x=>x!==t);render();notice.textContent='已从当前页面移除；本地存储不可用。';return}
  try{await new Promise((resolve,reject)=>{const tx=db.transaction('tasks','readwrite'),store=tx.objectStore('tasks'),get=store.get(t.id);let conflict=false;get.onsuccess=()=>{if((get.result?.revision||0)!==t.revision){conflict=true;tx.abort();return}store.delete(t.id)};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('删除失败'));tx.onabort=()=>reject(Error(conflict?'任务已在其他页面修改':'删除被中止'))});items=items.filter(x=>x!==t);render();notice.textContent='已删除本机任务记录。'}catch(error){blocked.add(t.id);notice.textContent=`删除失败：${error.message}；请刷新后重试。`}
 }
 function render(){list.replaceChildren();if(!items.length){list.append(el('p','还没有任务。填写上方内容后添加。','hint'));return}for(const t of items){const card=el('div',undefined,'group'),heading=el('input'),state=el('select'),assigned=el('input'),deadline=el('input'),details=el('details'),note=el('textarea'),stateGrid=el('div',undefined,'grid2');heading.value=t.title;heading.maxLength=200;for(const value of ['未开始','进行中','已完成'])option(state,value,value);state.value=t.status;assigned.value=t.owner||'';assigned.maxLength=100;deadline.type='date';deadline.value=t.due||'';note.rows=2;note.maxLength=2000;note.value=t.notes||'';const change=()=>{if(!heading.value.trim()){heading.value=t.title;notice.textContent='任务内容不能为空。';return}t.title=heading.value.trim();t.status=state.value;t.owner=assigned.value.trim();t.due=deadline.value;t.notes=note.value.trim();save(t)};for(const field of [heading,assigned,note])field.onchange=change;for(const field of [state,deadline])field.onchange=()=>{change();render()};stateGrid.append(label('进度',state),label('责任人',assigned),label('截止日期',deadline));details.append(el('summary','备注'),note);card.append(label('任务内容',heading),isOverdue(t)?el('p','已超过所填截止日期，请人工核实；不会自动提醒。','warning'):el('p','进度由你手动更新。','hint'),stateGrid,details,button('删除任务',()=>void remove(t)));list.append(card)}}
 const add=button('添加任务',()=>{if(loading){notice.textContent='任务正在读取，请稍候。';return}const text=title.value.trim();if(!text){notice.textContent='请先填写任务内容。';title.focus();return}if(items.length>=500){notice.textContent='最多保存 500 条任务，请先清理或导出。';return}const t={id:uid(),title:text,owner:owner.value.trim(),due:due.value,status:'未开始',notes:notes.value.trim(),revision:0};items.push(t);title.value='';owner.value='';due.value='';notes.value='';save(t);render()},'primary')
 const fields=el('div',undefined,'grid2');fields.append(label('责任人（可选）',owner),label('截止日期（可选）',due));const more=el('details');more.append(el('summary','添加备注（可选）'),notes)
 const generate=button('生成进度汇总',()=>{if(report.value.trim()&&!confirm('将替换当前汇总草稿，是否继续？'))return;report.value=taskReport(items);basis=taskSnapshot(items);reportNote.textContent='已根据当前本机记录生成，请核对后自行发送。'})
 const checked=()=>{if(!report.value.trim()){reportNote.textContent='请先生成或填写汇总。';return false}if(basis!==taskSnapshot(items)&&!confirm('任务记录已变化，汇总可能过期。请确认已核对，是否继续？'))return false;return true}
 const copy=button('复制汇总（人工发送）',async()=>{if(!checked())return;reportNote.textContent=await copyEditable(report)?'已复制，请核对后自行发送。':'无法自动复制，已选中文字，请手动复制。'})
 const word=button('在 Word 中继续编辑',()=>{if(checked())ctx.openReport({title:'工作任务进度汇总',body:report.value})})
 const reportBox=el('details');reportBox.append(el('summary','形成进度汇总'),el('p','根据本机记录生成草稿；不会自动发送。'),generate,label('汇总草稿（可编辑）',report),reportNote,copy,word)
 root.append(el('p','手动记录交办事项并更新进度。当前不识别录音或微信，也不会自动通知责任人；其他页面的更改不会实时同步，请刷新核对。'),label('任务内容',title),fields,more,add,notice,list,reportBox)
 void(async()=>{try{db=await openDB();items=await getAll(db);notice.textContent='任务保存在本浏览器；清理浏览器数据可能丢失，请及时备份。'}catch(e){notice.textContent=`本地保存不可用：${e?.message||e}；任务仅在本页面保留。`}finally{loading=false;render()}})()
 return {activate(goal){const value=String(goal||'').trim();if(!value||value==='帮我记录领导交办的工作任务并跟进进度')return;if(!title.value.trim())title.value=value.slice(0,200);else if(title.value!==value)notice.textContent='已保留未添加的任务内容；如需使用新需求，请在这里修改。'}}
}
