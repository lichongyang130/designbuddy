// Model responses below are deterministic TEST DOUBLES, not live-provider accuracy evidence.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { mkdtempSync, rmSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { SkillService } = require('../../dist/local/server/skills/service.js');
const { planSkill, validateDecision, planningCandidates } = require('../../dist/local/server/skills/planner.js');
const { approvalDigest } = require('../../dist/local/server/skills/plan-store.js');
const { createApiHandler } = require('../../dist/local/server/api/http-handler.js');
const data = '项目,金额\n甲,10\n乙,20\n甲,10';
const sha = s => createHash('sha256').update(s).digest('hex');
const decision = () => ({kind:'plan',expertId:'data',skillId:'table.analyze',reason:'按任务对实际CSV去重并计算，不推断正文。',options:{deduplicate:true}});
const input = (extra={}) => ({requestId:randomUUID(),goal:'将CSV全字段去重并计算合计',file:{name:'actual.csv',size:Buffer.byteLength(data),sha256:sha(data)},expertScope:'data',consent:true,...extra});
const req = (path, method='GET', body) => new Request('http://local/api/'+path, {method,...(body ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
const post = async (s,body=input(),owner='alice') => {const r=await s.handle(req('skill-plans','POST',body),owner);return {status:r.status,body:await r.json()};};
function approve(p,extra={},content=data,name='actual.csv') {const f=new FormData();f.set('planId',p.id);f.set('approvalDigest',p.approvalDigest);f.set('consent','true');f.set('file',new File([content],name));for(const [k,v] of Object.entries(extra))f.set(k,v);return new Request('http://local/api/skill-runs',{method:'POST',body:f});}
const get = async (s,path,owner='alice') => (await s.handle(req(path),owner)).json();
async function finish(s,id) {for(let i=0;i<400;i++){const r=await get(s,'skill-runs/'+id);if(!['queued','running'].includes(r.status))return r;await new Promise(r=>setTimeout(r,25));}throw Error('worker timed out');}
function fixture(t,planner=async()=>decision()){const s=new SkillService(':memory:',45000,planner);t.after(()=>s.close());return s;}

test('stub proposal does not execute; explicit hash-bound approval runs REAL worker once with checked artifacts and receipt',async t=>{
 let calls=0;const s=fixture(t,async request=>{calls++;assert.deepEqual(Object.keys(request.file).sort(),['name','sha256','size']);assert.ok(!JSON.stringify(request).includes('甲,10'));return decision();});
 const p=(await post(s)).body;assert.equal(p.status,'review');assert.equal(p.approvalDigest,approvalDigest(p));assert.equal((await get(s,'skill-runs')).runs.length,0);
 const replies=await Promise.all(Array.from({length:5},()=>s.handle(approve(p),'alice')));assert.equal(replies.filter(r=>r.status===202).length,1);assert.equal(replies.filter(r=>r.status===200).length,4);
 const records=await Promise.all(replies.map(r=>r.json()));assert.equal(new Set(records.map(r=>r.id)).size,1);assert.equal(calls,1);
 const run=await finish(s,records[0].id);assert.equal(run.status,'succeeded',run.error);assert.equal(run.plan.id,p.id);assert.equal(run.plan.approvalDigest,p.approvalDigest);assert.equal((await get(s,'skill-plans/'+p.id)).status,'executed');
 const artifact=async name=>{const a=run.artifacts.find(a=>a.name===name);assert.ok(a);return (await s.handle(req(`skill-runs/${run.id}/artifacts/${a.id}`),'alice')).json();};
 const report=await artifact('analysis.json');assert.equal(report.retainedRows,2);assert.equal(report.columns[1].sum,30);
 const receipt=await artifact('execution-receipt.json');assert.equal(receipt.plan.id,p.id);assert.equal(receipt.inputHash,sha(data));
 await s.handle(req('skill-runs/'+run.id,'DELETE'),'alice');assert.equal((await s.handle(approve(p),'alice')).status,410);assert.equal((await get(s,'skill-runs')).runs.length,0);
});
test('planning requires consent and valid bounded metadata; no adapter call on invalid requests',async t=>{
 let calls=0;const s=fixture(t,async()=>{calls++;return decision();});
 for(const [patch,status] of [[{consent:false},403],[{permission:'仅本地'},403],[{goal:''},400],[{goal:'a'.repeat(4001)},400],[{requestId:'bad'},400],[{expertScope:'invented'},400],[{skillScope:['table.analyze','document.format']},400],[{skillScope:['table.analyze','table.analyze']},400],[{file:{name:'a.csv',size:3,sha256:'bad'}},400],[{apiKey:'secret',provider:'http://evil.invalid'},400],[{body:data},400]]) {const r=await post(s,input(patch));assert.equal(r.status,status,JSON.stringify(r));}
 const oversized=await s.handle(new Request('http://local/api/skill-plans',{method:'POST',headers:{'content-type':'application/json'},body:'a'.repeat(32001)}),'alice');assert.equal(oversized.status,413);assert.equal(calls,0);
});
test('category skill scope narrows planner candidates, is frozen into approval, and rejects out-of-scope proposals',async t=>{
 const {planningCandidates}=require('../../dist/local/server/skills/planner.js');
 assert.deepEqual(planningCandidates({...input(),skillScope:['table.analyze']}).map(s=>s.id),['table.analyze']);
 const s=fixture(t,async request=>{assert.deepEqual(request.skillScope,['table.analyze']);return decision();});
 const p=(await post(s,input({skillScope:['table.analyze']}))).body;
 assert.equal(p.status,'review');assert.deepEqual(p.skillScope,['table.analyze']);assert.equal(p.approvalDigest,approvalDigest(p));
 const bad=fixture(t,async()=>({...decision(),skillId:'table.calculate'}));
 const rejected=(await post(bad,input({skillScope:['table.analyze']}))).body;
 assert.equal(rejected.status,'failed');assert.match(rejected.error,/模型选择了未接通/);
});
test('approval rejects changed bytes, filename, consent, digest and parameter/skill overrides, all without creating a task',async t=>{
 const s=fixture(t),p=(await post(s)).body;
 for(const [r,code] of [[approve(p,{consent:'false'}),403],[approve(p,{approvalDigest:'0'.repeat(64)}),409],[approve(p,{},data.replace('甲','丙')),409],[approve(p,{},data,'other.csv'),409],[approve(p,{skillId:'table.analyze'}),409],[approve(p,{parameters:'{}'}),409]]) assert.equal((await s.handle(r,'alice')).status,code);
 assert.equal((await get(s,'skill-runs')).runs.length,0);assert.equal((await get(s,'skill-plans/'+p.id)).status,'review');
});
test('owner isolation applies to plans, cancel, deletion and approval; stale expiry and version cannot authorize',async t=>{
 const s=fixture(t),p=(await post(s)).body;
 assert.equal((await get(s,'skill-plans','bob')).plans.length,0);
 for(const r of [req('skill-plans/'+p.id),req('skill-plans/'+p.id,'DELETE'),req('skill-plans/'+p.id+'/cancel','POST'),approve(p)])assert.equal((await s.handle(r,'bob')).status,404);
 p.expiresAt=new Date(Date.now()-1000).toISOString();p.approvalDigest=approvalDigest(p);s.db.prepare('UPDATE skill_plans SET record=? WHERE id=?').run(JSON.stringify(p),p.id);assert.equal((await s.handle(approve(p),'alice')).status,410);
 p.expiresAt=new Date(Date.now()+60000).toISOString();p.skillVersion='0.0.0';p.approvalDigest=approvalDigest(p);s.db.prepare('UPDATE skill_plans SET record=? WHERE id=?').run(JSON.stringify(p),p.id);assert.equal((await s.handle(approve(p),'alice')).status,409);
 assert.equal((await get(s,'skill-runs')).runs.length,0);
});
test('same planning key reuses record; conflicts fail; deleting a plan keeps tombstone and does not recall model',async t=>{
 let calls=0;const s=fixture(t,async()=>{calls++;return decision();}),body=input();const p=(await post(s,body)).body;
 assert.equal((await post(s,body)).body.id,p.id);assert.equal(calls,1);assert.equal((await post(s,{...body,goal:'another task'})).status,409);
 await s.handle(req('skill-plans/'+p.id,'DELETE'),'alice');assert.equal((await post(s,body)).status,410);assert.equal(calls,1);
});
test('in-flight cancel wins over late model completion and cannot be approved; duplicate request does not recall adapter',async t=>{
 let resolve;let calls=0;const s=fixture(t,()=>{calls++;return new Promise(r=>resolve=r);}),body=input();const pending=post(s,body);
 await new Promise(r=>setImmediate(r));const p=(await get(s,'skill-plans')).plans[0];assert.equal(p.status,'planning');
 assert.equal((await post(s,body)).body.id,p.id);assert.equal(calls,1);assert.equal((await post(s,input())).status,429);
 assert.equal((await s.handle(req('skill-plans/'+p.id+'/cancel','POST'),'alice')).status,200);resolve(decision());assert.equal((await pending).body.status,'cancelled');
 assert.equal((await get(s,'skill-plans/'+p.id)).status,'cancelled');assert.equal((await s.handle(approve({...p,approvalDigest:'fake'}),'alice')).status,409);
});
test('strict model schema rejects invented/unready skills, wrong expert, unknown options and file mismatch',async t=>{
 const candidates=planningCandidates(input());for(const d of [{...decision(),skillId:'code.build'},{...decision(),expertId:'qa'},{...decision(),execute:true},{...decision(),options:{deduplicate:true,command:'rm -rf /'}},{...decision(),options:{deduplicate:true,parameters:{title:'x'}}}])assert.throws(()=>validateDecision(d,candidates,'data'));
 assert.throws(()=>validateDecision(decision(),planningCandidates(input({file:{name:'a.png'}})),'data'));
 const s=fixture(t,async()=>({...decision(),skillId:'made.up'}));const p=(await post(s)).body;assert.equal(p.status,'failed');assert.equal((await get(s,'skill-runs')).runs.length,0);
});
test('clarify, unsupported and model failure remain truthful, with no receipt, approval digest or task',async t=>{
 for(const d of [{kind:'clarify',question:'需要去重吗？',options:['去重','保留']},{kind:'unsupported',reason:'没有接通外部日历'},{kind:'error'}]){
 const s=fixture(t,async()=>{if(d.kind==='error')throw Error('secret upstream body');return d;});const p=(await post(s)).body;assert.equal(p.status,d.kind==='error'?'failed':d.kind);assert.equal(p.approvalDigest,undefined);assert.ok(!JSON.stringify(p).includes('secret upstream body'));assert.equal((await get(s,'skill-runs')).runs.length,0);}
});
test('actual model adapter sends metadata only, uses fixed BYOK endpoint and rejects hostile/unbounded upstream responses (mocked transport)',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);let captured;
 global.fetch=async(url,init)=>{captured={url,init};return Response.json({choices:[{message:{content:JSON.stringify(decision())}}]});};
 const request=input({apiKey:'TEST_PRIVATE_KEY',provider:'openai'});const result=await planSkill(request,new AbortController().signal);assert.equal(result.skillId,'table.analyze');assert.equal(captured.url,'https://api.openai.com/v1/chat/completions');assert.equal(captured.init.redirect,'error');assert.equal(captured.init.headers.Authorization,'Bearer TEST_PRIVATE_KEY');assert.ok(!captured.init.body.includes('TEST_PRIVATE_KEY'));assert.ok(!captured.init.body.includes(data));assert.ok(!captured.init.body.includes(request.file.sha256));assert.ok(captured.init.body.includes('actual.csv'));
 global.fetch=async()=>new Response('x'.repeat(32001));await assert.rejects(()=>planSkill(request,new AbortController().signal),/过大/);
 global.fetch=async()=>new Response('TEST_PRIVATE_KEY',{status:403});await assert.rejects(()=>planSkill(request,new AbortController().signal),e=>e.message.includes('403')&&!e.message.includes('TEST_PRIVATE_KEY'));
 global.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({...decision(),skillId:'shell.exec'})}}]});await assert.rejects(()=>planSkill(request,new AbortController().signal),/模型选择/);
});
test('unconfigured model fails honestly, unsupported extension does not call a model',async t=>{
 const old=[process.env.AI_API_KEY,process.env.OPENAI_API_KEY];delete process.env.AI_API_KEY;delete process.env.OPENAI_API_KEY;t.after(()=>{for(const [i,k] of ['AI_API_KEY','OPENAI_API_KEY'].entries())old[i]===undefined?delete process.env[k]:process.env[k]=old[i];});
 const s=new SkillService(':memory:');t.after(()=>s.close());const p=(await post(s)).body;assert.equal(p.status,'failed');assert.match(p.error,/尚未配置/);assert.equal((await get(s,'skill-runs')).runs.length,0);
 const d=await planSkill(input({file:{name:'file.exe',size:1,sha256:'a'.repeat(64)}}),new AbortController().signal);assert.equal(d.kind,'unsupported');
});
test('restart preserves frozen proposals and idempotency; interrupted planning fails without model auto-retry; credentials absent from database',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'skill-plans-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'test.sqlite');let a=new SkillService(path,45000,async()=>decision());
 const p=(await post(a,input({apiKey:'TEST_SECRET_NOT_PERSISTED',provider:'openai'}))).body;const queued=await (await a.handle(approve(p),'alice')).json();await a.close();
 let calls=0;const b=new SkillService(path,45000,async()=>{calls++;return decision();});t.after(()=>b.close());assert.equal((await get(b,'skill-plans/'+p.id)).runId,queued.id);assert.equal((await (await b.handle(approve(p),'alice')).json()).id,queued.id);assert.equal(calls,0);
 assert.ok(!readFileSync(path).includes(Buffer.from('TEST_SECRET_NOT_PERSISTED')));
 let resolve;const path2=join(dir,'interrupted.sqlite');a=new SkillService(path2,45000,()=>new Promise(r=>resolve=r));const pending=post(a);await new Promise(r=>setImmediate(r));const interrupted=(await get(a,'skill-plans')).plans[0];await a.close();resolve(decision());await pending;
 const c=new SkillService(path2,45000,async()=>{calls++;return decision();});t.after(()=>c.close());const saved=await get(c,'skill-plans/'+interrupted.id);assert.equal(saved.status,'failed');assert.match(saved.error,/重启/);assert.equal(calls,0);
});
test('manual request IDs prevent duplicates, reject mismatched reuse and survive deletion with tombstones',async t=>{
 const s=fixture(t),id=randomUUID();const manual=(content=data)=>{const f=new FormData();for(const [k,v] of Object.entries({requestId:id,skillId:'table.analyze',expertId:'data',consent:'true',deduplicate:'false'}))f.set(k,v);f.set('file',new File([content],'actual.csv'));return new Request('http://local/api/skill-runs',{method:'POST',body:f});};
 const first=await (await s.handle(manual(),'alice')).json();assert.equal((await (await s.handle(manual(),'alice')).json()).id,first.id);assert.equal((await s.handle(manual(data+'\n丙,30'),'alice')).status,409);
 await s.handle(req('skill-runs/'+first.id,'DELETE'),'alice');assert.equal((await s.handle(manual(),'alice')).status,410);assert.equal((await get(s,'skill-runs')).runs.length,0);
});
test('plan creation daily budget persists across deletion; rejected adapter never authorizes anything',async t=>{
 let calls=0;const s=fixture(t,async()=>{calls++;return {kind:'unsupported',reason:'本任务不支持'};});
 for(let i=0;i<20;i++){const p=(await post(s)).body;assert.equal(p.status,'unsupported');await s.handle(req('skill-plans/'+p.id,'DELETE'),'alice');}
 assert.equal((await post(s)).status,429);assert.equal(calls,20);assert.equal((await get(s,'skill-runs')).runs.length,0);
});
test('plan APIs are authenticated and dispatched to the skill service',async t=>{
 const denied=createApiHandler({authenticate:async()=>null,projects:{}});assert.equal((await denied(req('skill-plans'))).status,401);
 const s=fixture(t);const allowed=createApiHandler({authenticate:async()=>({id:'alice'}),projects:{},skills:s});
 const response=await allowed(req('skill-plans'));assert.equal(response.status,200);assert.deepEqual((await response.json()).plans,[]);
 const proposed=await allowed(req('skill-plans','POST',input()));assert.equal(proposed.status,200);assert.equal((await proposed.json()).status,'review');
});
test('approval transaction rolls back both task and dedup mapping if plan transition fails',async t=>{
 const s=fixture(t),p=(await post(s)).body;const original=s.plans.markExecuted;
 s.plans.markExecuted=()=>{throw Error('injected database failure');};assert.equal((await s.handle(approve(p),'alice')).status,500);assert.equal((await get(s,'skill-runs')).runs.length,0);assert.equal(s.db.prepare('SELECT count(*) n FROM skill_submissions').get().n,0);assert.equal((await get(s,'skill-plans/'+p.id)).status,'review');
 s.plans.markExecuted=original;assert.equal((await s.handle(approve(p),'alice')).status,202);
});
test('model cancellation aborts actual adapter fetch and global model concurrency is bounded',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);global.fetch=async(_url,init)=>new Promise((_,reject)=>{init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true});});
 const controller=new AbortController();const task=planSkill(input({provider:'openai',apiKey:'test-only'}),controller.signal);controller.abort();await assert.rejects(()=>task,/已取消/);
 const resolvers=[];const s=fixture(t,()=>new Promise(resolve=>resolvers.push(resolve)));const pending=[];for(let i=0;i<4;i++){pending.push(post(s,input(),'owner'+i));await new Promise(r=>setImmediate(r));}
 assert.equal((await post(s,input(),'owner5')).status,429);for(const r of resolvers)r(decision());await Promise.all(pending);
});
test('task grouping is owner-scoped, immutable through approval, and included in real execution receipts',async t=>{
 const s=fixture(t),first=input({taskId:'task-context-one'}),second=input({taskId:'task-context-two'});
 const p=(await post(s,first)).body,other=(await post(s,second)).body;assert.equal(p.taskId,first.taskId);
 assert.deepEqual((await get(s,'skill-plans?taskId='+first.taskId)).plans.map(p=>p.id),[p.id]);
 assert.equal((await get(s,'skill-plans?taskId='+first.taskId,'bob')).plans.length,0);
 assert.equal((await get(s,'skill-plans')).plans.length,2);
 assert.equal((await post(s,{...first,taskId:second.taskId})).status,409);
 assert.equal((await s.handle(approve(p,{taskId:second.taskId}),'alice')).status,409);
 const altered={...p,taskId:second.taskId};altered.approvalDigest=approvalDigest(altered);assert.equal((await s.handle(approve(altered),'alice')).status,409);
 const q=await (await s.handle(approve(p),'alice')).json();assert.equal(q.taskId,first.taskId);const done=await finish(s,q.id);assert.equal(done.status,'succeeded',done.error);
 const receipt=done.artifacts.find(a=>a.name==='execution-receipt.json');const content=await (await s.handle(req(`skill-runs/${q.id}/artifacts/${receipt.id}`),'alice')).json();assert.equal(content.taskId,first.taskId);
 assert.equal((await get(s,'skill-runs?taskId='+first.taskId)).runs.length,1);assert.equal((await get(s,'skill-runs?taskId='+second.taskId)).runs.length,0);assert.equal((await get(s,'skill-runs?taskId='+first.taskId,'bob')).runs.length,0);assert.equal(other.status,'review');
});
test('manual tasks cannot reuse an idempotency key across conversation groups; unscoped calls remain compatible',async t=>{
 const s=fixture(t),key=randomUUID();const manual=(taskId,requestId=key)=>{const f=new FormData();for(const [k,v] of Object.entries({requestId,skillId:'table.analyze',expertId:'data',consent:'true',...(taskId===undefined?{}:{taskId})}))f.set(k,v);f.set('file',new File([data],'actual.csv'));return new Request('http://local/api/skill-runs',{method:'POST',body:f});};
 const q=await (await s.handle(manual('task-context-one'),'alice')).json();assert.equal((await (await s.handle(manual('task-context-one'),'alice')).json()).id,q.id);assert.equal((await s.handle(manual('task-context-two'),'alice')).status,409);
 assert.equal((await s.handle(manual(undefined,randomUUID()),'alice')).status,202);assert.equal((await get(s,'skill-runs')).runs.length,2);assert.equal((await get(s,'skill-runs?taskId=task-context-one')).runs.length,1);assert.equal((await get(s,'skill-runs?taskId=task-context-two')).runs.length,0);
});
test('malformed task grouping and local-only execution are rejected before any task is created',async t=>{
 let calls=0;const s=fixture(t,async()=>{calls++;return decision();});for(const taskId of ['',{},'../private','a'.repeat(81)])assert.equal((await post(s,input({taskId}))).status,400);
 for(const path of ['skill-plans?taskId=','skill-runs?taskId=%27%20OR%201=1'])assert.equal((await s.handle(req(path),'alice')).status,400);
 const f=new FormData();for(const [k,v] of Object.entries({skillId:'table.analyze',expertId:'data',consent:'true',permission:'仅本地'}))f.set(k,v);f.set('file',new File([data],'actual.csv'));assert.equal((await s.handle(new Request('http://local/api/skill-runs',{method:'POST',body:f}),'alice')).status,403);assert.equal(calls,0);assert.equal((await get(s,'skill-runs')).runs.length,0);
});
test('task grouping survives reopening without auto execution and legacy approval digests remain byte-compatible',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'task-skill-scope-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'test.sqlite');const a=new SkillService(path,45000,async()=>decision());const scoped=(await post(a,input({taskId:'persistent-task'}))).body;const legacy=(await post(a)).body;
 assert.equal(legacy.approvalDigest,sha(JSON.stringify({id:legacy.id,goal:legacy.goal,file:legacy.file,expertScope:legacy.expertScope,decision:legacy.decision,skillVersion:legacy.skillVersion,createdAt:legacy.createdAt,expiresAt:legacy.expiresAt})));
 await a.close();const b=new SkillService(path,45000,async()=>{throw Error('should not be called');});t.after(()=>b.close());assert.equal((await get(b,'skill-plans?taskId=persistent-task')).plans[0].id,scoped.id);assert.equal((await get(b,'skill-runs?taskId=persistent-task')).runs.length,0);assert.equal((await b.handle(approve(legacy),'alice')).status,202);
});
test('creating different conversation IDs does not bypass owner planning budgets',async t=>{
 const s=fixture(t);for(let i=0;i<20;i++)assert.equal((await post(s,input({taskId:'budget-task-'+i}))).body.status,'review');assert.equal((await post(s,input({taskId:'budget-task-next'}))).status,429);
});
