const test = require('node:test');
const assert = require('node:assert/strict');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const { runtimeSkills } = require('../../dist/local/shared/skillRuntime.js');
const sample = { employee: '新同事', role: '产品设计师', team: '产品体验组', manager: '团队负责人', startDate: '2026-11-02', tasks: [{ id: 'T3', title: '完成第一次设计评审', dayOffset: 7, owner: '设计负责人', category: '协作', details: '准备当前任务的过程与问题。' }, { id: 'T1', title: '领取设备并完成账户设置', dayOffset: 0, owner: 'IT支持', category: '设备' }] };
const run = data => executeSkill({ skillId: 'hr.onboarding', filename: 'onboarding.json', bytes: Buffer.from(JSON.stringify(data)), deduplicate: false });
const get = (result, name) => Buffer.from(result.outputs.find(item => item.name === name).bytes).toString();

test('onboarding plan computes calendar dates, sorts tasks, and exports HTML, CSV, and valid all-day ICS', async () => {
  const result = await run(sample);
  const report = JSON.parse(get(result, 'onboarding-plan.json'));
  assert.deepEqual(report.tasks.map(task => task.id), ['T1', 'T3']);
  assert.equal(report.tasks[0].dueDate, '2026-11-02');
  assert.equal(report.tasks[1].dueDate, '2026-11-09');
  assert.match(get(result, 'onboarding-plan.html'), /新同事/);
  assert.match(get(result, 'onboarding-tasks.csv'), /2026-11-09/);
  const ics = get(result, 'onboarding-calendar.ics');
  assert.match(ics, /BEGIN:VCALENDAR/); assert.match(ics, /DTSTART;VALUE=DATE:20261102/); assert.match(ics, /DTEND;VALUE=DATE:20261103/);
  for (const line of ics.trimEnd().split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, `overlong ICS line: ${line}`);
  assert.equal(runtimeSkills.find(skill => skill.id === 'hr.onboarding').status, 'ready');
});

test('onboarding plan rejects impossible dates, duplicate identifiers, and offsets beyond 90 days', async () => {
  await assert.rejects(() => run({ ...sample, startDate: '2026-02-30' }), /有效日期/);
  await assert.rejects(() => run({ ...sample, tasks: [sample.tasks[0], { ...sample.tasks[1], id: 'T3' }] }), /ID无效或重复/);
  await assert.rejects(() => run({ ...sample, tasks: [{ ...sample.tasks[0], dayOffset: 91 }] }), /0至90天/);
});
