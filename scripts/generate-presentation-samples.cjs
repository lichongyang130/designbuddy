#!/usr/bin/env node
/** Offline CC0 acceptance fixtures; NOT a live-model narrative/market-quality benchmark. Compile server first. */
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { zipSync, strToU8 } = require('fflate');
const { presentationFixture } = require('../server/skills/presentation-fixtures.cjs');
const { readPresentationSources, sha256 } = require('../dist/local/server/skills/presentation/sources.js');
const { compilePresentationSpec } = require('../dist/local/server/skills/presentation/spec.js');
const { presentationFonts, presentationFont } = require('../dist/local/server/skills/presentation/fonts.js');
const { presentationQuality } = require('../dist/local/server/skills/presentation/quality.js');
const { buildStructuredPresentation } = require('../dist/local/server/skills/pptx-deck.js');
const { renderPresentation } = require('../dist/local/server/skills/pptx-render.js');
const { json, out } = require('../dist/local/server/skills/io.js');
async function main() {
  const fonts = presentationFonts(), archive = {}, manifest = [];
  for (const [scenario, theme] of [['business-report', 'consulting'], ['pitch-deck', 'corporate'], ['data-analysis', 'technology']]) {
    const f = presentationFixture(scenario, theme), inputHash = sha256(f.bytes);
    const sources = await readPresentationSources(f.request, inputHash), spec = compilePresentationSpec(f.proposal, f.request.brief, sources);
    for (const s of spec.slides) s.content.speakerNotes = s.content.speakerNotes.replace('AI整理，', '固定规划编译样本，非真实模型生成，');
    const versionId = sha256(JSON.stringify({ spec, inputHash, fixture: 'offline-CC0', font: presentationFont.sha256 }));
    const built = await buildStructuredPresentation(Buffer.from(JSON.stringify({ title: spec.title, theme: { ...spec.theme, headingFont: 'Noto Sans SC', bodyFont: 'Noto Sans SC' }, slides: spec.slides.map(s => s.content) })), { strictLayout: true });
    const rendered = await renderPresentation(built.pptxBytes, 8, console.log, { fontDirectory: fonts.directory, pdf: true });
    const quality = { ...presentationQuality(spec, sources, built.layout, { report: rendered.report }, rendered.report.pdf), versionId, inputHash, pptxSHA256: sha256(built.pptxBytes), fixture: { license: 'CC0-1.0', syntheticBusinessData: true, liveAIPlanningVerified: false, planningOrigin: 'hand-authored deterministic fixture' } };
    if (quality.releaseStatus === 'blocked') throw Error(`${scenario}: ${JSON.stringify(quality.issues)}`);
    const outputs = [out('draft-presentation.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', built.pptxBytes), ...rendered.outputs.filter(o => o.name !== 'slide-01-preview.jpg'), json('presentation-spec.json', { versionId, inputHash, brief: f.request.brief, spec, planningOrigin: 'offline-authored fixture; NOT a live AI model result' }), json('sources-and-notes.json', { versionId, ...sources, slides: spec.slides }), json('resolved-layout.json', { versionId, unit: 'inch', textElements: built.layout }), json('quality-report.json', quality), out('input-request.json', 'application/json', f.bytes)];
    const dir = resolve('.cache/presentation-samples', scenario); mkdirSync(dir, { recursive: true });
    for (const o of outputs) { writeFileSync(resolve(dir, o.name), o.bytes); archive[`${scenario}/${o.name}`] = o.bytes; }
    manifest.push({ scenario, theme, pages: 8, versionId, pptxSHA256: quality.pptxSHA256, releaseStatus: quality.releaseStatus, commercialApproval: false, criticalIssues: quality.issues.filter(i => i.severity === 'critical').length, files: outputs.map(o => ({ name: o.name, bytes: o.bytes.length, sha256: sha256(o.bytes) })) });
  }
  archive['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  archive['font-OFL.txt'] = readFileSync(resolve(fonts.directory, 'OFL.txt'));
  archive['README.txt'] = strToU8('COMMERCIAL PPT ENGINE / FIRST-MILESTONE COMPILER SAMPLES\n\n三套CC0合成样本，每套8页：经营汇报/咨询主题，融资路演/企业主题，数据分析/深色主题。\n这些是固定逐页规划的离线编译与真实LibreOffice导出样本，不是联网研究、真实企业数据、真实模型叙事质量验收或商业视觉认证。三个样本共用可核对的数据骨架，不能当作三份已完成的真实商业策划。\n\n每套包含原生可编辑PPTX、实际8页PDF、全页960px JPEG包、联系表、逐页规划、完整来源和单元格绑定/讲稿、文字几何与质量报告、原始请求JSON。manifest.json包含SHA-256。quality-report中的commercialApproval始终false，needs-human-review不是商业通过。\n\nPPTX未嵌入字体。接收端需安装Noto Sans SC（400/700），并人工在PowerPoint/Keynote/WPS核对编辑、字体替换、图表和表格。OFL许可另附。没有任意旧PPT编辑、会话修改或版本对比。\n\n重新生成：corepack pnpm exec tsc -p server/tsconfig.local.json && node scripts/generate-presentation-samples.cjs\n真实AI调用需在部署环境配置AI_API_KEY/OPENAI_API_KEY，可选AI_BASE_URL/AI_MODEL，并在技能执行台逐次授权正文处理。\n');
  const path = resolve('docs/examples/commercial-ppt-samples.zip'); mkdirSync(resolve('docs/examples'), { recursive: true }); writeFileSync(path, zipSync(archive, { level: 6 }));
  console.log(path); console.log(JSON.stringify(manifest.map(({ files, ...m }) => m), null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
