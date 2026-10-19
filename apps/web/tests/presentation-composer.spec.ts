import { test, expect, type Page } from '@playwright/test';
const name = '商业演示AI规划与原生PPTX交付（首版）';
const workbench = (page: Page) => page.getByRole('region', { name: '真实技能执行台' });
async function openComposer(page: Page) {
  // UI-only fixture: declare dependencies present, but intercept execution below. No fake provider is enabled in the product.
  await page.route('**/api/skill-runtime', async route => {
    const response = await route.fetch(); const body = await response.json();
    body.skills = body.skills.map((s: { id: string }) => s.id === 'slides.create' ? { ...s, status: 'ready' } : s);
    await route.fulfill({ response, json: body });
  });
  await page.goto('/skills'); await page.getByRole('searchbox', { name: '搜索技能' }).fill('商业演示');
  const card = page.getByRole('article', { name }); await expect(card).toBeVisible();
  await card.getByRole('button', { name: `查看技能：${name}` }).click();
  await page.getByRole('dialog', { name }).getByRole('button', { name: '打开执行工作台' }).click();
  await expect(workbench(page).getByLabel('执行技能')).toHaveValue('slides.create');
  return workbench(page).getByRole('group', { name: '商业演示需求与多份材料' });
}
const sources = [{ name: 'facts.md', mimeType: 'text/markdown', buffer: Buffer.from('合成材料。试点仍需核对，禁止编造客户和融资金额。') }, { name: 'observations.csv', mimeType: 'text/csv', buffer: Buffer.from('月份,收入\n七月,120\n八月,150\n') }];
test('multiple sources prepare locally; both consents gate upload; actual brief/base64 envelope sent through existing skill runs', async ({ page }) => {
  let posted: { path: string; form: FormData } | undefined;
  await page.route('**/api/skill-runs?kind=presentation', async route => {
    const r = route.request(); const body = r.postDataBuffer();
    const form = await new Request(r.url(), { method: 'POST', headers: { 'content-type': r.headers()['content-type'] }, body: body! }).formData();
    posted = { path: r.url(), form }; await route.fulfill({ status: 400, json: { error: 'UI fixture intercepted: no actual model or upload execution' } });
  });
  const composer = await openComposer(page); const desk = workbench(page);
  await composer.getByLabel('演示目标').fill('向经营委员会汇报试点；只采用材料中的收入。');
  await composer.getByLabel('演示场景').selectOption('data-analysis'); await composer.getByLabel('统一主题').selectOption('technology');
  await composer.getByLabel('选择多份来源材料').setInputFiles(sources);
  await expect(composer.getByRole('list', { name: '演示来源清单' }).getByRole('listitem')).toHaveCount(2);
  await expect(desk.getByRole('button', { name: '上传并执行技能' })).toBeDisabled();
  await composer.getByRole('button', { name: '准备演示输入（尚不上传）' }).click();
  await expect(composer.getByRole('status')).toContainText('需求与材料已准备'); expect(posted).toBeUndefined();
  await desk.getByRole('checkbox', { name: /我同意上传材料/ }).check();
  await desk.getByRole('button', { name: '上传并执行技能' }).click(); expect(posted).toBeUndefined(); // required external consent still empty
  await desk.getByLabel('本次演示正文处理授权').selectOption('yes'); await desk.getByRole('button', { name: '上传并执行技能' }).click();
  await expect(desk.getByRole('alert')).toContainText('UI fixture intercepted');
  expect(posted).toBeDefined(); const form = posted!.form;
  expect(form.get('skillId')).toBe('slides.create'); expect(form.get('expertId')).toBe('slides'); expect(form.get('consent')).toBe('true'); expect(JSON.parse(String(form.get('parameters')))).toEqual({ externalConsent: 'yes' });
  const file = form.get('file') as File; const envelope = JSON.parse(await file.text()); expect(envelope.brief.scenario).toBe('data-analysis'); expect(envelope.brief.theme).toBe('technology'); expect(envelope.brief.slideCount).toBe(8); expect(envelope.brief.layoutStyle).toBe('adaptive');
  expect(envelope.files.map((f: { name: string }) => f.name)).toEqual(['facts.md', 'observations.csv']); expect(Buffer.from(envelope.files[1].base64, 'base64').toString()).toContain('七月,120');
});
test('changing a prepared brief revokes upload agreement; file/count/size errors do not prepare stale input', async ({ page }) => {
  const composer = await openComposer(page), desk = workbench(page);
  await composer.getByLabel('演示目标').fill('核对材料再汇报'); await composer.getByLabel('选择多份来源材料').setInputFiles(sources);
  await composer.getByRole('button', { name: '准备演示输入（尚不上传）' }).click(); await expect(composer.getByRole('status')).toContainText('需求与材料已准备');
  await desk.getByRole('checkbox', { name: /我同意上传材料/ }).check(); await desk.getByLabel('本次演示正文处理授权').selectOption('yes'); await composer.getByLabel('受众与决策背景').fill('试点评审委员会');
  await expect(desk.getByLabel('本次演示正文处理授权')).toHaveValue('');
  await expect(desk.getByRole('checkbox', { name: /我同意上传材料/ })).not.toBeChecked(); await expect(desk.getByRole('button', { name: '上传并执行技能' })).toBeDisabled();
  await composer.getByLabel('页数（8–25）').fill('7'); await composer.getByRole('button', { name: '准备演示输入（尚不上传）' }).click(); await expect(composer.getByRole('alert')).toContainText('8–25');
  await composer.getByLabel('页数（8–25）').fill('8'); await composer.getByLabel('选择多份来源材料').setInputFiles({ name: 'large.md', mimeType: 'text/markdown', buffer: Buffer.alloc(2_000_001, 65) });
  await composer.getByRole('button', { name: '准备演示输入（尚不上传）' }).click(); await expect(composer.getByRole('alert')).toContainText('每份≤2MB'); await expect(desk.getByRole('button', { name: '上传并执行技能' })).toBeDisabled();
});
test('commercial input remains usable at mobile width without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const composer = await openComposer(page);
  await composer.getByLabel('演示目标').fill('移动端准备经营汇报'); await composer.getByLabel('选择多份来源材料').setInputFiles(sources);
  await composer.getByRole('button', { name: '准备演示输入（尚不上传）' }).click(); await expect(composer.getByRole('status')).toContainText('需求与材料已准备');
  const box = await composer.boundingBox(); expect(box!.width).toBeLessThanOrEqual(390);
  expect(await composer.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
});

test('classic output remains an explicit selectable path, and changing layout revokes prepared input and consents',async({page})=>{
 const composer=await openComposer(page),desk=workbench(page);
 await composer.getByLabel('演示目标').fill('核对证据后再生成');await composer.getByLabel('选择多份来源材料').setInputFiles(sources);
 await composer.getByRole('button',{name:'准备演示输入（尚不上传）'}).click();
 await desk.getByRole('checkbox',{name:/我同意上传材料/}).check();await desk.getByLabel('本次演示正文处理授权').selectOption('yes');
 await composer.getByLabel('输出排版').selectOption('classic');
 await expect(desk.getByRole('checkbox',{name:/我同意上传材料/})).not.toBeChecked();await expect(desk.getByLabel('本次演示正文处理授权')).toHaveValue('');
 await expect(desk.getByRole('button',{name:'上传并执行技能'})).toBeDisabled();await expect(composer.getByLabel('输出排版')).toHaveValue('classic');
});

test('visual assets require per-file rights, carry real bytes and metadata, and every edit revokes both consents',async({page})=>{
 let envelope:any;
 await page.route('**/api/skill-runs?kind=presentation',async route=>{const r=route.request(),form=await new Request(r.url(),{method:'POST',headers:{'content-type':r.headers()['content-type']},body:r.postDataBuffer()!}).formData();envelope=JSON.parse(await(form.get('file') as File).text());await route.fulfill({status:400,json:{error:'M2 UI fixture intercepted; no actual model call'}});});
 const composer=await openComposer(page),desk=workbench(page);
 await composer.getByLabel('演示目标').fill('测试截图元数据与授权，禁止从图内推断数字');await composer.getByLabel('选择多份来源材料').setInputFiles(sources);
 await composer.getByLabel('视觉艺术方向').selectOption('technology-launch');
 await expect(composer.getByLabel('统一主题')).toBeDisabled();
 await composer.getByLabel('添加视觉素材').setInputFiles({name:'concept.jpg',mimeType:'image/jpeg',buffer:await (await import('node:fs/promises')).readFile('../../assets/presentation-visuals/concept-hero.jpg')});
 const a=composer.getByRole('group',{name:'素材 concept.jpg'});
 await a.getByLabel('素材角色').selectOption('screenshot');await expect(a.getByLabel('素材用途')).toHaveValue('evidence');await expect(a.getByLabel('素材用途')).toBeDisabled();
 await a.getByLabel('图片说明 / 无障碍文字').fill('UI夹具图像，非真实业务截图');await a.getByLabel('素材来源（仅记录，不抓取）').fill('本地测试文件');await a.getByLabel('使用许可 / 授权范围').fill('仅本次UI测试；不作为事实证据');
 await composer.getByRole('button',{name:'准备演示输入（尚不上传）'}).click();await expect(composer.getByRole('alert')).toContainText('确认本次使用权限');expect(envelope).toBeUndefined();
 await a.getByRole('checkbox').check();await composer.getByRole('button',{name:'准备演示输入（尚不上传）'}).click();await expect(composer.getByRole('status')).toContainText('需求与材料已准备');
 await desk.getByRole('checkbox',{name:/我同意上传材料/}).check();await desk.getByLabel('本次演示正文处理授权').selectOption('yes');await a.getByLabel('图片说明 / 无障碍文字').fill('更新元数据，必须重新授权');
 await expect(desk.getByRole('checkbox',{name:/我同意上传材料/})).not.toBeChecked();await expect(desk.getByLabel('本次演示正文处理授权')).toHaveValue('');await expect(desk.getByRole('button',{name:'上传并执行技能'})).toBeDisabled();
 await composer.getByRole('button',{name:'准备演示输入（尚不上传）'}).click();await desk.getByRole('checkbox',{name:/我同意上传材料/}).check();await desk.getByLabel('本次演示正文处理授权').selectOption('yes');await desk.getByRole('button',{name:'上传并执行技能'}).click();await expect(desk.getByRole('alert')).toContainText('M2 UI fixture');
 expect(envelope.brief.visualStyle).toBe('technology-launch');expect(envelope.assets).toHaveLength(1);expect(envelope.assets[0]).toMatchObject({role:'screenshot',usage:'evidence',permissionConfirmed:true,alt:'更新元数据，必须重新授权'});expect(Buffer.from(envelope.assets[0].base64,'base64').length).toBeGreaterThan(1000);
});
test('classic removes optional visuals without changing source documents; visual editing fits mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});const composer=await openComposer(page);
 await composer.getByLabel('演示目标').fill('视觉准备不越界');await composer.getByLabel('选择多份来源材料').setInputFiles(sources);await composer.getByLabel('视觉艺术方向').selectOption('brand-editorial');
 await composer.getByLabel('添加视觉素材').setInputFiles({name:'local.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')});
 await expect(composer.getByRole('group',{name:'素材 local.png'})).toBeVisible();expect(await composer.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
 await composer.getByLabel('输出排版').selectOption('classic');await expect(composer.getByLabel('视觉艺术方向')).toHaveCount(0);await expect(composer.getByRole('list',{name:'演示来源清单'}).getByRole('listitem')).toHaveCount(2);await composer.getByLabel('输出排版').selectOption('adaptive');await expect(composer.getByLabel('视觉艺术方向')).toHaveValue('');await expect(composer.getByRole('group',{name:'素材 local.png'})).toHaveCount(0);
});

test('director selection discloses bounded extra calls, is encoded locally and revokes both consents on every change',async({page})=>{
 let envelope:any;
 await page.route('**/api/skill-runs?kind=presentation',async route=>{const r=route.request(),form=await new Request(r.url(),{method:'POST',headers:{'content-type':r.headers()['content-type']},body:r.postDataBuffer()!}).formData();envelope=JSON.parse(await(form.get('file') as File).text());await route.fulfill({status:400,json:{error:'Director UI fixture intercepted; no actual model execution'}});});
 const composer=await openComposer(page),desk=workbench(page);await composer.getByLabel('演示目标').fill('先规划决策、证据与节奏，再写内容');await composer.getByLabel('选择多份来源材料').setInputFiles(sources);await composer.getByLabel('内容导演',{exact:true}).selectOption('directed');await expect(composer.getByRole('region',{name:'内容导演设置'})).toContainText('最多4次调用');
 await composer.getByRole('button',{name:'准备演示输入（尚不上传）'}).click();await desk.getByRole('checkbox',{name:/我同意上传材料/}).check();await desk.getByLabel('本次演示正文处理授权').selectOption('yes');await composer.getByLabel('内容导演',{exact:true}).selectOption('');await expect(desk.getByLabel('本次演示正文处理授权')).toHaveValue('');await expect(desk.getByRole('checkbox',{name:/我同意上传材料/})).not.toBeChecked();await expect(desk.getByRole('button',{name:'上传并执行技能'})).toBeDisabled();
 await composer.getByLabel('内容导演',{exact:true}).selectOption('directed');await composer.getByRole('button',{name:'准备演示输入（尚不上传）'}).click();await desk.getByRole('checkbox',{name:/我同意上传材料/}).check();await desk.getByLabel('本次演示正文处理授权').selectOption('yes');await desk.getByRole('button',{name:'上传并执行技能'}).click();await expect(desk.getByRole('alert')).toContainText('Director UI fixture');expect(envelope.brief.narrativeMode).toBe('directed');await composer.getByLabel('输出排版').selectOption('classic');await expect(composer.getByLabel('内容导演',{exact:true})).toHaveCount(0);await composer.getByLabel('输出排版').selectOption('adaptive');await expect(composer.getByLabel('内容导演',{exact:true})).toHaveValue('');
});
