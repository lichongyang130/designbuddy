const test = require('node:test');
const assert = require('node:assert/strict');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const { runtimeSkills } = require('../../dist/local/shared/skillRuntime.js');
const sample = { subject: '新活动开放报名', preheader: '查看本月活动详情。', brand: '城市邻里计划', title: '一起发现身边的新活动', intro: '本月活动已经开放报名。', sections: [{ heading: '周末步行导览', body: '周六上午十点集合。' }, { heading: '报名须知', body: '请先查看参与说明。' }], cta: { label: '查看活动', url: 'https://example.org/events?source=email&x=1' }, footer: '此邮件模板尚未发送。', palette: { primary: '#264C3B', background: '#F4F1E9', text: '#26312B' } };
const run = (data) => executeSkill({ skillId: 'email.marketing', filename: 'email.json', bytes: Buffer.from(JSON.stringify(data)), deduplicate: false });
const get = (result, name) => Buffer.from(result.outputs.find(item => item.name === name).bytes).toString();

test('email marketing skill produces usable table-layout HTML, plain text, and a no-send report', async () => {
  const result = await run(sample);
  const html = get(result, 'marketing-email.html');
  const report = JSON.parse(get(result, 'marketing-email-report.json'));
  assert.match(html, /role="presentation"/);
  assert.match(html, /width="600"/);
  assert.match(html, /@media only screen and \(max-width:620px\)/);
  assert.match(html, /href="https:\/\/example\.org\/events\?source=email&amp;x=1"/);
  assert.match(get(result, 'marketing-email.txt'), /本月活动已经开放报名/);
  assert.equal(report.networkSent, false);
  assert.equal(report.externalResources, 'none');
  assert.equal(runtimeSkills.find(skill => skill.id === 'email.marketing').status, 'ready');
});

test('email template escapes user HTML and rejects unsafe links and invalid palettes', async () => {
  const safe = await run({ ...sample, title: '<script>alert(1)</script>' });
  const html = get(safe, 'marketing-email.html');
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  await assert.rejects(() => run({ ...sample, cta: { label: 'Click', url: 'javascript:alert(1)' } }), /https:\/\/或有效mailto/);
  await assert.rejects(() => run({ ...sample, cta: { label: 'Click', url: 'http://127.0.0.1/admin' } }), /只支持https/);
  await assert.rejects(() => run({ ...sample, palette: { ...sample.palette, primary: 'red' } }), /十六进制颜色/);
});
