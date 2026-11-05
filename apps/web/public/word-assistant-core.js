import {zipSync,unzipSync,strToU8,strFromU8} from './vendor/file-buddy/fflate.js'
const esc=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
const limit=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}
export const DEFAULT_FORMAT={font:'仿宋_GB2312',titleFont:'方正小标宋简体',titleSize:22,size:16,line:28,top:37,bottom:35,left:28,right:26}
export function draftTemplate(kind,brief){
 const topic=brief.trim()||'［待补充事项］', title=`关于${topic.replace(/[。；;\n]+/g,' ').slice(0,48)}的${kind}`
 const content={'通知':['为做好相关工作，现就有关事项通知如下：','一、工作内容','［请填写具体工作内容、责任分工和完成时限。］','二、有关要求','［请填写执行要求、联系人和联系方式。］'], '请示':['［请说明请示事项的背景、依据和必要性。］','一、请示事项','［请明确需审批或协调的事项。］','二、有关说明','［请补充方案、影响和相关依据。］','以上请示，请予审阅。'], '报告':['［请说明报告背景和基本情况。］','一、工作情况','［请填写已开展的工作及真实数据。］','二、存在问题','［请填写具体问题和原因。］','三、下一步安排','［请填写计划、责任和时间安排。］'], '会议纪要':['［请填写会议时间、地点、主持人和参会人员。］','一、会议议题','［请填写议题和讨论情况。］','二、议定事项','［请逐项填写议定内容、责任人和完成时间。］']}
 return {title,recipient:'［主送单位］',body:(content[kind]||content['通知']).join('\n'),signature:'［落款单位］',date:'［成文日期］'}
}
export function checkDocument(doc){
 const notes=[];if(!doc.title.trim())notes.push('标题为空。');if(!doc.recipient.trim())notes.push('主送单位为空，请确认该文种是否需要。');if(!doc.body.trim())notes.push('正文为空。');if(!doc.signature.trim())notes.push('落款单位为空。');if(!doc.date.trim())notes.push('成文日期为空。')
 const all=[doc.title,doc.recipient,doc.body,doc.signature,doc.date].join('\n');if(/［[^］]{1,40}］|\[待/.test(all))notes.push('文稿包含待填写内容，请逐项核实。')
 for(const [word,suggestion] of [['既将','即将'],['以经','已经'],['截止目前','截至目前'],['在接再厉','再接再厉']])if(all.includes(word))notes.push(`疑似用词：“${word}”可考虑改为“${suggestion}”，请结合语境核对。`)
 if(doc.date.trim()){
  const m=doc.date.trim().match(/^(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})日?$/)
  if(!m)notes.push('成文日期格式需人工核对。')
  else{const y=Number(m[1]),month=Number(m[2]),day=Number(m[3]),d=new Date(Date.UTC(y,month-1,day));if(d.getUTCFullYear()!==y||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)notes.push('成文日期无效，请核对。')}
 }
 notes.push('检查仅覆盖少量规则，不保证无错别字或符合公文规范；发文前请人工审核事实、权限和适用格式。')
 return notes
}
export function parseReference(bytes){
 if(bytes.byteLength>10*1024*1024)throw Error('参考文件超过 10 MB')
 let total=0,count=0
 const entries=unzipSync(new Uint8Array(bytes),{filter(e){count++;total+=e.originalSize;if(count>2500||total>30*1024*1024||e.originalSize>20*1024*1024)throw Error('参考文件解压后过大');return e.name==='word/document.xml'}})
 if(!entries['word/document.xml'])throw Error('不是可读取的 DOCX')
 const xml=strFromU8(entries['word/document.xml']);if(/<!DOCTYPE/i.test(xml))throw Error('不支持包含 DTD 的文档')
 const parsed=new DOMParser().parseFromString(xml,'application/xml');if(parsed.getElementsByTagName('parsererror').length)throw Error('文档内容无法解析')
 const paragraphs=[...parsed.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','p')]
 return paragraphs.map(p=>[...p.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','t')].map(t=>t.textContent||'').join('')).filter(Boolean).join('\n').slice(0,12000)
}
export function makeDocx(doc,format=DEFAULT_FORMAT){
 if(!doc.title.trim()||!doc.body.trim())throw Error('请填写标题和正文')
 const f={font:String(format.font||DEFAULT_FORMAT.font).slice(0,80),titleFont:String(format.titleFont||DEFAULT_FORMAT.titleFont).slice(0,80),titleSize:limit(format.titleSize,14,30,22),size:limit(format.size,10,24,16),line:limit(format.line,18,48,28),top:limit(format.top,10,50,37),bottom:limit(format.bottom,10,50,35),left:limit(format.left,10,50,28),right:limit(format.right,10,50,26)}
 const fonts=name=>`<w:rFonts w:ascii="${esc(name)}" w:hAnsi="${esc(name)}" w:eastAsia="${esc(name)}"/>`
 const run=(text,font,size,bold=false)=>`<w:r><w:rPr>${fonts(font)}<w:sz w:val="${Math.round(size*2)}"/><w:szCs w:val="${Math.round(size*2)}"/>${bold?'<w:b/>':''}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
 const p=(text,{align='left',font=f.font,size=f.size,indent=false,bold=false,spacing=f.line}={})=>`<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:line="${Math.round(spacing*20)}" w:lineRule="exact" w:before="0" w:after="0"/>${indent?'<w:ind w:firstLineChars="200"/>':''}</w:pPr>${run(text,font,size,bold)}</w:p>`
 const lines=String(doc.body).split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
 const body=[p(doc.title,{align:'center',font:f.titleFont,size:f.titleSize,spacing:Math.max(f.line,f.titleSize*1.2)}),doc.recipient.trim()?p(doc.recipient.trim().replace(/[：:]?$/,'：')):'',...lines.map(line=>{const heading=/^[一二三四五六七八九十]+、/.test(line),sub=/^[（(][一二三四五六七八九十]+[）)]/.test(line);return p(line,{font:heading?'黑体':sub?'楷体_GB2312':f.font,indent:true})}),doc.signature.trim()?p(doc.signature.trim(),{align:'right'}):'',doc.date.trim()?p(doc.date.trim(),{align:'right'}):''].join('')
 const mm=x=>Math.round(x*1440/25.4)
 const document=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:footerReference w:type="default" r:id="rId1"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${mm(f.top)}" w:bottom="${mm(f.bottom)}" w:left="${mm(f.left)}" w:right="${mm(f.right)}" w:header="850" w:footer="900" w:gutter="0"/></w:sectPr></w:body></w:document>`
 const footer='<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:fldSimple w:instr="PAGE"><w:r><w:rPr><w:sz w:val="28"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>'
 const types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>'
 const root='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
 const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>'
 return zipSync(Object.fromEntries(Object.entries({'[Content_Types].xml':types,'_rels/.rels':root,'word/document.xml':document,'word/_rels/document.xml.rels':rels,'word/footer1.xml':footer}).map(([path,text])=>[path,strToU8(text)])),{level:6})
}
