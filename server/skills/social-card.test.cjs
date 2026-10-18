const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const { runtimeSkills } = require('../../dist/local/shared/skillRuntime.js');
const sample = { title: '让日常多一点观察', subtitle: '把细小灵感，整理成可实践的设计方法。', category: '设计笔记', brand: '林间工作室', palette: { background: '#F4F1E9', ink: '#264C3B', accent: '#C96D42' }, points: ['先观察真实使用场景', '把问题说得清晰具体', '用小步验证设计假设'] };
const run = (data) => executeSkill({ skillId: 'social.card', filename: 'card.json', bytes: Buffer.from(JSON.stringify(data)), deduplicate: false });
const get = (result, name) => Buffer.from(result.outputs.find(item => item.name === name).bytes);

test('social card actually renders the requested 3:4 raster and report', async () => {
  const result = await run(sample);
  const png = get(result, 'social-cover-card.png');
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.format, 'png'); assert.equal(metadata.width, 1080); assert.equal(metadata.height, 1440);
  const report = JSON.parse(get(result, 'social-cover-report.json'));
  assert.equal(report.ratio, '3:4'); assert.equal(report.pointCount, 3);
  assert.equal(runtimeSkills.find(skill => skill.id === 'social.card').status, 'ready');
});

test('social card rejects unsafe colors and out-of-layout copy', async () => {
  await assert.rejects(() => run({ ...sample, palette: { ...sample.palette, ink: 'red; url(https://bad.invalid)' } }), /十六进制颜色/);
  await assert.rejects(() => run({ ...sample, title: 'x'.repeat(31) }), /最多30字/);
  await assert.rejects(() => run({ ...sample, points: ['x'.repeat(43), 'ok'] }), /2至5条文字/);
});
