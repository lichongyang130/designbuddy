const test = require('node:test');
const assert = require('node:assert/strict');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const { runtimeSkills } = require('../../dist/local/shared/skillRuntime.js');
const run = (html) => executeSkill({ skillId: 'design.review', filename: 'page.html', bytes: Buffer.from(html), deduplicate: false });
const reportFrom = (result) => JSON.parse(Buffer.from(result.outputs.find(item => item.name === 'design-review.json').bytes).toString());

test('design review runs real HTML and PostCSS static checks and reports its non-browser scope', async () => {
  const html = '<!doctype html><html><head><title>Review</title><link rel="stylesheet" href="theme.css"><style>.card{width:1440px;color:#222!important}.card{width:100vw}</style></head><body><main><h1>Title</h1><h3>Skipped level</h3><img src="cover.png"><button></button></main></body></html>';
  const result = await run(html);
  const report = reportFrom(result);
  const codes = report.findings.map(item => item.code);
  assert.ok(codes.includes('MISSING_LANG'));
  assert.ok(codes.includes('MISSING_VIEWPORT'));
  assert.ok(codes.includes('MISSING_ALT'));
  assert.ok(codes.includes('EMPTY_BUTTON'));
  assert.ok(codes.includes('LARGE_FIXED_WIDTH'));
  assert.ok(codes.includes('DUPLICATE_SELECTOR'));
  assert.ok(codes.includes('HEADING_LEVEL_SKIP'));
  assert.ok(codes.includes('EXTERNAL_STYLESHEETS_NOT_SCANNED'));
  assert.ok(report.scope.notExecuted.includes('浏览器运行与截图'));
  assert.equal(runtimeSkills.find(skill => skill.id === 'design.review').status, 'ready');
});

test('design review returns a bounded syntax error finding for malformed HTML/CSS without executing scripts', async () => {
  const result = await run('<html><head><style>.card { color: red;</style></head><body><script>throw new Error("must not run")</script></body></html>');
  const report = reportFrom(result);
  assert.equal(report.scope.executed.includes('PostCSS解析内嵌style块'), true);
  assert.ok(report.findings.some(item => item.code === 'CSS_SYNTAX'));
  assert.ok(report.scope.notExecuted.includes('浏览器运行与截图'));
});
