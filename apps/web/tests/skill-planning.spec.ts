import { test, expect, type Page, type Route } from '@playwright/test';
import { createRequire } from 'node:module';
import type { SkillService as Service } from '../../../server/skills/service';
import type { Planner } from '../../../server/skills/plan-store';
const { SkillService } = createRequire(import.meta.url)('../../../dist/local/server/skills/service.js');
const csv = '项目,金额\n甲,10\n乙,20\n甲,10';
const proposal: Planner = async () => ({kind:'plan',expertId:'data',skillId:'table.analyze',reason:'按描述去重并汇总，尚未读取文件正文。',options:{deduplicate:true}});
const planner = (page: Page) => page.getByRole('region',{name:'模型技能规划'});
const desk = (page: Page) => page.getByRole('region',{name:'真实技能执行台'});
let services: Service[]=[];
// Only the model is a test double. Browser API requests are bridged to a real isolated
// SQLite-backed SkillService with actual worker threads and generated artifacts.
async function bridge(page: Page, model: Planner = proposal, after?: (route: Route, response: Response)=>Promise<boolean>) {
 const service: Service = new SkillService(':memory:',45000,model);services.push(service);
 await page.route(/\/api\/skill-(?:plans|runs|runtime)(?:\/[^?]*)?$/,async route=>{
  const r=route.request();const response=await service.handle(new Request(r.url(),{method:r.method(),headers:r.headers(),...(['GET','HEAD'].includes(r.method())?{}:{body:r.postDataBuffer()})}),'browser-test');
  if (after && await after(route,response)) return;
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())}).catch(()=>{});
 });return service;
}
test.afterEach(async()=>{for(const s of services)await s.close();services=[];});
async function open(page: Page) {await page.goto('/experts/data');await desk(page).getByText('描述任务，让模型建议技能',{exact:true}).click();await expect(planner(page).getByRole('textbox',{name:'任务描述',exact:true})).toBeVisible();}
async function file(page: Page,content=csv,name='actual.csv') {await planner(page).getByLabel('选择规划材料（先在浏览器校验）').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from(content)});await expect(planner(page).getByText(/已在浏览器校验/)).toBeVisible();}
async function propose(page: Page) {await planner(page).getByRole('textbox',{name:'任务描述',exact:true}).fill('将CSV全字段去重并计算各数值列合计');await file(page);await planner(page).getByRole('checkbox',{name:/允许将任务描述/}).check();await planner(page).getByRole('button',{name:'生成技能方案（不执行）'}).click();}

test('two-stage consent: metadata-only mocked proposal, then REAL backend worker and verified artifact',async({page})=>{
 let modelCalls=0;const service=await bridge(page,async input=>{modelCalls++;expect(Object.keys(input.file).sort()).toEqual(['name','sha256','size']);expect(JSON.stringify(input)).not.toContain(csv);return proposal(input,new AbortController().signal);});
 let posted='';page.on('request',r=>{if(r.method()==='POST' && r.url().endsWith('/api/skill-plans'))posted=r.postData()||'';});
 await open(page);await expect(planner(page).getByRole('button',{name:'生成技能方案（不执行）'})).toBeDisabled();await propose(page);
 await expect(planner(page).getByRole('status')).toHaveText('待你确认 · 未执行');expect(posted).not.toContain('甲,10');expect(posted).toContain('sha256');
 expect((await (await service.handle(new Request('http://local/api/skill-runs'),'browser-test')).json()).runs).toHaveLength(0);
 await expect(planner(page).getByRole('button',{name:'确认方案并执行一次'})).toBeDisabled();await planner(page).getByRole('checkbox',{name:/我已核对以上冻结方案/}).check();await planner(page).getByRole('button',{name:'确认方案并执行一次'}).click();
 await expect(desk(page).getByRole('status').filter({hasText:'执行成功'})).toBeVisible({timeout:15000});await expect(planner(page).getByRole('status')).toHaveText('已提交真实执行');expect(modelCalls).toBe(1);
 const run=(await (await service.handle(new Request('http://local/api/skill-runs'),'browser-test')).json()).runs[0];const a=run.artifacts.find((a:{name:string})=>a.name==='analysis.json');const report=await (await service.handle(new Request(`http://local/api/skill-runs/${run.id}/artifacts/${a.id}`),'browser-test')).json();expect(report.retainedRows).toBe(2);expect(report.columns[1].sum).toBe(30);
 await desk(page).getByText('执行证据与来源',{exact:true}).click();await expect(desk(page).getByText(/用户确认时间/)).toBeVisible();
});
test('refresh restores proposal, not file or approval; changed file blocks execution, cancel remains final',async({page})=>{
 const service=await bridge(page);await open(page);await propose(page);await expect(planner(page).getByRole('status')).toHaveText('待你确认 · 未执行');
 await page.reload();await desk(page).getByText('描述任务，让模型建议技能',{exact:true}).click();await expect(planner(page).getByText(/当前文件不匹配/)).toBeVisible();await expect(planner(page).getByRole('button',{name:'确认方案并执行一次'})).toBeDisabled();
 await file(page,csv.replace('甲','丙'));await expect(planner(page).getByRole('checkbox',{name:/我已核对/})).toBeDisabled();await file(page);await expect(planner(page).getByRole('checkbox',{name:/我已核对/})).toBeEnabled();await expect(planner(page).getByRole('checkbox',{name:/我已核对/})).not.toBeChecked();
 await planner(page).getByRole('button',{name:'取消此方案'}).click();await expect(planner(page).getByRole('status')).toHaveText('已取消方案 · 未执行');await expect(planner(page).getByRole('button',{name:'确认方案并执行一次'})).toHaveCount(0);
 expect((await (await service.handle(new Request('http://local/api/skill-runs'),'browser-test')).json()).runs).toHaveLength(0);
});
test('clarification only edits draft; unsupported does not substitute or execute a weaker tool',async({page})=>{
 let calls=0;await bridge(page,async()=>{calls++;return calls===1?{kind:'clarify',question:'是否需要去重？',options:['保留重复行','去除重复行']}:{kind:'unsupported',reason:'未接通向外部日历发布的技能。'};});
 await open(page);await propose(page);await expect(planner(page).getByRole('status')).toHaveText('需要澄清 · 未执行');await planner(page).getByRole('button',{name:'保留重复行（补充任务，不发送）'}).click();await expect(planner(page).getByRole('textbox',{name:'任务描述',exact:true})).toHaveValue(/补充：保留重复行/);expect(calls).toBe(1);
 await planner(page).getByRole('button',{name:'生成技能方案（不执行）'}).click();await expect(planner(page).getByRole('status')).toHaveText('当前不支持 · 未执行');await expect(planner(page).getByText(/不会用较弱工具冒充完成/)).toBeVisible();await expect(planner(page).getByRole('button',{name:'确认方案并执行一次'})).toHaveCount(0);
});
test('model failure leaves functional manual fallback with idempotent actual execution',async({page})=>{
 let calls=0;const service=await bridge(page,async()=>{calls++;throw Error('AI 服务尚未配置，未生成模型方案。');});await open(page);await propose(page);await expect(planner(page).getByRole('status')).toHaveText('规划失败 · 未执行');
 await desk(page).getByLabel('上传实际材料').setInputFiles({name:'manual.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await desk(page).getByRole('checkbox',{name:/我同意上传材料/}).check();await desk(page).getByRole('button',{name:'上传并执行技能'}).click();await expect(desk(page).getByRole('status').filter({hasText:'执行成功'})).toBeVisible({timeout:15000});
 await desk(page).getByRole('button',{name:'上传并执行技能'}).click();await expect(desk(page).getByRole('button',{name:'上传并执行技能'})).toBeEnabled();expect(calls).toBe(1);expect((await (await service.handle(new Request('http://local/api/skill-runs'),'browser-test')).json()).runs).toHaveLength(1);
});
test('lost approval response restores the already-created run, never starts a second run',async({page})=>{
 let lost=false;const service=await bridge(page,proposal,async(route)=>{if(!lost && route.request().method()==='POST' && route.request().url().endsWith('/api/skill-runs')){lost=true;await route.abort();return true;}return false;});
 await open(page);await propose(page);await planner(page).getByRole('checkbox',{name:/我已核对/}).check();await planner(page).getByRole('button',{name:'确认方案并执行一次'}).click();await expect(planner(page).getByRole('status')).toHaveText('已提交真实执行',{timeout:10000});await expect(desk(page).getByRole('status').filter({hasText:'执行成功'})).toBeVisible({timeout:15000});expect((await (await service.handle(new Request('http://local/api/skill-runs'),'browser-test')).json()).runs).toHaveLength(1);
});
test('cancel a planning request before model finishes: late completion cannot show an approvable plan',async({page})=>{
 let release: ((value: Awaited<ReturnType<Planner>>)=>void)|undefined;await bridge(page,async()=>new Promise(resolve=>release=resolve));await open(page);await propose(page);
 await expect(planner(page).getByRole('status')).toHaveText('模型规划中 · 未执行');await planner(page).getByRole('button',{name:'取消此方案'}).click();await expect(planner(page).getByRole('status')).toHaveText('已取消方案 · 未执行');release!(await proposal({} as never,new AbortController().signal));await expect(planner(page).getByRole('button',{name:'生成技能方案（不执行）'})).toBeEnabled();await expect(planner(page).getByRole('status')).toHaveText('已取消方案 · 未执行');await expect(planner(page).getByRole('button',{name:'确认方案并执行一次'})).toHaveCount(0);
});
test('401 identity change does not replay metadata POST under a newly authenticated identity',async({page})=>{
 let postCount=0;await bridge(page);await page.route('**/api/skill-plans',async route=>{if(route.request().method()==='POST'){postCount++;await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Session expired'})});}else await route.fallback();});
 await open(page);await propose(page);await expect(desk(page).getByText('描述任务，让模型建议技能',{exact:true})).toBeVisible();await desk(page).getByText('描述任务，让模型建议技能',{exact:true}).click();await expect(planner(page).getByRole('textbox',{name:'任务描述',exact:true})).toHaveValue('');expect(postCount).toBe(1);await expect(planner(page).getByRole('checkbox',{name:/允许将任务描述/})).not.toBeChecked();
});
test('mobile plan review fits without overflow and displays tool limits and frozen parameters',async({page})=>{
 await page.setViewportSize({width:390,height:844});await bridge(page);await open(page);await propose(page);await expect(planner(page).getByRole('status')).toHaveText('待你确认 · 未执行');await expect(planner(page).getByText('能力边界',{exact:true})).toBeVisible();await expect(planner(page).getByText('全字段相同的重复行：去除',{exact:true})).toBeVisible();
 expect(await planner(page).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await planner(page).getByRole('article',{name:'待确认技能方案'}).screenshot({path:'../../.cache/phase-three-mobile-review.png'});
});
test('manual upload also refuses a 401 replay under a new identity',async({page})=>{
 let postCount=0;await bridge(page);await page.route('**/api/skill-runs',async route=>{if(route.request().method()==='POST'){postCount++;await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Session expired'})});}else await route.fallback();});
 await open(page);await desk(page).getByLabel('上传实际材料').setInputFiles({name:'manual.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await desk(page).getByRole('checkbox',{name:/我同意上传材料/}).check();await desk(page).getByRole('button',{name:'上传并执行技能'}).click();await expect(desk(page).getByRole('checkbox',{name:/我同意上传材料/})).not.toBeChecked();await expect(desk(page).getByRole('button',{name:'上传并执行技能'})).toBeDisabled();expect(postCount).toBe(1);
});
test('late restored-run read cannot resurrect a run deleted in the same view',async({page})=>{
 let release:(()=>void)|undefined;let delayed=false;await bridge(page,proposal,async(route,response)=>{if(!delayed && route.request().method()==='GET' && /\/api\/skill-runs\/[a-f0-9-]+$/.test(route.request().url())){delayed=true;const bytes=Buffer.from(await response.arrayBuffer());await new Promise<void>(resolve=>release=resolve);await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:bytes});return true;}return false;});
 await open(page);await propose(page);await planner(page).getByRole('checkbox',{name:/我已核对/}).check();await planner(page).getByRole('button',{name:'确认方案并执行一次'}).click();await expect(desk(page).getByRole('status').filter({hasText:'执行成功'})).toBeVisible({timeout:15000});expect(delayed).toBe(true);
 page.once('dialog',d=>d.accept());await desk(page).getByRole('button',{name:'删除运行与文件'}).click();await expect(desk(page).getByText('暂无运行记录。点击执行后才会创建真实任务。')).toBeVisible();const late=page.waitForResponse(r=>r.request().method()==='GET' && /\/api\/skill-runs\/[a-f0-9-]+$/.test(r.url()));release!();await (await late).finished();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await expect(desk(page).getByRole('button',{name:'下载 analysis.json'})).toHaveCount(0);await expect(desk(page).getByText('暂无运行记录。点击执行后才会创建真实任务。')).toBeVisible();
});
test('live HTTP planner without model configuration reports failure and persists no fake run (no API interception)',async({page})=>{
 await open(page);const config=await (await page.request.get('/api/skill-plans')).json();test.skip(config.serverConfigured,'Live model is configured: do not spend user credentials in regression tests.');
 await propose(page);await expect(planner(page).getByRole('status')).toHaveText('规划失败 · 未执行');await expect(planner(page).getByText(/AI 服务尚未配置/)).toBeVisible();expect((await (await page.request.get('/api/skill-runs')).json()).runs).toHaveLength(0);
 const saved=(await (await page.request.get('/api/skill-plans')).json()).plans;expect(saved).toHaveLength(1);await page.request.delete('/api/skill-plans/'+saved[0].id);
});
