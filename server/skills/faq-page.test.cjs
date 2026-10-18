const test = require('node:test');
const assert = require('node:assert/strict');
const { unzipSync } = require('fflate');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const { runtimeSkills } = require('../../dist/local/shared/skillRuntime.js');
const sample = { title: '报名帮助中心', intro: '活动与报名相关的常见问题。', brand: '社区活动', theme: { primary: '#28634D', surface: '#F2F5F1', text: '#24352D' }, faqs: [{ category: '报名', question: '如何报名活动？', answer: '打开活动详情页并点击报名入口。' }, { category: '参与', question: '报名后如何取消？', answer: '请根据活动说明联系主办方处理。' }] };
const run = data => executeSkill({ skillId: 'faq.page', filename: 'faq.json', bytes: Buffer.from(JSON.stringify(data)), deduplicate: false });
const get = (result, name) => Buffer.from(result.outputs.find(item => item.name === name).bytes).toString();

test('FAQ skill creates a functional searchable and category-filtered static page package', async () => {
  const result = await run(sample);
  const html = get(result, 'faq-page.html');
  assert.match(html, /<details class="faq"/);
  assert.match(html, /id="search" type="search"/);
  assert.match(html, /id="category"/);
  assert.match(html, /addEventListener\('input',update\)/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /\.sr-only/);
  const zip = unzipSync(Buffer.from(result.outputs.find(item => item.name === 'faq-page-package.zip').bytes));
  assert.ok(zip['faq.html']); assert.ok(zip['faq-report.json']);
  const report = JSON.parse(get(result, 'faq-page-report.json'));
  assert.equal(report.questionCount, 2); assert.deepEqual(new Set(report.categories), new Set(['参与', '报名']));
  assert.equal(report.networkResources, 'none');
  assert.equal(runtimeSkills.find(item => item.id === 'faq.page').status, 'ready');
});

test('FAQ skill escapes all user content and rejects duplicate or invalid content', async () => {
  const result = await run({ ...sample, faqs: [{ category: 'x', question: '<script>alert(1)</script>', answer: '<img src=x onerror=alert(2)>' }] });
  const html = get(result, 'faq-page.html');
  assert.doesNotMatch(html, /<script>alert/); assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  await assert.rejects(() => run({ ...sample, faqs: [...sample.faqs, { ...sample.faqs[0], question: '如何报名活动？' }] }), /问题重复/);
  await assert.rejects(() => run({ ...sample, theme: { ...sample.theme, primary: 'red' } }), /十六进制颜色/);
});
