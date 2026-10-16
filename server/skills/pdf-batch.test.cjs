const {test}=require('node:test');const assert=require('node:assert/strict');const {zipSync,unzipSync}=require('fflate');const {PDFDocument}=require('pdf-lib');const {randomUUID,createHash}=require('node:crypto');const {mkdtempSync,rmSync}=require('node:fs');const {tmpdir}=require('node:os');const {join}=require('node:path');
const {executeSkill}=require('../../dist/local/server/skills/executors.js');const {readPDFBatch}=require('../../dist/local/server/skills/pdf-batch.js');const {SkillService}=require('../../dist/local/server/skills/service.js');const {scannedPDF,mixedPDF}=require('./testing/advanced-fixtures.cjs');
const run=bytes=>executeSkill({skillId:'pdf.ocr-batch',filename:'files.zip',bytes,deduplicate:false});
const pack=(files,level=6)=>zipSync(files,{level});
const json=(r,name)=>JSON.parse(Buffer.from(r.outputs.find(o=>o.name===name).bytes).toString());
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function finish(s,id){for(let i=0;i<7500;i++){const r=await(await s.handle(new Request('http://local/api/skill-runs/'+id),'owner')).json();if(!['queued','running'].includes(r.status))return r;await new Promise(r=>setTimeout(r,20));}throw Error('worker timeout');}
function request(bytes){const f=new FormData();f.set('file',new File([bytes],'batch.zip'));f.set('skillId','pdf.ocr-batch');f.set('expertId','documents');f.set('consent','true');f.set('requestId',randomUUID());return new Request('http://local/api/skill-runs',{method:'POST',body:f});}
async function waitFor(predicate){for(let i=0;i<2500;i++){const result=predicate();if(result)return result;await new Promise(r=>setTimeout(r,20));}throw Error('condition timed out');}

test('REAL two-file PDF OCR preserves source mapping, per-file evidence/hashes and mixed blank warnings inside downloadable ZIP',async()=>{
 const first=await scannedPDF({pages:1}),second=await mixedPDF(),bytes=pack({'扫描一.pdf':first,'扫描二.pdf':second});const r=await run(bytes);const report=json(r,'batch-report.json');assert.equal(report.fileCount,2);assert.equal(report.pageCount,4);assert.equal(report.pagesWithoutText,1);assert.equal(report.allPagesHaveText,false);assert.equal(report.sourceArchiveSHA256,hash(bytes));assert.equal(report.files[0].sourceSHA256,hash(first));assert.equal(report.files[1].sourceSHA256,hash(second));assert.match(r.summary,/不能视为全文/);
 const entries=unzipSync(r.outputs.find(o=>o.name==='batch-ocr-results.zip').bytes);assert.deepEqual(JSON.parse(Buffer.from(entries['batch-report.json'])),report);
 for(const f of report.files){const evidence=JSON.parse(Buffer.from(entries[f.folder+'/pdf-ocr-evidence.json']));assert.equal(evidence.sourceSHA256,f.sourceSHA256);assert.match(evidence.pages[0].text.replace(/\s/g,''),/项目验收SALES12345/);for(const p of evidence.pages)assert.equal(hash(entries[f.folder+'/'+p.rasterFile]),p.rasterSHA256);}
});
test('four files and eight total pages are all processed, not silently truncated',async()=>{
 const bytes=await scannedPDF({pages:2});const r=await run(pack({'a.pdf':bytes,'b.pdf':bytes,'c.pdf':bytes,'d.pdf':bytes}));const report=json(r,'batch-report.json');assert.equal(report.fileCount,4);assert.equal(report.pageCount,8);assert.equal(report.allPagesHaveText,true);assert.ok(report.files.every(f=>f.pageCount===2&&f.recognizedPages===2));
});
test('interrupted PDF batch is durably requeued after service restart and explicit retry is owner-scoped',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'pdf-ocr-recovery-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const db=join(dir,'runs.sqlite'),pdf=await scannedPDF({pages:3}),archive=pack({'recover-a.pdf':pdf,'recover-b.pdf':pdf});let service=new SkillService(db,120000);const created=await service.handle(request(archive),'owner'),queued=await created.json();assert.equal(created.status,202);await waitFor(()=>Number(service.db.prepare('SELECT count(*) AS n FROM skill_run_checkpoints WHERE run_id=?').get(queued.id)?.n||0)>=1);const savedCount=Number(service.db.prepare('SELECT count(*) AS n FROM skill_run_checkpoints WHERE run_id=?').get(queued.id)?.n||0);assert.ok(savedCount>=1);await service.close();service=new SkillService(db,120000);t.after(()=>service.close());const resumed=await finish(service,queued.id);assert.equal(resumed.status,'succeeded',resumed.error);assert.ok(resumed.events.some(e=>e.message.includes('检查点已持久保存')));assert.ok(resumed.events.some(e=>e.message.includes('恢复自已校验的持久化检查点')));assert.equal(Number(service.db.prepare('SELECT count(*) AS n FROM skill_run_checkpoints WHERE run_id=?').get(queued.id)?.n||0),0);
 const artifact=resumed.artifacts.find(a=>a.name==='batch-report.json');assert.ok(artifact);assert.equal((await service.handle(new Request('http://local/api/skill-runs/'+resumed.id+'/resume',{method:'POST'}),'other')).status,404);
 const second=await(await service.handle(request(archive),'owner')).json();await waitFor(()=>Number(service.db.prepare('SELECT count(*) AS n FROM skill_run_checkpoints WHERE run_id=?').get(second.id)?.n||0)>=1);assert.equal((await(await service.handle(new Request('http://local/api/skill-runs/'+second.id+'/cancel',{method:'POST'}),'owner')).json()).status,'cancelled');const retryResponse=await service.handle(new Request('http://local/api/skill-runs/'+second.id+'/resume',{method:'POST'}),'owner');assert.equal(retryResponse.status,202);const retry=await finish(service,second.id);assert.equal(retry.status,'succeeded',retry.error);assert.ok(retry.events.some(e=>e.message.includes('恢复自已校验的持久化检查点')));
});

test('ZIP rejects file count, paths, non-PDF files, declared oversize, encrypted flags, length/CRC damage',()=>{
 const pdf=Buffer.from('%PDF- sample');
 for(const files of [{'a.pdf':pdf},{'a.pdf':pdf,'b.pdf':pdf,'c.pdf':pdf,'d.pdf':pdf,'e.pdf':pdf},{'a.pdf':pdf,'sub/b.pdf':pdf},{'a.pdf':pdf,'b.txt':pdf},{'a.pdf':pdf,'../b.pdf':pdf}])assert.throws(()=>readPDFBatch(pack(files)));
 const stored=Buffer.from(pack({'a.pdf':pdf,'b.pdf':pdf},0));const pos=stored.readUInt32LE(stored.length-22+16);
 const crc=Buffer.from(stored);crc.writeUInt32LE(0,pos+16);assert.throws(()=>readPDFBatch(crc),/CRC/);
 const size=Buffer.from(stored);size.writeUInt32LE(3000000,pos+24);assert.throws(()=>readPDFBatch(size));
 const encrypted=Buffer.from(stored);encrypted.writeUInt16LE(1,pos+8);assert.throws(()=>readPDFBatch(encrypted),/加密/);
 const wrongName=Buffer.from(stored);wrongName[30]='z'.charCodeAt(0);assert.throws(()=>readPDFBatch(wrongName),/文件名/);
 assert.equal(readPDFBatch(stored).length,2);assert.throws(()=>readPDFBatch(stored.subarray(0,stored.length-1)),/ZIP/);
});
test('fake PDFs and more than eight total pages fail before OCR instead of processing only a subset',async()=>{
 await assert.rejects(()=>run(pack({'a.pdf':Buffer.from('fake'),'b.pdf':Buffer.from('fake')})),/不是真实PDF/);
 const doc=await PDFDocument.create();for(let i=0;i<5;i++)doc.addPage();const bytes=await doc.save();await assert.rejects(()=>run(pack({'a.pdf':bytes,'b.pdf':bytes})),/合计最多8页/);
});
test('real worker uses atomic delivery: a blank second file discards first-file outputs; successful batch remains owner-only',async t=>{
 const service=new SkillService(':memory:');t.after(()=>service.close());const good=await scannedPDF({pages:1}),blank=await scannedPDF({pages:1,blank:true});
 const bad=await(await service.handle(request(pack({'good.pdf':good,'blank.pdf':blank})),'owner')).json();const failed=await finish(service,bad.id);assert.equal(failed.status,'failed');assert.equal(failed.artifacts.length,0);assert.match(failed.error,/文件2.*整批未完成/);assert.ok(failed.events.some(e=>e.message.includes('文件1：第1/1页')));
 const twoPages=await scannedPDF({pages:2}),res=await service.handle(request(pack({'a.pdf':twoPages,'b.pdf':twoPages,'c.pdf':twoPages,'d.pdf':twoPages})),'owner');assert.equal(res.status,202);const q=await res.json(),done=await finish(service,q.id);assert.equal(done.status,'succeeded',done.error);assert.equal(done.artifacts.length,3);const a=done.artifacts.find(a=>a.name==='batch-ocr-results.zip'),url='http://local/api/skill-runs/'+q.id+'/artifacts/'+a.id;assert.equal((await service.handle(new Request(url),'other')).status,404);const contents=unzipSync(new Uint8Array(await(await service.handle(new Request(url),'owner')).arrayBuffer()));assert.ok(contents['document-04/pdf-ocr.txt']);const batch=JSON.parse(Buffer.from(contents['batch-report.json']));assert.equal(batch.fileCount,4);assert.equal(batch.pageCount,8);
});
