import { test, expect, type Page } from '@playwright/test';
import { resetComposerDefaults, setPermission } from './helpers/home';
import { createRequire } from 'node:module';
import type { SkillService as Service } from '../../../server/skills/service';
import type { Planner } from '../../../server/skills/plan-store';
const { SkillService } = createRequire(import.meta.url)('../../../dist/local/server/skills/service.js');
const csv='项目,金额\n甲,10\n乙,20\n甲,10';
const goal='把CSV中所有字段完全相同的重复行去除，并计算数值合计';
const desk=(page:Page)=>page.getByRole('region',{name:'真实技能执行台'});
const planner=(page:Page)=>page.getByRole('region',{name:'模型技能规划'});
let services:Service[]=[];
async function bridge(page:Page,model:Planner) {
 const service:Service=new SkillService(':memory:',45000,model);services.push(service);
 await page.route(/\/api\/skill-(?:plans|runs|runtime)(?:\/[^?]*)?(?:\?.*)?$/,async route=>{
  const r=route.request();const response=await service.handle(new Request(r.url(),{method:r.method(),headers:r.headers(),...(['GET','HEAD'].includes(r.method())?{}:{body:r.postDataBuffer()})}),'task-browser');
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())}).catch(()=>{});
 });return service;
}
async function openFromHome(page:Page,text=goal,prepare?:()=>Promise<void>) {
 await page.goto('/');await page.getByRole('textbox',{name:'任务描述',exact:true}).fill(text);if(prepare)await prepare();
 await page.getByRole('button',{name:'添加附件',exact:true}).click();await page.getByRole('menuitem',{name:'添加文件',exact:true}).click();await page.getByRole('menuitem',{name:'用实际文件执行技能',exact:true}).click();
 await expect(page).toHaveURL(/\/tasks\//);await expect(page.getByRole('tab',{name:'文件技能与产物'})).toHaveAttribute('aria-selected','true');return page.url();
}
async function choose(page:Page) {await planner(page).getByLabel('选择规划材料（先在浏览器校验）').setInputFiles({name:'task.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await expect(planner(page).getByText(/已在浏览器校验/)).toBeVisible();}
async function manual(page:Page) {await desk(page).getByRole('combobox',{name:'执行技能',exact:true}).selectOption('table.analyze');await desk(page).getByLabel('上传实际材料').setInputFiles({name:'task.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await desk(page).getByRole('checkbox',{name:/去除所有字段/}).check();await desk(page).getByRole('checkbox',{name:/我同意上传材料/}).check();await desk(page).getByRole('button',{name:'上传并执行技能'}).click();await expect(desk(page).getByRole('status').filter({hasText:'执行成功'})).toBeVisible({timeout:15000});}
test.beforeEach(async({page})=>{
 // Composer defaults are account-wide; do not inherit 「仅本地」 from another file.
 await resetComposerDefaults(page);
});
test.afterEach(async({page})=>{
 for(const s of services)await s.close();services=[];
 // Only this browser's actual HTTP records; tests use isolated browser sessions.
 await page.unrouteAll({behavior:'ignoreErrors'});
 await page.evaluate(async()=>{for(const kind of ['skill-runs','skill-plans']){const r=await fetch('/api/'+kind);if(!r.ok)continue;const body=await r.json();for(const v of body[kind==='skill-runs'?'runs':'plans']||[])await fetch('/api/'+kind+'/'+v.id,{method:'DELETE'});}}).catch(()=>{});
});
test('home file task does not call chat/model automatically; actual HTTP execution belongs only to that task and restores after reload',async({page})=>{
 let chat=0,plans=0;page.on('request',r=>{if(/\/api\/(chat|generation)$/.test(r.url()))chat++;if(r.url().endsWith('/api/skill-plans')&&r.method()==='POST')plans++;});
 const first=await openFromHome(page);const id=first.split('/').at(-1)!;await expect(planner(page).getByRole('textbox',{name:'任务描述',exact:true})).toHaveValue(goal);expect(chat).toBe(0);expect(plans).toBe(0);
 await manual(page);const result=await (await page.request.get('/api/skill-runs?taskId='+id)).json();expect(result.runs).toHaveLength(1);expect(result.runs[0].taskId).toBe(id);const report=result.runs[0].artifacts.find((a:{name:string})=>a.name==='analysis.json');const json=await (await page.request.get(`/api/skill-runs/${result.runs[0].id}/artifacts/${report.id}`)).json();expect(json.columns[1].sum).toBe(30);
 await openFromHome(page,'第二个任务不得混入第一个任务的文件');await expect(desk(page).getByText('暂无运行记录。点击执行后才会创建真实任务。')).toBeVisible();await expect(desk(page).getByRole('button',{name:'下载 analysis.json'})).toHaveCount(0);
 await page.goto(first);await expect(desk(page).getByRole('button',{name:'下载 analysis.json'})).toBeVisible();await expect(desk(page).getByRole('checkbox',{name:/我同意上传材料/})).not.toBeChecked();expect(chat).toBe(0);expect(plans).toBe(0);
});
test('task model proposal preserves explicit expert/model, omits chat attachment text, then actual worker executes after separate approval',async({page})=>{
 let seen:any;await bridge(page,async input=>{seen=input;return {kind:'plan',expertId:'data',skillId:'table.analyze',reason:'根据描述进行固定统计；未读正文',options:{deduplicate:true}};});
 await page.route('**/api/expert-match',route=>route.fulfill({json:{kind:'match',expertId:'data',collaboratorIds:[],reason:'表格数值计算',responsibilities:['核对字段'],missing:[]}}));
 const url=await openFromHome(page,goal,async()=>{
  await page.locator('input.visually-hidden-input[type=file]').setInputFiles({name:'chat-only.txt',mimeType:'text/plain',buffer:Buffer.from('CHAT_PRIVATE_BODY_MUST_NOT_REACH_SKILL_PLANNER')});
  await page.locator('.home-expert-trigger').click();await page.getByRole('button',{name:'允许并开启自动匹配',exact:true}).click();await page.getByRole('textbox',{name:'任务描述',exact:true}).click();await expect(page.locator('.home-expert-trigger')).toContainText('推荐：数据分析专家');await page.locator('.home-expert-trigger').click();await page.getByRole('button',{name:'使用推荐并锁定',exact:true}).click();
 });
 await expect(planner(page).getByText(/固定专家：数据分析专家/)).toBeVisible();// Pick a model the planner really offers; the option list follows the shipped
// registry, so hard-coded positions break as soon as that list changes.
const modelOptions=await page.getByLabel('规划模型',{exact:true}).locator('option').evaluateAll(os=>os.map(o=>({value:(o as HTMLOptionElement).value,disabled:(o as HTMLOptionElement).disabled})));
const model=modelOptions.find(o=>o.value&&!o.disabled)?.value;expect(model).toBeTruthy();await page.getByLabel('规划模型',{exact:true}).selectOption(model!);
 await choose(page);await planner(page).getByRole('checkbox',{name:/允许将任务描述/}).check();await planner(page).getByRole('button',{name:'生成技能方案（不执行）'}).click();await expect(planner(page).getByRole('status')).toHaveText('待你确认 · 未执行');
 expect(seen.taskId).toBe(url.split('/').at(-1));expect(seen.expertScope).toBe('data');expect(seen.model).toBe(model);expect(seen.goal).toBe(goal);expect(JSON.stringify(seen)).not.toContain('CHAT_PRIVATE_BODY');expect(JSON.stringify(seen)).not.toContain('甲,10');
 await page.reload();await expect(planner(page).getByRole('button',{name:'确认方案并执行一次'})).toBeDisabled();await choose(page);await planner(page).getByRole('checkbox',{name:/我已核对/}).check();await planner(page).getByRole('button',{name:'确认方案并执行一次'}).click();await expect(desk(page).getByRole('status').filter({hasText:'执行成功'})).toBeVisible({timeout:15000});await expect(desk(page).getByRole('button',{name:'下载 analysis.json'})).toBeVisible();
});
test('local-only file task opens no skill API and no chat; switching permission still does not auto upload or plan',async({page})=>{
 const calls:string[]=[];page.on('request',r=>{if(/^\/api\/(skill-|chat|generation)/.test(new URL(r.url()).pathname))calls.push(r.method()+':'+r.url());});
 await openFromHome(page,goal,async()=>{await setPermission(page,'仅本地');});
 await expect(page.getByText(/当前为仅本地模式：不会打开后台执行台/)).toBeVisible();
 // Picking the entry from the attach menu legitimately reads the public skill
 // catalogue; what must never happen for a local-only task is chat, planning,
 // a run record, or any upload, so only catalogue reads are allowed here.
 expect(calls.filter(x=>!x.startsWith('GET:http://127.0.0.1:5273/api/skill-runtime'))).toEqual([]);
 await expect(desk(page)).toHaveCount(0);
 await page.getByLabel('任务权限',{exact:true}).selectOption('默认权限');await expect(desk(page).getByLabel('上传实际材料')).toBeVisible();expect(calls.some(x=>x.startsWith('POST:'))).toBe(false);await expect(planner(page).getByRole('button',{name:'生成技能方案（不执行）'})).toBeDisabled();
 page.once('dialog',d=>d.accept());await page.getByLabel('任务权限',{exact:true}).selectOption('仅本地');await expect(desk(page)).toHaveCount(0);
});
test('existing ordinary conversation can open file tools without replacing its messages or sending a second chat',async({page})=>{
 let chats=0;await page.route('**/api/chat',route=>{chats++;return route.fulfill({contentType:'text/event-stream',body:'data: {"choices":[{"delta":{"content":"这是普通聊天回复，不是文件处理结果。"}}]}\n\ndata: [DONE]\n\n'});});
 await page.goto('/');await page.getByRole('textbox',{name:'任务描述',exact:true}).fill('帮我核对文件');await page.getByRole('button',{name:'开始任务',exact:true}).click();await expect(page.locator('.task-progress summary')).toContainText('已完成');await page.getByRole('tab',{name:'文件技能与产物'}).click();await expect(planner(page).getByRole('textbox',{name:'任务描述',exact:true})).toHaveValue('帮我核对文件');await page.getByRole('tab',{name:'对话',exact:true}).click();await expect(page.locator('.task-reply-markdown')).toContainText('普通聊天回复');expect(chats).toBe(1);
});
test('identity event closes task executor until explicit acknowledgement and never reuses file consent',async({page})=>{
 await openFromHome(page);await choose(page);await planner(page).getByRole('checkbox',{name:/允许将任务描述/}).check();await page.evaluate(()=>window.dispatchEvent(new Event('designbuddy:server-identity')));await expect(page.getByText(/服务端身份已变化，已关闭此任务的执行入口/)).toBeVisible();await expect(desk(page)).toHaveCount(0);await page.getByRole('button',{name:'已核对账号，重新打开执行台'}).click();await expect(planner(page).getByRole('checkbox',{name:/允许将任务描述/})).not.toBeChecked();await expect(planner(page).getByRole('button',{name:'生成技能方案（不执行）'})).toBeDisabled();
});
test('unsupported custom expert is not silently replaced with a built-in executor',async({page})=>{
 const url=await openFromHome(page);const id=url.split('/').at(-1)!;await page.evaluate(id=>{const key='designbuddy.conversation.v1.'+id;const value=JSON.parse(localStorage.getItem(key)!);value.skillExpertId='custom-personal-expert';localStorage.setItem(key,JSON.stringify(value));},id);await page.reload();await expect(page.getByText(/此任务指定的自建专家尚未绑定后台技能/)).toBeVisible();await expect(desk(page)).toHaveCount(0);
});
for(const width of [320,390])test(`task file tools fit ${width}px and keep real consent controls usable`,async({page})=>{
 await page.setViewportSize({width,height:844});await openFromHome(page);await choose(page);await expect(planner(page).getByRole('checkbox',{name:/允许将任务描述/})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await desk(page).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);if(width===390)await page.screenshot({path:'../../.cache/task-skills-mobile.png'});
});
