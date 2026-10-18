const test = require('node:test');
const assert = require('node:assert/strict');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const { runtimeSkills } = require('../../dist/local/shared/skillRuntime.js');
const base = { project: '社区活动报名体验', audience: '首次访问网站的居民。', problem: '活动信息分散，报名步骤不清楚。', objective: '帮助居民快速找到报名方式。', scope: { include: ['活动列表页'], exclude: ['支付系统'] }, deliverables: ['响应式页面原型', '交付说明'], constraints: ['优先适配手机'], successMetrics: ['居民可以找到活动时间与报名方式'] };
const run = (data) => executeSkill({ skillId: 'design.brief', filename: 'brief.json', bytes: Buffer.from(JSON.stringify(data)), deduplicate: false });
const get = (result, name) => Buffer.from(result.outputs.find(item => item.name === name).bytes).toString();

test('design brief validates declared fields and produces editable Markdown, HTML, and a completeness report', async () => {
  const result = await run(base);
  const markdown = get(result, 'design-brief.md'); const html = get(result, 'design-brief.html'); const report = JSON.parse(get(result, 'design-brief-report.json'));
  assert.match(markdown, /设计简报/); assert.match(markdown, /响应式页面原型/);
  assert.match(html, /<h1>社区活动报名体验<\/h1>/); assert.match(html, /<h2>成功指标<\/h2>/);
  assert.equal(report.completeness.requiredFieldsPresent, true); assert.deepEqual(report.completeness.warnings, []);
  assert.equal(runtimeSkills.find(item => item.id === 'design.brief').status, 'ready');
});

test('design brief flags missing optional scope and success details without inventing them', async () => {
  const result = await run({ project: '小项目', audience: '居民', problem: '找不到信息', objective: '快速找到', deliverables: ['页面'] });
  const report = JSON.parse(get(result, 'design-brief-report.json'));
  const html = get(result, 'design-brief.html');
  assert.ok(report.completeness.warnings.length >= 4);
  assert.match(html, /待补充信息/);
  assert.match(html, /工作范围/);
  assert.match(html, /待确认/);
});

test('design brief rejects invalid structures and safely escapes user content', async () => {
  const result = await run({ ...base, project: '<script>alert(1)</script>' });
  const html = get(result, 'design-brief.html');
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  await assert.rejects(() => run({ ...base, unknown: true }), /不支持的字段/);
  await assert.rejects(() => run({ ...base, deliverables: [] }), /deliverables 必须包含1至20条/);
});
