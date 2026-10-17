const {test}=require('node:test');const assert=require('node:assert/strict');const ExcelJS=require('exceljs');const {createHash,randomUUID}=require('node:crypto');
const {executeSkill}=require('../../dist/local/server/skills/executors.js');const {parseFormula,evaluateFormula}=require('../../dist/local/server/skills/formula-engine.js');const {SkillService}=require('../../dist/local/server/skills/service.js');const {planningCandidates,validateDecision}=require('../../dist/local/server/skills/planner.js');const {formulaWorkbook}=require('./testing/formula-fixtures.cjs');
const run=bytes=>executeSkill({skillId:'table.calculate',filename:'formulas.xlsx',bytes,deduplicate:false});
const parsed=r=>JSON.parse(Buffer.from(r.outputs.find(o=>o.name==='formula-report.json').bytes));
const scalar=f=>evaluateFormula(parseFormula(f,'Sheet1').tree,()=>[null],()=>{}).toString();
async function simple(formula,setup){const w=new ExcelJS.Workbook();const s=w.addWorksheet('Sheet1');s.getCell('A1').value={formula,result:123456};if(setup)setup(w,s);return Buffer.from(await w.xlsx.writeBuffer());}
async function finish(s,id){for(let i=0;i<1800;i++){const response=await s.handle(new Request('http://local/api/skill-runs/'+id),'owner');const r=await response.json();if(!['queued','running'].includes(r.status))return r;await new Promise(r=>setTimeout(r,20));}throw Error('worker timeout');}
function request(bytes,extra={}){const f=new FormData();for(const [k,v]of Object.entries({skillId:'table.calculate',expertId:'data',consent:'true',requestId:randomUUID(),...extra}))f.set(k,v);f.set('file',new File([bytes],'source.xlsx'));return new Request('http://local/api/skill-runs',{method:'POST',body:f});}

test('closed arithmetic grammar handles precedence, decimals, percent on divisor, ROUND and scientific literals',()=>{
 for(const [f,expected]of [['0.1+0.2','0.3'],['2+3*4','14'],['(2+3)*4','20'],['2/5%','40'],['2*5%','0.1'],['-50%','-0.5'],['50%%','0.005'],['ROUND(-1.005,2)','-1.01'],['ROUND(125,-1)','130'],['ABS(-5)+COUNT(2,3)','7'],['1e-3+2E-3','0.003'],['MIN(4,-2)+MAX(1,5)','3'],['=SUM(1,2,3)','6'],['ROUNDUP(1.001,2)','1.01'],['ROUNDDOWN(1.009,2)','1'],['MOD(-1,3)','2'],['POWER(2,10)','1024'],['INT(-1.5)','-2'],['SQRT(16)','4'],['SIGN(-7)','-1'],['CEILING(7,3)','9'],['FLOOR(7,3)','6']])assert.equal(scalar(f),expected,f);
 assert.throws(()=>scalar('ROUND(1,2.2)'),/位数/);assert.throws(()=>scalar('ROUND(1,16)'),/位数/);assert.throws(()=>scalar('1e999'),/范围/);assert.throws(()=>scalar('1e-31'),/范围/);assert.throws(()=>scalar('1/0'),/除数/);
});
test('actual XLSX formulas ignore deliberately stale caches, resolve cross-sheet dependencies and export ONLY calculated values',async()=>{
 const {bytes}=await formulaWorkbook();const result=await run(bytes),report=parsed(result);assert.equal(report.formulaCount,6);assert.equal(report.sourceSHA256,createHash('sha256').update(bytes).digest('hex'));assert.equal(report.cells.find(c=>c.sheet==='汇总'&&c.cell==='B2').decimalResult,'25.3');assert.equal(report.cells.find(c=>c.sheet==='汇总'&&c.cell==='B5').decimalResult,'22.77');assert.ok(report.cells.every(c=>c.cachedValueUsed===false));assert.deepEqual(report.cells.find(c=>c.sheet==='汇总'&&c.cell==='B2').dependencies,[{sheet:'明细',address:'D2',end:'D3'}]);
 const w=new ExcelJS.Workbook();await w.xlsx.load(Buffer.from(result.outputs[0].bytes));assert.equal(w.getWorksheet('明细').getCell('D2').value,.3);assert.equal(w.getWorksheet('汇总').getCell('B2').value,25.3);w.eachSheet(s=>s.eachRow(r=>r.eachCell(c=>assert.equal(c.formula,undefined))));
});
test('absolute refs, escaped quoted sheet names, case-insensitive sheet refs and shared-formula translation work',async()=>{
 const bytes=await simple("'O''Brien 表'!$B$1+other!$A1",(w,s)=>{w.addWorksheet("O'Brien 表").getCell('B1').value=2;w.addWorksheet('Other').getCell('A1').value=3;s.getCell('B1').value=4;s.getCell('B2').value=7;s.getCell('C1').value={formula:'B1*2',result:0,shareType:'shared',ref:'C1:C2'};s.getCell('C2').value={sharedFormula:'C1',result:0};});
 const report=parsed(await run(bytes));assert.equal(report.cells.find(c=>c.cell==='A1').result,5);assert.equal(report.cells.find(c=>c.cell==='C2').result,14);
});
test('aggregate semantics distinguish empty, text, booleans and numbers; dates are rejected instead of silently skipped',async()=>{
 const bytes=await simple('SUM(B1:B5)+COUNT(B1:B5)',(w,s)=>{s.getCell('B1').value=2;s.getCell('B2').value='12';s.getCell('B3').value=true;s.getCell('B5').value=3;});assert.equal(parsed(await run(bytes)).cells[0].result,7);
 assert.equal(parsed(await run(await simple('B1+2'))).cells[0].result,2);
 for(const value of ['12',true,new Date('2026-10-16')])await assert.rejects(async()=>run(await simple('B1+2',(w,s)=>s.getCell('B1').value=value)),/文本、布尔或日期/);
 await assert.rejects(async()=>run(await simple('SUM(B1:B2)',(w,s)=>s.getCell('B1').value=new Date('2026-10-16'))),/日期/);
 await assert.rejects(async()=>run(await simple('AVERAGE(B1:B2)')),/没有数值/);
 assert.equal(parsed(await run(await simple('MIN(B1:B2)+MAX(B1:B2)+COUNT(B1:B2)'))).cells[0].result,0);
});
test('errors are fail-closed for cycles, missing sheets, divide by zero and unsupported functions even with valid cached values',async()=>{
 for(const [formula,pattern]of [['A1+1',/循环/],['Missing!B1',/不存在/],['5/0',/除数/],['TEXTJOIN(",",TRUE,A1)',/不支持函数/],['WEBSERVICE("https://example.com")',/不支持函数/],['B1:B2',/区域/],['SUM(B3:B1)',/倒序/],['B1:B1+2',/区域/]])await assert.rejects(async()=>run(await simple(formula)),pattern);
 await assert.rejects(async()=>run(await simple('Other!A1',(w)=>{w.addWorksheet('Other').getCell('A1').value={formula:'Sheet1!A1',result:0};})),/循环/);
});
test('formula syntax is never JavaScript, external data, named ranges, implicit intersection or arbitrary function execution',()=>{
 for(const f of ['process.exit()','constructor(1)','SUM(1);globalThis.x=1','[book.xlsx]Sheet!A1','Revenue+1','SUM(A:A)','A1#','@A1','2^3','SUM()','1,2','1 garbage','SUM(B1:Other!B2)'])assert.throws(()=>scalar(f),undefined,f);
 assert.equal(globalThis.x,undefined);
});
test('resource bounds enforce formula length, nesting, reference area and dependency chain',async()=>{
 assert.throws(()=>parseFormula('1+'.repeat(300)+'1','Sheet1'),/512/);assert.throws(()=>parseFormula('('.repeat(66)+'1'+')'.repeat(66),'Sheet1'),/64/);assert.throws(()=>parseFormula('AY1','Sheet1'),/50列/);assert.throws(()=>parseFormula('A2001','Sheet1'),/2000行/);
 await assert.rejects(async()=>run(await simple('B1',(w,s)=>{for(let i=1;i<67;i++)s.getCell('B'+i).value={formula:'B'+(i+1),result:0};s.getCell('B68').value=1;})),/依赖链/);
 await assert.rejects(async()=>run(await simple('1',(w,s)=>{for(let i=2;i<=1001;i++)s.getCell('A'+i).value={formula:'1',result:0};})),/1000/);
 await assert.rejects(async()=>run(await simple('SUM(B1:AX2000)+SUM(B1:AX2000)+SUM(B1:AX2000)')),/200000/);
});
test('unsupported array formula, merged cells, errors and links fail; blank constants-only workbooks are not called recalculated',async()=>{
 await assert.rejects(async()=>run(await simple('1',(w,s)=>s.getCell('A1').value={formula:'SUM(B1:B2)',shareType:'array',ref:'A1:A2',result:1})),/数组/);
 await assert.rejects(async()=>run(await simple('1',(w,s)=>s.mergeCells('B1:C1'))),/合并/);
 for(const value of [{error:'#N/A'},{text:'link',hyperlink:'https://example.com'}])await assert.rejects(async()=>run(await simple('1',(w,s)=>s.getCell('B1').value=value)),/不支持错误|外部链接/);
 const w=new ExcelJS.Workbook();w.addWorksheet('No formulas').addRow([1,2]);await assert.rejects(async()=>run(await w.xlsx.writeBuffer()),/没有可计算公式/);
});
test('real service worker stores computed artifacts and receipts behind owner checks and rejects unexpected parameters',async t=>{
 const service=new SkillService(':memory:');t.after(()=>service.close());const {bytes}=await formulaWorkbook();const response=await service.handle(request(bytes),'owner');assert.equal(response.status,202);const q=await response.json();const done=await finish(service,q.id);assert.equal(done.status,'succeeded',done.error);const a=done.artifacts.find(a=>a.name==='formula-report.json');const path='http://local/api/skill-runs/'+q.id+'/artifacts/'+a.id;
 assert.equal((await service.handle(new Request(path),'other')).status,404);const report=await(await service.handle(new Request(path),'owner')).json();assert.equal(report.formulaCount,6);assert.equal((await service.handle(request(bytes,{parameters:'{"script":"evil"}'}),'owner')).status,400);
 const failed=await(await service.handle(request(await simple('1/0')),'owner')).json();const record=await finish(service,failed.id);assert.equal(record.status,'failed');assert.equal(record.artifacts.length,0);
});
test('planner accepts only matching candidate/expert/format and no calculation parameters',()=>{
 const d={kind:'plan',expertId:'data',skillId:'table.calculate',reason:'受限公式重算',options:{deduplicate:false}};assert.equal(validateDecision(d,planningCandidates({file:{name:'book.xlsx'}})).skillId,'table.calculate');assert.throws(()=>validateDecision(d,planningCandidates({file:{name:'book.csv'}})));assert.throws(()=>validateDecision({...d,expertId:'qa'},planningCandidates({file:{name:'book.xlsx'}})));assert.throws(()=>validateDecision({...d,options:{deduplicate:false,parameters:{formula:'1'}}},planningCandidates({file:{name:'book.xlsx'}})));
});

test('tier-2 text, boolean, comparison and concatenation semantics never coerce number into text',()=>{
 const value=f=>evaluateFormula(parseFormula(f,'Sheet1').tree,()=>[null],()=>{});
 assert.equal(scalar('"hello"'),'hello');assert.equal(scalar('"a"&"b"'),'ab');assert.equal(scalar('"n="&1'),'n=1');
 assert.equal(scalar('IF(1>0,"yes","no")'),'yes');assert.equal(scalar('IF(1>2,"yes","no")'),'no');assert.equal(scalar('IF(1>2,"yes")'),'false');
 assert.equal(scalar('LEN("abc")'),'3');assert.equal(scalar('UPPER("ab")'),'AB');assert.equal(scalar('LOWER("AB")'),'ab');
 assert.equal(scalar('LEFT("abcdef",2)'),'ab');assert.equal(scalar('RIGHT("abcdef",2)'),'ef');assert.equal(scalar('MID("abcdef",2,3)'),'bcd');
 assert.equal(scalar('TRIM("  a   b  ")'),'a b');assert.equal(scalar('CONCATENATE("a","b","c")'),'abc');
 assert.equal(value('1=1'),true);assert.equal(value('1<>1'),false);assert.equal(value('"a"="A"'),true);assert.equal(value('"5"=5'),false);
 assert.equal(value('AND(TRUE,1=1)'),true);assert.equal(value('OR(FALSE,FALSE)'),false);assert.equal(value('NOT(FALSE)'),true);
 assert.equal(value('TRUE'),true);assert.equal(value('FALSE'),false);
 assert.throws(()=>scalar('IF("a",1,2)'),/逻辑判断/);assert.throws(()=>scalar('"a"+1'),/文本、布尔或日期/);
});
test('VLOOKUP, INDEX, MATCH, SUMIF and COUNTIF read real ranges with exact-match and no-silent-coercion rules',async()=>{
 const setup=(w,s)=>{s.getCell('B1').value=1;s.getCell('B2').value=5;s.getCell('B3').value=3;s.getCell('C1').value=10;s.getCell('C2').value=20;s.getCell('C3').value=30;};
 assert.equal(parsed(await run(await simple('VLOOKUP(5,B1:C3,2,FALSE)',setup))).cells[0].result,20);
 assert.equal(parsed(await run(await simple('VLOOKUP(5,B1:C3,2)',setup))).cells[0].result,20);
 assert.equal(parsed(await run(await simple('INDEX(B1:C3,2,2)',setup))).cells[0].result,20);
 assert.equal(parsed(await run(await simple('MATCH(5,B1:B3,0)',setup))).cells[0].result,2);
 assert.equal(parsed(await run(await simple('SUMIF(B1:B3,">1",C1:C3)',setup))).cells[0].result,50);
 assert.equal(parsed(await run(await simple('COUNTIF(B1:B3,">1")',setup))).cells[0].result,2);
 assert.equal(parsed(await run(await simple('SUMIF(B1:B3,">=3",C1:C3)',setup))).cells[0].result,50);
 await assert.rejects(async()=>run(await simple('VLOOKUP(5,B1:C3,2,TRUE)',setup)),/精确匹配/);
 await assert.rejects(async()=>run(await simple('VLOOKUP(9,B1:C3,2,FALSE)',setup)),/未找到匹配/);
 await assert.rejects(async()=>run(await simple('MATCH(9,B1:B3,0)',setup)),/未找到匹配/);
 await assert.rejects(async()=>run(await simple('MATCH(5,B1:C3,0)',setup)),/单行或单列/);
 await assert.rejects(async()=>run(await simple('INDEX(B1:C3,2)',setup)),/必须同时指定/);
 await assert.rejects(async()=>run(await simple('VLOOKUP(5,B1,2,FALSE)',setup)),/区域/);
});
test('text and boolean results keep their real type in the report and in the exported workbook',async()=>{
 const bytes=await simple('IF(B1>10,"高","低")',(w,s)=>{s.getCell('B1').value=20;});
 const report=parsed(await run(bytes));assert.equal(report.cells[0].resultType,'text');assert.equal(report.cells[0].result,'高');assert.equal(report.cells[0].decimalResult,undefined);
 const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from((await run(bytes)).outputs[0].bytes));assert.equal(book.getWorksheet('Sheet1').getCell('A1').value,'高');
 const flag=parsed(await run(await simple('B1>10',(w,s)=>{s.getCell('B1').value=20;})));assert.equal(flag.cells[0].resultType,'boolean');assert.equal(flag.cells[0].result,true);
});
