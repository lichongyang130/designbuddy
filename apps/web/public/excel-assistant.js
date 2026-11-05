import {FIELDS,readWorkbook,analyze,makeWorkbook} from './excel-assistant-core.js'
const $=id=>document.getElementById(id),node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
const RULE_KEY='designbuddy.excel.rules.v1'
let sheets=[],result=null,busy=false,filesSeen=new Set(),rules=null
const status=(text,error=false)=>{$('ebFileStatus').textContent=text;$('ebFileStatus').classList.toggle('error',error)}
function invalidate(){result=null;$('ebExport').disabled=true;$('ebResult').replaceChildren(node('div','eb-empty','设置已变化，请重新检查并预览。'))}
function rulesText(text){$('ebRuleStatus').textContent=text}
function getRules(){try{const v=JSON.parse(localStorage.getItem(RULE_KEY)||'null');return v&&v.version===1?v:null}catch{return null}}
function applyRules(sheet){
 if(!rules?.aliases)return
 for(const [field] of FIELDS){const names=rules.aliases[field]||[],matches=sheet.headers.map((h,i)=>names.includes(String(h).trim())?i:-1).filter(i=>i>=0);if(matches.length===1)sheet.mapping[field]=matches[0]}
}
function loadRules(){
 rules=getRules();if(!rules){rulesText('可选择保存字段映射与统计口径；不会保存文件内容。');return}
 if(['CNY','USD'].includes(rules.currency))$('ebCurrency').value=rules.currency
 if(['元','万元'].includes(rules.unit))$('ebUnit').value=rules.unit
 document.querySelectorAll('[data-eb-duplicate]').forEach(el=>{el.checked=Array.isArray(rules.duplicates)&&rules.duplicates.includes(el.dataset.ebDuplicate)})
 rulesText('已读取本机保存的规则。匹配到的表头会应用建议，仍需逐表确认。')
}
function saveRules(){
 const chosen=sheets.filter(s=>s.selected);if(!chosen.length){rulesText('请先选择工作表并确认字段，再保存规则。');return}
 const duplicates=[...document.querySelectorAll('[data-eb-duplicate]:checked')].map(x=>x.dataset.ebDuplicate);if(!duplicates.length){rulesText('请至少选择一个查重字段。');return}
 const aliases=Object.fromEntries(FIELDS.map(([k])=>[k,[...new Set(chosen.map(s=>s.mapping[k]>=0?String(s.headers[s.mapping[k]]).trim():'').filter(Boolean))]]))
 const value={version:1,aliases,currency:$('ebCurrency').value,unit:$('ebUnit').value,duplicates}
 try{localStorage.setItem(RULE_KEY,JSON.stringify(value));rules=value;rulesText('已在当前浏览器保存字段名称和统计规则，不含文件内容。')}catch{rulesText('无法保存规则：浏览器存储不可用。')}
}
function deleteRules(){try{localStorage.removeItem(RULE_KEY);rules=null;rulesText('已删除本机保存的规则。');}catch{rulesText('无法删除规则，请检查浏览器存储权限。')}}
function renderSheets(){
 const root=$('ebSheets');root.replaceChildren()
 if(!sheets.length){root.append(node('div','eb-empty','添加文件后，在这里选择工作表并确认字段。'));return}
 sheets.forEach((sheet)=>{
  const card=node('div','eb-sheet'),header=node('div','eb-sheet-head'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=sheet.selected;checkbox.setAttribute('aria-label',`导入 ${sheet.filename} ${sheet.name}`);checkbox.addEventListener('change',()=>{sheet.selected=checkbox.checked;invalidate()})
  const title=node('div','',`${sheet.filename} / ${sheet.name}`);title.append(node('small','',`${sheet.rows.length} 条数据 · 第 1 行为表头`))
  const remove=node('button','eb-remove','移除文件');remove.type='button';remove.addEventListener('click',()=>{sheets=sheets.filter(x=>x.filename!==sheet.filename);filesSeen.delete(sheet.filename);invalidate();renderSheets();status(`已移除 ${sheet.filename}；当前 ${filesSeen.size} 个文件。`)})
  header.append(checkbox,title,remove);card.append(header)
  const grid=node('div','eb-map-grid')
  for(const [key,label] of FIELDS){
   const wrap=node('label','',label+(key==='department'||key==='amount'?' *':'')),select=document.createElement('select');select.setAttribute('aria-label',`${sheet.filename} ${sheet.name} ${label}`)
   const none=node('option','','不映射');none.value='-1';select.append(none)
   sheet.headers.forEach((value,i)=>{const opt=node('option','',`${i+1}. ${value}`);opt.value=String(i);select.append(opt)})
   select.value=String(sheet.mapping[key]??-1);select.addEventListener('change',()=>{sheet.mapping[key]=Number(select.value);invalidate()});wrap.append(select);grid.append(wrap)
  }
  card.append(grid)
  const example=sheet.rows[0];if(example)card.append(node('div','eb-sheet-sample','首行示例：'+example.cells.map(c=>String(c.value??'')).join(' · ').slice(0,250)))
  root.append(card)
 })
}
async function addFiles(input){
 const files=Array.from(input||[]);if(!files.length)return
 if(busy){status('正在读取文件，请稍候。',true);return}if(!globalThis.ExcelJS){status('Excel 解析器加载失败，请刷新后重试。',true);return}
 busy=true;invalidate();let added=0;const errors=[]
 try{for(const file of files){
  if(!/\.xlsx$/i.test(file.name)){errors.push(`${file.name}：仅支持 XLSX`);continue}
  if(filesSeen.has(file.name)){errors.push(`${file.name}：文件名重复，请重命名后再导入`);continue}
  if(filesSeen.size>=20){errors.push('最多添加 20 个文件');break}
  status(`正在读取 ${file.name}…`)
  try{const loaded=await readWorkbook(globalThis.ExcelJS,file);if(!loaded.length)throw Error('没有可读取的工作表');if(sheets.reduce((n,s)=>n+s.rows.length,0)+loaded.reduce((n,s)=>n+s.rows.length,0)>20000)throw Error('合计超过 20000 条数据，请分批处理');loaded.forEach(applyRules);sheets.push(...loaded);filesSeen.add(file.name);added++}catch(error){errors.push(`${file.name}：${error?.message||'无法读取'}`)}
 }}finally{busy=false;renderSheets()}
 status(`已添加 ${filesSeen.size} 个文件、${sheets.length} 个工作表。${errors.length?' '+errors.join('；'):''}`,!!errors.length)
}
function table(headers,rows){
 const wrap=node('div','eb-scroll'),table=node('table','eb-table'),head=document.createElement('thead'),tr=document.createElement('tr');for(const h of headers)tr.append(node('th','',h));head.append(tr);table.append(head)
 const body=document.createElement('tbody');for(const row of rows){const tr=document.createElement('tr');for(const v of row)tr.append(node('td','',String(v??'')));body.append(tr)}table.append(body);wrap.append(table);return wrap
}
function showResult(data){
 const root=$('ebResult');root.replaceChildren();root.className='';const outputUnit=data.options.currency==='USD'?'美元':'元'
 const metrics=node('div','eb-metrics');for(const [label,value] of [['合并记录',data.details.length],['部门',data.summaries.length],['检查提示',data.issues.length]]){const m=node('div','eb-metric',label);m.append(node('b','',String(value)));metrics.append(m)}root.append(metrics)
 root.append(node('div','eb-info',`输入口径：${data.options.currency} / ${data.options.unit==='万元'?'万':''}${outputUnit}；汇总单位：${outputUnit}。疑似重复不删除，符合条件的记录仍计入汇总。预览仅展示前 30 条明细和问题。`))
 root.append(node('h3','eb-section-title','部门预算汇总 · 预览图'))
 if(data.summaries.length){const max=Math.max(...data.summaries.map(x=>x.amount),1);for(const row of data.summaries.slice(0,30)){const r=node('div','eb-chart-row'),label=node('div','eb-chart-label',row.department),track=node('div','eb-bar-track'),bar=node('div','eb-bar'),value=node('div','eb-chart-value',row.amount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}));bar.style.width=`${Math.max(0,Math.min(100,row.amount/max*100))}%`;track.append(bar);r.append(label,track,value);root.append(r)}root.append(table(['部门',`预算总额（${data.options.currency}，${outputUnit}）`,'计入行数'],data.summaries.map(x=>[x.department,x.amount,x.count])))}else root.append(node('div','eb-hint','没有可计入汇总的记录，不会生成图表。'))
 root.append(node('h3','eb-section-title',`问题检查 · ${data.issues.length} 条`));if(data.issues.length)root.append(table(['来源文件','工作表','行号','问题'],data.issues.slice(0,30).map(i=>[i.file,i.sheet,i.row,i.note])));else root.append(node('div','eb-hint','没有发现当前规则覆盖的问题。'))
 root.append(node('h3','eb-section-title','合并明细 · 前 30 条'));root.append(table(['来源文件','工作表','原行号','部门','姓名','日期','预算原值'],data.details.slice(0,30).map(d=>[d.file,d.sheet,d.row,d.department,d.person,d.date,d.amount])))
}
function preview(){
 if(busy){status('文件仍在读取，请稍候。',true);return}
 try{const duplicates=[...document.querySelectorAll('[data-eb-duplicate]:checked')].map(x=>x.dataset.ebDuplicate);result=analyze(sheets,{currency:$('ebCurrency').value,unit:$('ebUnit').value,duplicates});showResult(result);$('ebExport').disabled=false;status(`已检查 ${result.selectedCount} 个工作表、${result.details.length} 条记录。`)}catch(error){invalidate();status(error?.message||'无法分析，请检查设置',true)}
}
async function download(){
 if(!result||busy)return
 busy=true;$('ebExport').disabled=true
 try{status('正在生成新的工作簿…');const bytes=await makeWorkbook(globalThis.ExcelJS,result),blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='部门预算汇总.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status(`工作簿已生成：${result.details.length} 条明细、${result.issues.length} 条检查提示。`)}catch(error){status(`生成失败：${error?.message||error}`,true)}finally{busy=false;$('ebExport').disabled=!result}
}
function init(){
 loadRules();$('ebAddFiles').addEventListener('click',()=>$('ebFileInput').click());$('ebFileInput').addEventListener('change',event=>{void addFiles(event.target.files);event.target.value=''})
 window.addEventListener('excel-assistant:receive-files',event=>{void addFiles(event.detail)})
 $('ebAnalyze').addEventListener('click',preview);$('ebExport').addEventListener('click',()=>{void download()});$('ebSaveRules').addEventListener('click',saveRules);$('ebDeleteRules').addEventListener('click',deleteRules)
 for(const el of document.querySelectorAll('#ebCurrency,#ebUnit,[data-eb-duplicate]'))el.addEventListener('change',invalidate)
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init()
