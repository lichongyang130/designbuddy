import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync} from 'fflate';
const require=createRequire(import.meta.url),ExcelJS=require('exceljs');
const {formulaWorkbook}=require('../../../server/skills/testing/formula-fixtures.cjs');
const {scannedPDF}=require('../../../server/skills/testing/advanced-fixtures.cjs');
const desk=(page:Page)=>page.getByRole('region',{name:'真实技能执行台'});
async function select(page:Page,skill:string,expert='data'){await page.goto('/experts/'+expert);await desk(page).getByLabel('执行技能').selectOption(skill);}
async function submit(page:Page,name:string,buffer:Buffer){await desk(page).getByLabel('上传实际材料').setInputFiles({name,mimeType:'application/octet-stream',buffer});await desk(page).getByRole('checkbox',{name:/我同意上传材料/}).check();await desk(page).getByRole('button',{name:'上传并执行技能'}).click();}
async function download(page:Page,name:string){const wait=page.waitForEvent('download');await desk(page).getByRole('button',{name:'下载 '+name,exact:true}).click();return readFile((await(await wait).path())!);}
test.afterEach(async({page})=>{await page.evaluate(async()=>{const response=await fetch('/api/skill-runs');if(!response.ok)return;for(const r of (await response.json()).runs)await fetch('/api/skill-runs/'+r.id,{method:'DELETE'});});});

test('actual formula example download, upload, calculation, evidence and value-only XLSX survive refresh',async({page})=>{
 await select(page,'table.calculate');const wait=page.waitForEvent('download');await desk(page).getByRole('button',{name:'下载公式示例XLSX（不会执行）'}).click();const bytes=await readFile((await(await wait).path())!);const before=new ExcelJS.Workbook();await before.xlsx.load(bytes);expect(before.getWorksheet('明细').getCell('D2').value.result).toBe(999);
 await submit(page,'formulas.xlsx',bytes);await expect(desk(page).getByRole('status')).toHaveText('执行成功',{timeout:15000});const report=JSON.parse((await download(page,'formula-report.json')).toString());expect(report.formulaCount).toBe(6);expect(report.cells.find((c:any)=>c.sheet==='汇总'&&c.cell==='B2').decimalResult).toBe('25.3');expect(report.cells.every((c:any)=>!c.cachedValueUsed)).toBe(true);
 const book=new ExcelJS.Workbook();await book.xlsx.load(await download(page,'calculated-values.xlsx'));expect(book.getWorksheet('汇总').getCell('B5').value).toBe(22.77);expect(book.getWorksheet('明细').getCell('D2').formula).toBeUndefined();await expect(desk(page)).toContainText('不等于完整Excel计算');await page.reload();await expect(desk(page).getByRole('button',{name:'下载 formula-report.json',exact:true})).toBeVisible();
});
test('unsupported formula is visible failure, never replaced by an existing plausible cached value',async({page})=>{
 await select(page,'table.calculate');const {book}=await formulaWorkbook();book.getWorksheet('明细').getCell('D2').value={formula:'IF(1,100,200)',result:100};await submit(page,'unsupported.xlsx',Buffer.from(await book.xlsx.writeBuffer()));await expect(desk(page).getByRole('status')).toHaveText('执行失败',{timeout:15000});await expect(desk(page)).toContainText('不支持函数IF');await expect(desk(page).getByRole('button',{name:'下载 calculated-values.xlsx',exact:true})).toHaveCount(0);
});
test('two real PDFs are processed into an actually downloadable ZIP with both source hashes and Chinese OCR',async({page})=>{
 await select(page,'pdf.ocr-batch','documents');const a=await scannedPDF({pages:1}),b=await scannedPDF({pages:1,rotate:true});await submit(page,'batch.zip',Buffer.from(zipSync({'合同.pdf':a,'附件.pdf':b})));await expect(desk(page).getByRole('status')).toHaveText('执行成功',{timeout:25000});const report=JSON.parse((await download(page,'batch-report.json')).toString());expect(report.fileCount).toBe(2);expect(report.pageCount).toBe(2);expect(report.files[0].sourceSHA256).toBe(createHash('sha256').update(a).digest('hex'));expect(report.files[1].sourceSHA256).toBe(createHash('sha256').update(b).digest('hex'));
 const files=unzipSync(await download(page,'batch-ocr-results.zip'));for(const f of report.files){const evidence=JSON.parse(Buffer.from(files[f.folder+'/pdf-ocr-evidence.json']).toString());expect(evidence.pages[0].text.replace(/\s/g,'')).toContain('项目验收SALES12345');expect(files[f.folder+'/ocr-page-01.png'].length).toBeGreaterThan(1000);}await desk(page).locator('.skill-run-result').screenshot({path:'../../.cache/formula-batch-results.png'});
});
test('a failed PDF in a batch yields zero downloads, not a partial batch labeled successful',async({page})=>{
 await select(page,'pdf.ocr-batch','documents');const a=await scannedPDF({pages:1}),b=await scannedPDF({pages:1,blank:true});await submit(page,'bad-batch.zip',Buffer.from(zipSync({'good.pdf':a,'blank.pdf':b})));await expect(desk(page).getByRole('status')).toHaveText('执行失败',{timeout:25000});await expect(desk(page)).toContainText('文件2（blank.pdf）失败，整批未完成');await expect(desk(page).getByRole('button',{name:'下载 batch-ocr-results.zip',exact:true})).toHaveCount(0);
});
for(const width of [320,390])test(`new formula and batch controls fit ${width}px with visible consent and actual boundaries`,async({page})=>{
 await page.setViewportSize({width,height:844});for(const [skill,expert]of[['table.calculate','data'],['pdf.ocr-batch','documents']]){await select(page,skill,expert);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await desk(page).evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await expect(desk(page).getByRole('checkbox',{name:/我同意上传材料/})).toBeAttached();}if(width===390)await desk(page).locator('.skill-runtime-form').screenshot({path:'../../.cache/pdf-batch-mobile.png'});
});
