import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
const desk=(page:Page)=>page.getByRole('region',{name:'真实技能执行台'});
const image=()=>sharp({create:{width:240,height:160,channels:3,background:'#cf714f'}}).png().toBuffer();
async function submit(page:Page,name:string,buffer:Buffer){
 await desk(page).getByLabel('上传实际材料').setInputFiles({name,mimeType:'application/octet-stream',buffer});
 await desk(page).getByRole('checkbox',{name:/我同意上传材料/}).check();
 await desk(page).getByRole('button',{name:'上传并执行技能'}).click();
 await expect(desk(page).getByRole('status')).toHaveText('执行成功',{timeout:25000});
}
async function downloaded(page:Page,name:string){const waiting=page.waitForEvent('download');await desk(page).getByRole('button',{name:`下载 ${name}`,exact:true}).click();return readFile((await(await waiting).path())!);}
test.afterEach(async({page})=>{await page.evaluate(async()=>{const r=await fetch('/api/skill-runs');if(!r.ok)return;const {runs}=await r.json();for(const run of runs)await fetch(`/api/skill-runs/${run.id}`,{method:'DELETE'});});});

test('PDF generation and extraction use actual files and page evidence in the browser',async({page})=>{
 await page.goto('/experts/documents');await expect(desk(page).getByLabel('执行技能')).toHaveValue('document.format');
 await submit(page,'source.md',Buffer.from('# 实际文档\n本月销售额 120.50 元\n请核对原始材料。'));
 const pdf=await downloaded(page,'organized.pdf');expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
 await desk(page).getByLabel('执行技能').selectOption('pdf.extract');await submit(page,'actual.pdf',pdf);
 const result=JSON.parse((await downloaded(page,'pdf-pages.json')).toString());expect(result[0].page).toBe(1);expect(result[0].text).toContain('本月销售额 120.50 元');
});
test('browser OCR uploads actual raster pixels and downloads recognized text/evidence',async({page})=>{
 await page.goto('/experts/documents');await desk(page).getByLabel('执行技能').selectOption('image.ocr');
 const png=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="180"><rect width="100%" height="100%" fill="white"/><text x="30" y="110" font-family="sans-serif" font-size="58" fill="black">SALES 12345</text></svg>')).png().toBuffer();
 await submit(page,'scan.png',png);const recognized=(await downloaded(page,'recognized.txt')).toString().replace(/\s/g,'');expect(recognized).toContain('SALES12345');const evidence=JSON.parse((await downloaded(page,'ocr-evidence.json')).toString());expect(evidence.requiresReview).toBe(true);expect(evidence.lines.length).toBeGreaterThan(0);
});
test('brand extraction and product processing return real downloadable and viewable images',async({page})=>{
 await page.goto('/experts/brand');await expect(desk(page).getByLabel('执行技能')).toHaveValue('brand.assets');await submit(page,'brand.png',await image());
 const tokens=JSON.parse((await downloaded(page,'brand-tokens.json')).toString());expect(tokens.colors[0].hex).toBe('#cf714f');
 await page.goto('/experts/product-visual');await expect(desk(page).getByLabel('执行技能')).toHaveValue('image.product');await submit(page,'product.png',await image());
 const bytes=await downloaded(page,'product-square.jpg');const meta=await sharp(bytes).metadata();expect(meta.width).toBe(1200);expect(meta.height).toBe(1200);
 await desk(page).getByRole('button',{name:'预览 product-square.jpg',exact:true}).click();await expect(desk(page).getByRole('img',{name:'实际处理后的图片预览'})).toBeVisible();
 await expect(desk(page)).toContainText('未执行抠图或AI修图');
});
test('marketing expert uses entered copy, outputs two real posters, and retains parameters on reload',async({page})=>{
 await page.goto('/experts/visual');await expect(desk(page).getByLabel('执行技能')).toHaveValue('image.marketing');
 await desk(page).getByLabel('海报标题',{exact:true}).fill('新品发布');await desk(page).getByLabel('副标题',{exact:true}).fill('真实素材，实际排版');await desk(page).getByLabel('行动文字',{exact:true}).fill('了解更多');
 await submit(page,'material.png',await image());const bytes=await downloaded(page,'poster-portrait.png');const meta=await sharp(bytes).metadata();expect(meta.width).toBe(1080);expect(meta.height).toBe(1440);
 const data=JSON.parse((await downloaded(page,'poster-layout.json')).toString());expect(data.title).toBe('新品发布');
 await desk(page).getByRole('button',{name:'预览 poster-portrait.png',exact:true}).click();await expect(desk(page).getByRole('img',{name:'实际处理后的图片预览'})).toBeVisible();
 await page.screenshot({path:'../../.cache/phase-two-poster-desktop.png',fullPage:true});
 await page.reload();await expect(desk(page).getByRole('status')).toHaveText('执行成功');const receipt=JSON.parse((await downloaded(page,'execution-receipt.json')).toString());expect(receipt.options.parameters.title).toBe('新品发布');
});
test('schedule and requirements downloadable format examples run without automatic execution',async({page})=>{
 for(const [id,filename,output] of [['communication','schedule-example.csv','schedule.ics'],['product','requirements-example.json','requirements-report.json']]){
  await page.goto(`/experts/${id}`);const waiting=page.waitForEvent('download');await desk(page).getByRole('button',{name:'下载输入格式示例（不会执行）',exact:true}).click();const sample=await readFile((await(await waiting).path())!);
  await expect(desk(page)).toContainText('暂无运行记录');await submit(page,filename,sample);const result=await downloaded(page,output);expect(result.length).toBeGreaterThan(100);
 }
});
test('web, developer and QA experts have real static checks without claiming runtime testing',async({page})=>{
 for(const [expert,skill,file,content,report] of [
  ['web-design','web.audit','page.html','<!doctype html><html><body><img src="x"><input></body></html>','html-audit.json'],
  ['developer','code.inspect','source.js','eval(userInput);','javascript-report.json'],
  ['qa','web.audit','page.html','<!doctype html><html><body><button></button></body></html>','html-audit.json'],
 ]){
  await page.goto(`/experts/${expert}`);await expect(desk(page).getByLabel('执行技能')).toHaveValue(skill);await submit(page,file,Buffer.from(content));const r=JSON.parse((await downloaded(page,report)).toString());expect(r.findings.length).toBeGreaterThan(0);await expect(desk(page).locator('.skill-run-result')).toContainText(/未执行|没有安装/);
 }
});
for(const width of [320,375,768])test(`new skill parameters and results fit ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/experts/visual');await expect(desk(page).getByLabel('海报标题')).toBeVisible();await desk(page).getByLabel('海报标题').fill('每一个细节都值得认真对待');await submit(page,'input.png',await image());expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 if(width===375){await desk(page).scrollIntoViewIfNeeded();await page.screenshot({path:'../../.cache/phase-two-mobile.png'});}
});
