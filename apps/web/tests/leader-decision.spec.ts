import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';

test('built-in leadership template opens the real 12-page export, notes and provenance without publishing', async ({ page }) => {
  const writes: string[] = [], errors: string[] = [];
  page.on('request',r => { if(r.method() !== 'GET' && /community|templates|skill-runs|skill-plans/.test(r.url())) writes.push(r.url()); });
  page.on('pageerror',e => errors.push(e.message));
  await page.goto('/inspiration');
  await page.getByRole('button',{name:'幻灯片',exact:true}).click();
  await expect(page.locator('.sample-card')).toHaveCount(5);
  await expect(page.locator('[data-sample="luma"]')).toBeVisible();
  await expect(page.locator('[data-sample="city"]')).toBeVisible();
  const card = page.locator('[data-sample="leader-decision"]'); await expect(card).toBeVisible();
  expect(await card.locator('img').evaluate((e:HTMLImageElement) => e.complete && e.naturalWidth>0)).toBe(true);
  await card.getByRole('button').click(); await expect(page).toHaveURL(/\/inspiration\/leader-decision$/);
  await expect(page.locator('.leader-report-pages button')).toHaveCount(12);
  await expect(page.getByRole('heading',{name:'建议有条件批准，而不是宣布商业就绪。'})).toBeVisible();
  await expect(page.getByRole('button',{name:'上一页',exact:true})).toBeDisabled();
  for (let i=0;i<12;i++) {
    await page.locator('.leader-report-pages button').nth(i).click();
    await expect(page.locator('.leader-report-slide')).toHaveAttribute('src',new RegExp(`slides/${String(i+1).padStart(2,'0')}\\.jpg$`));
    await expect.poll(() => page.locator('.leader-report-slide').evaluate((e:HTMLImageElement) => e.complete && e.naturalWidth === 960)).toBe(true);
    await expect(page.getByRole('region',{name:'本页讲稿'})).toContainText('仓库依据');
    await expect(page.getByRole('region',{name:'本页来源'}).locator('details')).not.toHaveCount(0);
  }
  await expect(page.getByRole('button',{name:'下一页',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:/第3页：/}).click();
  await page.getByRole('region',{name:'本页来源'}).getByText(/E04 ·/).click();
  await expect(page.getByRole('region',{name:'本页来源'})).toContainText('docs/commercial-ppt-engine.md:L');
  const pending = page.waitForEvent('download'); await page.getByRole('link',{name:'下载可编辑PPTX',exact:true}).click();
  const bytes = await readFile((await (await pending).path())!);
  const deck = unzipSync(bytes); expect(Object.keys(deck).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))).toHaveLength(12);
  const pdf = await page.request.get('/presentation-examples/leader-decision/adaptive/leader-decision.pdf'); expect(pdf.ok()).toBe(true); expect((await pdf.body()).subarray(0,4).toString()).toBe('%PDF');
  await page.screenshot({path:'../../.cache/leader-decision-desktop.png',fullPage:true});
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});
for(const width of [320,390,768]) test(`leadership template is usable without overflow at ${width}px`,async ({page}) => {
  await page.setViewportSize({width,height:900}); await page.goto('/inspiration/leader-decision');
  await expect(page.locator('.leader-report-pages button')).toHaveCount(12);
  await page.getByRole('button',{name:/第8页：/}).click();
  await expect(page.locator('.leader-report-stage h2')).toContainText('成本尚未测算');
  await page.getByRole('region',{name:'本页来源'}).locator('summary').first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  if(width===390) await page.screenshot({path:'../../.cache/leader-decision-mobile.png',fullPage:true});
});
test('template regeneration opens the real slides.create composer, never auto-uploads and respects missing dependencies', async({page}) => {
  let posts = 0;
  page.on('request',r => { if(r.method() === 'POST' && /skill-runs|skill-plans/.test(r.url())) posts++; });
  // UI-only dependency fixture: no execution endpoint or provider is mocked as successful.
  await page.route('**/api/skill-runtime',async route => { const r=await route.fetch();const body=await r.json();body.skills=body.skills.map((s:{id:string})=>s.id==='slides.create'?{...s,status:'ready'}:s);await route.fulfill({response:r,json:body}); });
  await page.goto('/inspiration/leader-decision');
  await page.getByRole('button',{name:'用自己的材料生成',exact:true}).click();
  const desk = page.getByRole('region',{name:'真实技能执行台'});
  await expect(desk.getByLabel('执行技能')).toHaveValue('slides.create');
  await expect(desk.getByRole('group',{name:'商业演示需求与多份材料'})).toBeVisible();
  await expect(desk.getByLabel('页数（8–25）')).toHaveValue('12');
  await expect(desk.getByLabel('统一主题')).toHaveValue('consulting');
  await expect(desk.getByLabel('输出排版')).toHaveValue('adaptive');
  await expect(desk.getByLabel('受众与决策背景')).toHaveValue('项目决策领导');
  await expect(desk.getByRole('button',{name:'上传并执行技能'})).toBeDisabled();
  await expect(desk.getByRole('checkbox',{name:/我同意上传材料/})).not.toBeChecked();
  expect(posts).toBe(0);
  await page.getByRole('button',{name:'收起生成工作台',exact:true}).click();
  await expect(desk).toHaveCount(0);
});
test('failed example metadata fetch is visible and retry recovers the real asset', async({page}) => {
  let unavailable=true;
  await page.route('**/presentation-examples/leader-decision/report-v2.json',async route => { if(unavailable) await route.fulfill({status:503,body:'Unavailable'});else await route.continue(); });
  await page.goto('/inspiration/leader-decision');
  await expect(page.getByRole('alert')).toContainText('案例资源读取失败');
  unavailable=false;
  await page.getByRole('button',{name:'重新载入案例',exact:true}).click();
  await expect(page.locator('.leader-report-pages button')).toHaveCount(12);
});


test('missing server dependencies never fall back to an old compose skill or show a fake run button', async({page}) => {
  await page.route('**/api/skill-runtime',async route => { const r=await route.fetch();const body=await r.json();body.skills=body.skills.map((s:{id:string})=>s.id==='slides.create'?{...s,status:'unavailable',executorState:'connected'}:s);await route.fulfill({response:r,json:body}); });
  await page.goto('/inspiration/leader-decision');
  await page.getByRole('button',{name:'用自己的材料生成',exact:true}).click();
  const desk = page.getByRole('region',{name:'真实技能执行台'});
  await expect(desk).toContainText('执行器已接入、但服务端还没配置依赖');
  await expect(desk.getByRole('button',{name:'上传并执行技能'})).toHaveCount(0);
  await expect(desk.getByLabel('执行技能')).toHaveCount(0);
});


test('same-content comparison keeps the selected page and binds downloads to the selected export version',async({page})=>{
 await page.goto('/inspiration/leader-decision');
 await expect(page.locator('.leader-report-pages button')).toHaveCount(12);
 await page.getByRole('button',{name:/第6页：/}).click();
 await expect(page.locator('.leader-report-slide')).toHaveAttribute('src',/adaptive\/slides\/06.jpg$/);
 await expect(page.getByRole('link',{name:'下载可编辑PPTX',exact:true})).toHaveAttribute('href',/adaptive\/leader-decision.pptx$/);
 await page.getByRole('button',{name:'经典 V1 对照',exact:true}).click();
 await expect(page.locator('.leader-report-slide')).toHaveAttribute('src',/^\/presentation-examples\/leader-decision\/slides\/06.jpg$/);
 await expect(page.getByRole('link',{name:'下载可编辑PPTX',exact:true})).toHaveAttribute('href','/presentation-examples/leader-decision/leader-decision.pptx');
 await page.getByRole('button',{name:'自适应商务 V2',exact:true}).click();
 await expect(page.locator('.leader-report-slide')).toHaveAttribute('src',/adaptive\/slides\/06.jpg$/);
});
