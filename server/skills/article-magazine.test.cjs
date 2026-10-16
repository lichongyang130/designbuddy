const test = require('node:test');
const assert = require('node:assert/strict');
const { unzipSync } = require('fflate');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const { runtimeSkills } = require('../../dist/local/shared/skillRuntime.js');
const run = (source, filename = 'story.md') => executeSkill({ skillId: 'article.magazine', filename, bytes: Buffer.from(source), deduplicate: false });

test('magazine formatter creates a real responsive standalone HTML and distributable package', async () => {
  const source = '# 城市的清晨\n\n沿着海边慢慢走，第一束光落在旧街区。\n\n## 从观察开始\n\n**设计不是装饰。**它是一种观察。\n\n> 好的细节，让人愿意停留。\n\n- 看见变化\n- 记录空间\n';
  const result = await run(source);
  const html = Buffer.from(result.outputs.find(item => item.name === 'editorial-article.html').bytes).toString();
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<title>城市的清晨<\/title>/);
  assert.match(html, /<h1>城市的清晨<\/h1>/);
  assert.match(html, /<blockquote>好的细节/);
  assert.match(html, /<ul><li>看见变化<\/li><li>记录空间<\/li><\/ul>/);
  assert.match(html, /@media\(max-width:600px\)/);
  assert.match(html, /@media print/);
  const zip = unzipSync(Buffer.from(result.outputs.find(item => item.name === 'editorial-package.zip').bytes));
  assert.ok(zip['article.html']); assert.ok(zip['article-report.json']);
  assert.equal(runtimeSkills.find(skill => skill.id === 'article.magazine').status, 'ready');
});

test('magazine formatter escapes untrusted markup and rejects oversized or empty documents', async () => {
  const result = await run('# <script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
  const html = Buffer.from(result.outputs.find(item => item.name === 'editorial-article.html').bytes).toString();
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  await assert.rejects(() => run('   '), /未发现可排版/);
  await assert.rejects(() => run('x'.repeat(40001)), /最多40000字/);
});
