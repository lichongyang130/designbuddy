import {unzipSync} from './vendor/file-buddy/fflate.js'
import {FILE_SOURCES} from './file-buddy-sources.js'

export const SUPPORTED = /\.(xlsx|xls|docx|doc|pdf|txt|csv)$/i
const MAX_FILE = 20 * 1024 * 1024, MAX_XML = 25 * 1024 * 1024, MAX_TOTAL_XML = 40 * 1024 * 1024, MAX_TEXT = 500_000
const decoder = new TextDecoder('utf-8')
const xmlText = s => s.replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,ent=>{
 const m={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};if(m[ent])return m[ent]
 const hex=ent[2]?.toLowerCase()==='x', n=parseInt(ent.slice(hex?3:2,-1),hex?16:10);return Number.isFinite(n)&&n<=0x10ffff?String.fromCodePoint(n):' '
}).replace(/\s+/g,' ')

export function extractOffice(bytes,extension){
 let total=0,found=0
 const parts=unzipSync(new Uint8Array(bytes),{filter(entry){
  const wanted=extension==='docx'?/^word\/(document|header\d*|footer\d*)\.xml$/i.test(entry.name):/^xl\/(sharedStrings|workbook|worksheets\/sheet\d+)\.xml$/i.test(entry.name)
  if(!wanted)return false
  found++;total+=entry.originalSize
  if(found>200||entry.originalSize>MAX_XML||total>MAX_TOTAL_XML)throw Error('文档解压后过大')
  return true
 }})
 const required=extension==='docx'?'word/document.xml':'xl/workbook.xml'
 if(!parts[required]) throw Error('文件结构不完整或格式不受支持')
 const text=Object.values(parts).map(part=>xmlText(decoder.decode(part))).join(' ').slice(0,MAX_TEXT)
 return text
}
let pdfLoader
async function loadPdf(){
 if(globalThis.pdfjsLib)return globalThis.pdfjsLib
 if(!pdfLoader)pdfLoader=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='/vendor/file-buddy/pdf.min.js';script.onload=()=>resolve(globalThis.pdfjsLib);script.onerror=()=>reject(Error('PDF 解析器加载失败'));document.head.append(script)
 }).catch(error=>{pdfLoader=null;throw error})
 return pdfLoader
}
async function pdfText(buffer){
 const lib=await loadPdf();lib.GlobalWorkerOptions.workerSrc='/vendor/file-buddy/pdf.worker.min.js'
 const task=lib.getDocument({data:new Uint8Array(buffer),disableAutoFetch:true,disableStream:true,isEvalSupported:false})
 const pdf=await task.promise;let pages=[],limit=Math.min(pdf.numPages,30),length=0
 try{for(let i=1;i<=limit;i++){const page=await pdf.getPage(i);const text=await page.getTextContent();const content=text.items.map(x=>x.str||'').join(' ');pages.push(content);length+=content.length;if(length>=MAX_TEXT)break}}
 finally{await pdf.destroy()}
 return {text:pages.join(' ').slice(0,MAX_TEXT),partial:pdf.numPages>limit||length>=MAX_TEXT}
}
export async function indexFile(file){
 const ext=(file.name.split('.').pop()||'').toLowerCase(), path=file.webkitRelativePath||file.name
 const result={name:file.name,path,modified:file.lastModified||0,size:file.size,ext,text:'',status:'仅文件信息',file}
 if(file.size>MAX_FILE){result.status='文件超过 20 MB，仅索引文件信息';return result}
 if(ext==='xls'||ext==='doc'){result.status='旧版格式，仅索引文件信息';return result}
 try{
  const buffer=await file.arrayBuffer()
  if(ext==='xlsx'||ext==='docx')result.text=extractOffice(buffer,ext)
  else if(ext==='pdf'){const parsed=await pdfText(buffer);result.text=parsed.text;result.partial=parsed.partial}
  else if(ext==='txt'||ext==='csv')result.text=decoder.decode(buffer).slice(0,MAX_TEXT)
  result.status=result.text?(result.partial?'已索引部分正文':'已索引正文'):'未提取到正文，仅索引文件信息'
 }catch(error){result.status='无法解析正文，仅索引文件信息';result.error=String(error?.message||error)}
 return result
}
const TOPICS=[['预算',['预算','费用计划','经费计划','budget']],['合同',['合同','协议','contract']],['发票',['发票','invoice']],['报告',['报告','report']],['项目',['项目','project']]]
const DEPARTMENTS=['财务部','市场部','销售部','人事部','研发部','运营部','行政部','产品部','技术部','采购部']
const quarters={'一':1,'二':2,'三':3,'四':4,'1':1,'2':2,'3':3,'4':4}
export function parseQuery(raw,now=new Date()){
 const q=String(raw||'').trim(),lower=q.toLowerCase()
 let year=null,quarter=null
 const yearMatch=lower.match(/(20\d{2})\s*年?/)
 if(yearMatch)year=Number(yearMatch[1]);else if(/今年|本年|今年度/.test(q))year=now.getFullYear();else if(/去年|上年/.test(q))year=now.getFullYear()-1
 const qmatch=lower.match(/第\s*([一二三四1234])\s*季度|q\s*([1-4])|([一二三四1234])\s*季度/)
 if(qmatch)quarter=quarters[qmatch[1]||qmatch[2]||qmatch[3]]
 if(/本季度|这个季度/.test(q)){quarter=Math.floor(now.getMonth()/3)+1;year??=now.getFullYear()}
 if(/上季度/.test(q)){quarter=Math.floor(now.getMonth()/3);year??=now.getFullYear();if(quarter===0){quarter=4;year--}}
 if(quarter&&!year)year=now.getFullYear()
 const types=/excel|xlsx|xls|表格/i.test(q)?['xlsx','xls','csv']:/pdf/i.test(q)?['pdf']:/word|docx|doc|文档/i.test(q)?['docx','doc']:null
 const topic=TOPICS.find(([,aliases])=>aliases.some(alias=>lower.includes(alias)))||null
 const departments=DEPARTMENTS.filter(d=>q.includes(d))
 const sources=FILE_SOURCES.filter(source=>q.includes(source.name)).map(source=>source.id)
 let rest=lower.replace(/20\d{2}\s*年?/g,' ').replace(/第\s*[一二三四1234]\s*季度|[一二三四1234]\s*季度|q\s*[1-4]/g,' ').replace(/excel|xlsx|xls|pdf|word|docx|doc|表格/g,' ').replace(/帮我|找一下|查找|寻找|搜索|请找|文件|哪些|各部门|部门|提交|上传|发送|今年度|今年|去年|本年|上年|本季度|上季度|这个季度|以及|和|的|一下|有关|相关|所有|一份|一个|最新|版本/g,' ')
 if(topic)for(const alias of topic[1])rest=rest.split(alias).join(' ')
 for(const dep of departments)rest=rest.split(dep).join(' ')
 for(const source of FILE_SOURCES)if(sources.includes(source.id))rest=rest.split(source.name).join(' ')
 rest=rest.replace(/来自|发来的|下载的|保存的|里面|里的|中的|里|从/g,' ')
 const terms=rest.split(/[\s,，。？?、；;:：]+/).filter(x=>x.length>1).slice(0,5)
 return {query:q,year,quarter,types,topic,departments,sources,terms,submissionRequested:/提交|上传|发送/.test(q)}
}
function dateMatch(row,query){
 if(!query.year&&!query.quarter)return null
 const text=`${row.path} ${row.text}`.toLowerCase(), y=query.year, quarter=query.quarter
 if(quarter){
  const cn=['一','二','三','四'][quarter-1]
  const pattern=new RegExp(`${y}\\s*(?:年|[-/.])?\\s*(?:第\\s*)?(?:${cn}|${quarter})\\s*季度|${y}\\s*[-/ ]?q\\s*${quarter}\\b|(?:第\\s*)?(?:${cn}|${quarter})\\s*季度.{0,8}${y}`,'i')
  if(pattern.test(text))return `文件文字包含 ${y} 年第 ${quarter} 季度`
 }else if(new RegExp(`${y}\\s*年`).test(text))return `文件文字包含 ${y} 年`
 const d=new Date(row.modified)
 if(row.modified&&d.getFullYear()===y&&(!quarter||Math.floor(d.getMonth()/3)+1===quarter))return `修改时间位于 ${y} 年${quarter?`第 ${quarter} 季度`:''}（不是提交时间）`
 return false
}
export function searchFiles(rows,query,now=new Date()){
 const parsed=typeof query==='string'?parseQuery(query,now):query
 if(!parsed.query)return {parsed,results:[]}
 const results=[]
 for(const row of rows){
  if(parsed.sources?.length&&!parsed.sources.includes(row.source))continue
  if(parsed.types&&!parsed.types.includes(row.ext))continue
  const title=`${row.name} ${row.path}`.toLowerCase(),body=(row.text||'').toLowerCase(),hay=`${title} ${body}`
  let score=0,reasons=[]
  if(parsed.topic){const [topic,aliases]=parsed.topic;const hit=aliases.find(x=>hay.includes(x));if(!hit)continue;score+=title.includes(hit)?8:4;reasons.push(`${title.includes(hit)?'文件名或路径':'正文'}包含“${hit}”（${topic}）`)}
  if(parsed.departments.length&&!parsed.departments.some(d=>hay.includes(d)))continue
  if(parsed.departments.length){score+=3;reasons.push(`匹配部门：${parsed.departments.filter(d=>hay.includes(d)).join('、')}`)}
  let termsOK=true
  for(const term of parsed.terms){if(!hay.includes(term)){termsOK=false;break}score+=title.includes(term)?5:2;reasons.push(`${title.includes(term)?'文件名或路径':'正文'}包含“${term}”`)}
  if(!termsOK)continue
  const time=dateMatch(row,parsed);if(time===false)continue;if(time){score+=3;reasons.push(time)}
  if(parsed.types){score+=1;reasons.push(`文件类型：${row.ext.toUpperCase()}`)}
  if(parsed.sources?.length)reasons.push('按手动标记的来源筛选')
  if(!parsed.topic&&!parsed.terms.length&&!parsed.departments.length&&!parsed.types&&!parsed.year&&!parsed.sources?.length)continue
  results.push({row,score,reasons})
 }
 results.sort((a,b)=>b.score-a.score||b.row.modified-a.row.modified||a.row.name.localeCompare(b.row.name))
 return {parsed,results}
}
