const test = require('node:test');
const assert = require('node:assert/strict');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const { runtimeSkills } = require('../../dist/local/shared/skillRuntime.js');
const base = { period: '2026 Q4', organization: '体验小组', objectives: [
  { id: 'O1', title: '提升活动页体验', owner: '设计组', keyResults: [
    { id: 'KR1', title: '完成率', baseline: 0, current: 50, target: 100, unit: '%' },
    { id: 'KR2', title: '加载耗时', baseline: 10, current: 5, target: 0, unit: '秒' },
  ] },
  { id: 'O2', title: '减少出错率', keyResults: [{ id: 'KR3', title: '错误数量', baseline: 10, current: 12, target: 0 }] },
] };
const run = (data) => executeSkill({ skillId: 'team.okrs', filename: 'okrs.json', bytes: Buffer.from(JSON.stringify(data)), deduplicate: false });
const get = (result, name) => Buffer.from(result.outputs.find(item => item.name === name).bytes).toString();

test('OKR worker computes progress for increasing and decreasing measures and exports an auditable scorecard', async () => {
  const result = await run(base);
  const report = JSON.parse(get(result, 'okr-scorecard.json'));
  assert.equal(report.objectiveCount, 2); assert.equal(report.keyResultCount, 3);
  assert.equal(report.objectives[0].keyResults[0].progress, 50);
  assert.equal(report.objectives[0].keyResults[1].progress, 50);
  assert.equal(report.objectives[1].keyResults[0].progress, 0);
  assert.equal(report.objectives[1].keyResults[0].status, '回退');
  assert.equal(report.objectives[0].progress, 50);
  assert.ok(report.calculationIssues.some(issue => issue.includes('KR3')));
  assert.equal(report.overallProgressPercent, 33.33);
  assert.match(get(result, 'okr-scorecard.html'), /团队OKR记分卡/);
  assert.match(get(result, 'okr-scorecard.csv'), /KR2/);
  assert.equal(runtimeSkills.find(skill => skill.id === 'team.okrs').status, 'ready');
});

test('OKR worker rejects malformed metrics, duplicate IDs, and excessive dimensions', async () => {
  await assert.rejects(() => run({ ...base, objectives: [...base.objectives, { id: 'O1', title: '重复', keyResults: [{ id: 'KR4', title: 'x', baseline: 0, current: 1, target: 2 }] }] }), /目标ID无效或重复/);
  await assert.rejects(() => run({ ...base, objectives: [{ id: 'O1', title: 'bad metric', keyResults: [{ id: 'KR1', title: 'same', baseline: 3, current: 2, target: 3 }] }] }), /目标值不能等于基线值/);
  await assert.rejects(() => run({ ...base, unknown: 'not allowed' }), /不支持的字段/);
});
