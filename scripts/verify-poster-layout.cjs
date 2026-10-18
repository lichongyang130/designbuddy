// Run after compiling server/tsconfig.local.json. Uses an isolated in-memory service, never the workspace DB.
const assert=require('node:assert/strict');
const {createHash,randomUUID}=require('node:crypto');
const {mkdir,writeFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const {SkillService}=require('../dist/local/server/skills/service.js');
const {posterExample}=require('../dist/local/shared/posterLayout.js');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function main(){
 const folder=resolve(process.argv[2]||'.cache/layout-service-artifacts'),service=new SkillService(':memory:');
 try{
  const input=Buffer.from(JSON.stringify(posterExample(),null,2)),form=new FormData();
  for(const[k,v]of Object.entries({skillId:'image.layout',expertId:'visual',consent:'true',requestId:randomUUID()}))form.set(k,v);
  form.set('file',new File([input],'poster-layout.json',{type:'application/json'}));
  const created=await service.handle(new Request('http://local/api/skill-runs',{method:'POST',body:form}),'layout-fixture-owner');assert.equal(created.status,202);
  const id=(await created.json()).id;let run;
  for(let i=0;i<500;i++){run=await(await service.handle(new Request('http://local/api/skill-runs/'+id),'layout-fixture-owner')).json();if(!['queued','running'].includes(run.status))break;await new Promise(r=>setTimeout(r,20));}
  assert.equal(run.status,'succeeded',run.error);assert.equal(run.artifacts.length,6);assert.equal(run.inputHash,sha(input));await mkdir(folder,{recursive:true});
  const outputs={};for(const artifact of run.artifacts){const request=new Request('http://local/api/skill-runs/'+id+'/artifacts/'+artifact.id);assert.equal((await service.handle(request,'different-owner')).status,404);const response=await service.handle(request,'layout-fixture-owner');assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha(bytes),artifact.sha256);await writeFile(resolve(folder,artifact.name),bytes);outputs[artifact.name]=bytes;}
  const report=JSON.parse(outputs['poster-report.json']);assert.equal(report.sourceSHA256,sha(input));assert.equal(report.render.pngSHA256,sha(outputs['poster.png']));assert.equal(report.render.svgSHA256,sha(outputs['poster.svg']));assert.deepEqual(JSON.parse(outputs['poster-project.json']),posterExample());
  console.log(JSON.stringify({folder,status:run.status,sourceSHA256:run.inputHash,artifacts:run.artifacts.map(({name,size,sha256})=>({name,size,sha256})),foreignOwnerDownload:404,generatedImagery:report.generatedImagery,published:report.published},null,2));
 }finally{service.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
