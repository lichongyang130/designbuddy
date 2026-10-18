import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const {workbook,scannedPDF,mixedPDF}=require('../../../server/skills/testing/advanced-fixtures.cjs');
const ExcelJS=require('exceljs');
const {SkillService}=require('../../../dist/local/server/skills/service.js');
const desk=(page:Page)=>page.getByRole('region',{name:'真实技能执行台'});
const planner=(page:Page)=>page.getByRole('region',{name:'模型技能规划'});
let isolated:any;
async function choose(page:Page,id:string,path='/experts/data'){await page.goto(path);await desk(page).getByLabel('执行技能').selectOption(id);}
async function fields(page:Page,type='left'){for(const [name,value]of[['左表工作表名称','订单'],['右表工作表名称','客户'],['左表关联字段','编号'],['右表关联字段','编号']])await desk(page).getByLabel(name,{exact:true}).fill(value);await desk(page).getByRole('combobox',{name:'连接方式',exact:true}).selectOption(type);}
async function submit(page:Page,name:string,buffer:Buffer){await desk(page).getByLabel('上传实际材料').setInputFiles({name,mimeType:'application/octet-stream',buffer});await desk(page).getByRole('checkbox',{name:/我同意上传材料/}).check();await desk(page).getByRole('button',{name:'上传并执行技能'}).click();}
async function download(page:Page,name:string){const wait=page.waitForEvent('download');await desk(page).getByRole('button',{name:'下载 '+name,exact:true}).click();return readFile((await(await wait).path())!);}
test.afterEach(async({page})=>{await page.unrouteAll({behavior:'ignoreErrors'});if(isolated){await isolated.close();isolated=undefined;}await page.evaluate(async()=>{for(const kind of ['skill-runs','skill-plans']){const r=await fetch('/api/'+kind);if(!r.ok)continue;const body=await r.json();for(const item of body[kind==='skill-runs'?'runs':'plans']||[])await fetch(`/api/${kind}/${item.id}`,{method:'DELETE'});}}).catch(()=>{});});

test('real scanned and mixed PDF uploads produce per-page OCR evidence, readable text and matching preview hashes',async({page})=>{
 await choose(page,'pdf.ocr','/experts/documents');await submit(page,'mixed.pdf',await mixedPDF());await expect(desk(page).getByRole('status')).toHaveText('执行成功',{timeout:25000});await expect(desk(page)).toContainText('不能视为全文读取完成');
 const report=JSON.parse((await download(page,'pdf-ocr-evidence.json')).toString());expect(report.pageCount).toBe(3);expect(report.pagesWithoutText).toEqual([3]);expect(report.pages[0].text.replace(/\s/g,'')).toContain('项目验收SALES12345');expect(report.pages[1].text.replace(/\s/g,'')).toContain('DIGITALPAGE2CHECK24680');
 const png=await download(page,'ocr-page-01.png');expect(createHash('sha256').update(png).digest('hex')).toBe(report.pages[0].rasterSHA256);const meta=await sharp(png).metadata();expect(meta.width).toBe(report.pages[0].width);await desk(page).getByRole('button',{name:'预览 ocr-page-01.png',exact:true}).click();await expect(desk(page).getByRole('img',{name:'实际处理后的图片预览'})).toBeVisible();await page.screenshot({path:'../../.cache/advanced-pdf-ocr.png'});
});
test('failed local PDF OCR can be explicitly resumed from persisted page checkpoints with consent and an honest warning',async({page})=>{
 await choose(page,'pdf.ocr','/experts/documents');await submit(page,'blank-retry.pdf',await scannedPDF({pages:1,blank:true}));await expect(desk(page).getByRole('status')).toHaveText('执行失败',{timeout:25000});const retry=desk(page).getByRole('button',{name:'继续/重试PDF OCR'});await expect(retry).toBeVisible();page.once('dialog',dialog=>dialog.accept());await retry.click();await expect(desk(page).getByRole('status')).toHaveText('执行失败',{timeout:25000});await desk(page).getByText('执行证据与来源',{exact:true}).click();await expect(desk(page)).toContainText('用户请求继续PDF OCR；将校验并复用已持久化的逐页检查点，重新处理未完成页。');
});

test('blank PDF fails with no fake OCR output; invalid oversized page count is rejected',async({page})=>{
 await choose(page,'pdf.ocr','/experts/documents');await submit(page,'blank.pdf',await scannedPDF({pages:1,blank:true}));await expect(desk(page).getByRole('status')).toHaveText('执行失败',{timeout:25000});await expect(desk(page)).toContainText('所有PDF页面均未识别到文字');await expect(desk(page).getByRole('button',{name:'下载 pdf-ocr.txt',exact:true})).toHaveCount(0);
 const {PDFDocument}=require('pdf-lib');const many=await PDFDocument.create();for(let i=0;i<7;i++)many.addPage();await submit(page,'many.pdf',Buffer.from(await many.save()));await expect(desk(page).getByRole('status')).toHaveText('执行失败');await expect(desk(page)).toContainText('最多6页');
});
test('downloadable real XLSX example joins through visible required parameters and survives refresh',async({page})=>{
 await choose(page,'table.join');const waiting=page.waitForEvent('download');await desk(page).getByRole('button',{name:'下载双表示例XLSX（不会执行）'}).click();const bytes=await readFile((await(await waiting).path())!);const source=new ExcelJS.Workbook();await source.xlsx.load(bytes);expect(source.worksheets.map((s:any)=>s.name)).toEqual(['订单','客户']);
 let posts=0;page.on('request',r=>{if(r.method()==='POST' && r.url().endsWith('/api/skill-runs'))posts++;});await submit(page,'example.xlsx',bytes);expect(posts).toBe(0);await fields(page,'full');await desk(page).getByRole('button',{name:'上传并执行技能'}).click();await expect(desk(page).getByRole('status')).toHaveText('执行成功',{timeout:15000});const report=JSON.parse((await download(page,'join-report.json')).toString());expect(report.outputRows).toBe(8);expect(report.matchedRows).toBe(3);expect(report.parameters.joinType).toBe('full');
 const result=new ExcelJS.Workbook();await result.xlsx.load(await download(page,'joined.xlsx'));expect(result.getWorksheet('关联结果').rowCount).toBe(9);expect(result.getWorksheet('关联结果').getCell('C2').value).toBe('001');await page.reload();await expect(desk(page).getByRole('button',{name:'下载 joined.xlsx',exact:true})).toBeVisible();
});
test('ambiguous right-side duplicate keys fail rather than creating misleading expanded rows',async({page})=>{
 await choose(page,'table.join');await fields(page);const {bytes}=await workbook(undefined,[['编号'],['001'],['001']]);await submit(page,'duplicate.xlsx',bytes);await expect(desk(page).getByRole('status')).toHaveText('执行失败',{timeout:15000});await expect(desk(page)).toContainText('右表关联键不唯一');await expect(desk(page).getByRole('button',{name:'下载 joined.xlsx',exact:true})).toHaveCount(0);
});
test('generic skill parameter form clears the previous skill fields when switching skill',async({page})=>{
 // table.join and table.calculate both belong to the data expert, so the same
 // workbench can switch between them; the join fields must not survive.
 await choose(page,'table.join');await fields(page,'full');await expect(desk(page).getByLabel('左表工作表名称',{exact:true})).toBeVisible();await desk(page).getByLabel('执行技能').selectOption('table.calculate');await expect(desk(page).getByLabel('左表工作表名称',{exact:true})).toHaveCount(0);
});
test('poster skill runs with its own parameters and writes a real receipt',async({page})=>{
 await choose(page,'image.marketing','/experts/visual');await desk(page).getByLabel('海报标题',{exact:true}).fill('独立素材');const image=await sharp({create:{width:100,height:100,channels:3,background:'blue'}}).png().toBuffer();await submit(page,'blue.png',image);await expect(desk(page).getByRole('status')).toHaveText('执行成功',{timeout:15000});const receipt=JSON.parse((await download(page,'execution-receipt.json')).toString());expect(receipt.options.parameters).toEqual({title:'独立素材',subtitle:'',action:''});
});
test('model-selected join shows frozen Chinese parameter labels before actual approved execution (model stub only)',async({page})=>{
 const parameters={leftSheet:'订单',rightSheet:'客户',leftKey:'编号',rightKey:'编号',joinType:'full'};
 isolated=new SkillService(':memory:',45000,async()=>({kind:'plan',expertId:'data',skillId:'table.join',reason:'任务明确给出表名与字段',options:{deduplicate:false,parameters}}));
 await page.route(/\/api\/skill-(?:plans|runs|runtime)(?:\/[^?]*)?(?:\?.*)?$/,async route=>{const r=route.request();const response=await isolated.handle(new Request(r.url(),{method:r.method(),headers:r.headers(),...(['GET','HEAD'].includes(r.method())?{}:{body:r.postDataBuffer()})}),'test-owner');await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});});
 await page.goto('/experts/data');await desk(page).getByText('描述任务，让模型建议技能',{exact:true}).click();await planner(page).getByRole('textbox',{name:'任务描述',exact:true}).fill('订单与客户工作表按编号字段全外连接，右表键须唯一');const {bytes}=await workbook();await planner(page).getByLabel('选择规划材料（先在浏览器校验）').setInputFiles({name:'join.xlsx',mimeType:'application/octet-stream',buffer:bytes});await planner(page).getByRole('checkbox',{name:/允许将任务描述/}).check();await planner(page).getByRole('button',{name:'生成技能方案（不执行）'}).click();await expect(planner(page).getByRole('status')).toHaveText('待你确认 · 未执行');await expect(planner(page).getByText('左表工作表名称：订单',{exact:true})).toBeVisible();await expect(planner(page).getByText('连接方式：全外连接（保留两边未匹配行）',{exact:true})).toBeVisible();await planner(page).getByRole('checkbox',{name:/我已核对/}).check();await planner(page).getByRole('button',{name:'确认方案并执行一次'}).click();await expect(desk(page).getByRole('status').filter({hasText:'执行成功'})).toBeVisible({timeout:15000});const result=JSON.parse((await download(page,'join-report.json')).toString());expect(result.outputRows).toBe(8);expect(result.parameters).toEqual(parameters);
});
for(const width of [320,390])test(`join form remains usable at ${width}px without overflow`,async({page})=>{await page.setViewportSize({width,height:844});await choose(page,'table.join');await fields(page,'full');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await desk(page).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);if(width===390)await desk(page).locator('.skill-runtime-form').screenshot({path:'../../.cache/advanced-join-mobile.png'});});
