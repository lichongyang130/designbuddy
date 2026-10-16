const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { unzipSync } = require('fflate');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const { runtimeSkills } = require('../../dist/local/shared/skillRuntime.js');
const { SkillService } = require('../../dist/local/server/skills/service.js');
const get = (result, name) => { const item = result.outputs.find(output => output.name === name); assert.ok(item, `missing ${name}`); return Buffer.from(item.bytes); };
const run = (skillId, filename, value) => executeSkill({ skillId, filename, bytes: Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)), deduplicate: false });
const scaffold = {
  title: '林间工作室', description: '展示真实作品与设计服务。', language: 'zh-CN',
  theme: { primary: '#264C3B', surface: '#F4F1E9', text: '#1B211D', accent: '#C96D42' },
  navigation: [{ label: '服务', section: '服务项目' }, { label: '联系', section: '联系我们' }],
  sections: [
    { type: 'hero', eyebrow: 'DESIGN STUDIO', title: '为日常设计清晰的体验', body: '从品牌识别到数字产品界面，交付经过核对的设计文件。', button: '查看服务' },
    { type: 'features', title: '服务项目', items: [{ title: '品牌识别', body: '整理颜色与排版系统。' }, { title: '网页设计', body: '设计响应式页面。' }] },
    { type: 'contact', title: '联系我们', body: '此站点仅展示联系方式，不发送表单。', email: 'studio@example.com' },
  ],
};

test('CSS audit parses a real stylesheet and reports concrete responsive and token risks', async () => {
  const result = await run('web.css-audit', 'site.css', ':root{--gap:16px}.card{width:1600px;margin:var(--missing);color:#222!important} .card {width:100vw}');
  const report = JSON.parse(get(result, 'css-audit.json'));
  assert.equal(report.syntaxValid, true); assert.equal(report.rules, 3);
  const codes = report.findings.map(item => item.code);
  assert.ok(codes.includes('DUPLICATE_SELECTOR')); assert.ok(codes.includes('LARGE_FIXED_WIDTH'));
  assert.ok(codes.includes('VIEWPORT_WIDTH_OVERFLOW')); assert.ok(codes.includes('UNDEFINED_CUSTOM_PROPERTY'));
  const invalid = await run('web.css-audit', 'broken.css', '.card { color: red;');
  assert.equal(JSON.parse(get(invalid, 'css-audit.json')).syntaxValid, false);
});

test('design tokens are validated, exported as actual CSS, and contrast ratios are computed', async () => {
  const input = { name: '林间品牌', colors: { primary: '#264C3B', surface: '#F4F1E9', text: '#1B211D' }, spacing: { sm: '8px', md: '1rem' }, typography: { body: '16px', heading: '2rem' }, radii: { card: '12px' }, contrast: [{ label: '正文', foreground: '#1B211D', background: '#F4F1E9' }] };
  const result = await run('design.tokens', 'tokens.json', input);
  const css = get(result, 'tokens.css').toString(); assert.match(css, /--colors-primary: #264C3B/); assert.match(css, /--spacing-md: 1rem/);
  const audit = JSON.parse(get(result, 'token-audit.json')); assert.equal(audit.tokenCount, 8); assert.ok(audit.contrasts[0].ratio > 10); assert.equal(audit.contrasts[0].normalAA, true);
  await assert.rejects(() => run('design.tokens', 'tokens.json', { colors: { 'bad name': '#fff' } }), /名称格式/);
  await assert.rejects(() => run('design.tokens', 'tokens.json', { colors: { bad: 'red; background:url(https://evil.invalid)' } }), /白名单格式/);
});

test('static site scaffold produces a real ZIP with semantic responsive HTML, CSS, and working menu JS', async () => {
  const result = await run('web.scaffold', 'site.json', scaffold);
  const zip = unzipSync(get(result, 'static-site.zip'));
  for (const file of ['index.html', 'styles.css', 'app.js', 'scaffold-report.json']) assert.ok(zip[file], `missing ${file}`);
  const html = Buffer.from(zip['index.html']).toString(); const css = Buffer.from(zip['styles.css']).toString(); const js = Buffer.from(zip['app.js']).toString();
  assert.match(html, /<html lang="zh-CN">/); assert.match(html, /<main id="main">/); assert.match(html, /林间工作室/); assert.match(html, /mailto:studio@example\.com/);
  assert.match(css, /@media\(max-width:700px\)/); assert.match(css, /:focus-visible/); assert.match(js, /aria-expanded/); assert.match(js, /addEventListener/);
  assert.equal(JSON.parse(Buffer.from(zip['scaffold-report.json']).toString()).externalResources, 'none');
  await assert.rejects(() => run('web.scaffold', 'site.json', { ...scaffold, navigation: [{ label: 'Missing', section: 'Unknown section' }] }), /未匹配任何区块标题/);
  const hostile = structuredClone(scaffold); hostile.navigation = []; hostile.sections[0].title = '<script>alert(1)</script>';
  const safe = await run('web.scaffold', 'site.json', hostile); const safeHtml = get(safe, 'index.html').toString();
  assert.doesNotMatch(safeHtml, /<script>alert/); assert.match(safeHtml, /&lt;script&gt;/);
});

test('responsive web image pack transforms a real raster into bounded WebP variants', async () => {
  const pixels = Buffer.alloc(300 * 150 * 3, 90);
  const png = await sharp(pixels, { raw: { width: 300, height: 150, channels: 3 } }).png().toBuffer();
  const result = await run('image.web-pack', 'sample.png', png);
  const records = JSON.parse(get(result, 'responsive-image.json')).outputs;
  assert.equal(records.length, 3); assert.deepEqual(records.map(item => item.width), [300, 300, 300]);
  for (const item of records) { const metadata = await sharp(get(result, item.name)).metadata(); assert.equal(metadata.format, 'webp'); assert.ok(metadata.width <= 300); assert.equal(metadata.height, 150); }
});

test('social carousel renders a real set of sized PNG slides and a bounded manifest', async () => {
  const config = { title: '春季品牌故事', brand: '林间工作室', palette: { background: '#F4F1E9', primary: '#264C3B', accent: '#C96D42' }, slides: [
    { eyebrow: '品牌故事', heading: '从一片叶子开始', body: '记录灵感如何变成日常物件。' },
    { eyebrow: '设计方法', heading: '留意细小变化', body: '观察纹理、光线与季节，让每件作品都来自真实的自然细节。' },
    { eyebrow: '欢迎交流', heading: '把日常写进自然', body: '查看完整作品集，了解工作室近期项目。' },
  ] };
  const result = await run('social.carousel', 'carousel.json', config);
  const zip = unzipSync(get(result, 'social-carousel.zip'));
  assert.ok(zip['slide-01.png']); assert.ok(zip['slide-03.png']);
  const metadata = await sharp(Buffer.from(zip['slide-01.png'])).metadata();
  assert.equal(metadata.format, 'png'); assert.equal(metadata.width, 1080); assert.equal(metadata.height, 1350);
  const manifest = JSON.parse(Buffer.from(zip['carousel-report.json']).toString());
  assert.equal(manifest.pageCount, 3); assert.deepEqual(manifest.pages.map(page => page.file), ['slide-01.png', 'slide-02.png', 'slide-03.png']);
  await assert.rejects(() => run('social.carousel', 'carousel.json', { ...config, slides: config.slides.slice(0, 2) }), /3至10页/);
  await assert.rejects(() => run('social.carousel', 'carousel.json', { ...config, palette: { ...config.palette, primary: 'red' } }), /十六进制颜色/);
});

test('new front-end and design tools are registered as ready and execute through the real owner-scoped worker', async () => {
  const ids = ['design.tokens', 'web.scaffold', 'web.css-audit', 'image.web-pack', 'social.carousel'];
  for (const id of ids) assert.equal(runtimeSkills.find(skill => skill.id === id)?.status, 'ready');
  const service = new SkillService(':memory:');
  try {
    const form = new FormData(); form.set('skillId', 'web.scaffold'); form.set('expertId', 'web-design');
    form.set('file', new File([JSON.stringify(scaffold)], 'site.json', { type: 'application/json' })); form.set('consent', 'true'); form.set('deduplicate', 'false');
    const response = await service.handle(new Request('http://local/api/skill-runs', { method: 'POST', body: form }), 'design-owner');
    assert.equal(response.status, 202); const queued = await response.json(); let record;
    for (let i = 0; i < 500; i++) { record = await (await service.handle(new Request(`http://local/api/skill-runs/${queued.id}`), 'design-owner')).json(); if (!['queued', 'running'].includes(record.status)) break; await new Promise(resolve => setTimeout(resolve, 20)); }
    assert.equal(record.status, 'succeeded', record.error); assert.ok(record.artifacts.some(item => item.name === 'static-site.zip'));
    assert.equal((await service.handle(new Request(`http://local/api/skill-runs/${queued.id}`), 'other-owner')).status, 404);
  } finally { service.close(); }
});
