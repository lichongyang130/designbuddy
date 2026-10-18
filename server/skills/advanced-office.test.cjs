const { test } = require('node:test');const assert=require('node:assert/strict');
const {createHash,randomUUID}=require('node:crypto');const ExcelJS=require('exceljs');const {PDFDocument, PDFName, PDFNumber, PDFDict, rgb}=require('pdf-lib');const sharp=require('sharp');
const {executeSkill}=require('../../dist/local/server/skills/executors.js');const {SkillService}=require('../../dist/local/server/skills/service.js');const {validateDecision,planningCandidates}=require('../../dist/local/server/skills/planner.js');const {validateSkillOptions}=require('../../dist/local/server/skills/contracts.js');
const {workbook,scannedPDF,mixedPDF}=require('./testing/advanced-fixtures.cjs');
const params={leftSheet:'订单',rightSheet:'客户',leftKey:'编号',rightKey:'编号',joinType:'left'};
const run=(skillId,filename,bytes,parameters)=>executeSkill({skillId,filename,bytes,deduplicate:false,...(parameters?{parameters}:{})});
const parse=(r,name)=>JSON.parse(Buffer.from(r.outputs.find(o=>o.name===name).bytes).toString());
const hash=b=>createHash('sha256').update(b).digest('hex');
const req=(path,method='GET')=>new Request('http://local/api/'+path,{method});
async function finished(s,id){for(let i=0;i<1800;i++){const response=await s.handle(req('skill-runs/'+id),'alice');const r=await response.json();if(!['queued','running'].includes(r.status))return r;await new Promise(r=>setTimeout(r,25));}throw Error('Real worker did not finish before 45s');}
async function upload(s,skill,bytes,parameters){const f=new FormData();f.set('file',new File([bytes],skill==='pdf.ocr'?'scan.pdf':'source.xlsx'));f.set('skillId',skill);f.set('expertId',skill==='pdf.ocr'?'documents':'data');f.set('consent','true');f.set('requestId',randomUUID());if(parameters)f.set('parameters',JSON.stringify(parameters));return s.handle(new Request('http://local/api/skill-runs',{method:'POST',body:f}),'alice');}

test('all join modes are actual typed-value joins with exact row provenance, never matching blanks or coercing identifiers',async()=>{
 const {bytes}=await workbook();
 for(const [mode,count] of [['left',6],['inner',3],['full',8]]){
  const r=await run('table.join','input.xlsx',bytes,{...params,joinType:mode});const report=parse(r,'join-report.json');assert.equal(report.outputRows,count);assert.equal(report.matchedRows,3);assert.deepEqual(report.unmatchedLeftRows,[3,5,6]);assert.deepEqual(report.unmatchedRightRows,[4,5]);assert.deepEqual(report.emptyKeyRows,{left:[6],right:[5]});assert.deepEqual(report.provenance[0],{resultRow:2,leftRow:2,rightRow:2,status:'matched'});
  const result=new ExcelJS.Workbook();await result.xlsx.load(Buffer.from(r.outputs.find(o=>o.name==='joined.xlsx').bytes));const sheet=result.getWorksheet('关联结果');assert.equal(sheet.rowCount,count+1);assert.equal(sheet.getCell('C2').value,'001');assert.equal(sheet.getCell('D2').value,10);assert.equal(sheet.getCell('F2').value,'客户甲');assert.equal(result.getWorksheet('来源对照').rowCount,count+1);
  if(mode!=='inner'){assert.equal(sheet.getCell('C3').value,'1');assert.equal(sheet.getCell('F3').value,null);}
 }
});
test('join preserves dates, booleans, literal formula-looking text, row gaps and case/whitespace distinctions',async()=>{
 const {bytes}=await workbook([['编号','日期','有效'],['A',new Date('2026-10-16T00:00:00Z'),true],[],[' A',null,false],['a','=1+1',true]],[['编号','名称'],['A','matched'],['a','lower']]);
 const r=await run('table.join','x.xlsx',bytes,params);const report=parse(r,'join-report.json');assert.equal(report.outputRows,3);assert.equal(report.skippedBlankRows.left,1);assert.deepEqual(report.provenance.map(x=>x.leftRow),[2,4,5]);assert.deepEqual(report.unmatchedLeftRows,[4]);
 const w=new ExcelJS.Workbook();await w.xlsx.load(Buffer.from(r.outputs[0].bytes));const s=w.getWorksheet('关联结果');assert.ok(s.getCell('D2').value instanceof Date);assert.equal(s.getCell('E2').value,true);assert.equal(s.getCell('D4').value,'=1+1');assert.equal(typeof s.getCell('D4').value,'string');
});
test('inner join with no matches delivers a checked empty result rather than inventing matches',async()=>{
 const {bytes}=await workbook([['编号'],['a']],[['编号'],['b']]);const r=await run('table.join','x.xlsx',bytes,{...params,joinType:'inner'});assert.equal(parse(r,'join-report.json').outputRows,0);const w=new ExcelJS.Workbook();await w.xlsx.load(Buffer.from(r.outputs[0].bytes));assert.equal(w.worksheets[0].rowCount,1);
});
test('join rejects ambiguous right keys, formulas, links, merges, duplicated headers and missing fields/sheets',async()=>{
 const cases=[
  {left:[['编号'],['a']],right:[['编号'],['a'],['a']],error:/不唯一/},
  {left:[['编号'],[{formula:'1+1',result:2}]],right:[['编号'],[2]],error:/公式/},
  {left:[['编号'],[{text:'a',hyperlink:'https://invalid.example'}]],right:[['编号'],['a']],error:/链接/},
  {left:[['编号','编号'],['a','b']],right:[['编号'],['a']],error:/重复字段/},
  {left:[[' 编号'],['a']],right:[['编号'],['a']],error:/表头/},
 ];
 for(const c of cases){const {bytes}=await workbook(c.left,c.right);await assert.rejects(()=>run('table.join','x.xlsx',bytes,params),c.error);}
 const {book,bytes}=await workbook();await assert.rejects(()=>run('table.join','x.xlsx',bytes,{...params,rightSheet:'unknown'}),/工作表/);await assert.rejects(()=>run('table.join','x.xlsx',bytes,{...params,rightKey:'wrong'}),/字段不存在/);
 book.worksheets[0].mergeCells('A2:B2');await assert.rejects(async()=>run('table.join','x.xlsx',await book.xlsx.writeBuffer(),params),/合并单元格/);
});
test('join bounds prevent wide/long source sheets and output expansion instead of truncating results',async()=>{
 const rows=[['编号',...Array.from({length:49},(_,i)=>'字段'+i)],...Array.from({length:1900},(_,i)=>[String(i),...Array(49).fill('x')])];
 const {bytes}=await workbook(rows,[['编号','名称'],['0','a']]);await assert.rejects(()=>run('table.join','x.xlsx',bytes,params),/关联结果超过/);
 const big=await workbook([['编号'],...Array.from({length:5001},(_,i)=>[String(i)])],[['编号'],['x']]);await assert.rejects(()=>run('table.join','x.xlsx',big.bytes,params),/5000行/);
 const tooMany=await workbook();for(let i=0;i<9;i++)tooMany.book.addWorksheet('额外'+i);await assert.rejects(async()=>run('table.join','x.xlsx',await tooMany.book.xlsx.writeBuffer(),params),/10个工作表/);
});
test('join schema is closed; planner requires literal parameter names in goal and enforces expert and file scope',()=>{
 const options={deduplicate:false,parameters:params};assert.deepEqual(validateSkillOptions('table.join',options),options);
 for(const parameters of [{...params,command:'execute'},{...params,leftSheet:'订单\n坏'},{...params,joinType:'cross'},{...params,leftSheet:'客户'},{}])assert.throws(()=>validateSkillOptions('table.join',{deduplicate:false,parameters}));
 assert.throws(()=>validateSkillOptions('table.join',{...options,deduplicate:true}));const d={kind:'plan',skillId:'table.join',expertId:'data',reason:'用户提供了表名与键',options};assert.equal(validateDecision(d,planningCandidates({file:{name:'x.xlsx'},expertScope:'data'}),'data','订单与客户按编号关联').skillId,'table.join');assert.throws(()=>validateDecision(d,planningCandidates({file:{name:'x.csv'}}),'data'));assert.throws(()=>validateDecision({...d,expertId:'qa'},planningCandidates({file:{name:'x.xlsx'}})));assert.equal(validateDecision(d,planningCandidates({file:{name:'x.xlsx'}}),'data','帮我自动关联数据').kind,'clarify');
});
test('REAL multi-page PDF OCR recognizes Chinese and English, outputs actual raster hashes and per-page coordinates',async()=>{
 const bytes=await scannedPDF({rotate:true});const r=await run('pdf.ocr','scan.pdf',bytes);const evidence=parse(r,'pdf-ocr-evidence.json');assert.equal(evidence.pageCount,2);assert.equal(evidence.recognizedPages,2);assert.equal(evidence.allPagesHaveText,true);assert.equal(evidence.sourceSHA256,hash(bytes));assert.match(evidence.pages[0].text.replace(/\s/g,''),/项目验收SALES12345/);assert.match(evidence.pages[1].text.replace(/\s/g,''),/INVOICEPAGE2TOTAL67890/);assert.ok(evidence.requiresReview);
 for(const p of evidence.pages){const artifact=r.outputs.find(o=>o.name===p.rasterFile);assert.equal(hash(artifact.bytes),p.rasterSHA256);assert.equal(hash(p.text),p.textSHA256);const meta=await sharp(artifact.bytes).metadata();assert.equal(meta.width,p.width);assert.equal(meta.height,p.height);assert.ok(p.width*p.height<=2000000);assert.ok(p.lines.length);assert.ok(p.lines[0].bbox);assert.ok(p.confidence>50);}
 assert.equal(Object.keys(evidence.modelHashes).length,2);assert.match(evidence.modelHashes.eng,/^[a-f0-9]{64}$/);
});
test('mixed scanned, text and blank PDF reports missing page honestly; wholly blank is failure',async()=>{
 const r=await run('pdf.ocr','mixed.pdf',await mixedPDF());const report=parse(r,'pdf-ocr-evidence.json');assert.equal(report.pageCount,3);assert.equal(report.recognizedPages,2);assert.equal(report.allPagesHaveText,false);assert.deepEqual(report.pagesWithoutText,[3]);assert.match(report.pages[1].text.replace(/\s/g,''),/DIGITALPAGE2CHECK24680/);assert.match(r.summary,/不能视为全文/);
 await assert.rejects(async()=>run('pdf.ocr','blank.pdf',await scannedPDF({pages:1,blank:true})),/所有PDF页面均未识别到/);
});
test('PDF OCR fails on invalid, encrypted, excessive-page, oversized-image, dynamic-form and huge-page inputs',async()=>{
 await assert.rejects(()=>run('pdf.ocr','fake.pdf',Buffer.from('no pdf')),/真实 PDF/);
 const many=await PDFDocument.create();for(let i=0;i<7;i++)many.addPage();await assert.rejects(async()=>run('pdf.ocr','many.pdf',await many.save()),/最多6页/);
 const imageDoc=await PDFDocument.create();const png=await sharp({create:{width:4001,height:3000,channels:3,background:'white'}}).png().toBuffer();const img=await imageDoc.embedPng(png);imageDoc.addPage().drawImage(img,{x:0,y:0,width:400,height:300});await assert.rejects(async()=>run('pdf.ocr','oversized.pdf',await imageDoc.save()),/1200万像素/);
 const huge=await PDFDocument.create();huge.addPage([15000,15000]);await assert.rejects(async()=>run('pdf.ocr','huge.pdf',await huge.save()),/尺寸不受支持/);
 const form=await PDFDocument.create();form.addPage();form.catalog.set(PDFName.of('AcroForm'),form.context.obj({XFA:'dynamic'}));await assert.rejects(async()=>run('pdf.ocr','xfa.pdf',await form.save()),/XFA/);
 const encrypted=await PDFDocument.create();encrypted.addPage();encrypted.context.trailerInfo.Encrypt=encrypted.context.register(encrypted.context.obj({Filter:'Standard',V:1,R:2,Length:40}));await assert.rejects(async()=>run('pdf.ocr','locked.pdf',await encrypted.save()),/加密/);
});
test('REAL bounded background workers persist both new skills and owner-only artifacts, cancellation/deadline never fake success',async t=>{
 const s=new SkillService(':memory:');t.after(()=>s.close());const {bytes}=await workbook();
 for(const [skill,data,p] of [['table.join',bytes,params],['pdf.ocr',await scannedPDF(),undefined]]){
  const queued=await upload(s,skill,data,p);assert.equal(queued.status,202);const q=await queued.json();const done=await finished(s,q.id);assert.equal(done.status,'succeeded',done.error);assert.ok(done.artifacts.length>=3);
  const receipt=done.artifacts.find(a=>a.name==='execution-receipt.json');const output=await (await s.handle(req(`skill-runs/${q.id}/artifacts/${receipt.id}`),'alice')).json();assert.equal(output.skillId,skill);assert.equal(output.inputHash,hash(data));if(p)assert.deepEqual(output.options.parameters,p);
  assert.equal((await s.handle(req(`skill-runs/${q.id}/artifacts/${receipt.id}`),'bob')).status,404);
 }
 const invalid=await upload(s,'table.join',bytes,{...params,command:'bad'});assert.equal(invalid.status,400);
 const waiting=await (await upload(s,'pdf.ocr',await scannedPDF())).json();await s.handle(req('skill-runs/'+waiting.id+'/cancel','POST'),'alice');const cancelled=await finished(s,waiting.id);assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.artifacts.length,0);
 const short=new SkillService(':memory:',1);t.after(()=>short.close());const q=await (await upload(short,'table.join',bytes,params)).json();const failed=await finished(short,q.id);assert.equal(failed.status,'failed');assert.match(failed.error,/超过/);assert.equal(failed.artifacts.length,0);
});
test('mocked join proposal freezes parameters; approval executes REAL join using only stored options',async t=>{
 const p={...params,joinType:'full'}, {bytes}=await workbook();const decision={kind:'plan',expertId:'data',skillId:'table.join',reason:'任务明确给出了两表、字段与全外连接',options:{deduplicate:false,parameters:p}};
 const s=new SkillService(':memory:',45000,async()=>decision);t.after(()=>s.close());
 const body={requestId:randomUUID(),goal:'订单和客户工作表按编号进行全外连接，右表编号必须唯一',file:{name:'source.xlsx',size:bytes.length,sha256:hash(bytes)},expertScope:'data',consent:true};
 const response=await s.handle(new Request('http://local/api/skill-plans',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),'alice');assert.equal(response.status,200);const plan=await response.json();assert.equal(plan.status,'review');assert.deepEqual(plan.decision.options.parameters,p);
 const f=new FormData();f.set('planId',plan.id);f.set('approvalDigest',plan.approvalDigest);f.set('consent','true');f.set('file',new File([bytes],'source.xlsx'));
 const q=await (await s.handle(new Request('http://local/api/skill-runs',{method:'POST',body:f}),'alice')).json();const r=await finished(s,q.id);assert.equal(r.status,'succeeded',r.error);const artifact=r.artifacts.find(a=>a.name==='join-report.json');const report=await (await s.handle(req(`skill-runs/${r.id}/artifacts/${artifact.id}`),'alice')).json();assert.equal(report.parameters.joinType,'full');assert.equal(report.outputRows,8);
});
test('PDF OCR cancellation after a real first-page result discards partial files; explicit reupload processes all six pages',async t=>{
 const s=new SkillService(':memory:');t.after(()=>s.close());const bytes=await scannedPDF({pages:6});const q=await(await upload(s,'pdf.ocr',bytes)).json();let reached=false;
 for(let i=0;i<1800;i++){const r=await(await s.handle(req('skill-runs/'+q.id),'alice')).json();if(r.status==='running' && r.events.some(e=>e.message.includes('第1/6页'))){reached=true;break;}if(!['running','queued'].includes(r.status))throw Error('Expected cancellable OCR after first page, got '+r.status);await new Promise(r=>setTimeout(r,10));}
 assert.equal(reached,true);await s.handle(req('skill-runs/'+q.id+'/cancel','POST'),'alice');const cancelled=await finished(s,q.id);assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.artifacts.length,0);
 const retry=await upload(s,'pdf.ocr',bytes);assert.equal(retry.status,202);const next=await retry.json();assert.notEqual(next.id,q.id);const done=await finished(s,next.id);assert.equal(done.status,'succeeded',done.error);const artifact=done.artifacts.find(a=>a.name==='pdf-ocr-evidence.json');const evidence=await(await s.handle(req(`skill-runs/${next.id}/artifacts/${artifact.id}`),'alice')).json();assert.equal(evidence.pageCount,6);assert.equal(evidence.recognizedPages,6);assert.equal(evidence.sourceSHA256,hash(bytes));
});
