const test = require('node:test');
const assert = require('node:assert/strict');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
 const { validateSkillOptions, SkillRequestError } = require('../../dist/local/server/skills/contracts.js');
const original = { fetch: global.fetch, apiKey: process.env.AI_API_KEY, openai: process.env.OPENAI_API_KEY, base: process.env.AI_BASE_URL, model: process.env.AI_MODEL };
function restore(){ global.fetch=original.fetch; for(const [k,v] of [['AI_API_KEY',original.apiKey],['OPENAI_API_KEY',original.openai],['AI_BASE_URL',original.base],['AI_MODEL',original.model]]) v===undefined?delete process.env[k]:process.env[k]=v; }
test('document summary requires a separate third-party processing consent and a server identity', async t=>{
 t.after(restore); let calls=0; global.fetch=async()=>{calls++;return new Response(JSON.stringify({model:'test-model',choices:[{message:{content:'## 摘要\\n订单总额为 42 元。[P1]'}}]}),{status:200,headers:{'content-type':'application/json'}})};
 process.env.AI_API_KEY='test-only'; process.env.AI_BASE_URL='https://provider.invalid/v1'; process.env.AI_MODEL='test-model';
 const {planningCandidates}=require('../../dist/local/server/skills/planner.js'); assert.ok(!planningCandidates({file:{name:'note.txt',size:20},expertScope:'documents'}).some(s=>s.id==='document.summarize'),'summary is manual-only and must never be proposed as an automatic execution plan');
 assert.throws(()=>validateSkillOptions('document.summarize',{deduplicate:false}),SkillRequestError);
 assert.deepEqual(validateSkillOptions('document.summarize',{deduplicate:false,parameters:{externalConsent:'yes'}}),{deduplicate:false,parameters:{externalConsent:'yes'}});
 await assert.rejects(executeSkill({skillId:'document.summarize',filename:'note.txt',bytes:new TextEncoder().encode('订单总额为 42 元。'),deduplicate:false,parameters:{externalConsent:'no'},owner:'owner-a'}),/正文处理授权/);
 await assert.rejects(executeSkill({skillId:'document.summarize',filename:'note.txt',bytes:new TextEncoder().encode('订单总额为 42 元。'),deduplicate:false,parameters:{externalConsent:'yes'}}),/所有者/);
 assert.equal(calls,0);
});
test('document summary sends text only after consent, records source references and explicit third-party processing',async t=>{
 t.after(restore); const requests=[]; global.fetch=async(url,init)=>{requests.push({url:String(url),init});return new Response(JSON.stringify({model:'test-model',choices:[{message:{content:'## 摘要\\n订单总额为 42 元。[P1]'}}]}),{status:200,headers:{'content-type':'application/json'}})};
 process.env.AI_API_KEY='test-only'; process.env.AI_BASE_URL='https://provider.invalid/v1'; process.env.AI_MODEL='test-model';
 const result=await executeSkill({skillId:'document.summarize',filename:'note.txt',bytes:new TextEncoder().encode('订单总额为 42 元。'),deduplicate:false,parameters:{externalConsent:'yes'},owner:'owner-a'});
 assert.equal(requests.length,1); assert.equal(requests[0].url,'https://provider.invalid/v1/chat/completions'); assert.equal(requests[0].init.headers.Authorization,'Bearer test-only'); assert.match(requests[0].init.body,/订单总额为 42 元/);
 const summary=new TextDecoder().decode(result.outputs.find(x=>x.name==='document-summary.md').bytes); assert.ok(summary.includes('[P1]'));
 const report=JSON.parse(new TextDecoder().decode(result.outputs.find(x=>x.name==='document-summary-report.json').bytes)); assert.equal(report.contentWasSentToThirdParty,true); assert.deepEqual(report.sourceParagraphs,[1]); assert.equal(report.model,'test-model');
});
test('document summary rejects invented paragraph references and does not return partial artifacts',async t=>{
 t.after(restore); global.fetch=async()=>new Response(JSON.stringify({model:'test-model',choices:[{message:{content:'总结。[P99]'}}]}),{status:200,headers:{'content-type':'application/json'}});
 process.env.AI_API_KEY='test-only'; process.env.AI_BASE_URL='https://provider.invalid/v1';
 await assert.rejects(executeSkill({skillId:'document.summarize',filename:'note.txt',bytes:new TextEncoder().encode('只有一段原文。'),deduplicate:false,parameters:{externalConsent:'yes'},owner:'owner-a'}),/有效来源段落标记/);
});
test('document summary does not create a deterministic fake result when the server AI provider is missing',async t=>{
 t.after(restore); delete process.env.AI_API_KEY; delete process.env.OPENAI_API_KEY; delete process.env.AI_BASE_URL; delete process.env.AI_MODEL;
 let calls=0; global.fetch=async()=>{calls++;throw Error('must not fetch')};
 await assert.rejects(executeSkill({skillId:'document.summarize',filename:'note.txt',bytes:new TextEncoder().encode('需要摘要的正文。'),deduplicate:false,parameters:{externalConsent:'yes'},owner:'owner-a'}),/技能或输入文件格式不受支持/); assert.equal(calls,0);
});
