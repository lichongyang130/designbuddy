const test = require('node:test');
const assert = require('node:assert/strict');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const { validateSkillOptions } = require('../../dist/local/server/skills/contracts.js');
const { runtimeSkills } = require('../../dist/local/shared/skillRuntime.js');
const csv = '渠道,收入\n线上,100\n线下,40\n线上,50\n暂停,-10\n';
const run = (source, parameters = { groupBy: '渠道', aggregation: 'sum', metric: '收入', title: '渠道报告' }) => executeSkill({ skillId: 'data.report', filename: 'data.csv', bytes: Buffer.from(source), parameters, deduplicate: false });
const get = (result, name) => Buffer.from(result.outputs.find(item => item.name === name).bytes).toString();

test('CSV report groups and aggregates actual records and exports HTML/CSV/JSON', async () => {
  const result = await run(csv);
  const report = JSON.parse(get(result, 'grouped-data-report.json'));
  assert.equal(report.sourceRows, 4); assert.equal(report.groups.length, 3);
  assert.equal(report.groups.find(x => x.group === '线上').value, 150);
  assert.equal(report.groups.find(x => x.group === '暂停').value, -10);
  assert.match(get(result, 'grouped-data-report.html'), /渠道报告/);
  assert.match(get(result, 'grouped-data-report.csv'), /线上/);
  assert.equal(runtimeSkills.find(skill => skill.id === 'data.report').status, 'ready');
});

test('CSV report supports average and count and rejects ambiguous data', async () => {
  const avg = await run(csv, { groupBy: '渠道', aggregation: 'average', metric: '收入' });
  assert.equal(JSON.parse(get(avg, 'grouped-data-report.json')).groups.find(x => x.group === '线上').value, 75);
  const count = await run('地区,类别\n北,甲\n北,乙\n南,甲\n', { groupBy: '地区', aggregation: 'count' });
  assert.equal(JSON.parse(get(count, 'grouped-data-report.json')).groups.find(x => x.group === '北').value, 2);
  await assert.rejects(() => run('cat,cat\na,1\n'), /不重复/);
  await assert.rejects(() => run('group,value\na,nope\n', { groupBy: 'group', aggregation: 'sum', metric: 'value' }), /不是严格数字/);
  await assert.rejects(() => run('group,value\n,10\n', { groupBy: 'group', aggregation: 'sum', metric: 'value' }), /分组字段为空/);
});

test('CSV report validates its execution options and escapes spreadsheet formula cells', async () => {
  assert.throws(() => validateSkillOptions('data.report', { deduplicate: false }), /请指定分组字段/);
  assert.throws(() => validateSkillOptions('data.report', { deduplicate: false, parameters: { groupBy: 'group', aggregation: 'avg', metric: 'value' } }), /报告参数不合法/);
  const result = await run('group,value\n=CMD(),5\n', { groupBy: 'group', aggregation: 'sum', metric: 'value' });
  assert.match(get(result, 'grouped-data-report.csv'), /'=CMD\(\)/);
});
