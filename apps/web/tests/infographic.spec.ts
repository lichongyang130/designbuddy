import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{fixture}=require('../../../server/skills/testing/infographic-fixtures.cjs');
const desk=(page:Page)=>page.getByRole('region',{name:'真实技能执行台'});
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
async function open(page:Page){await page.goto('/experts/infographics');await desk(page).getByLabel('执行技能').selectOption('infographic.compose');}
async function submit(page:Page,bytes:Buffer){await desk(page).getByLabel('上传实际材料').setInputFiles({name:'data.json',mimeType:'application/json',buffer:bytes});await expect(desk(page).getByRole('button',{name:'上传并执行技能'})).toBeDisabled();await desk(page).getByRole('checkbox',{name:/我同意上传材料/}).check();const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/skill-runs');await desk(page).getByRole('button',{name:'上传并执行技能'}).click();const accepted=await response;expect(accepted.status()).toBe(202);const run=await accepted.json();await expect(desk(page).getByLabel('选择技能运行记录')).toHaveValue(run.id);}
async function success(page:Page){await expect(desk(page).getByRole('status')).toHaveText('执行成功',{timeout:20000});}
async function download(page:Page,name:string){const wait=page.waitForEvent('download');await desk(page).getByRole('button',{name:'下载 '+name,exact:true}).click();return readFile((await(await wait).path())!);}
async function preview(page:Page,kind='infographic.png'){await desk(page).getByRole('button',{name:'预览 '+kind,exact:true}).click();const img=desk(page).getByRole('img',{name:'实际生成的信息图'});await expect.poll(()=>img.evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBe(1200);return img;}
test.afterEach(async({page})=>{await page.evaluate(async()=>{const response=await fetch('/api/skill-runs');if(!response.ok)return;for(const r of(await response.json()).runs)await fetch('/api/skill-runs/'+r.id,{method:'DELETE'});});});

test('downloaded JSON sample requires consent and produces real PNG/SVG, matching hashes and reloadable artifacts',async({page})=>{
 await open(page);const wait=page.waitForEvent('download');await desk(page).getByRole('button',{name:'下载输入格式示例（不会执行）'}).click();const bytes=await readFile((await(await wait).path())!);expect(JSON.parse(bytes.toString()).purpose).toBe('comparison');expect(await page.evaluate(async()=>(await(await fetch('/api/skill-runs')).json()).runs.length)).toBe(0);
 await submit(page,bytes);await success(page);const report=JSON.parse((await download(page,'infographic-report.json')).toString());expect(report.sourceSHA256).toBe(hash(bytes));expect(report.selectionMethod).toContain('not AI');expect(report.sourceIndependentlyVerified).toBe(false);expect(report.rows.map((r:any)=>r.value)).toEqual(['128.5','96.2','73.8','155.6']);expect(report.rowReference).toContain('不是JSON物理行号');
 const png=await download(page,'infographic.png'),svg=await download(page,'infographic.svg');expect(hash(png)).toBe(report.render.pngSHA256);expect(hash(svg)).toBe(report.render.svgSHA256);expect(png.subarray(1,4).toString()).toBe('PNG');expect(svg.toString()).toContain('<path ');expect(svg.toString()).not.toContain('<script');expect((await download(page,'font-license.txt')).toString()).toContain('SIL OPEN FONT LICENSE');
 const img=await preview(page);await img.screenshot({path:'../../.cache/infographic-comparison-preview.png'});await preview(page,'图表');await page.reload();await expect(desk(page).getByRole('button',{name:'下载 infographic-report.json',exact:true})).toBeVisible();await preview(page);
 await desk(page).getByLabel('执行技能').selectOption('infographic.compose');const numeric=Buffer.from(JSON.stringify({...fixture(),data:[{label:'精确数值',value:'RAW_NUMBER'},{label:'零值',value:'0'}]}).replace('"RAW_NUMBER"','999999999999.999999'));await submit(page,numeric);await success(page);expect(JSON.parse((await download(page,'infographic-report.json')).toString()).rows[0].value).toBe('999999999999.999999');
});
test('actual trend preserves source record positions and proportional date spacing in report and preview',async({page})=>{
 await open(page);await submit(page,Buffer.from(JSON.stringify({...fixture('trend'),title:'累计收入趋势'})));await success(page);const r=JSON.parse((await download(page,'infographic-report.json')).toString());expect(r.rows.map((v:any)=>v.sourceRow)).toEqual([2,3,1]);expect(r.change).toBe('50');expect(r.changePercent).toBe('50');const [a,b,c]=r.geometry;expect((b.x-a.x)/(c.x-a.x)).toBeCloseTo(1/3,10);expect(r.missingDatesFilled).toBe(false);await(await preview(page)).screenshot({path:'../../.cache/infographic-trend-preview.png'});
});
test('actual confirmed composition retains zero category and discloses rounded 99.99 percent total',async({page})=>{
 await open(page);const data={...fixture('composition'),title:'小数构成核对',data:[{label:'甲',value:'0.1'},{label:'乙',value:'0.1'},{label:'丙',value:'0.1'},{label:'零',value:'-0'}]};await submit(page,Buffer.from(JSON.stringify(data)));await success(page);const r=JSON.parse((await download(page,'infographic-report.json')).toString());expect(r.total).toBe('0.3');expect(r.displayedSharesSum).toBe('99.99');expect(r.rows[3].shareDisplay).toBe('0.00%');expect(r.geometry[3].width).toBe(0);expect(r.userDeclaredPartsCompleteAndDisjoint).toBe(true);await(await preview(page)).screenshot({path:'../../.cache/infographic-composition-preview.png'});
});
test('invalid purpose, missing unit, impossible date and unconfirmed composition fail visibly with no artifacts',async({page})=>{
 await open(page);for(const [value,message]of [
  [{...fixture(),purpose:'automatic'},'不猜测业务目的'],
  [{...fixture(),unit:''},'单位必须'],
  [{...fixture('trend'),data:[{label:'2026-02-30',value:'1'},{label:'2026-03-01',value:'2'}]},'不存在的日历日期'],
  [{...fixture('composition'),compositionConfirmed:false},'compositionConfirmed=true']
 ]as const){await submit(page,Buffer.from(JSON.stringify(value)));await expect(desk(page).getByRole('status')).toHaveText('执行失败',{timeout:20000});await expect(desk(page).locator('.skill-run-result > p')).toContainText(message);await expect(desk(page).getByRole('button',{name:'下载 infographic.png',exact:true})).toHaveCount(0);}
 const runs=await page.evaluate(async()=>(await(await fetch('/api/skill-runs')).json()).runs);expect(runs).toHaveLength(4);for(const r of runs){expect(r.status).toBe('failed');expect(r.artifacts).toHaveLength(0);}
});
for(const width of [320,390])test(`infographic upload and actual preview remain usable at ${width}px without page overflow`,async({page})=>{
 await page.setViewportSize({width,height:844});await open(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await desk(page).evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await submit(page,Buffer.from(JSON.stringify(fixture())));await success(page);const img=await preview(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await img.evaluate(el=>el.getBoundingClientRect().width<=innerWidth)).toBe(true);if(width===390){await img.scrollIntoViewIfNeeded();await page.screenshot({path:'../../.cache/infographic-mobile-390.png'});}
});
