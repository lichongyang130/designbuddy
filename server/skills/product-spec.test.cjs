const test = require('node:test');
const assert = require('node:assert/strict');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const { runtimeSkills } = require('../../dist/local/shared/skillRuntime.js');
const base = { project: '社区活动报名页', owner: '产品与设计', problem: '活动信息分散，居民难以找到报名方式。', goals: ['展示活动的时间、地点与名额。'], nonGoals: ['本期不接入支付系统。'], requirements: [{ id: 'R1', title: '展示活动信息', priority: 'must', dependsOn: [] }, { id: 'R2', title: '提供报名入口', priority: 'should', dependsOn: ['R1'] }], acceptance: [{ id: 'A1', requirementId: 'R1', check: '页面显示时间、地点、名额和主办方。' }, { id: 'A2', requirementId: 'R2', check: '报名入口指向项目方提供的链接。' }], risks: [{ id: 'K1', description: '名额信息可能变化。', mitigation: '显示更新时间和联系方式。' }], openQuestions: ['是否需要双语？'] };
const run = (data) => executeSkill({ skillId: 'product.spec', filename: 'spec.json', bytes: Buffer.from(JSON.stringify(data)), deduplicate: false });
const get = (result, name) => Buffer.from(result.outputs.find(item => item.name === name).bytes).toString();

test('product spec validates dependency graph and acceptance mapping and exports editable documents', async () => {
  const result = await run(base);
  const report = JSON.parse(get(result, 'product-spec-report.json'));
  assert.equal(report.requirementCount, 2); assert.equal(report.acceptanceCount, 2);
  assert.equal(report.coveredRequirementCount, 2); assert.deepEqual(report.uncoveredRequirements, []);
  assert.deepEqual(report.dependencyOrder, ['R1', 'R2']);
  assert.equal(report.warnings.length, 0);
  assert.match(get(result, 'product-spec.md'), /验收条件/);
  assert.match(get(result, 'product-spec.html'), /社区活动报名页/);
  assert.equal(runtimeSkills.find(skill => skill.id === 'product.spec').status, 'ready');
});

test('product spec reports coverage gaps and rejects dangling references and cycles', async () => {
  const partial = await run({ ...base, acceptance: base.acceptance.slice(0, 1) });
  const report = JSON.parse(get(partial, 'product-spec-report.json'));
  assert.deepEqual(report.uncoveredRequirements, ['R2']);
  assert.ok(report.warnings.some(w => w.includes('尚无关联验收条件')));
  await assert.rejects(() => run({ ...base, requirements: [{ ...base.requirements[0], dependsOn: ['MISSING'] }, base.requirements[1]] }), /不存在或自身/);
  await assert.rejects(() => run({ ...base, requirements: [{ ...base.requirements[0], dependsOn: ['R2'] }, base.requirements[1]] }), /依赖存在循环/);
});

test('product spec prevents malformed IDs and safely escapes untrusted text', async () => {
  const result = await run({ ...base, project: '<img src=x onerror=alert(1)>' });
  const html = get(result, 'product-spec.html');
  assert.doesNotMatch(html, /<img src=x/); assert.match(html, /&lt;img/);
  await assert.rejects(() => run({ ...base, requirements: [{ ...base.requirements[0], id: 'bad id' }] }), /ID、标题/);
});
