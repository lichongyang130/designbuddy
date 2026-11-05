import {unzipSync,zipSync,strToU8,strFromU8} from './vendor/file-buddy/fflate.js'

export const FIELDS=[['department','部门'],['person','姓名'],['date','日期'],['amount','预算金额'],['currency','币种'],['unit','单位']]
const ALIASES={department:['部门','部门名称','所属部门','department','dept'],person:['姓名','员工姓名','申报人','申请人','name'],date:['日期','填报日期','申请日期','date'],amount:['预算金额','预算','申请金额','金额','预算费用','budget','amount'],currency:['币种','货币','currency'],unit:['单位','金额单位','unit']}
const normalize=s=>String(s??'').trim().toLowerCase().replace(/[\s_\-（）()]/g,'')
export function suggestMapping(headers){const map={};for(const [field] of FIELDS){const matches=headers.map((h,i)=>ALIASES[field].map(normalize).includes(normalize(h))?i:-1).filter(i=>i>=0);map[field]=matches.length===1?matches[0]:-1}return map}
export function validateArchive(bytes){
 if(bytes.byteLength>20*1024*1024)throw Error('单个文件超过 20 MB')
 let total=0,count=0,workbook=false
 unzipSync(new Uint8Array(bytes),{filter(entry){count++;total+=entry.originalSize;if(entry.name==='xl/workbook.xml')workbook=true;if(count>2500||entry.originalSize>30*1024*1024||total>60*1024*1024)throw Error('文件解压后过大');return false}})
 if(!workbook)throw Error('不是有效的 XLSX 工作簿')
}
function cellValue(cell){
 const value=cell.value
 if(value==null)return {value:''}
 if(value instanceof Date)return {value:value.toISOString().slice(0,10)}
 if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return {value}
 if(value.formula!==undefined||value.sharedFormula!==undefined){const v=value.result;return {value:v instanceof Date?v.toISOString().slice(0,10):v??'',formula:true,formulaText:value.formula||value.sharedFormula||'',missing:v==null}}
 if(value.richText)return {value:value.richText.map(x=>x.text).join('')}
 if(value.text!==undefined)return {value:String(value.text)}
 if(value.error)return {value:'',error:String(value.error)}
 return {value:String(value)}
}
export async function readWorkbook(ExcelJS,file){
 if(!/\.xlsx$/i.test(file.name))throw Error('仅支持 .xlsx，不支持 .xls、.xlsm 或加密工作簿')
 const bytes=await file.arrayBuffer();validateArchive(bytes)
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes)
 if(workbook.worksheets.length>30)throw Error('单个工作簿超过 30 个工作表')
 const sheets=[];let totalRows=0
 for(const ws of workbook.worksheets){
  if(ws.rowCount>10001||ws.columnCount>100)throw Error(`工作表 ${ws.name} 超过 10000 行或 100 列`)
  if(!ws.rowCount||!ws.columnCount)continue
  totalRows+=Math.max(0,ws.rowCount-1);if(totalRows>20000)throw Error('单个工作簿超过 20000 条数据，请分批处理')
  const headers=[];for(let c=1;c<=ws.columnCount;c++){const h=cellValue(ws.getRow(1).getCell(c)).value;headers.push(String(h||`列 ${c}`))}
  const rows=[]
  for(let r=2;r<=ws.rowCount;r++){
   const cells=[];let present=false
   for(let c=1;c<=headers.length;c++){const item=cellValue(ws.getRow(r).getCell(c));cells.push(item);if(item.value!==''||item.formula||item.error)present=true}
   if(present)rows.push({number:r,cells})
  }
  sheets.push({filename:file.name,name:ws.name,headers,rows,mapping:suggestMapping(headers),selected:ws.state==='visible'})
 }
 return sheets
}
function parseMoney(value,unit){
 const s=String(value??'').trim();if(!s)return {error:'预算金额为空'}
 if(!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(s))return {error:'金额无法解析或超过两位小数'}
 const amount=Number(s.replaceAll(',',''));if(!Number.isFinite(amount)||amount<0)return {error:'金额为负数或无效'}
 const cents=Math.round(amount*100*(unit==='万元'?10000:1));if(!Number.isSafeInteger(cents))return {error:'金额超出安全计算范围'}
 return {cents}
}
function parseDate(v){
 if(v==null||String(v).trim()==='')return {value:'',error:'日期为空'}
 const s=String(v).trim(),m=s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/)
 if(!m)return {value:s,error:'日期格式无法确认'}
 const y=Number(m[1]),month=Number(m[2]),day=Number(m[3]),d=new Date(Date.UTC(y,month-1,day))
 if(d.getUTCFullYear()!==y||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return {value:s,error:'日期无效'}
 return {value:`${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`}
}
export function analyze(sheets,options){
 const selected=sheets.filter(x=>x.selected);if(!selected.length)throw Error('至少选择一个工作表')
 if(!['CNY','USD'].includes(options.currency)||!['元','万元'].includes(options.unit))throw Error('请选择币种和单位')
 if(!options.duplicates?.length)throw Error('请选择至少一个查重字段')
 if(selected.reduce((total,s)=>total+s.rows.length,0)>20000)throw Error('选择的工作表合计超过 20000 条数据，请分批处理')
 for(const sheet of selected){for(const field of ['department','amount'])if(!Number.isInteger(sheet.mapping[field])||sheet.mapping[field]<0||sheet.mapping[field]>=sheet.headers.length)throw Error(`${sheet.filename} / ${sheet.name}：请映射部门和预算金额`)
  for(const field of options.duplicates)if(!Number.isInteger(sheet.mapping[field])||sheet.mapping[field]<0)throw Error(`${sheet.filename} / ${sheet.name}：查重字段未映射，请映射或取消该查重条件`)
  const mapped=Object.values(sheet.mapping).filter(i=>Number.isInteger(i)&&i>=0);if(new Set(mapped).size!==mapped.length)throw Error(`${sheet.filename} / ${sheet.name}：同一列不能映射到多个字段`)}
 const details=[],issues=[],summaries=new Map(),seen=new Map()
 for(const sheet of selected)for(const row of sheet.rows){
  const get=field=>sheet.mapping[field]>=0?row.cells[sheet.mapping[field]]||{value:''}:{value:''}
  const field=Object.fromEntries(FIELDS.map(([key])=>[key,get(key)])),source=`${sheet.filename} / ${sheet.name} / 第 ${row.number} 行`,notes=[]
  const department=String(field.department.value??'').trim(),person=String(field.person.value??'').trim(),date=parseDate(field.date.value)
  if(!department)notes.push('部门为空');if(sheet.mapping.person>=0&&!person)notes.push('姓名为空');if(sheet.mapping.date>=0&&date.error)notes.push(date.error)
  if(row.cells.some(c=>c.formula))notes.push('包含公式：仅使用原文件缓存值，未重新计算')
  if(row.cells.some(c=>c.missing))notes.push('公式缺少缓存值');if(row.cells.some(c=>c.error))notes.push('单元格包含错误值')
  const amount=parseMoney(field.amount.value,options.unit);if(amount.error)notes.push(amount.error)
  const currency=String(field.currency.value??'').trim(),unit=String(field.unit.value??'').trim()
  const acceptedCurrency=options.currency==='CNY'?['CNY','RMB','人民币','¥','￥']:['USD','美元','$']
  const currencyOK=sheet.mapping.currency<0||(currency&&acceptedCurrency.includes(currency.toUpperCase()))
  const allowedUnit=options.currency==='USD'?(options.unit==='元'?['元','美元','usd','yuan']:['万元','万美元','wanyuan']):(options.unit==='元'?['元','yuan']:['万元','wanyuan'])
  const unitOK=sheet.mapping.unit<0||(unit&&allowedUnit.includes(unit.toLowerCase()))
  if(!currencyOK)notes.push('币种为空或与所选币种不一致，未计入汇总')
  if(!unitOK)notes.push('单位为空或与所选单位不一致，未计入汇总')
  let duplicate='';const values={department,person,date:date.value,amount:amount.error?String(field.amount.value??'').trim():String(amount.cents)}
  const keys=options.duplicates.map(k=>normalize(values[k]));if(keys.every(Boolean)){const key=JSON.stringify(keys);if(seen.has(key)){duplicate=seen.get(key);notes.push(`疑似重复：与 ${duplicate} 相同（未删除）`)}else seen.set(key,source)}
  let includedAmount=null
  const valid=department&&!amount.error&&currencyOK&&unitOK&&!field.amount.missing&&!field.amount.error
  if(valid){const prev=summaries.get(department)||{cents:0,count:0};if(!Number.isSafeInteger(prev.cents+amount.cents))notes.push('部门汇总超出安全计算范围，未计入该行');else{prev.cents+=amount.cents;prev.count++;summaries.set(department,prev);includedAmount=amount.cents/100}}
  const original=row.cells.map((c,i)=>`${sheet.headers[i]} [${i+1}]: ${String(c.value??'')}${c.formula?` (公式: ${c.formulaText})`:''}`).join(' | ')
  if(original.length>32000)throw Error(`${source}：原始字段过长，无法完整写入一个 Excel 单元格，请拆分后重试`)
  details.push({file:sheet.filename,sheet:sheet.name,row:row.number,department,person,date:date.value,amount:field.amount.value,currency,unit,original,notes,includedAmount})
  for(const note of notes)issues.push({file:sheet.filename,sheet:sheet.name,row:row.number,note})
 }
 return {details,issues,summaries:[...summaries.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([department,v])=>({department,amount:v.cents/100,count:v.count})),options,selectedCount:selected.length}
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
function chartXml(count){
 const end=count+1,cat=`&apos;部门汇总&apos;!$A$2:$A$${end}`,val=`&apos;部门汇总&apos;!$B$2:$B$${end}`
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>部门预算</c:v></c:tx><c:cat><c:strRef><c:f>${cat}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${val}</c:f></c:numRef></c:val></c:ser><c:axId val="100"/><c:axId val="101"/></c:barChart><c:catAx><c:axId val="100"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:crossAx val="101"/><c:crosses val="autoZero"/></c:catAx><c:valAx><c:axId val="101"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:crossAx val="100"/><c:crosses val="autoZero"/></c:valAx></c:plotArea><c:plotVisOnly val="1"/></c:chart></c:chartSpace>`
}
export function attachChart(buffer,count){
 if(!count)return new Uint8Array(buffer)
 const files=unzipSync(new Uint8Array(buffer));const read=n=>strFromU8(files[n]),write=(n,s)=>{files[n]=strToU8(s)}
 let sheet=read('xl/worksheets/sheet2.xml');if(!/xmlns:r=/.test(sheet))sheet=sheet.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');sheet=sheet.replace('</worksheet>','<drawing r:id="rId1"/></worksheet>');write('xl/worksheets/sheet2.xml',sheet)
 write('xl/worksheets/_rels/sheet2.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>')
 write('xl/drawings/drawing1.xml','<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>4</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>13</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>20</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="部门预算图表"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>')
 write('xl/drawings/_rels/drawing1.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>')
 write('xl/charts/chart1.xml',chartXml(count))
 let types=read('[Content_Types].xml').replace('</Types>','<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>');write('[Content_Types].xml',types)
 return zipSync(files,{level:6})
}
export async function makeWorkbook(ExcelJS,result,appearance={}){
 const headerColor=/^[0-9A-Fa-f]{6}$/.test(String(appearance.headerColor||''))?'FF'+String(appearance.headerColor).toUpperCase():'FF285743'
 const book=new ExcelJS.Workbook();book.creator='DesignBuddy';book.calcProperties.fullCalcOnLoad=true
 const outputUnit=result.options.currency==='USD'?'美元':'元'
 const details=book.addWorksheet('合并明细'),summary=book.addWorksheet('部门汇总'),issues=book.addWorksheet('问题检查'),notes=book.addWorksheet('处理说明')
 const add=(ws,header,rows)=>{ws.addRow(header);for(const row of rows)ws.addRow(row.map(v=>typeof v==='number'&&Number.isFinite(v)?v:String(v??'')));ws.views=[{state:'frozen',ySplit:1}];ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:headerColor}};ws.columns.forEach(c=>{c.width=22});ws.autoFilter={from:'A1',to:`${String.fromCharCode(64+Math.min(header.length,26))}1`}}
 add(details,['来源文件','工作表','原始行号','部门','姓名','日期','预算原值','原币种','原单位','原始字段（列号与值）','检查结果','计入汇总金额'],result.details.map(d=>[d.file,d.sheet,d.row,d.department,d.person,d.date,d.amount,d.currency,d.unit,d.original,d.notes.join('；'),d.includedAmount??'']))
 add(summary,['部门',`预算总额（${result.options.currency}，${outputUnit}）`,'计入行数'],result.summaries.map(d=>[d.department,d.amount,d.count]));summary.getColumn(2).numFmt='#,##0.00'
 if(result.details.length){const end=result.details.length+1;for(const [i,item] of result.summaries.entries()){const r=i+2,dept=`'合并明细'!$D$2:$D$${end}`,amount=`'合并明细'!$L$2:$L$${end}`;summary.getCell(`B${r}`).value={formula:`SUMPRODUCT(--(${dept}=A${r}),IFERROR(${amount}*1,0))`,result:item.amount};summary.getCell(`C${r}`).value={formula:`SUMPRODUCT(--(${dept}=A${r}),--ISNUMBER(${amount}))`,result:item.count}}}
 add(issues,['来源文件','工作表','原始行号','问题'],result.issues.map(i=>[i.file,i.sheet,i.row,i.note]))
 add(notes,['项目','说明'],[['口径',`币种 ${result.options.currency}；输入单位 ${result.options.unit==='万元'?'万':''}${outputUnit}；结果单位 ${outputUnit}`],['查重规则',result.options.duplicates.join(' + ')],['重复数据','仅标记、不删除；符合条件的重复行仍计入汇总'],['无币种/单位列','按确认的币种与单位处理；有列但不一致的行不计入'],['公式','原文件公式仅使用缓存值；汇总公式引用明细表“计入汇总金额”。原始字段更改后需重新运行检查'],['日期与姓名','只检查格式与空值，不验证人员身份'],['图表','图表显示前 50 个部门，汇总表保留全部部门'],['来源','原文件未修改；原始行号按工作表位置保留']])
 const bytes=await book.xlsx.writeBuffer();return attachChart(bytes,Math.min(50,result.summaries.length))
}
