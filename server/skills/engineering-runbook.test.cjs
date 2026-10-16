const test = require('node:test');
const assert = require('node:assert/strict');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const { runtimeSkills } = require('../../dist/local/shared/skillRuntime.js');
const sample = { title: '报名服务不可用', service: '活动报名Web', severity: 'P1', impact: '部分用户可能无法打开报名页。', commander: '当班负责人', escalation: '按内部值班表联系服务负责人。', steps: [
  { id: 'S1', phase: 'detect', action: '确认错误率和受影响路由', owner: '值班工程师', success: '记录时间范围与证据。' },
  { id: 'S2', phase: 'contain', action: '评估是否暂停最近变更', owner: '服务负责人', success: '负责人批准临时措施。', rollback: '依据已批准的回退流程恢复版本。', command: 'echo \'do not run\'' },
  { id: 'S3', phase: 'recover', action: '恢复后检查核心接口', owner: '值班工程师', success: '核心接口恢复。', rollback: '如再次异常，重新升级。' },
  { id: 'S4', phase: 'verify', action: '观察错误率与反馈', owner: '观察人', success: '按组织规定的观察窗口确认稳定。' },
  { id: 'S5', phase: 'communicate', action: '整理事件状态更新', owner: '记录人', success: '发布经核实的状态。' },
], postIncident: '按组织流程安排复盘。' };
const run = data => executeSkill({ skillId: 'engineering.runbook', filename: 'runbook.json', bytes: Buffer.from(JSON.stringify(data)), deduplicate: false });
const get = (result, name) => Buffer.from(result.outputs.find(item => item.name === name).bytes).toString();

test('engineering runbook checks phase coverage and creates a real interactive offline checklist', async () => {
  const result = await run(sample);
  const report = JSON.parse(get(result, 'engineering-runbook-report.json'));
  const html = get(result, 'engineering-runbook.html');
  assert.equal(report.stepCount, 5); assert.deepEqual(report.missingPhases, []); assert.deepEqual(report.missingRollbackSteps, []);
  assert.match(html, /type="checkbox"/); assert.match(html, /addEventListener\('change',update\)/); assert.match(html, /reset/);
  assert.equal(report.execution, 'none: no commands, APIs, alerts, or production systems were invoked');
  assert.match(get(result, 'engineering-runbook.md'), /回退方案/);
  assert.equal(runtimeSkills.find(skill => skill.id === 'engineering.runbook').status, 'ready');
});

test('engineering runbook flags missing phases and rollback guidance, and escapes all supplied text', async () => {
  const result = await run({ ...sample, title: '<script>alert(1)</script>', steps: [{ id: 'S1', phase: 'contain', action: '临时控制', owner: '值班工程师', success: '记录并确认' }] });
  const report = JSON.parse(get(result, 'engineering-runbook-report.json'));
  const html = get(result, 'engineering-runbook.html');
  assert.ok(report.missingPhases.includes('detect'));
  assert.deepEqual(report.missingRollbackSteps, ['S1']);
  assert.doesNotMatch(html, /<script>alert/); assert.match(html, /&lt;script&gt;/);
});

test('engineering runbook rejects duplicate step IDs and unsupported severity values', async () => {
  await assert.rejects(() => run({ ...sample, steps: [...sample.steps, { ...sample.steps[0], action: '重复ID' }] }), /ID无效或重复/);
  await assert.rejects(() => run({ ...sample, severity: 'P5' }), /P0\/P1\/P2\/P3/);
});
