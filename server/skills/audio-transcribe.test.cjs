const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {randomUUID,createHash}=require('node:crypto');
const {executeSkill}=require('../../dist/local/server/skills/executors.js');
const {readSpeechWav,validateTranscript}=require('../../dist/local/server/skills/audio-transcribe.js');
const {startASRProcess}=require('../../dist/local/server/skills/asr-process.js');
const {asrConfiguration,asrRoot}=require('../../dist/local/server/skills/asr-config.js');
const {runtimeCatalog}=require('../../dist/local/server/skills/runtime-catalog.js');
const {SkillService}=require('../../dist/local/server/skills/service.js');
const {validateSkillOptions}=require('../../dist/local/server/skills/contracts.js');
const {planningCandidates,planSkill}=require('../../dist/local/server/skills/planner.js');
const sample=(name='goforward')=>fs.readFileSync(path.join(__dirname,'testing/audio',name+'.wav'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const run=bytes=>executeSkill({skillId:'audio.transcribe-en',filename:'upload.wav',bytes,deduplicate:false,parameters:{englishConfirmed:'yes'}});
const report=r=>JSON.parse(Buffer.from(r.outputs.find(o=>o.name==='transcript-report.json').bytes));
function wave(pcm){const h=Buffer.from(sample().subarray(0,44));h.writeUInt32LE(36+pcm.length,4);h.writeUInt32LE(pcm.length,40);return Buffer.concat([h,pcm]);}
function request(bytes=sample(),extra={}){const f=new FormData();for(const[k,v]of Object.entries({skillId:'audio.transcribe-en',expertId:'documents',consent:'true',requestId:randomUUID(),parameters:JSON.stringify({englishConfirmed:'yes'}),...extra}))f.set(k,v);f.set('file',new File([bytes],'speech.wav'));return new Request('http://local/api/skill-runs',{method:'POST',body:f});}
async function wait(fn){for(let i=0;i<1500;i++){const x=await fn();if(x)return x;await new Promise(r=>setTimeout(r,10));}throw Error('test condition timed out');}
const get=async(s,id)=> (await s.handle(new Request('http://local/api/skill-runs/'+id),'owner')).json();
const done=(s,id)=>wait(async()=>{const r=await get(s,id);return !['queued','running'].includes(r.status)&&r;});
const alive=pid=>{try{process.kill(pid,0);return true}catch{return false}};

test('REAL offline recognizer reads two different actual recordings with native word timing and low-score evidence',async()=>{
 assert.equal(asrConfiguration().ready,true,'Run python3 scripts/setup-asr.py; actual recognition tests are not skipped or mocked.');
 for(const [name,text]of [['goforward','go forward ten meters'],['something','go somewhere and do something']]){
  const b=sample(name),r=await run(b),p=report(r);assert.equal(Buffer.from(r.outputs[0].bytes).toString().trim(),text);assert.equal(p.sourceSHA256,sha(b));assert.equal(p.pcmSHA256,sha(b.subarray(44)));assert.equal(p.languageAutomaticallyVerified,false);assert.equal(p.confidenceIsAccuracy,false);assert.equal(p.engine.networkUsed,false);assert.equal(p.wordCount,text.split(' ').length);assert.ok(p.words.every(w=>w.startSeconds>=0&&w.endSeconds>w.startSeconds&&w.endSeconds<=p.audio.durationSeconds&&w.requiresReview));assert.ok(p.lowConfidenceWordCount>0);assert.deepEqual(Buffer.from(r.outputs.find(o=>o.name==='review-audio.wav').bytes),b);assert.match(Buffer.from(r.outputs.find(o=>o.name==='transcript.srt').bytes).toString(),/00:00:00,\d{3} --> 00:00:02,\d{3}/);assert.match(Buffer.from(r.outputs.find(o=>o.name==='recognizer-license.txt').bytes).toString(),/Alpha Cephei/);
  if(name==='goforward'){assert.ok(p.words.some(w=>w.posteriorApprox>1&&w.displayConfidence===1));assert.equal(p.words.find(w=>w.word==='ten').lowConfidence,true);}
 }
});
test('actual leading silence and separated utterances retain original-audio time positions, not per-segment zero',async()=>{
 const a=sample().subarray(44),b=sample('something').subarray(44),data=wave(Buffer.concat([Buffer.alloc(32000),a,Buffer.alloc(32000),b]));const p=report(await run(data));assert.equal(p.cues.length,2);assert.equal(p.cues[0].text,'go forward ten meters');assert.equal(p.cues[1].text,'go somewhere and do something');assert.ok(p.words[0].startSeconds>1.45);assert.ok(p.cues[1].startSeconds>4.7);assert.ok(p.cues[1].endSeconds<=p.audio.durationSeconds);
});
test('strict WAV rejects wrong rates/channels/encoding, invalid lengths, multiple data and overlong recordings',()=>{
 const original=sample();for(const mutate of [b=>b.writeUInt16LE(2,22),b=>b.writeUInt32LE(44100,24),b=>b.writeUInt16LE(3,20),b=>b.writeUInt16LE(8,34),b=>b.writeUInt32LE(32001,28),b=>b.writeUInt32LE(b.length,4),b=>b.writeUInt32LE(0xffffffff,40),b=>b.write('RF64',0)]){const b=Buffer.from(original);mutate(b);assert.throws(()=>readSpeechWav(b));}
 assert.throws(()=>readSpeechWav(original.subarray(0,original.length-1)));assert.throws(()=>readSpeechWav(wave(Buffer.alloc(480002,1))));assert.throws(()=>readSpeechWav(wave(Buffer.alloc(15998,1))));
 const extra=Buffer.from('data\x02\x00\x00\x00\x01\x00','binary'),double=Buffer.concat([original,extra]);double.writeUInt32LE(double.length-8,4);assert.throws(()=>readSpeechWav(double),/多个音频块/);
});
test('silence fails without a made-up transcript and metadata cannot be interpreted as audio or instructions',async()=>{
 await assert.rejects(run(wave(Buffer.alloc(32000))),/静音/);const b=sample(),chunk=Buffer.from('LIST\x08\x00\x00\x00INFOtest','binary'),extended=Buffer.concat([b,chunk]);extended.writeUInt32LE(extended.length-8,4);const w=readSpeechWav(extended);assert.deepEqual(w.pcm,b.subarray(44));assert.deepEqual(w.ignoredMetadataChunks,['LIST']);
 chunk.write('wavl',8);const bad=Buffer.concat([b,chunk]);bad.writeUInt32LE(bad.length-8,4);assert.throws(()=>readSpeechWav(bad),/扩展块/);
});
test('language declaration is mandatory, additional parameters and model-generated confirmation are rejected',async()=>{
 for(const parameters of [undefined,{}, {englishConfirmed:'no'},{englishConfirmed:true},{englishConfirmed:'yes',prompt:'go forward'},{englishConfirmed:'yes',language:'zh'}])assert.throws(()=>validateSkillOptions('audio.transcribe-en',{deduplicate:false,parameters}));assert.throws(()=>validateSkillOptions('audio.transcribe-en',{deduplicate:true,parameters:{englishConfirmed:'yes'}}));assert.deepEqual(planningCandidates({file:{name:'speech.wav'},expertScope:'documents'}),[]);const decision=await planSkill({file:{name:'speech.wav'},expertScope:'documents'},new AbortController().signal);assert.equal(decision.kind,'unsupported');assert.match(decision.reason,/仅手动/);
});
test('missing installation and same-size corrupted assets make catalog unavailable and block HTTP execution',async t=>{
 const previous=process.env.DESIGNBUDDY_ASR_ROOT,dir=fs.mkdtempSync(path.join(os.tmpdir(),'asr-config-test-'));t.after(()=>{if(previous===undefined)delete process.env.DESIGNBUDDY_ASR_ROOT;else process.env.DESIGNBUDDY_ASR_ROOT=previous;fs.rmSync(dir,{recursive:true,force:true});});const installed=asrRoot();process.env.DESIGNBUDDY_ASR_ROOT=dir;assert.equal(asrConfiguration().ready,false);assert.equal(runtimeCatalog().find(s=>s.id==='audio.transcribe-en').status,'unavailable');const s=new SkillService(':memory:');try{assert.equal((await s.handle(request(),'owner')).status,409);}finally{await s.close();}
 fs.cpSync(installed,dir,{recursive:true});assert.equal(asrConfiguration().ready,true);const f=path.join(dir,'site/pocketsphinx/model/en-us/en-us/feat.params'),original=fs.readFileSync(f),changed=Buffer.from(original);changed[0]^=1;fs.writeFileSync(f,changed);assert.equal(asrConfiguration().ready,false);
});
test('real broker persists seven owner-only artifacts; unsupported WAV fails atomically',async t=>{
 const s=new SkillService(':memory:');t.after(()=>s.close());const accepted=await s.handle(request(),'owner');assert.equal(accepted.status,202);const queued=await accepted.json(),r=await done(s,queued.id);assert.equal(r.status,'succeeded',r.error);assert.equal(r.artifacts.length,7);const artifact=r.artifacts.find(a=>a.name==='transcript.txt'),url='http://local/api/skill-runs/'+r.id+'/artifacts/'+artifact.id;assert.equal((await s.handle(new Request(url),'other')).status,404);assert.equal((await s.handle(new Request(url),'owner')).status,200);assert.equal((await(await s.handle(new Request(url),'owner')).text()).trim(),'go forward ten meters');
 const bad=Buffer.from(sample());bad.writeUInt32LE(8000,24);const badRun=await(await s.handle(request(bad),'owner')).json(),failed=await done(s,badRun.id);assert.equal(failed.status,'failed');assert.equal(failed.artifacts.length,0);
});
test('actual cancellation kills and reaps API-owned decoder, leaves zero artifacts, and permits explicit reupload',async t=>{
 const s=new SkillService(':memory:');t.after(()=>s.close());const long=wave(Buffer.concat(Array(5).fill(sample().subarray(44))));const q=await(await s.handle(request(long),'owner')).json();const child=await wait(()=>s.active.get(q.id)?.external);assert.ok(child.pid&&alive(child.pid));const cancelled=await(await s.handle(new Request('http://local/api/skill-runs/'+q.id+'/cancel',{method:'POST'}),'owner')).json();assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.artifacts.length,0);assert.equal(alive(child.pid),false);const retry=await(await s.handle(request(),'owner')).json();assert.equal((await done(s,retry.id)).status,'succeeded');
});
test('worker crash, service shutdown and decoder deadline do not leave orphan native processes',async()=>{
 const long=wave(Buffer.concat(Array(5).fill(sample().subarray(44))));
 for(const action of ['crash','close']){const s=new SkillService(':memory:');try{const q=await(await s.handle(request(long),'owner')).json();const a=await wait(()=>s.active.get(q.id)?.external&&s.active.get(q.id)),pid=a.external.pid;if(action==='crash'){await a.worker.terminate();assert.equal((await done(s,q.id)).status,'failed');await wait(()=>!alive(pid));}else{await s.close();assert.equal(alive(pid),false);}}finally{if(!s.closed)await s.close();}}
 const timed=startASRProcess(readSpeechWav(long).pcm,1);await assert.rejects(timed.promise,/超时/);assert.equal(alive(timed.pid),false);
});
test('malformed decoder words and missing recognition never become an apparently valid partial transcript',()=>{
 const base={engine:'pocketsphinx',version:'5.1.1',frameRate:100,regions:[{speechStart:0,speechEnd:1,hypothesis:'word',words:[{rawWord:'word',startFrame:0,endFrameInclusive:20,posteriorApprox:.9}]}]};assert.equal(validateTranscript(base,2).words.length,1);
 for(const mutate of [r=>r.regions[0].words=[],r=>r.regions[0].words[0].posteriorApprox=NaN,r=>r.regions[0].words[0].endFrameInclusive=10000,r=>r.regions[0].speechEnd=40,r=>r.regions.push({...r.regions[0],words:[]})]){const r=structuredClone(base);mutate(r);assert.throws(()=>validateTranscript(r,2));}
});
