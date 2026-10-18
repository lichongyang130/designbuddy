const { test } = require('node:test');
const assert = require('node:assert/strict');
const { executeSkill } = require('../../dist/local/server/skills/executors.js');
const { presentationRendererAvailable } = require('../../dist/local/server/skills/pptx-render.js');
const { unzipSync, zipSync, strToU8, strFromU8 } = require('fflate');

const example = {
  title: '社区活动季度简报',
  theme: {
    primary: '#294C3B', background: '#F4F1E9', surface: '#FFFFFF',
    text: '#1C2822', muted: '#66736B', accent: '#D2744C',
    headingFont: 'Microsoft YaHei', bodyFont: 'Microsoft YaHei',
  },
  slides: [
    { type: 'cover', title: '让社区活动更容易参与', subtitle: '季度项目进展与下一步' },
    { type: 'bullets', title: '本季度三项重点', body: '以下为用户提供的原始要点，未做事实核查。', bullets: ['梳理活动报名流程与关键步骤。', '完成三个社区场次的参与者访谈。', '把活动信息更新节奏纳入运营清单。'], sources: ['项目样例材料'] },
    { type: 'metrics', title: '项目进展概览', items: [{ label: '完成场次', value: '7 场' }, { label: '访谈参与者', value: '24 人' }, { label: '待跟进事项', value: '5 项' }] },
    { type: 'timeline', title: '下一步计划', items: [{ date: '11月', label: '确认流程', body: '由项目负责人核对活动报名路径。' }, { date: '12月', label: '复测体验', body: '用实际用户反馈复核信息清晰度。' }] },
    { type: 'chart', title: '各阶段完成事项', chartType: 'bar', categories: ['第一阶段', '第二阶段', '第三阶段'], series: [{ name: '完成事项', values: [3, 5, 7] }], unit: '件', sources: ['用户提供的演示样例，不代表真实业务数据'] },
    { type: 'quote', title: '项目原则', quote: '先核对信息，再改进参与体验。', attribution: '项目工作原则' },
  ],
};
const jsonBytes = strToU8(JSON.stringify(example));
const outputBytes = (result, name) => {
  const item = result.outputs.find(output => output.name === name);
  assert.ok(item, `missing ${name}`);
  return item.bytes;
};
const jsonOutput = (result, name) => JSON.parse(strFromU8(outputBytes(result, name)));

// The successful path deliberately performs a real local render; assertions never interpret that as a visual pass.
test('structured JSON builds editable PowerPoint objects, native charts, rendering evidence and extracted design tokens', async (t) => {
  if (!presentationRendererAvailable()) { t.skip('local LibreOffice Kit is not installed'); return; }
  const composed = await executeSkill({ skillId: 'slides.compose', filename: 'presentation.json', bytes: jsonBytes, deduplicate: false });
  const pptx = outputBytes(composed, 'presentation.pptx');
  const packageEntries = unzipSync(pptx);
  const slidePaths = Object.keys(packageEntries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path));
  assert.equal(slidePaths.length, example.slides.length);
  assert.match(strFromU8(packageEntries['ppt/slides/slide1.xml']), /让社区活动更容易参与/);
  assert.match(strFromU8(packageEntries['ppt/slides/slide2.xml']), /梳理活动报名流程/);
  assert.ok(packageEntries['ppt/charts/chart1.xml'], 'bar chart is stored as a native chart part');
  assert.ok(Object.keys(packageEntries).some(path => /^ppt\/embeddings\/Microsoft_Excel_Worksheet\d+\.xlsx$/i.test(path)), 'chart has a local editable workbook part');
  const render = jsonOutput(composed, 'render-report.json');
  assert.equal(render.review.automaticVisualPass, false);
  assert.equal(render.review.visualReviewRequired, true);
  if (render.status === 'rendered-locally') assert.equal(render.missingFontCount, render.missingFonts.length);
  if (presentationRendererAvailable()) {
    assert.equal(render.status, 'rendered-locally');
    assert.match(composed.summary, /本地 LibreOffice 实际渲染/);
    if (render.missingFonts?.length) assert.match(composed.summary, /缺少字体/);
    assert.ok(outputBytes(composed, 'slide-contact-sheet.jpg').length > 1000);
    const previewZip = unzipSync(outputBytes(composed, 'rendered-slides.zip'));
    assert.ok(previewZip['slides/01.jpg']);
    assert.ok(previewZip['render-manifest.json']);
  } else {
    assert.equal(render.status, 'unavailable');
    assert.match(composed.summary, /渲染未完成/);
  }

  const inspected = await executeSkill({ skillId: 'slides.inspect', filename: 'presentation.pptx', bytes: pptx, deduplicate: false });
  const analysis = jsonOutput(inspected, 'pptx-analysis.json');
  assert.equal(analysis.editableObjectEvidence.slideCount, example.slides.length);
  assert.ok(analysis.editableObjectEvidence.textShapeCount >= 10);
  assert.equal(analysis.editableObjectEvidence.chartCount, 1);
  assert.ok(analysis.editableObjectEvidence.pictureCount >= 0);
  assert.equal(analysis.requiresHumanReview, true);
  assert.ok(analysis.checks.some(check => check.id === 'text-overflow-and-overlap' && check.status === 'not-automatically-verified'));
  const tokens = jsonOutput(inspected, 'pptx-design-tokens.json');
  assert.equal(tokens.suggestedThemeForSlidesCompose.primary, '#294C3B');
  assert.equal(tokens.suggestedThemeForSlidesCompose.background, '#F4F1E9');
  assert.equal(tokens.slideSizeInches.width, 13.333);
  assert.match(strFromU8(outputBytes(inspected, 'pptx-text.md')), /完成三个社区场次/);

  const entries = unzipSync(pptx);
  const relsPath = 'ppt/_rels/presentation.xml.rels';
  const rels = strFromU8(entries[relsPath]).replace('</Relationships>', '<Relationship Id="rId999" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid" TargetMode="External"/></Relationships>');
  const hostile = zipSync({ ...entries, [relsPath]: strToU8(rels) });
  await assert.rejects(
    executeSkill({ skillId: 'slides.inspect', filename: 'hostile.pptx', bytes: hostile, deduplicate: false }),
    /外部链接|外部目标/,
  );
});

test('structured deck validation rejects unsupported content, unsafe theme fields and mismatched native chart data', async () => {
  const cases = [
    { ...example, unexpected: 'do not silently ignore unknown root properties' },
    { ...example, theme: { ...example.theme, primary: 'red' } },
    { ...example, slides: [{ type: 'chart', title: 'bad chart', chartType: 'bar', categories: ['A', 'B'], series: [{ name: 'Sales', values: [1] }] }] },
    { ...example, slides: [{ type: 'bullets', title: 'bad slide', bullets: ['only one bullet'] }] },
  ];
  for (const invalid of cases) {
    await assert.rejects(
      executeSkill({ skillId: 'slides.compose', filename: 'bad.json', bytes: strToU8(JSON.stringify(invalid)), deduplicate: false }),
    );
  }
});

