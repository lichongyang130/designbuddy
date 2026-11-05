import test from 'node:test'
import assert from 'node:assert/strict'
// @ts-ignore browser bundle
await import('../apps/web/public/vendor/excel-buddy/exceljs.min.js')
// @ts-ignore browser modules
import {readWorkbook,analyze,makeWorkbook,suggestMapping,validateArchive} from '../apps/web/public/excel-assistant-core.js'
// @ts-ignore browser modules
import {unzipSync,strFromU8,zipSync,strToU8} from '../apps/web/public/vendor/file-buddy/fflate.js'
import {readFileSync} from 'node:fs'
const ExcelJS=(globalThis as any).ExcelJS
const options={currency:'CNY',unit:'元',duplicates:['department','person','date','amount']}
async function source(name:string,headers:string[],rows:any[][]){const b=new ExcelJS.Workbook();const s=b.addWorksheet('预算');s.addRow(headers);rows.forEach(row=>s.addRow(row));return new File([await b.xlsx.writeBuffer()],name)}

test('15 xlsx inputs are mapped, consolidated, checked and exported with a native chart',async()=>{
 const sheets=[]
 for(let i=0;i<15;i++){
  const headers=i%2?['部门名称','员工姓名','申请日期','申请金额']:['部门','姓名','日期','预算']
  const file=await source(`部门${i}.xlsx`,headers,[['销售部','小王','2026-08-01','1,000.00']])
  sheets.push(...await readWorkbook(ExcelJS,file))
 }
 const result=analyze(sheets,options)
 assert.equal(result.details.length,15);assert.equal(result.summaries[0].amount,15000);assert.equal(result.summaries[0].count,15)
 assert.equal(result.issues.filter((i:any)=>i.note.includes('疑似重复')).length,14)
 const bytes=await makeWorkbook(ExcelJS,result),archive=unzipSync(bytes)
 const chart=strFromU8(archive['xl/charts/chart1.xml']),sheet=strFromU8(archive['xl/worksheets/sheet2.xml'])
 assert.match(chart,/<c:barChart>/);assert.match(chart,/部门汇总/);assert.equal((sheet.match(/xmlns:r=/g)||[]).length,1);assert.match(sheet,/<drawing r:id="rId1"/)
 const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(bytes)
 assert.deepEqual(loaded.worksheets.map((s:any)=>s.name),['合并明细','部门汇总','问题检查','处理说明'])
 assert.equal(loaded.getWorksheet('部门汇总').getCell('B2').value.result,15000);assert.match(loaded.getWorksheet('部门汇总').getCell('B2').value.formula,/SUMPRODUCT/)
 assert.equal(loaded.getWorksheet('合并明细').getCell('C2').value,2)
})

test('invalid values are reported and excluded; formulas use cached values; duplicate numeric formats match',async()=>{
 const file=await source('测试.xlsx',['部门','姓名','日期','预算','币种','单位'],[
  ['财务','A','2026-02-30','-1','CNY','元'],['财务','A','2026-01-01','1,000.00','CNY','元'],['财务','A','2026-01-01',1000,'CNY','元'],['市场','B','2026-01-01',50,'USD','元'],['市场','B','2026-01-01',{formula:'SUM(1,2)',result:3},'CNY','元'],['=恶意内容','A','2026-01-01',3,'CNY','元']])
 const sheets=await readWorkbook(ExcelJS,file),r=analyze(sheets,options)
 assert.ok(r.issues.some((i:any)=>i.note.includes('日期无效')));assert.ok(r.issues.some((i:any)=>i.note.includes('金额为负数')))
 assert.ok(r.issues.some((i:any)=>i.note.includes('币种为空或')));assert.ok(r.issues.some((i:any)=>i.note.includes('疑似重复')));assert.ok(r.issues.some((i:any)=>i.note.includes('缓存值')))
 assert.equal(r.summaries.find((x:any)=>x.department==='财务').amount,2000);assert.equal(r.summaries.find((x:any)=>x.department==='市场').amount,3)
 const data=await makeWorkbook(ExcelJS,r),loaded=new ExcelJS.Workbook();await loaded.xlsx.load(data)
 assert.equal(loaded.getWorksheet('合并明细').getCell('D7').value,'=恶意内容')
 assert.equal(typeof loaded.getWorksheet('合并明细').getCell('D7').value,'string')
})

test('mapping validation, zip bounds, duplicate header ambiguity and missing cache are explicit',async()=>{
 assert.equal(suggestMapping(['部门','部门','预算']).department,-1)
 assert.throws(()=>validateArchive(strToU8('not a zip')))
 const sheet=(await readWorkbook(ExcelJS,await source('预算.xlsx',['部门','预算'],[['销售',100]])))[0]
 assert.throws(()=>analyze([sheet],options),/查重字段未映射/)
 sheet.mapping.amount=0;assert.throws(()=>analyze([sheet],{...options,duplicates:['department']}),/同一列/)
 const formula=(await readWorkbook(ExcelJS,await source('公式.xlsx',['部门','预算'],[['销售',{formula:'SUM(1,2)'}]])))[0]
 const result=analyze([formula],{...options,duplicates:['department']});assert.equal(result.summaries.length,0);assert.ok(result.issues.some((x:any)=>x.note.includes('缺少缓存')))
 const zip=zipSync({'hello.txt':strToU8('data')});assert.throws(()=>validateArchive(zip),/不是有效的 XLSX/)
})

test('workspace integrates local file manager and never posts spreadsheet data to server',()=>{
 const html=readFileSync('apps/web/public/index.html','utf8'),script=readFileSync('apps/web/public/excel-assistant.js','utf8'),buddy=readFileSync('apps/web/public/file-buddy.js','utf8')
 assert.match(html,/id="navHome"/);assert.doesNotMatch(html,/id="navExcelAssistant"/);assert.match(html,/id="viewExcelAssistant"/);assert.match(buddy,/excel-assistant:receive-files/)
 assert.doesNotMatch(script,/\bfetch\s*\(|XMLHttpRequest/);assert.match(script,/localStorage\.setItem/)
})

test('workspace appearance changes only the generated workbook header style',async()=>{
 const sheet=(await readWorkbook(ExcelJS,await source('部门.xlsx',['部门','预算'],[['财务部',123]])))[0]
 const result=analyze([sheet],{...options,duplicates:['department']})
 const bytes=await makeWorkbook(ExcelJS,result,{headerColor:'3157A4'})
 const archive=unzipSync(bytes),styles=strFromU8(archive['xl/styles.xml'])
 assert.match(styles,/FF3157A4/);assert.ok(archive['xl/charts/chart1.xml'])
 const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(bytes)
 assert.equal(loaded.getWorksheet('合并明细').getCell('D2').value,'财务部')
 assert.equal(loaded.getWorksheet('部门汇总').getCell('B2').value.result,123)
})
