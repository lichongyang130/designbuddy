const test = require('node:test');
const assert = require('node:assert/strict');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const { validateSkillOptions } = require('../../dist/local/server/skills/contracts.js');
const { runtimeSkills } = require('../../dist/local/shared/skillRuntime.js');
const params = { dateField: '日期', categoryField: '分类', typeField: '收支', amountField: '金额', incomeValue: '收入', expenseValue: '支出', currency: 'HKD', descriptionField: '备注', startDate: '2026-09-01', endDate: '2026-09-30', title: '九月财务快照' };
const csv = '日期,分类,收支,金额,备注\n2026-09-01,服务收入,收入,12500.25,第一笔\n2026-09-03,软件订阅,支出,820.50,月费\n2026-09-05,咨询收入,收入,6800.00,第二笔\n2026-10-01,其他,收入,999,不在选定月份\n';
const run = (source, parameters = params) => executeSkill({ skillId: 'finance.report', filename: 'finance.csv', bytes: Buffer.from(source), parameters, deduplicate: false });
const get = (result, name) => Buffer.from(result.outputs.find(item => item.name === name).bytes).toString();

test('financial report computes decimal totals, period filtering, margins and category breakdown', async () => {
  const result = await run(csv);
  const report = JSON.parse(get(result, 'financial-report.json'));
  assert.equal(report.sourceTransactions, 4); assert.equal(report.includedTransactions, 3); assert.equal(report.excludedTransactions, 1);
  assert.equal(report.income, '19300.25'); assert.equal(report.expenses, '820.50'); assert.equal(report.net, '18479.75');
  assert.equal(report.categoryCount, 3); assert.equal(report.currency, 'HKD');
  assert.match(get(result, 'financial-report.html'), /九月财务快照/);
  assert.match(get(result, 'financial-category-summary.csv'), /软件订阅/);
  assert.equal(runtimeSkills.find(skill => skill.id === 'finance.report').status, 'ready');
});

test('financial report enforces selected ledger semantics and rejects invalid dates and negative entries', async () => {
  await assert.rejects(() => run(csv, { ...params, expenseValue: '费用' }), /收支类型/);
  await assert.rejects(() => run('日期,分类,收支,金额,备注\n2026-02-30,A,收入,1,\n', params), /日期无效/);
  await assert.rejects(() => run('日期,分类,收支,金额,备注\n2026-09-01,A,支出,-1,\n', params), /正的十进制数/);
  await assert.rejects(() => run(csv, { ...params, currency: '' }), /缺少必填字段/);
});

test('financial report validates parameters and protects CSV formula cells', async () => {
  assert.throws(() => validateSkillOptions('finance.report', { deduplicate: false }), /指定日期/);
  const attack = '日期,分类,收支,金额,备注\n2026-09-01,"=HYPERLINK(""https://bad.invalid"")",收入,10,\n';
  const result = await run(attack, params);
  assert.match(get(result, 'financial-category-summary.csv'), /'=HYPERLINK/);
});
