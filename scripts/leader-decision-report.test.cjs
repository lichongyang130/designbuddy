const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { unzipSync, strFromU8 } = require('fflate');
const { PDFDocument } = require('pdf-lib');
const dir = path.resolve(__dirname, '../apps/web/public/presentation-examples/leader-decision');
const read = p => fs.readFileSync(path.join(dir,p));
const json = p => JSON.parse(read(p));
const hash = b => createHash('sha256').update(b).digest('hex');
const { parsePresentationRequest, readPresentationSources } = require('../dist/local/server/skills/presentation/sources.js');
const { compilePresentationSpec } = require('../dist/local/server/skills/presentation/spec.js');

test('the built-in report has 12 substantive source-bound pages, explicit epistemic labels and 15-minute notes', async () => {
  const report = json('report.json');
  assert.equal(report.pages.length,12); assert.equal(report.pages.reduce((n,p) => n+p.suggestedSeconds,0),900);
  assert.equal(report.externalProviderCalls,0); assert.match(report.planningOrigin,/assistant-authored/);
  assert.deepEqual(report.qualitySummary, { releaseStatus: 'needs-human-review', commercialApproval: false, criticalIssues: 0 });
  for (const page of report.pages) {
    assert.ok(['事实','分析','建议'].includes(page.classification));
    assert.match(page.content.subtitle, new RegExp(`【${page.classification}】`));
    assert.ok(page.content.speakerNotes.length > 150); assert.match(page.content.speakerNotes,/仓库依据/);
    assert.ok(page.chartSuggestion.length > 10);
    for (const id of page.sourceRefs) assert.ok(report.sourceCatalog.some(s => s.id === id));
    assert.ok(read(page.preview).length > 1000);
  }
  const request = parsePresentationRequest(read('input-request.json'));
  assert.equal(request.files.length,4);
  const sources = await readPresentationSources(request,hash(read('input-request.json')));
  const authored = json('authoring-plan.json');
  const map = Object.fromEntries(report.sourceCatalog.map(s => [s.id,s.resolvedRef]));
  const slides = JSON.parse(JSON.stringify(authored.pages.map(p => p.content)));
  for (const p of slides) {
    p.sourceRefs = p.sourceRefs.map(r => map[r]);
    if (p.binding) p.binding.datasetId = map[p.binding.datasetId];
    for (const i of p.items || []) if(i.binding) i.binding.datasetId = map[i.binding.datasetId];
  }
  const spec = compilePresentationSpec({ title: '复验',storyline: '证据到建议',missingInformation:authored.missingInformation,slides },request.brief,sources);
  assert.equal(spec.slides.length,12);
  assert.deepEqual(spec.slides[4].content.series[0].values,[19,4]);
  assert.deepEqual(spec.slides[2].content.items.map(i => i.value),['240','25','4']);
});


test('PPTX uses native chart/table/text and every page includes speaker notes with repository positions', () => {
  const deck = unzipSync(read('leader-decision.pptx'));
  assert.equal(Object.keys(deck).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length,12);
  assert.equal(Object.keys(deck).filter(n => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).length,12);
  assert.match(strFromU8(deck['ppt/slides/slide5.xml']),/<c:chart/);
  for (const n of [6,8,9]) assert.match(strFromU8(deck[`ppt/slides/slide${n}.xml`]),/<a:tbl>/);
  for (let n=1;n<=12;n++) {
    assert.match(strFromU8(deck[`ppt/slides/slide${n}.xml`]),/<a:t>/);
    assert.doesNotMatch(strFromU8(deck[`ppt/slides/slide${n}.xml`]),/<p:pic>/);
    assert.match(strFromU8(deck[`ppt/notesSlides/notesSlide${n}.xml`]),/仓库依据/);
  }
});

test('the actual PDF has 12 readable Chinese pages, with matching raster evidence and draft quality boundary', async () => {
  assert.equal((await PDFDocument.load(read('leader-decision.pdf'))).getPageCount(),12);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading = pdfjs.getDocument({ data: new Uint8Array(read('leader-decision.pdf')),useSystemFonts:false,isEvalSupported:false });
  const doc = await loading.promise;
  try { for(let i=1;i<=12;i++) { const page = await doc.getPage(i); const txt = (await page.getTextContent()).items.map(i => i.str || '').join(''); assert.match(txt,/[\u4e00-\u9fff]/); assert.ok(txt.length > 40); } } finally { await loading.destroy(); }
  assert.equal(json('render-report.json').pageCount,12);
  assert.deepEqual(json('render-report.json').missingFonts,[]);
  assert.equal(json('quality-report.json').commercialApproval,false);
});

test('manifest hashes match both delivered assets and the complete reusable evidence archive', () => {
  const manifest = json('manifest.json'), archive = unzipSync(read('leader-decision-package.zip'));
  assert.equal(json('quality-report.json').staleSourcePaths.length,0);
  for (const f of manifest.files) { assert.equal(hash(read(f.name)),f.sha256,f.name); assert.equal(hash(archive[f.name]),f.sha256,`zip:${f.name}`); }
  assert.equal(strFromU8(archive['manifest.json']),read('manifest.json').toString());
  assert.ok(archive['materials/analysis-tables.xlsx']);
});

test('V2 comparison preserves V1 content, source bindings and page order and does not masquerade as live planning',()=>{
 const v1=json('presentation-spec.json'),v2=json('adaptive/presentation-spec.json'),comparison=json('adaptive/comparison.json');
 assert.deepEqual(v2.spec.slides.map(s=>s.content),v1.spec.slides.map(s=>s.content));
 assert.deepEqual(v2.spec.slides.map(s=>s.bindings),v1.spec.slides.map(s=>s.bindings));
 assert.deepEqual(v2.spec.slides.map(s=>s.sourceRefs),v1.spec.slides.map(s=>s.sourceRefs));
 assert.equal(v2.externalProviderCalls,0);assert.equal(comparison.sameContent,true);assert.equal(comparison.commercialApproval,false);
 assert.deepEqual(json('report-v2.json'),json('adaptive/report.json'));
});
test('V2 manifest and packaged native files are independently verifiable',()=>{
 const m=json('adaptive/manifest.json'),archive=unzipSync(read('adaptive/leader-decision-package.zip'));
 for(const f of m.files){assert.equal(hash(read(`adaptive/${f.name}`)),f.sha256,f.name);assert.equal(hash(archive[f.name]),f.sha256,`v2zip:${f.name}`);}
 assert.equal(json('adaptive/quality-report.json').releaseStatus,'needs-human-review');assert.equal(json('adaptive/quality-report.json').issues.filter(i=>i.severity==='critical').length,0);
 const geometry=json('adaptive/resolved-layout.json');
 const {checkPresentationLayout,checkPresentationObjects}=require('../dist/local/server/skills/presentation/quality.js');
 assert.deepEqual(checkPresentationLayout(geometry.textElements),[]);assert.deepEqual(checkPresentationObjects(geometry.objects),[]);
 const zip=unzipSync(read('adaptive/leader-decision.pptx'));assert.match(strFromU8(zip['ppt/slides/slide5.xml']),/<c:chart/);for(const n of [6,8,9])assert.match(strFromU8(zip[`ppt/slides/slide${n}.xml`]),/<a:tbl>/);
});
test('all substantive original strings remain extractable from the actual V2 PDF, including all table rows',async()=>{
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=pdfjs.getDocument({data:new Uint8Array(read('adaptive/leader-decision.pdf')),useSystemFonts:false,isEvalSupported:false});
 const doc=await loading.promise,strip=s=>s.replace(/\s/g,'');
 assert.equal(doc.numPages,12);
 try{for(const [index,s]of json('presentation-spec.json').spec.slides.entries()){
  const text=strip((await(await doc.getPage(index+1)).getTextContent()).items.map(i=>i.str||'').join(''));
  const c=s.content;const expected=[c.title,c.subtitle,c.body,...(c.bullets||[]),...(c.columns||[]).flatMap(v=>[v.heading,...v.bullets]),...(c.items||[]).flatMap(v=>[v.label,v.value,v.note,v.body]),...(c.headers||[]),...(c.rows||[]).flat()].filter(Boolean);
  for(const value of expected)assert.ok(text.includes(strip(value)),`第${index+1}页缺少正文：${value}`);
 }}finally{await loading.destroy();}
});
