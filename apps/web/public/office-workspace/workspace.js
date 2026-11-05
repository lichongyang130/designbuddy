import {TASKS,suggestTasks} from './core.js'
import {el,button} from './ui.js'
import {mountSearch} from './search-panel.js'
import {mountExcel} from './excel-panel.js'
import {mountWord} from './word-panel.js'
import {mountCollectionPanel} from './collection-panel.js'
import {mountTasks} from './task-panel.js'
import {mountComparison} from './compare-panel.js'
import {mountNumberCheck} from './number-check-panel.js'
const $=id=>document.getElementById(id)
const integrated=window.parent!==window&&new URLSearchParams(location.search).get('embedded')==='1'
if(integrated)document.documentElement.classList.add('integrated-office')
const inline=integrated&&new URLSearchParams(location.search).get('inline')==='1'
if(inline)document.documentElement.classList.add('inline-office')
let files=[],active='',fileVersion=0,pendingSelection=null;const panels={}
const available=['word','excel','search','collection','beautify','ppt','tasks','review','crossreview'].map(id=>TASKS.find(t=>t.id===id)).filter(Boolean)
function openLegacyInline(tool){
 const root=$(active+'Panel');if(!root)return
 const previous=root.querySelector('.legacy-tool');if(previous)previous.remove()
 const box=el('div',undefined,'legacy-tool'),note=el('p','在当前智能办公区域打开原有功能。原工具的会话文件与上方已选文件不自动互通，请按需重新选择。','hint'),close=button('收起原有功能',()=>box.remove(),'text-btn'),frame=document.createElement('iframe')
 frame.className='legacy-tool-frame';frame.title='原有办公功能';frame.src='/index.html?officeEmbed=1';frame.onload=()=>{const names={filebuddy:'app:open-filebuddy',excel:'app:open-excel',word:'app:open-word',collection:'app:open-collection',ppt:'app:open-ppt'};const name=names[tool];if(name&&frame.contentWindow)frame.contentWindow.dispatchEvent(new frame.contentWindow.Event(name))};box.append(note,close,frame);root.append(box);box.scrollIntoView?.({behavior:'smooth',block:'start'})
}
const ctx={files:()=>files,version:()=>fileVersion,pickFiles(accept,callback){pendingSelection=callback||null;$('files').accept=accept||'';$('files').click()},addFiles,useFile(id,file){openTask(id,file)},openCollectionExcel(records,origin){return openCollectionExcel(records,origin)},async appendCollectionCheck(origin,text){const error=await panels.collection.appendExcelCheck(origin,text);if(!error)openTask('collection');return error},openReport(doc){if(panels.word.setDraft(doc))openTask('word')},openTask(id){openTask(id)},openFormat(id){openTask(id);panels[id].openFormat?.()},openLegacy:openLegacyInline}
function notify(text){$('status').textContent=text}
function renderFiles(){
 const list=$('selectedFiles'),visible=$('visibleFiles');list.replaceChildren();visible.replaceChildren();$('fileCount').textContent=files.length?`已添加 ${files.length} 个文件`:'未添加文件';$('sessionFiles').hidden=!files.length
 files.forEach((f,i)=>{for(const root of [list,visible]){const chip=el('span',f.webkitRelativePath||f.name,'file-chip'),remove=button('×',()=>{files.splice(i,1);fileVersion++;renderFiles();panels.excel.filesChanged();panels.review?.filesChanged();panels.crossreview?.filesChanged();panels.search?.filesChanged();if(active==='word')panels.word.activate('',null);notify('已移除所选文件，原文件未受影响。')},'text-btn');remove.setAttribute('aria-label',`移除 ${f.name}`);chip.append(remove);root.append(chip)}})
}
function addFiles(input){const values=Array.from(input||[]);if(!values.length)return 0;if(files.length+values.length>100){notify('当前工作区最多选择 100 个文件，请分批操作。');return -1}const seen=new Set(files.map(f=>`${f.webkitRelativePath||f.name}\0${f.size}\0${f.lastModified}`));let added=0;for(const f of values){const key=`${f.webkitRelativePath||f.name}\0${f.size}\0${f.lastModified}`;if(seen.has(key))continue;seen.add(key);files.push(f);added++}renderFiles();if(added){fileVersion++;panels.excel.filesChanged();panels.review?.filesChanged();panels.crossreview?.filesChanged();panels.search?.filesChanged()}if(active==='word')panels.word.activate('',null);notify(`已添加 ${added} 个文件；原文件不会被修改。`);return added}
function openCollectionExcel(records,origin){
 if(panels.excel.isBusy())return '表格正在处理，请稍候再试。'
 if(!records.length)return '没有已确认的当前 XLSX 材料。'
 if(records.length>20)return '最多一次处理 20 个 XLSX 文件，请分批选择。'
 if(new Set(records.map(r=>r.name)).size!==records.length)return '已确认的表格有同名文件，请先重命名后重新导入以区分来源。'
 const chosen=[]
 for(const r of records){if(!r.file||typeof r.file.arrayBuffer!=='function')return `无法读取 ${r.name} 的本地副本，请重新导入。`;const timestamp=Number(String(r.key||'').split('\0').at(-1))||0;const f=r.file.name===r.name?r.file:new File([r.file],r.name,{type:r.file.type||'',lastModified:timestamp});chosen.push(f)}
 const key=f=>`${f.webkitRelativePath||f.name}\0${f.size}\0${f.lastModified}`
 const newCount=new Set(chosen.map(key).filter(k=>!files.some(f=>key(f)===k))).size
 if(files.length+newCount>100)return '工作区文件数量将超过 100 个，请先移除部分文件。'
 if(panels.excel.hasWork()&&!confirm('将替换当前 Excel 的读取结果和映射设置，不会修改原文件。是否继续？'))return '已取消，原有 Excel 结果保持不变。'
 panels.excel.filesChanged()
 const fresh=chosen.filter(f=>!files.some(existing=>key(existing)===key(f)));const added=fresh.length?addFiles(fresh):0;if(added<0)return '无法加入文件，请检查工作区文件数量。'
 const mapped=chosen.map(f=>files.find(x=>key(x)===key(f))).filter(Boolean)
 if(mapped.length!==chosen.length)return '部分文件未能加入工作区，请重新选择。'
 openTask('excel',{files:mapped,origin});return ''
}
function openTask(id,preferred){const task=available.find(t=>t.id===id);if(!task)return;active=id;$('choice').hidden=true;$('workspace').hidden=false;$('workTitle').textContent=task.label;$('workSubtitle').textContent=task.description;for(const t of available){$(t.id+'Panel').hidden=t.id!==id;document.querySelector(`[data-work="${t.id}"]`)?.classList.toggle('active',t.id===id)}panels[id].activate($('goal').value.trim(),preferred);if(!inline)$('workspace').scrollIntoView?.({behavior:'smooth',block:'start'})}
function start(){const goal=$('goal').value.trim();if(!goal){notify('请先描述工作目标，或直接点击下方常用工作。');return}const suggested=suggestTasks(goal),candidates=suggested.filter(id=>available.some(t=>t.id===id)),unsupported=suggested.filter(id=>!available.some(t=>t.id===id));if(candidates.length===1&&!unsupported.length){openTask(candidates[0]);panels[candidates[0]].start?.(goal);return}const ids=candidates.length?candidates:available.map(t=>t.id);$('workspace').hidden=true;active='';$('choices').replaceChildren(...ids.map(id=>button(available.find(t=>t.id===id).label,()=>{openTask(id);if(id==='collection')panels.collection.start(goal)},'subtle')));$('choice').hidden=false;notify(unsupported.length?`“${unsupported.map(id=>TASKS.find(t=>t.id===id)?.label).join('、')}”尚未接入；请选择已支持的工作，不能自动完成缺失的步骤。`:candidates.length?'工作目标涉及多个场景，请选择先处理哪一项。':'没有匹配到明确场景，请选择一项工作；这是关键词规则，不是 AI 理解。');if(!inline)$('choice').scrollIntoView?.({behavior:'smooth',block:'start'})}
for(const task of available){const card=el('button',undefined,'quick-card');card.type='button';card.dataset.work=task.id;const text=el('div');text.append(el('strong',task.label),el('small',task.description));card.append(el('span',task.icon,'quick-icon'),text,el('span','↗','arrow'));card.onclick=()=>openTask(task.id);$('quickGrid').append(card)}
panels.ppt={activate(){}}
{
 const root=$('pptPanel');root.append(el('p','PPT 生成和页面编辑沿用现有工具；当前工作台不能直接传入已选文件或自动生成演示文稿。','hint'))
 if(ctx.openLegacy)root.append(button('打开演示文稿与模板',()=>ctx.openLegacy('ppt'),'primary'))
 else {const a=el('a','打开原有模板与演示文稿 ↗');a.href='/index.html';a.target='_blank';a.rel='noopener';root.append(a)}
}
panels.beautify={activate(){}}
{
 const root=$('beautifyPanel');root.append(el('p','在当前成果上调整外观，不会自动更改正文或原始文件。先选择要优化的成果。','hint'))
 const actions=el('div',undefined,'actions');actions.append(button('优化 Word 草稿排版',()=>ctx.openFormat('word'),'primary'),button('优化 Excel 汇总样式',()=>ctx.openFormat('excel')));root.append(actions)
 root.append(el('p','Word：仅支持本工作区编辑生成的草稿。导入旧 DOCX 作为参考只提取文字，不能保留复杂格式、图片和表格。','warning'),el('p','Excel：仅调整本工作区生成的汇总工作簿表头样式，不修改输入文件或原始数据。'))
 if(ctx.openLegacy)root.append(button('前往 PPT 模板与编辑',()=>ctx.openLegacy('ppt')))
 root.append(el('p','PPT 可使用现有编辑器调整主题和布局；此处暂不能自动接收原 PPT 或把工作台成果转成 PPT。PDF 原文件美化尚不支持。'))
}
panels.search=mountSearch($('searchPanel'),ctx);panels.excel=mountExcel($('excelPanel'),ctx);panels.word=mountWord($('wordPanel'),ctx);panels.collection=mountCollectionPanel($('collectionPanel'),ctx);panels.tasks=mountTasks($('tasksPanel'),ctx);panels.review=mountComparison($('reviewPanel'),ctx);panels.crossreview=mountNumberCheck($('crossreviewPanel'),ctx)
$('pickFiles').onclick=()=>ctx.pickFiles('',null);$('moreFiles').onclick=()=>ctx.pickFiles('',null);$('pickFolder').onclick=()=>$('folder').click();for(const id of ['files','folder'])$(id).onchange=e=>{const selected=Array.from(e.target.files||[]),callback=id==='files'?pendingSelection:null;pendingSelection=null;const added=addFiles(selected);e.target.value='';if(selected.length&&added>=0&&callback)callback(selected)}
$('start').onclick=start;$('closeWork').onclick=()=>{$('workspace').hidden=true;active='';document.querySelectorAll('.quick-card').forEach(c=>c.classList.remove('active'))}
const composer=document.querySelector('.composer');composer.addEventListener('dragover',e=>{e.preventDefault()});composer.addEventListener('drop',e=>{e.preventDefault();addFiles(e.dataTransfer?.files)})

if(integrated){
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==window.parent)return
  const data=event.data;if(!data||data.type!=='office-workspace:open')return
  if(data.action==='workspace'){if(data.goal&&typeof data.goal==='string'){if(!$('goal').value.trim()){$('goal').value=data.goal.slice(0,4000);$('askBox').open=true}else if($('goal').value!==data.goal)notify('已保留当前工作目标；如需使用首页输入，请手动复制。')}return}
  if(!inline)return
  if(data.action==='dismiss'){$('workspace').hidden=true;$('choice').hidden=true;active='';notify('');return}
  if(data.action==='files'){if(Array.isArray(data.files)&&data.files.every(f=>f instanceof File))addFiles(data.files);return}
  if((data.action==='task'||data.action==='task-start')&&available.some(t=>t.id===data.task)){$('goal').value=typeof data.goal==='string'?data.goal.slice(0,4000):'';openTask(data.task);if(data.action==='task-start')panels[data.task].start?.($('goal').value.trim());return}
  if(data.action==='start'&&typeof data.goal==='string'){$('goal').value=data.goal.slice(0,4000);start()}
 })
 const notifyHeight=()=>window.parent.postMessage({type:'office-workspace:resize',height:document.body.getBoundingClientRect().height},location.origin)
 if(typeof ResizeObserver==='function')new ResizeObserver(notifyHeight).observe(document.body)
 else if(typeof MutationObserver==='function')new MutationObserver(notifyHeight).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true})
 window.addEventListener('load',notifyHeight,{once:true});notifyHeight()
 window.parent.postMessage({type:'office-workspace:ready'},location.origin)
}
