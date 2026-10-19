const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph } = require('docx');
const { unzipSync, strFromU8 } = require('fflate');
const { presentationFixture } = require('./presentation-fixtures.cjs');
const base = '../../dist/local/server/skills/';
const { parsePresentationRequest, readPresentationSources, sha256 } = require(base + 'presentation/sources.js');
const { compilePresentationSpec } = require(base + 'presentation/spec.js');
const { validatePresentationCheckpoint, createPresentation } = require(base + 'presentation/pipeline.js');
const { checkPresentationLayout, presentationQuality } = require(base + 'presentation/quality.js');
const { runtimeCatalog } = require(base + 'runtime-catalog.js');
const { skillPermissions } = require(base + 'skill-permissions.js');
const { validateSkillOptions } = require(base + 'contracts.js');
const { buildStructuredPresentation } = require(base + 'pptx-deck.js');
const clone = v => JSON.parse(JSON.stringify(v));
const encode = v => Buffer.from(JSON.stringify(v));
async function context(scenario, theme) { const f = presentationFixture(scenario, theme); return { ...f, sources: await readPresentationSources(f.request, sha256(f.bytes)) }; }
const readJSON = (r, name) => JSON.parse(Buffer.from(r.outputs.find(o => o.name === name).bytes));

test('presentation request whitelists scenario/theme/count, rejects unknown provider config and arbitrary files', () => {
  const f = presentationFixture(); assert.deepEqual(parsePresentationRequest(f.bytes), f.request);
  for (const mutate of [r => r.apiKey = 'not-allowed', r => r.brief.slideCount = 7, r => r.brief.theme = 'remote-url', r => r.files[0].name = '../escape.md', r => r.files[0].name = 'scan.pdf', r => r.files.push(r.files[0]), r => r.files[0].base64 = 'YQ=', r => r.files[0].base64 = 'YQ==\n']) {
    const r = clone(f.request); mutate(r); assert.throws(() => parsePresentationRequest(encode(r)));
  }
});
test('the scoped envelope really accepts five 2MB materials without regex recursion, generic body limits unchanged', () => {
  const f = presentationFixture(); f.request.files = Array.from({ length: 5 }, (_, i) => ({ name: `${i}.txt`, base64: Buffer.alloc(2_000_000, 65).toString('base64') }));
  assert.equal(parsePresentationRequest(encode(f.request)).files.length, 5);
  f.request.files[0].base64 = Buffer.alloc(2_000_001, 65).toString('base64'); assert.throws(() => parsePresentationRequest(encode(f.request)), /2 MB/);
});
test('source extraction retains exact paragraphs, records, hashes and actual values without silent truncation', async () => {
  const c = await context(); assert.equal(c.sources.blocks.length, 5); assert.equal(c.sources.datasets.length, 1);
  assert.equal(c.sources.files[1].sha256, sha256(Buffer.from(c.request.files[1].base64, 'base64')));
  assert.deepEqual(c.sources.datasets[0].rows.map(r => r.row), [2, 3, 4]); assert.equal(c.sources.datasets[0].rows[1].values[1], '150');
  const r = clone(c.request); r.files[0].base64 = Buffer.from('长'.repeat(40_001)).toString('base64'); await assert.rejects(readPresentationSources(r, sha256(encode(r))), /40000/);
});
test('DOCX source is actually read, external links/revisions are not treated as trustworthy content', async () => {
  const c = await context(); const docx = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('真实正文来自DOCX'), new Paragraph('第二个段落')] }] }));
  c.request.files = [{ name: 'notes.docx', base64: docx.toString('base64') }]; const s = await readPresentationSources(c.request, sha256(encode(c.request)));
  assert.deepEqual(s.blocks.map(b => b.text), ['真实正文来自DOCX', '第二个段落']); assert.match(s.warnings.join(' '), /页眉/);
});
test('all XLSX sheets are read; hidden, merged, formula, hyperlink and oversized data sources fail closed', async () => {
  async function extract(change) { const f = presentationFixture(); const wb = new ExcelJS.Workbook(); const sheet = wb.addWorksheet('明细'); sheet.addRows([['月份', '收入'], ['七月', 120]]); if (change) change(wb, sheet); f.request.files = [{ name: 'facts.xlsx', base64: Buffer.from(await wb.xlsx.writeBuffer()).toString('base64') }]; return readPresentationSources(f.request, sha256(encode(f.request))); }
  assert.equal((await extract(wb => wb.addWorksheet('另一表').addRows([['类别', '数值'], ['甲', 3]]))).datasets.length, 2);
  for (const change of [(_, s) => s.state = 'hidden', (_, s) => s.mergeCells('A1:B1'), (_, s) => s.getCell('B2').value = { formula: '1+1', result: 2 }, (_, s) => s.getCell('B2').value = { text: 'link', hyperlink: 'https://example.com' }, (_, s) => s.getCell('A502').value = 'too many']) await assert.rejects(extract(change));
});
test('CSV reading never hides extra rows, ragged columns, duplicate headers or malformed UTF-8', async () => {
  const c = await context();
  for (const content of ['a,a\nx,y', 'a,b\nx', 'a,b\n' + 'x,1\n'.repeat(501), Buffer.from([0xff, 0xfe])]) {
    c.request.files = [{ name: 'input.csv', base64: Buffer.from(content).toString('base64') }]; await assert.rejects(readPresentationSources(c.request, sha256(encode(c.request))));
  }
});
test('plans get stable slide IDs and deterministic chart/table/metric values from original cells', async () => {
  const c = await context(); const s = compilePresentationSpec(c.proposal, c.request.brief, c.sources);
  assert.equal(s.slides[0].id, 'slide-01'); assert.equal(s.slides[7].id, 'slide-08');
  assert.deepEqual(s.slides[3].content.series[0].values, [120, 150, 180]); assert.equal(s.slides[2].content.items[0].value, '120');
  assert.equal(s.slides[4].content.rows[2][2], '100'); assert.deepEqual(s.slides[3].bindings[0].rows, [2, 3, 4]);
  assert.deepEqual(s, compilePresentationSpec(clone(c.proposal), c.request.brief, c.sources));
});
test('fabricated chart values, unknown refs, injected code, invalid bindings and fake quotations are rejected', async () => {
  const c = await context();
  for (const mutate of [p => p.slides[3].series = [{ name: 'fake', values: [999] }], p => p.slides[1].sourceRefs = ['invented-source'], p => p.slides[1].javascript = 'process.exit()', p => p.slides[3].binding.rows = [999, 1000], p => p.slides[3].binding.columns = ['月份', '虚构指标'], p => p.slides[3].sourceRefs = ['source-1-p-1'], p => p.slides[3].binding.rows = [2, 2], p => p.slides[3] = { ...p.slides[0], type: 'quote', quote: 'a fabricated quotation' }]) {
    const p = clone(c.proposal); mutate(p); assert.throws(() => compilePresentationSpec(p, c.request.brief, c.sources));
  }
});
test('chart numeric parser does not infer percentages, leading zeros or cached formula values', async () => {
  const c = await context();
  for (const number of ['12%', '01', '$120', '1e2', '1000000000001', 'NaN']) { const s = clone(c.sources); s.datasets[0].rows[0].values[1] = number; assert.throws(() => compilePresentationSpec(c.proposal, c.request.brief, s), /十进制/); }
});
test('checkpoint rejects wrong source hash, version, OCR-shaped data and oversized/mutated metadata', async () => {
  const c = await context(); const cp = { kind: 'presentation', schemaVersion: 1, inputHash: sha256(c.bytes), stage: 'planned', spec: c.proposal };
  assert.equal(validatePresentationCheckpoint(cp, sha256(c.bytes)).kind, 'presentation');
  for (const patch of [{ inputHash: 'f'.repeat(64) }, { schemaVersion: 2 }, { stage: 'rendered' }, { png: new Uint8Array(8) }, { apiKey: 'forbidden' }, { plannerModel: 'x'.repeat(201) }]) assert.throws(() => validatePresentationCheckpoint({ ...cp, ...patch }, sha256(c.bytes)));
});
test('quality gate detects bounds, density, missing glyphs, overlaps and failed/missing-font render evidence', async () => {
  const box = { slideId: 'slide-01', elementId: 'title', text: '测试', x: 1, y: 1, w: 3, h: 1, fontSize: 20, fontFace: 'Noto Sans SC', role: 'text' };
  assert.deepEqual(checkPresentationLayout([box]), []);
  assert.ok(checkPresentationLayout([{ ...box, x: 13 }]).some(i => i.code === 'OUT_OF_BOUNDS'));
  assert.ok(checkPresentationLayout([{ ...box, w: 1, h: 0.2, text: '内容'.repeat(100) }]).some(i => i.code === 'TEXT_DENSITY'));
  assert.ok(checkPresentationLayout([{ ...box, text: '\u{10FFFF}' }]).some(i => i.code === 'MISSING_GLYPH'));
  assert.ok(checkPresentationLayout([box, { ...box, elementId: 'other' }]).some(i => i.code === 'TEXT_INTERSECTION'));
  const c = await context(), spec = compilePresentationSpec(c.proposal, c.request.brief, c.sources);
  const bad = presentationQuality(spec, c.sources, [], { report: { pageCount: 8, missingFontCount: 1 } }, { pageCount: 7 });
  assert.equal(bad.releaseStatus, 'blocked'); assert.equal(bad.commercialApproval, false);
  const clean = presentationQuality(spec, c.sources, [], { report: { pageCount: 8, missingFontCount: 0 } }, { pageCount: 8, missingFonts: [] });
  assert.equal(clean.releaseStatus, 'needs-human-review'); assert.equal(clean.commercialApproval, false);
});
test('new permission and option contracts require both subprocess and per-run external-AI consent', () => {
  assert.deepEqual(skillPermissions('slides.create'), ['local.read', 'local.write', 'subprocess', 'external.ai']);
  assert.throws(() => validateSkillOptions('slides.create', { deduplicate: false }));
  assert.throws(() => validateSkillOptions('slides.create', { deduplicate: false, parameters: { externalConsent: 'yes', endpoint: 'http://localhost' } }));
  assert.deepEqual(validateSkillOptions('slides.create', { deduplicate: false, parameters: { externalConsent: 'yes' } }).parameters, { externalConsent: 'yes' });
});
test('unconfigured model is visibly unavailable and direct execution never falls back to embedded credentials/templates', async () => {
  const saved = [process.env.AI_API_KEY, process.env.OPENAI_API_KEY]; delete process.env.AI_API_KEY; delete process.env.OPENAI_API_KEY;
  try { assert.equal(runtimeCatalog().find(s => s.id === 'slides.create').status, 'unavailable'); const c = await context(); await assert.rejects(createPresentation({ bytes: c.bytes, owner: 'test', parameters: { externalConsent: 'yes' } }, () => {}), /未配置/); }
  finally { saved.forEach((v, i) => { const key = ['AI_API_KEY', 'OPENAI_API_KEY'][i]; if (v === undefined) delete process.env[key]; else process.env[key] = v; }); }
});
test('no owner/no explicit consent never invokes a planner', async () => {
  const c = await context(); for (const input of [{ bytes: c.bytes, owner: 'test' }, { bytes: c.bytes, parameters: { externalConsent: 'yes' } }]) await assert.rejects(createPresentation(input, () => {}), /授权/);
});
test('compiler emits native editable tables/charts and captures fixed-font layout instead of shrinking', async () => {
  const c = await context(); const s = compilePresentationSpec(c.proposal, c.request.brief, c.sources);
  const b = await buildStructuredPresentation(encode({ title: s.title, theme: { ...s.theme, headingFont: 'Noto Sans SC', bodyFont: 'Noto Sans SC' }, slides: s.slides.map(v => v.content) }), { strictLayout: true, contentOrigin: 'ai-planned' });
  const z = unzipSync(b.pptxBytes); assert.match(strFromU8(z['ppt/slides/slide5.xml']), /<a:tbl>/); assert.ok(z['ppt/charts/chart1.xml']); assert.ok(z['ppt/notesSlides/notesSlide1.xml']);
  assert.equal(Object.keys(z).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p)).length, 8);
  assert.ok(!strFromU8(z['ppt/slides/slide2.xml']).includes('<a:normAutofit')); assert.equal(b.layout.filter(e => e.role === 'table-cell').length, 12);
  assert.deepEqual(checkPresentationLayout(b.layout), []);
  assert.match(Buffer.from(b.outputs.find(o => o.name === 'source-slides.json').bytes).toString(), /AI-planned/);
});

test('native chart precision and label formatting preserve decimals instead of silently rounding to integers', async () => {
  const c = await context(); const sources = clone(c.sources); sources.datasets[0].rows[0].values[1] = '120.25';
  const spec = compilePresentationSpec(c.proposal, c.request.brief, sources); assert.equal(spec.slides[3].content.series[0].values[0], 120.25);
  const b = await buildStructuredPresentation(encode({ title: spec.title, slides: [spec.slides[3].content] })); const z = unzipSync(b.pptxBytes); assert.match(strFromU8(z[Object.keys(z).find(p => /^ppt\/charts\/chart\d+\.xml$/.test(p))]), /0\.############/);
  sources.datasets[0].rows[0].values[1] = '999999999999.123456789012'; assert.throws(() => compilePresentationSpec(c.proposal, c.request.brief, sources), /精度|有效数字/);
});
test('failed raster export remains a blocked downloadable draft with an explicit failure receipt, not a visual pass', async () => {
  const c = await context(); const renderer = require(base + 'pptx-render.js'), original = renderer.renderPresentation;
  renderer.renderPresentation = async () => { throw Error('fixture render failure'); };
  try {
    const r = await createPresentation({ bytes: c.bytes, owner: 'test', parameters: { externalConsent: 'yes' }, resumePresentation: { kind: 'presentation', schemaVersion: 1, inputHash: sha256(c.bytes), stage: 'planned', spec: c.proposal } }, () => {});
    assert.equal(readJSON(r, 'quality-report.json').releaseStatus, 'blocked'); assert.equal(readJSON(r, 'render-report.json').status, 'failed'); assert.ok(r.outputs.some(o => o.name === 'draft-presentation.pptx')); assert.ok(!r.outputs.some(o => o.name === 'draft-presentation.pdf'));
  } finally { renderer.renderPresentation = original; }
});
test('server-only provider adapter never leaks an OpenAI key to the legacy fallback and bounds provider response size', async () => {
  const ai = require('../../dist/local/server/api/ai.js'), originalFetch = global.fetch;
  const keys = ['AI_API_KEY','OPENAI_API_KEY','AI_BASE_URL','AI_MODEL','OPENAI_MODEL'], saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    keys.forEach(k => delete process.env[k]); let called = false;
    global.fetch = async () => { called = true; throw Error('must not be called'); };
    await assert.rejects(ai.requestAI({ userId: 'test', prompt: 'test', serverConfigurationOnly: true }), /not configured/); assert.equal(called, false);
    process.env.OPENAI_API_KEY = 'fixture-only-not-a-real-key';
    global.fetch = async (url, request) => { assert.equal(url, 'https://api.openai.com/v1/chat/completions'); assert.equal(JSON.parse(request.body).model, 'gpt-4o-mini'); return new Response(JSON.stringify({ model:'fixture', choices:[{message:{content:'ok'}}] }), { headers:{'content-type':'application/json'} }); };
    assert.equal((await ai.requestAI({ userId:'test', prompt:'test', serverConfigurationOnly:true })).content, 'ok');
    global.fetch = async () => new Response('x'.repeat(1_000_001)); await assert.rejects(ai.requestAI({userId:'test',prompt:'test',serverConfigurationOnly:true}), /1 MB/);
  } finally { global.fetch = originalFetch; for (const [k,v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});
