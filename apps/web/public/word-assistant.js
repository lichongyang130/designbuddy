import {DEFAULT_FORMAT,draftTemplate,checkDocument,parseReference,makeDocx} from './word-assistant-core.js'
const $=id=>document.getElementById(id)
let suggestion=null,requestSeq=0
const documentData=()=>({title:$('waTitle').value,recipient:$('waRecipient').value,body:$('waBody').value,signature:$('waSignature').value,date:$('waDate').value})
const formatData=()=>({font:$('waFont').value,titleFont:$('waTitleFont').value,titleSize:Number($('waTitleSize').value),size:Number($('waSize').value),line:Number($('waLine').value),top:Number($('waTop').value),bottom:Number($('waBottom').value),left:Number($('waLeft').value),right:Number($('waRight').value)})
const isEdited=()=>Object.values(documentData()).some(v=>v.trim())
function apply(data){$('waTitle').value=data.title||'';$('waRecipient').value=data.recipient||'';$('waBody').value=data.body||'';$('waSignature').value=data.signature||'';$('waDate').value=data.date||'';render();$('waChecks').textContent='文稿已更新，请重新检查。'}
function render(){
 const d=documentData(),f=formatData();$('waPaperTitle').textContent=d.title||'文稿标题';$('waPaperTitle').style.fontFamily=`'${f.titleFont}', serif`;$('waPaperTitle').style.fontSize=`${Math.max(14,Math.min(28,f.titleSize*.9))}px`;$('waPaperRecipient').textContent=d.recipient?d.recipient.replace(/[：:]?$/,'：'):'';$('waPaperSignature').textContent=d.signature;$('waPaperDate').textContent=d.date
 const body=$('waPaperBody');body.replaceChildren();body.style.fontFamily=`'${f.font}', serif`;body.style.fontSize=`${Math.max(10,Math.min(20,f.size*.875))}px`;body.style.lineHeight=String(Math.max(1.1,Math.min(3,f.line/(f.size||16))))
 if(!d.body.trim())body.textContent='正文将在这里显示。'
 else for(const line of d.body.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)){const p=document.createElement('p');p.textContent=line;if(/^[一二三四五六七八九十]+、/.test(line))p.className='heading';else if(/^[（(][一二三四五六七八九十]+[）)]/.test(line))p.className='subheading';body.append(p)}
 $('waPaper').style.padding=`${Math.max(15,f.top*1.25)}px ${Math.max(15,f.right*1.25)}px ${Math.max(15,f.bottom*1.25)}px ${Math.max(15,f.left*1.25)}px`
}
async function importReference(file){
 if(!file)return
 if(file.size>10*1024*1024){$('waRefStatus').textContent='参考文件超过 10 MB。';return}
 if($('waReference').value.trim()&&!window.confirm('将替换当前参考文字，是否继续？'))return
 try{let text;if(/\.docx$/i.test(file.name))text=parseReference(await file.arrayBuffer());else if(/\.txt$/i.test(file.name))text=(await file.text()).slice(0,12000);else throw Error('仅支持 DOCX 或 TXT')
  if(!text.trim())throw Error('未提取到文字；图片和扫描内容暂不支持')
  $('waReference').value=text;$('waRefStatus').textContent=`已从 ${file.name} 提取文字（最多 12000 字），未保留原版式、图片或表格结构。`
 }catch(error){$('waRefStatus').textContent=`参考文件读取失败：${error?.message||error}`}
}
function validFormat(){
 for(const [id,min,max] of [['waTitleSize',14,30],['waSize',10,24],['waLine',18,48],['waTop',10,50],['waBottom',10,50],['waLeft',10,50],['waRight',10,50]]){const value=$(id).value,n=Number(value);if(!value||!Number.isFinite(n)||n<min||n>max)throw Error(`${$(id).parentElement.textContent.trim()}需在 ${min}–${max} 范围内。`)}
 if(Number($('waLine').value)<Number($('waSize').value))throw Error('固定行距不能小于正文磅值，以免文字被裁切。')
}
export function mountWordAssistant(rpc){
 for(const id of ['waTitle','waRecipient','waBody','waSignature','waDate','waTitleFont','waTitleSize','waFont','waSize','waLine','waTop','waBottom','waLeft','waRight'])$(id).addEventListener('input',render)
 $('waResetFormat').addEventListener('click',()=>{for(const [id,key] of [['waTitleFont','titleFont'],['waTitleSize','titleSize'],['waFont','font'],['waSize','size'],['waLine','line'],['waTop','top'],['waBottom','bottom'],['waLeft','left'],['waRight','right']])$(id).value=DEFAULT_FORMAT[key];render()})
 $('waPickReference').addEventListener('click',()=>$('waReferenceFile').click())
 $('waReferenceFile').addEventListener('change',e=>{const file=e.target.files?.[0];e.target.value='';void importReference(file)})
 window.addEventListener('word-assistant:reference-file',event=>{void importReference(event.detail)})
 $('waTemplate').addEventListener('click',()=>{if(isEdited()&&!window.confirm('将替换当前编辑区内容，是否继续？'))return;apply(draftTemplate($('waKind').value,$('waBrief').value));$('waStatus').textContent='已生成本地草稿框架；方括号内容必须由你核实和填写。'})
 $('waAI').addEventListener('click',async()=>{
  const brief=$('waBrief').value.trim(),reference=$('waReference').value,kind=$('waKind').value
  if(!brief){$('waStatus').textContent='请先填写写作需求。';return}if(brief.length>8000||reference.length>12000){$('waStatus').textContent='需求最多 8000 字，参考文字最多 12000 字。';return}
  if(!window.confirm('需求和参考文字将发送到你配置的模型服务。请确认没有未经授权的敏感信息，是否继续？'))return
  const seq=++requestSeq;$('waAI').disabled=true;$('waStatus').textContent='正在请求模型起草…';$('waSuggestion').hidden=true
  try{const answer=await rpc('word.assist',{brief,reference,kind},65000);if(seq!==requestSeq)return;suggestion=answer;$('waSuggestionText').textContent=[answer.title,answer.recipient,answer.body,answer.signature,answer.date].filter(Boolean).join('\n\n');$('waSuggestion').hidden=false;$('waStatus').textContent=`模型草稿已生成（${answer.model||'模型'}），不会自动覆盖编辑区；请审核后应用。`}
  catch(error){if(seq===requestSeq)$('waStatus').textContent=`AI 起草失败：${error?.message||error}。你仍可使用本地草稿框架。`}
  finally{if(seq===requestSeq)$('waAI').disabled=false}
 })
 $('waApply').addEventListener('click',()=>{if(!suggestion)return;if(isEdited()&&!window.confirm('将替换当前编辑区内容，是否继续？'))return;apply(suggestion);$('waSuggestion').hidden=true;$('waStatus').textContent='已应用 AI 草稿。请核实事实、单位、日期及格式。'})
 $('waCheck').addEventListener('click',()=>{const root=$('waChecks');root.replaceChildren();for(const note of checkDocument(documentData())){const p=document.createElement('p');p.textContent='• '+note;root.append(p)}})
 $('waDownload').addEventListener('click',()=>{
  try{validFormat();const bytes=makeDocx(documentData(),formatData()),blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=($('waTitle').value.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').slice(0,60)||'文稿')+'.docx';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);$('waStatus').textContent='已生成 DOCX。请在 Word/WPS 检查字体、分页和具体格式要求。'}catch(error){$('waStatus').textContent=`无法导出：${error?.message||error}`}
 })
 render()
}
