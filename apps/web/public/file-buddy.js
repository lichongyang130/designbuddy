import {SUPPORTED,indexFile,searchFiles} from './file-buddy-core.js'
import {FILE_SOURCES,filterSource} from './file-buddy-sources.js'
import {collectDirectory} from './file-buddy-directories.js'

const $=id=>document.getElementById(id)
let entries=[],generation=0,indexing=false,activeSource='computer',folders=[],folderSequence=0
const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
function empty(title,description){
 const box=node('div','fb-empty'),icon=node('div','fb-empty-icon','⌕'),b=node('b','',title),p=node('p','',description)
 box.append(icon,b,p);$('fbResults').replaceChildren(box)
}
function renderSources(){
 const container=$('fbSourceList');container.replaceChildren()
 for(const source of FILE_SOURCES){
  const count=entries.filter(e=>e.source===source.id).length, folderCount=folders.filter(f=>f.source===source.id).length
  const card=node('div','fb-source-item');card.dataset.source=source.id
  const line=node('div','fb-source-line');line.append(node('span','fb-source-name',source.name),node('span','fb-source-count',count||folderCount?`${count} 个文件 · ${folderCount} 个授权目录`:'未导入'))
  const detail=node('p','',`${source.description}。${source.hint}`)
  const actions=node('div','fb-source-buttons')
  for(const [label,kind] of [['授权目录','connect'],['重新扫描','rescan'],['导入文件夹','folder'],['文件','files'],['移除','remove']]){
   const button=node('button',kind==='remove'?'fb-remove':'',label);button.type='button';button.dataset.kind=kind;button.dataset.source=source.id;button.setAttribute('aria-label',`${label} · ${source.name}`)
   button.disabled=indexing || (kind==='remove' && count===0 && folderCount===0) || (kind==='rescan' && folderCount===0) || (kind==='connect' && typeof window.showDirectoryPicker!=='function')
   if(kind==='connect' && typeof window.showDirectoryPicker!=='function')button.title='当前浏览器不支持文件夹授权，请使用导入文件夹'
   button.addEventListener('click',()=>{
    if(kind==='remove'){removeSource(source.id);return}
    if(kind==='connect'){void connectDirectory(source.id);return}
    if(kind==='rescan'){void rescanDirectories(source.id);return}
    activeSource=source.id;$(kind==='folder'?'fbFolder':'fbFiles').click()
   });actions.append(button)
  }
  card.append(line,detail,actions);container.append(card)
 }
}
function removeSource(id){
 generation++;indexing=false;entries=entries.filter(entry=>entry.source!==id);folders=folders.filter(folder=>folder.source!==id);$('fbClear').disabled=!entries.length&&!folders.length
 $('fbStatus').textContent=`已移除 ${FILE_SOURCES.find(s=>s.id===id)?.name||'该来源'} 的索引；当前共 ${entries.length} 个文件。`
 renderSources();if($('fbQuery').value.trim()&&entries.length)runSearch();else{$('fbInterpretation').hidden=true;$('fbResultTitle').textContent=entries.length?'输入一句话开始搜索':'准备好开始了吗？';$('fbCount').textContent=`${entries.length} 个文件`;empty(entries.length?'文件已准备好':'先选择你想搜索的文件',entries.length?'输入查询以搜索已导入的文件。':'添加文件或文件夹后，输入关键词或完整的一句话。')}
}
function clear(){
 generation++;indexing=false;entries=[];folders=[];$('fbFolder').value='';$('fbFiles').value='';$('fbStatus').textContent='尚未选择文件';$('fbClear').disabled=true;$('fbInterpretation').hidden=true;$('fbCount').textContent='等待搜索';$('fbResultTitle').textContent='准备好开始了吗？';$('fbSourceFilter').value='all';renderSources();empty('先选择你想搜索的文件','添加文件或文件夹后，输入关键词或完整的一句话。')
}
async function connectDirectory(sourceId){
 if(typeof window.showDirectoryPicker!=='function')return
 try{
  // The picker runs directly in the click handler, never on page load.
  const handle=await window.showDirectoryPicker({mode:'read'})
  const existing=folders.filter(folder=>folder.source===sourceId)
  for(const folder of existing)if(await folder.handle.isSameEntry(handle)){$('fbStatus').textContent='这个文件夹已授权，可点击重新扫描。';return}
  const folder={id:`folder-${++folderSequence}`,source:sourceId,handle};folders.push(folder);$('fbClear').disabled=false;renderSources()
  await scanFolders(sourceId,[folder])
 }catch(error){if(error?.name!=='AbortError')$('fbStatus').textContent='无法授权文件夹：'+(error?.message||String(error))}
}
async function rescanDirectories(sourceId){await scanFolders(sourceId,folders.filter(f=>f.source===sourceId))}
async function scanFolders(sourceId,selected){
 if(!selected.length)return
 const run=++generation;indexing=true;renderSources();$('fbStatus').textContent='正在扫描已授权的目录…'
 const records=[],completed=[],problems=[];let truncated=false
 for(const folder of selected){
  try{
   if(await folder.handle.queryPermission({mode:'read'})!=='granted'){problems.push(`${folder.handle.name}：需要重新授权`);continue}
   const found=await collectDirectory(folder.handle,name=>SUPPORTED.test(name),{maxFiles:1000,maxDirectories:2000,shouldStop:()=>run!==generation})
   if(run!==generation)return
   // Do not delete the old index if traversal was partial or any file failed.
   if(found.errors.length||found.truncated){problems.push(`${folder.handle.name}：扫描未完成，保留已有索引`);truncated||=found.truncated;continue}
   records.push(...found.records.map(item=>({...item,folderId:folder.id})));completed.push(folder.id)
  }catch(error){if(run!==generation)return;problems.push(`${folder.handle.name}：${error?.message||'读取失败'}`)}
 }
 if(run!==generation)return
 const previous=entries.filter(e=>completed.includes(e.folderId))
 // Never replace an existing directory index with a partial one due to the global cap.
 if(entries.length-previous.length+records.length>1000){problems.push('超过 1000 个文件上限，保留原索引');completed.length=0;records.length=0}
 if(completed.length)entries=entries.filter(e=>!completed.includes(e.folderId))
 indexing=false
 if(records.length)await addSelection(records,sourceId)
 else{renderSources();$('fbCount').textContent=`${entries.length} 个文件`;if($('fbQuery').value.trim()&&entries.length)runSearch();else if(!entries.length){$('fbInterpretation').hidden=true;$('fbResultTitle').textContent='没有可搜索的文件';empty('目录已扫描','没有找到支持的文件。')}}
 if(!folders.some(f=>completed.includes(f.id)) && completed.length)return
 if(problems.length)$('fbStatus').textContent=problems.join('；')+(truncated?'（目录或文件过多）':'')
 else if(!records.length)$('fbStatus').textContent='目录已扫描，没有找到支持的文件。'
}
async function addSelection(fileList,sourceId){
 const selected=Array.from(fileList||[]).map(value=>value.file?value:{file:value,path:value.webkitRelativePath||value.name,folderId:null});if(!selected.length)return
 const run=++generation;indexing=true;$('fbClear').disabled=false;renderSources();$('fbInterpretation').hidden=true;$('fbResultTitle').textContent='正在读取所选文件';$('fbCount').textContent='建立索引中';empty('正在本地建立索引','请稍候，文件不会上传。')
 const known=new Set(entries.filter(e=>e.source===sourceId).map(e=>`${e.path}\0${e.size}\0${e.modified}`))
 const eligible=selected.filter(({file,path})=>{const key=`${path}\0${file.size}\0${file.lastModified||0}`;if(!SUPPORTED.test(file.name)||known.has(key))return false;known.add(key);return true})
 const files=eligible.slice(0,Math.max(0,1000-entries.length)), ignored=selected.length-files.length
 for(const [i,record] of files.entries()){
  const {file,path,folderId}=record
  $('fbStatus').textContent=`正在读取 ${i+1} / ${files.length}：${file.name}`
  const item=await indexFile(file);if(run!==generation)return
  item.source=sourceId;item.path=path;item.folderId=folderId;entries.push(item)
  if(i%5===0)await new Promise(resolve=>setTimeout(resolve,0))
  if(run!==generation)return
 }
 indexing=false
 renderSources()
 const failed=entries.filter(e=>e.status!=='已索引正文').length
 $('fbStatus').textContent=`已索引 ${entries.length} 个文件${failed?`；${failed} 个未完整提取正文`:''}${ignored?`；${ignored} 个重复、不支持或超过 1000 个上限`:''}`
 $('fbResultTitle').textContent=entries.length?'输入一句话开始搜索':'没有可索引的文件';$('fbCount').textContent=`${entries.length} 个文件`
 empty(entries.length?'文件已准备好':'没有找到支持的文件',entries.length?'输入文件主题、类型、部门或时间，再点击搜索。':'支持 XLSX、DOCX、PDF、TXT、CSV；旧版 XLS 和 DOC 仅索引文件信息。')
 if($('fbQuery').value.trim()&&entries.length)runSearch()
}

function runSearch(){
 if(indexing){$('fbStatus').textContent='正在建立索引，请稍候再搜索。';return}
 const q=$('fbQuery').value.trim()
 if(!q){$('fbResultTitle').textContent='请输入搜索内容';$('fbCount').textContent='等待搜索';$('fbInterpretation').hidden=true;empty('描述一下你要找的文件','例如：今年第三季度各部门提交的预算 Excel。');return}
 if(!entries.length){$('fbResultTitle').textContent='还没有可搜索的文件';$('fbCount').textContent='0 个文件';empty('先选择你想搜索的文件','选择文件夹或文件后再搜索。');return}
 const {parsed,results}=searchFiles(filterSource(entries,$('fbSourceFilter').value),q)
 const interpretation=[]
 if(parsed.topic)interpretation.push(`主题：${parsed.topic[0]}及相关词`)
 if(parsed.types)interpretation.push(`类型：${parsed.types.map(x=>x.toUpperCase()).join(' / ')}`)
 if(parsed.year)interpretation.push(`时间：${parsed.year} 年${parsed.quarter?`第 ${parsed.quarter} 季度`:''}`)
 if(parsed.sources.length)interpretation.push(`来源（手动标记）：${parsed.sources.map(id=>FILE_SOURCES.find(s=>s.id===id)?.name).join('、')}`)
 if(parsed.departments.length)interpretation.push(`部门：${parsed.departments.join('、')}`)
 if(parsed.terms.length)interpretation.push(`关键词：${parsed.terms.join('、')}`)
 const warnings=[]
 if(parsed.submissionRequested)warnings.push('未获取提交时间或提交人；时间匹配可能依据文件内容或修改时间，不能证明已提交。')
 if(parsed.quarter)warnings.push('季度按自然季度计算；未识别财年规则。无对应内容或时间信息的文件不会显示。')
 if(!interpretation.length)warnings.push('未识别出可搜索的条件，请尝试文件主题、类型或关键词。')
 $('fbInterpretation').textContent=`识别条件：${interpretation.join(' · ')||'无'}。${warnings.length?' '+warnings.join(' '):''}`;$('fbInterpretation').hidden=false
 $('fbResultTitle').textContent=results.length?'为你找到这些文件':'没有找到匹配的文件';$('fbCount').textContent=`${results.length} 个结果${results.length>100?'（显示前 100 个）':''}`
 if(!results.length){empty('暂时没有匹配结果','试试减少限制，或重新选择包含目标文件的文件夹。');return}
 const list=document.createDocumentFragment()
 for(const {row,reasons} of results.slice(0,100)){
  const item=node('article','fb-result'),icon=node('div','fb-file-icon',row.ext.toUpperCase()),info=node('div','fb-result-info'),title=node('h3','',row.name)
  const modified=row.modified?new Date(row.modified).toLocaleString():'未知'
  info.append(title,node('div','fb-result-meta',`${FILE_SOURCES.find(s=>s.id===row.source)?.name||'电脑'}（手动标记） · ${row.path} · 修改时间 ${modified}`),node('div','fb-result-reason',`匹配依据：${reasons.join('；')}`),node('div','fb-result-status',row.status))
  const open=node('button','fb-open','打开 / 下载 ↗');open.type='button';open.addEventListener('click',()=>{
   try{const url=URL.createObjectURL(row.file),a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';if(!['pdf','txt'].includes(row.ext))a.download=row.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}catch{ $('fbStatus').textContent='无法打开文件，请重新选择原文件后重试。' }
  })
  item.append(icon,info,open)
  if(row.ext==='xlsx'){const send=node('button','fb-open','Excel 助手');send.type='button';send.addEventListener('click',()=>{window.dispatchEvent(new CustomEvent('excel-assistant:receive-files',{detail:[row.file]}));window.dispatchEvent(new Event('app:open-excel'))});item.append(send)}
  if(row.ext==='docx'||row.ext==='txt'){const send=node('button','fb-open','Word 参考');send.type='button';send.addEventListener('click',()=>{window.dispatchEvent(new CustomEvent('word-assistant:reference-file',{detail:row.file}));window.dispatchEvent(new Event('app:open-word'))});item.append(send)}
  const collect=node('button','fb-open','资料收集');collect.type='button';collect.addEventListener('click',()=>{window.dispatchEvent(new Event('app:open-collection'));window.dispatchEvent(new CustomEvent('collection:receive-files',{detail:[row.file]}))});item.append(collect)
  list.append(item)
 }
 $('fbResults').replaceChildren(list)
}
function init(){
 renderSources()
 window.addEventListener('filebuddy:source',event=>{const card=document.querySelector(`.fb-source-item[data-source="${event.detail}"]`);if(card){card.scrollIntoView({block:'nearest'});card.querySelector('button')?.focus()}})
 $('fbSourceFilter').addEventListener('change',()=>{if($('fbQuery').value.trim())runSearch()})
 for(const id of ['fbFolder','fbFiles'])$(id).addEventListener('change',event=>{void addSelection(event.target.files,activeSource);event.target.value=''})
 $('fbClear').addEventListener('click',clear);$('fbSearchForm').addEventListener('submit',event=>{event.preventDefault();runSearch()})
 document.querySelectorAll('[data-fb-example]').forEach(el=>el.addEventListener('click',()=>{$('fbQuery').value=el.dataset.fbExample;runSearch()}))
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init()
