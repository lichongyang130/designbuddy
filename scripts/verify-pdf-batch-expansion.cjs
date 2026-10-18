const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { zipSync, unzipSync } = require('fflate');
const { scannedPDF } = require('../server/skills/testing/advanced-fixtures.cjs');
const { SkillService } = require('../dist/local/server/skills/service.js');
const outDir = resolve(__dirname, '../docs/verification/pdf-batch-expansion-2026-10-16');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function main(){
  mkdirSync(join(outDir,'artifacts'),{recursive:true});
  const pagePdf=await scannedPDF({pages:2});
  const files={}; for(let i=1;i<=4;i++) files[`document-${i}.pdf`]=pagePdf;
  const input=zipSync(files,{level:6});
  const service=new SkillService(':memory:');
  try {
    const form=new FormData(); form.set('requestId',randomUUID()); form.set('skillId','pdf.ocr-batch'); form.set('expertId','documents'); form.set('consent','true'); form.set('file',new File([input],'four-documents.zip'));
    const created=await service.handle(new Request('http://local/api/skill-runs',{method:'POST',body:form}),'verification-owner');
    if(created.status!==202) throw Error(`enqueue failed: ${created.status} ${await created.text()}`);
    const queued=await created.json(); let run;
    for(let i=0;i<6000;i++){
      run=await(await service.handle(new Request(`http://local/api/skill-runs/${queued.id}`),'verification-owner')).json();
      if(!['queued','running'].includes(run.status)) break;
      await new Promise(r=>setTimeout(r,25));
    }
    if(run.status!=='succeeded') throw Error(`worker failed: ${run.error||run.status}`);
    const artifacts=[];
    for(const meta of run.artifacts){
      const response=await service.handle(new Request(`http://local/api/skill-runs/${run.id}/artifacts/${meta.id}`),'verification-owner');
      if(!response.ok) throw Error(`artifact download failed ${meta.name}: ${response.status}`);
      const bytes=Buffer.from(await response.arrayBuffer()); writeFileSync(join(outDir,'artifacts',meta.name),bytes);
      artifacts.push({name:meta.name,size:bytes.length,sha256:sha(bytes)});
    }
    const bundle=unzipSync(require('node:fs').readFileSync(join(outDir,'artifacts','batch-ocr-results.zip')));
    const report=JSON.parse(Buffer.from(bundle['batch-report.json']));
    if(report.fileCount!==4||report.pageCount!==8||!report.allPagesHaveText) throw Error('unexpected OCR report counts');
    for(const file of report.files){
      const evidence=JSON.parse(Buffer.from(bundle[`${file.folder}/pdf-ocr-evidence.json`]));
      if(evidence.pageCount!==2||evidence.recognizedPages!==2) throw Error('page-level recognition evidence mismatch');
    }
    const result={date:'2026-10-16',skill:'pdf.ocr-batch@1.0.0',status:run.status,summary:run.summary,input:{name:'four-documents.zip',size:input.length,sha256:sha(input)},actualServiceWorker:true,workerArtifacts:artifacts,report:{fileCount:report.fileCount,pageCount:report.pageCount,allPagesHaveText:report.allPagesHaveText,files:report.files.map(f=>({filename:f.filename,pageCount:f.pageCount,recognizedPages:f.recognizedPages,sourceSHA256:f.sourceSHA256}))},foreignOwner404:(await service.handle(new Request(`http://local/api/skill-runs/${run.id}`),'foreign-owner')).status===404,disclosure:'Synthetic fixture text only; real local OCR worker; no external service or business-document quality claim.'};
    writeFileSync(join(outDir,'results.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result,null,2));
  } finally {await service.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
