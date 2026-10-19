const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { mkdtempSync, rmSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { PDFDocument } = require('pdf-lib');
const ExcelJS = require('exceljs');
const { unzipSync, strFromU8 } = require('fflate');
const { presentationFixture } = require('./presentation-fixtures.cjs');
const { createPresentation } = require('../../dist/local/server/skills/presentation/pipeline.js');
const { SkillService } = require('../../dist/local/server/skills/service.js');
const { sha256 } = require('../../dist/local/server/skills/presentation/sources.js');
let server, calls = 0, mode = 'normal'; const saved = {};
before(async () => {
  for (const key of ['AI_API_KEY', 'OPENAI_API_KEY', 'AI_BASE_URL', 'AI_MODEL']) saved[key] = process.env[key];
  server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    calls++; if (mode === 'provider-error') { res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({error:{message:'fixture provider unavailable'}})); return; } const body = JSON.parse(raw), user = body.messages.find(m => m.role === 'user').content;
    assert.match(user, /source-2-table-1/); assert.match(user, /月份/); // actual authorized content, not metadata-only routing
    const payload = JSON.parse(user.split('\nThe previous proposal')[0]);
    const fixture = presentationFixture(payload.brief.scenario, payload.brief.theme);
    let proposal = fixture.proposal;
    if (payload.brief.slideCount > 8) { const templates = proposal.slides.slice(1); proposal.slides = [proposal.slides[0], ...Array.from({length:payload.brief.slideCount - 1}, (_,i) => JSON.parse(JSON.stringify(templates[i % templates.length])))]; }
    if (mode === 'invalid' || (mode === 'retry-once' && !user.includes('previous proposal'))) proposal = { title: 'bad', slides: [] };
    if (mode === 'slow') await new Promise(r => setTimeout(r, 300));
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ model: 'fixture-planner-not-a-production-model', choices: [{ message: { content: JSON.stringify(proposal) } }], usage: { prompt_tokens: 123, completion_tokens: 456, total_tokens: 579 } }));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  process.env.AI_API_KEY = 'fixture-only-not-a-production-credential'; process.env.AI_BASE_URL = `http://127.0.0.1:${server.address().port}/v1`; process.env.AI_MODEL = 'fixture-planner';
});
after(async () => { await new Promise(r => server.close(r)); for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
const output = (r, name) => { const o = r.outputs.find(o => o.name === name); assert.ok(o, name); return o.bytes; };
const json = (r, name) => JSON.parse(Buffer.from(output(r, name)));
for (const [scenario, theme] of [['business-report', 'consulting'], ['pitch-deck', 'corporate'], ['data-analysis', 'technology']]) test(`real Office pipeline: ${scenario}/${theme} -> editable PPTX, Chinese PDF, all pages and honest quality`, { timeout: 300000 }, async () => {
  mode = scenario === 'business-report' ? 'retry-once' : 'normal'; const f = presentationFixture(scenario, theme); let checkpoint;
  const r = await createPresentation({ skillId: 'slides.create', filename: 'request.json', bytes: f.bytes, owner: 'fixture-owner', parameters: { externalConsent: 'yes' }, onPresentationCheckpoint: cp => { checkpoint = cp; } }, () => {});
  assert.equal(checkpoint.inputHash, sha256(f.bytes)); assert.equal(checkpoint.stage, 'planned');
  const q = json(r, 'quality-report.json'); assert.equal(q.releaseStatus, 'needs-human-review', JSON.stringify(q.issues)); assert.equal(q.commercialApproval, false); assert.equal(q.issues.filter(i => i.severity === 'critical').length, 0);
  const render = json(r, 'render-report.json'); assert.equal(render.pageCount, 8); assert.equal(render.pdf.pageCount, 8); assert.deepEqual(render.missingFonts, []); assert.deepEqual(render.pdf.missingFonts, []); assert.equal(render.dpi, 96); assert.equal(render.pages[0].width, 960);
  const pdfBytes = output(r, 'draft-presentation.pdf'); assert.equal((await PDFDocument.load(pdfBytes)).getPageCount(), 8);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'); const loading = pdfjs.getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: false, isEvalSupported: false }); const doc = await loading.promise;
  try { const p = await doc.getPage(1), txt = await p.getTextContent(); assert.match(txt.items.map(i => i.str || '').join(''), /合成样本/); } finally { await loading.destroy(); }
  const zip = unzipSync(output(r, 'rendered-slides.zip')); assert.equal(Object.keys(zip).filter(k => /^slides\/\d+\.jpg$/.test(k)).length, 8); assert.ok(zip['font-OFL.txt']); assert.match(strFromU8(zip['REVIEW.txt']), /DRAFT/);
  const pptx = unzipSync(output(r, 'draft-presentation.pptx')); assert.match(strFromU8(pptx['ppt/slides/slide5.xml']), /<a:tbl>/); assert.match(strFromU8(pptx['ppt/slides/slide4.xml']), /<c:chart/); assert.match(strFromU8(pptx['ppt/notesSlides/notesSlide1.xml']), /来源位置/);
  const embedded = Object.keys(pptx).find(k => /ppt\/embeddings\/.*\.xlsx/.test(k)); assert.ok(embedded); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(pptx[embedded])); const values = []; wb.worksheets[0].eachRow(row => row.eachCell(cell => values.push(cell.value))); for (const n of [120, 150, 180, 80, 90, 100]) assert.ok(values.includes(n), `chart workbook missing source value ${n}`);
  const spec = json(r, 'presentation-spec.json'); assert.equal(spec.versionId, q.versionId); assert.equal(json(r, 'sources-and-notes.json').versionId, q.versionId); assert.equal(spec.editing.conversationalRevisionImplemented, false); assert.equal(spec.planner.callsThisExecution, scenario === 'business-report' ? 2 : 1); assert.equal(spec.planner.usage.length, spec.planner.callsThisExecution); assert.equal(spec.planner.usage[0].totalTokens, 579);
  assert.ok(r.outputs.length <= 9); assert.ok(r.outputs.reduce((n, o) => n + o.bytes.length, 0) < 25_000_000);
});
test('one schema repair is bounded; two bad responses produce no fake deck; provider failures do not silently retry', { timeout: 15000 }, async () => {
  const f = presentationFixture(), input = { skillId: 'slides.create', filename: 'request.json', bytes: f.bytes, owner: 'fixture-owner', parameters: { externalConsent: 'yes' } };
  mode = 'invalid'; const start = calls; await assert.rejects(createPresentation(input, () => {}), /两次均未通过/); assert.equal(calls - start, 2);
  mode = 'provider-error'; const failedStart = calls; await assert.rejects(createPresentation(input, () => {}), /503/); assert.equal(calls - failedStart, 1); mode = 'normal';
});
const req = (path, method = 'GET') => new Request(`http://local/api/skill-runs${path}`, { method });
function upload(f, key = 'presentation-request-key', opts = {}) {
  const form = new FormData(); form.set('skillId', 'slides.create'); form.set('expertId', 'slides'); form.set('file', new File([f.bytes], 'request.json')); form.set('consent', 'true'); form.set('taskId', 'ppt-business-task'); form.set('requestId', key); form.set('parameters', JSON.stringify({ externalConsent: 'yes' }));
  for (const [key, value] of Object.entries(opts)) form.set(key, value);
  return new Request('http://local/api/skill-runs?kind=presentation', { method: 'POST', body: form });
}
async function waitRun(service, id, predicate) {
  const until = Date.now() + 305000;
  while (Date.now() < until) { const run = await (await service.handle(req('/' + id), 'alice')).json(); if (predicate(run)) return run; await new Promise(r => setTimeout(r, 15)); }
  throw Error('Timed out waiting for real worker');
}
test('real worker checkpoint survives process interruption; no second AI call, atomic owner/task-scoped artifacts, quotas and deletion', { timeout: 300000 }, async t => {
  mode = 'normal'; const dir = mkdtempSync(join(tmpdir(), 'presentation-service-test-')), path = join(dir, 'runs.sqlite'); let service = new SkillService(path); t.after(async () => { await service.close(); rmSync(dir, { recursive: true, force: true }); });
  const usage = []; require('../../dist/local/server/api/ai.js').setAiUsageRecorder((owner, record) => usage.push({owner,record})); t.after(() => require('../../dist/local/server/api/ai.js').setAiUsageRecorder(undefined));
  const f = presentationFixture(), beforeCalls = calls;
  const response = await service.handle(upload(f), 'alice'); assert.equal(response.status, 202); const queued = await response.json(); assert.equal(queued.taskId, 'ppt-business-task');
  assert.equal((await service.handle(req('/' + queued.id), 'bob')).status, 404);
  await waitRun(service, queued.id, run => run.events.some(e => /规划检查点已持久/.test(e.message)));
  const active = service.active.get(queued.id); assert.ok(active); assert.equal(active.timeout._idleTimeout, 300000); assert.ok(existsSync(active.workDirectory)); const workDirectory = active.workDirectory;
  const beforeClose = new DatabaseSync(path); const checkpointJSON = beforeClose.prepare('SELECT meta FROM skill_presentation_checkpoints WHERE run_id=?').get(queued.id).meta; beforeClose.close(); assert.equal(service.presentationStorage('alice'), Buffer.byteLength(checkpointJSON));
  await service.close(); assert.equal(existsSync(workDirectory), false);
  const db = new DatabaseSync(path); assert.equal(db.prepare('SELECT count(*) AS n FROM skill_presentation_checkpoints').get().n, 1); assert.equal(db.prepare('SELECT count(*) AS n FROM skill_run_checkpoints').get().n, 0); db.close();
  service = new SkillService(path);
  const run = await waitRun(service, queued.id, run => !['queued', 'running'].includes(run.status)); assert.equal(run.status, 'succeeded', run.error); assert.equal(calls - beforeCalls, 1); assert.equal(run.artifacts.length, 10); assert.equal(usage.length, 1); assert.equal(usage[0].owner, 'alice'); assert.equal(usage[0].record.totalTokens, 579);
  assert.ok(run.events.some(e => /不重复调用/.test(e.message))); assert.equal(run.permissions.includes('external.ai'), true);
  const quality = run.artifacts.find(a => a.name === 'quality-report.json'); assert.ok(quality); assert.equal((await service.handle(req(`/${run.id}/artifacts/${quality.id}`), 'bob')).status, 404);
  const report = await (await service.handle(req(`/${run.id}/artifacts/${quality.id}`), 'alice')).json(); assert.equal(report.releaseStatus, 'needs-human-review'); assert.equal(report.commercialApproval, false);
  const replay = await service.handle(upload(f), 'alice'); assert.equal(replay.status, 200); assert.equal((await replay.json()).id, run.id); assert.equal(calls - beforeCalls, 1);
  const check = new DatabaseSync(path); assert.equal(check.prepare('SELECT count(*) AS n FROM skill_presentation_checkpoints').get().n, 0); check.close();
  assert.equal((await service.handle(req('/' + run.id, 'DELETE'), 'alice')).status, 200); assert.equal((await service.handle(req('/' + run.id), 'alice')).status, 404); assert.equal((await service.handle(upload(f), 'alice')).status, 410);
});
test('cancellation before a saved plan cannot re-send content through resume; missing consent/local-only reject before AI', { timeout: 15000 }, async t => {
  const service = new SkillService(':memory:'); t.after(() => service.close()); const f = presentationFixture(); const start = calls;
  assert.equal((await service.handle(upload(f, 'no-upload-consent', { consent: 'false' }), 'alice')).status, 403);
  assert.equal((await service.handle(upload(f, 'local-only-denied', { permission: '仅本地' }), 'alice')).status, 403);
  assert.equal((await service.handle(upload(f, 'no-ai-consent', { parameters: '{}' }), 'alice')).status, 400);
  const q = await (await service.handle(upload(f, 'cancel-before-start'), 'alice')).json(); assert.ok(q.id);
  const cancelled = await service.handle(req(`/${q.id}/cancel`, 'POST'), 'alice'); assert.equal((await cancelled.json()).status, 'cancelled');
  const resume = await service.handle(req(`/${q.id}/resume`, 'POST'), 'alice'); assert.equal(resume.status, 409); assert.match((await resume.json()).error, /尚无/); assert.equal(calls, start);
});

test('25-page upper-bound stress deck renders all physical pages under the scoped budget without claiming narrative quality', {timeout:300000}, async () => {
  mode = 'normal'; const f = presentationFixture(); f.request.brief.slideCount = 25; f.bytes = Buffer.from(JSON.stringify(f.request));
  const r = await createPresentation({ skillId:'slides.create', filename:'stress.json', bytes:f.bytes, owner:'stress-fixture', parameters:{externalConsent:'yes'} }, () => {});
  assert.equal(json(r,'render-report.json').pageCount,25); assert.equal(json(r,'render-report.json').pdf.pageCount,25); assert.deepEqual(json(r,'render-report.json').missingFonts,[]); assert.equal((await PDFDocument.load(output(r,'draft-presentation.pdf'))).getPageCount(),25); assert.equal(json(r,'quality-report.json').commercialApproval,false); assert.ok(r.outputs.reduce((n,o)=>n+o.bytes.length,0)<25_000_000);
});
test('large presentation upload is scoped: five 2MB materials accepted only by its envelope route; generic skills stay at 2MB', {timeout:15000}, async t => {
  const service = new SkillService(':memory:'); t.after(()=>service.close()); const f = presentationFixture(); f.request.files = Array.from({length:5},(_,i)=>({name:`source-${i}.txt`,base64:Buffer.alloc(2_000_000,65).toString('base64')})); f.bytes = Buffer.from(JSON.stringify(f.request));
  const accepted = await service.handle(upload(f,'large-presentation-upload'),'alice'); assert.equal(accepted.status,202); const run = await accepted.json(); await service.handle(req(`/${run.id}/cancel`,'POST'),'alice');
  const generic = new FormData(); generic.set('skillId','table.analyze'); generic.set('expertId','data'); generic.set('consent','true'); generic.set('file',new File([Buffer.alloc(2_000_001,65)],'large.csv'));
  assert.equal((await service.handle(new Request('http://local/api/skill-runs?kind=presentation',{method:'POST',body:generic}),'alice')).status,413);
  const normal = new FormData(); normal.set('skillId','slides.create'); normal.set('expertId','slides'); normal.set('consent','true'); normal.set('file',new File([f.bytes],'large.json'));
  assert.equal((await service.handle(new Request('http://local/api/skill-runs',{method:'POST',body:normal}),'alice')).status,413);
});
