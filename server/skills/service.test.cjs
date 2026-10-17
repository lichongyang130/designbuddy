const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SkillService } = require('../../dist/local/server/skills/service.js');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const ExcelJS = require('exceljs');
const { unzipSync, zipSync, strToU8, strFromU8 } = require('fflate');
const { createApiHandler } = require('../../dist/local/server/api/http-handler.js');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const upload = (skillId='table.analyze', expertId='data', content='产品,金额\n甲,10\n乙,20\n甲,10', filename='sample.csv', consent=true, parameters) => {
 const form=new FormData();form.set('skillId',skillId);form.set('expertId',expertId);form.set('file',new File([content],filename));form.set('consent',String(consent));form.set('deduplicate','true');
 if(parameters!==undefined)form.set('parameters',JSON.stringify(parameters));
 return new Request('http://local/api/skill-runs',{method:'POST',body:form});
};
const req=(path,method='GET')=>new Request('http://local/api/'+path,{method});
async function done(service,id,owner='alice') {
 const until=Date.now()+10000;
 while(Date.now()<until) { const r=await (await service.handle(req('skill-runs/'+id),owner)).json(); if(!['running','queued'].includes(r.status))return r;await new Promise(r=>setTimeout(r,20)); }
 throw Error('Worker did not finish');
}
async function output(service,run,name) { const a=run.artifacts.find(a=>a.name===name);assert.ok(a,name);const response=await service.handle(req(`skill-runs/${run.id}/artifacts/${a.id}`),'alice');assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/attachment/);return new Uint8Array(await response.arrayBuffer()); }

test('real worker CSV -> checked XLSX, JSON, SVG and receipt; owner-only list/download/delete', async t=>{
 const service=new SkillService(':memory:'); t.after(()=>service.close());
 const response=await service.handle(upload(),'alice'); assert.equal(response.status,202);const queued=await response.json();
 const run=await done(service,queued.id);assert.equal(run.status,'succeeded',run.error);assert.equal(run.artifacts.length,4);
 const report=JSON.parse(new TextDecoder().decode(await output(service,run,'analysis.json')));
 assert.equal(report.originalRows,3);assert.equal(report.retainedRows,2);assert.equal(report.duplicateRows,1);assert.equal(report.columns[1].sum,30);assert.deepEqual(report.sourceRows,[2,3]);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await output(service,run,'cleaned.xlsx')));assert.equal(workbook.worksheets[0].rowCount,3);assert.equal(workbook.worksheets[0].getCell('B3').value,20);
 assert.match(new TextDecoder().decode(await output(service,run,'overview.svg')),/<svg/);
 const receipt=JSON.parse(new TextDecoder().decode(await output(service,run,'execution-receipt.json')));assert.equal(receipt.inputHash,run.inputHash);assert.equal(receipt.skillId,'table.analyze');
 assert.equal((await service.handle(req('skill-runs/'+run.id),'bob')).status,404);
 assert.equal((await service.handle(req(`skill-runs/${run.id}/artifacts/${run.artifacts[0].id}`),'bob')).status,404);
 assert.equal((await service.handle(req('skill-runs/'+run.id,'DELETE'),'bob')).status,404);
 assert.equal((await (await service.handle(req('skill-runs'),'bob')).json()).runs.length,0);
 assert.equal((await service.handle(req('skill-runs/'+run.id,'DELETE'),'alice')).status,200);
 assert.equal((await service.handle(req('skill-runs/'+run.id),'alice')).status,404);
});
test('DOCX retains actual paragraphs, can be read again, and does not claim an AI summary',async t=>{
 const service=new SkillService(':memory:');t.after(()=>service.close());
 const queued=await (await service.handle(upload('document.format','documents','# 项目纪要\n实际材料 & 数据\n确认负责人：张三','notes.md'),'alice')).json();
 const run=await done(service,queued.id);assert.equal(run.status,'succeeded',run.error);
 const bytes=await output(service,run,'organized.docx');const xml=strFromU8(unzipSync(bytes)['word/document.xml']);assert.match(xml,/实际材料 &amp; 数据/);assert.match(xml,/确认负责人：张三/);
 const next=await (await service.handle(upload('document.format','documents',bytes,'notes.docx'),'alice')).json();const roundtrip=await done(service,next.id);assert.equal(roundtrip.status,'succeeded',roundtrip.error);
 const source=JSON.parse(new TextDecoder().decode(await output(service,roundtrip,'source-paragraphs.json')));assert.equal(source[1].text,'实际材料 & 数据');assert.match(roundtrip.summary,/未进行 AI/);
});
test('PPTX contains actual editable slides and escaped content preview with provenance',async t=>{
 const service=new SkillService(':memory:');t.after(()=>service.close());
 const queued=await (await service.handle(upload('slides.compose','slides','# 工作汇报\n完成三个任务\n<script>alert(1)</script>\n# 下周安排\n继续验证','slides.md'),'alice')).json();
 const run=await done(service,queued.id);assert.equal(run.status,'succeeded',run.error);
 const archive=unzipSync(await output(service,run,'presentation.pptx'));assert.ok(archive['ppt/slides/slide1.xml']);assert.ok(archive['ppt/slides/slide2.xml']);assert.match(strFromU8(archive['ppt/slides/slide1.xml']),/完成三个任务/);
 const html=new TextDecoder().decode(await output(service,run,'content-preview.html'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.match(run.summary,/没有执行 PowerPoint 渲染/);
});
test('registry rejects unbound/unavailable skills, wrong formats and missing upload consent',async t=>{
 const s=new SkillService(':memory:');t.after(()=>s.close());
 assert.equal((await s.handle(upload('table.analyze','qa'),'alice')).status,409);
 assert.equal((await s.handle(upload('collaboration.sync','communication','{"action":"email.send"}','request.json',true,{externalConsent:'yes',confirmation:'yes',idempotencyKey:'key-abc-123'}),'alice')).status,409);
 assert.equal((await s.handle(upload('code.build','developer','a,b\n1,2','a.csv'),'alice')).status,400);
 assert.equal((await s.handle(upload('table.analyze','data','bad','fake.pdf'),'alice')).status,400);
 assert.equal((await s.handle(upload('table.analyze','data','a,b\n1,2','a.csv',false),'alice')).status,403);
 assert.equal((await s.handle(upload('table.analyze','data','a'.repeat(2100001)),'alice')).status,413);
 const registry=await (await s.handle(req('skill-runtime'),'alice')).json();
 const {runtimeSkills}=require('../../dist/local/shared/skillRuntime.js');
 const {asrConfiguration}=require('../../dist/local/server/skills/asr-config.js');
 // Five skills that used to be placeholders now have real executors. Three of them
 // are self-contained and ready; the two that need an external service stay
 // unavailable until the server has that credential, and say why.
 const credentialBound=['collaboration.sync','image.generate'];
 const connected=['web.verify','test.browser','code.build'];
 assert.equal(registry.skills.length,runtimeSkills.length,'catalogue must expose every declared skill');
 for(const skill of registry.skills){
  if(credentialBound.includes(skill.id)){assert.equal(skill.status,'unavailable',skill.id);assert.equal(skill.executorState,'connected',skill.id);assert.ok(skill.requires&&skill.requires.length>0,skill.id+' must declare what it needs');continue;}
  if(connected.includes(skill.id)){assert.equal(skill.status,'ready',skill.id);assert.equal(skill.executorState,'connected',skill.id);continue;}
  if(skill.id==='audio.transcribe-en'){assert.equal(skill.status,asrConfiguration().ready?'ready':'unavailable',skill.id);continue;}
  if(skill.id==='document.summarize'){assert.equal(skill.status,(process.env.AI_API_KEY||process.env.OPENAI_API_KEY)?'ready':'unavailable',skill.id);continue;}
  assert.equal(skill.status,'ready',skill.id);
 }
 assert.equal(registry.skills.filter(s=>s.status==='ready').length+registry.skills.filter(s=>s.status==='unavailable').length,registry.skills.length,'every skill is either ready or explicitly unavailable');
});
test('malformed files, duplicate headers and formulas fail honestly without artifacts',async t=>{
 const s=new SkillService(':memory:');t.after(()=>s.close());
 for(const [content,name] of [['a,a\n1,2','bad.csv'],['a,b\n1','bad.csv'],['not zip','fake.xlsx']]) {
 const q=await (await s.handle(upload('table.analyze','data',content,name),'alice')).json();const r=await done(s,q.id);assert.equal(r.status,'failed');assert.equal(r.artifacts.length,0);assert.ok(r.error);
 }
 const workbook=new ExcelJS.Workbook();workbook.addWorksheet('Sheet').addRows([['金额'],[{formula:'1+1',result:2}]]);
 const q=await (await s.handle(upload('table.analyze','data',new Uint8Array(await workbook.xlsx.writeBuffer()),'formula.xlsx'),'alice')).json();const r=await done(s,q.id);assert.equal(r.status,'failed');assert.match(r.error,/公式/);
});
test('XLSX reads real first sheet, preserves string identifiers and does not interpret formula-looking CSV',async()=>{
 const workbook=new ExcelJS.Workbook();workbook.addWorksheet('真实数据').addRows([['编码','金额'],['001',12.5],['002',2.5]]);
 const r=await executeSkill({skillId:'table.analyze',filename:'data.xlsx',bytes:new Uint8Array(await workbook.xlsx.writeBuffer()),deduplicate:false});
 const report=JSON.parse(new TextDecoder().decode(r.outputs.find(o=>o.name==='analysis.json').bytes));assert.equal(report.sourceSheet,'真实数据');assert.equal(report.columns[0].numeric,false);assert.equal(report.columns[1].sum,15);
 const f=await executeSkill({skillId:'table.analyze',filename:'input.csv',bytes:strToU8('name,value\n=1+1,2'),deduplicate:false});const read=new ExcelJS.Workbook();await read.xlsx.load(Buffer.from(f.outputs[0].bytes));assert.equal(read.worksheets[0].getCell('A2').value,'=1+1');
});
test('cancel queued work, deadline failure and restart persistence never report fake success',async t=>{
 const s=new SkillService(':memory:',1);t.after(()=>s.close());
 const q=await (await s.handle(upload(),'alice')).json();await s.handle(req('skill-runs/'+q.id+'/cancel','POST'),'alice');assert.equal((await done(s,q.id)).status,'cancelled');
 const timed=await (await s.handle(upload(),'alice')).json();const r=await done(s,timed.id);assert.equal(r.status,'failed');assert.match(r.error,/超过/);assert.deepEqual(r.artifacts,[]);
 const dir=mkdtempSync(join(tmpdir(),'skill-persistence-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const db=join(dir,'skills.sqlite');const a=new SkillService(db);
 const interrupted=await (await a.handle(upload(),'alice')).json();await a.close();const b=new SkillService(db);t.after(()=>b.close());const saved=await (await b.handle(req('skill-runs/'+interrupted.id),'alice')).json();assert.equal(saved.status,'failed');assert.match(saved.error,/重启/);
});
test('unsafe XML entities, archive paths, malformed UTF8 and binary disguises are rejected',async()=>{
 for(const input of [
 {filename:'x.docx',bytes:zipSync({'word/document.xml':strToU8('<!DOCTYPE test><w:document/>')})},
 {filename:'x.docx',bytes:zipSync({'../bad':strToU8('a'),'word/document.xml':strToU8('<w:document/>')})},
 {filename:'x.txt',bytes:new Uint8Array([255,255])},
 {filename:'x.txt',bytes:new Uint8Array([0,1,2])},
 ]) await assert.rejects(()=>executeSkill({skillId:'document.format',deduplicate:false,...input}));
});
test('public API exposes only a read-only catalogue and never runs skills or serves files without an authenticated principal',async t=>{
 const service=new SkillService(':memory:');t.after(()=>service.close());
 const api=createApiHandler({authenticate:async()=>null,projects:{},skills:service});
 // The catalogue is public product metadata (skill list, limits, what each one still needs). It must not carry any
 // run, artifact, owner or session data.
 const catalogue=await api(req('skill-runtime'));
 assert.equal(catalogue.status,200);
 const body=await catalogue.json();
 assert.ok(Array.isArray(body.skills)&&body.skills.length>0);
 assert.equal(body.runs,undefined);assert.equal(body.artifacts,undefined);
 assert.ok(!/"(ownerId|inputHash|principal|session|token)"/.test(JSON.stringify(body)));
 // Execution, uploads, plans and run records stay behind authentication.
 assert.equal((await api(upload())).status,401);
 assert.equal((await api(req('skill-runs'))).status,401);
 assert.equal((await api(req('skill-plans'))).status,401);
});
test('decimal arithmetic is computed rather than inferred and unsafe numeric formats remain text',async()=>{
 const r=await executeSkill({skillId:'table.analyze',filename:'decimal.csv',bytes:strToU8('金额,百分比,标识\n0.1,10%,001\n0.2,20%,002'),deduplicate:false});
 const report=JSON.parse(new TextDecoder().decode(r.outputs.find(o=>o.name==='analysis.json').bytes));assert.equal(report.columns[0].sumExact,'0.3');assert.equal(report.columns[0].sum,0.3);assert.equal(report.columns[1].numeric,false);assert.equal(report.columns[2].numeric,false);
});
test('running cancellation stops the worker and successful runs survive reopening the database',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'skill-success-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const db=join(dir,'runs.sqlite');let service=new SkillService(db);t.after(()=>service.close());
 const q=await (await service.handle(upload(),'alice')).json();await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await (await service.handle(req('skill-runs/'+q.id),'alice')).json()).status,'running');
 await service.handle(req('skill-runs/'+q.id+'/cancel','POST'),'alice');assert.equal((await done(service,q.id)).status,'cancelled');
 const second=await (await service.handle(upload(),'alice')).json();const succeeded=await done(service,second.id);assert.equal(succeeded.status,'succeeded');
 await service.close();service=new SkillService(db);const saved=await done(service,second.id);assert.equal(saved.status,'succeeded');assert.equal(saved.inputHash,succeeded.inputHash);await output(service,saved,'analysis.json');
});
