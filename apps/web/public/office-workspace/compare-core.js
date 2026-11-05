import {unzipSync,strFromU8} from '../vendor/file-buddy/fflate.js'
const NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const MAX_BYTES=10*1024*1024,MAX_XML=25*1024*1024,MAX_TEXT=50000,MAX_LINES=500
export async function readComparable(file){
 if(!file||!/\.(txt|docx)$/i.test(file.name))throw Error('仅支持 TXT 和 DOCX 文件。')
 if(file.size>MAX_BYTES)throw Error('单个文件不能超过 10 MB。')
 const bytes=await file.arrayBuffer();let text='',warnings=[]
 if(/\.txt$/i.test(file.name)){
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw Error('TXT 不是有效 UTF-8 编码，请另存为 UTF-8 后重试。')}
 }else{
  let count=0,total=0;const entries=unzipSync(new Uint8Array(bytes),{filter(e){count++;total+=e.originalSize;if(count>2500||total>MAX_XML||e.originalSize>MAX_XML)throw Error('文档解压后过大，无法安全比较。');return e.name==='word/document.xml'}})
  if(!entries['word/document.xml'])throw Error('不是可读取的 DOCX。')
  const xml=strFromU8(entries['word/document.xml']);if(/<!DOCTYPE/i.test(xml))throw Error('不支持包含 DTD 的文档。')
  const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('DOCX 正文无法解析。')
  if(doc.getElementsByTagNameNS(NS,'ins').length||doc.getElementsByTagNameNS(NS,'del').length)warnings.push('文件包含修订痕迹；本比较不核对修订记录，请在 Word 中检查。')
  const paras=[...doc.getElementsByTagNameNS(NS,'p')].filter(p=>{for(let n=p.parentElement;n;n=n.parentElement)if(n.namespaceURI===NS&&n.localName==='del')return false;return true})
  text=paras.map(p=>{let out='';const walk=n=>{if(n.nodeType!==1)return;if(n!==p&&n.namespaceURI===NS&&n.localName==='p')return;if(n.namespaceURI===NS&&n.localName==='del')return;if(n.namespaceURI===NS&&n.localName==='t'){out+=n.textContent||'';return}if(n.namespaceURI===NS&&n.localName==='tab'){out+='\t';return}if(n.namespaceURI===NS&&(n.localName==='br'||n.localName==='cr')){out+='\n';return}for(const c of n.children)walk(c)};walk(p);return out}).join('\n')
  warnings.push('DOCX 仅比较提取的正文文字；图片、版式、表格结构、页眉页脚、脚注及批注不在比较范围。')
 }
 text=text.replace(/\r\n?/g,'\n');if(text.length>MAX_TEXT)throw Error('提取的正文超过 50000 字符，请拆分后比较。')
 const lines=text===''?[]:text.split('\n');if(lines.length>MAX_LINES)throw Error('正文超过 500 行或段，请拆分后比较。')
 return {lines,warnings}
}
// Bounded LCS, exact extracted lines; preserve sequence and whitespace.
export function compareLines(oldLines,newLines){
 if(oldLines.length>MAX_LINES||newLines.length>MAX_LINES)throw Error('正文超过 500 行或段。')
 const n=oldLines.length,m=newLines.length,width=m+1,dp=new Uint16Array((n+1)*width)
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i*width+j]=oldLines[i]===newLines[j]?dp[(i+1)*width+j+1]+1:Math.max(dp[(i+1)*width+j],dp[i*width+j+1])
 const changes=[];let i=0,j=0
 while(i<n||j<m){if(i<n&&j<m&&oldLines[i]===newLines[j]){i++;j++;continue}if(j<m&&(i===n||dp[i*width+j+1]>dp[(i+1)*width+j])){changes.push({type:'新增',line:j+1,text:newLines[j++]})}else{changes.push({type:'删除',line:i+1,text:oldLines[i++]})}}
 return changes
}
export function comparisonText(oldName,newName,changes,warnings=[]){
 const lines=[`旧文件：${oldName}`,`新文件：${newName}`,'仅比较提取的正文文字；修改通常显示为删除旧行和新增新行。',...warnings,'',changes.length?`共 ${changes.length} 条逐行变动：`:'提取的正文未发现逐行差异；不代表文件完全相同。']
 for(const c of changes)lines.push(`【${c.type} 第 ${c.line} 行】${c.text}`)
 return lines.join('\n')
}
