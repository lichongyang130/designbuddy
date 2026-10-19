#!/usr/bin/env node
/** Source-based assistant-authored case; no external AI/provider call. Compile server first. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { zipSync, unzipSync, strToU8 } = require('fflate');
const { parsePresentationRequest, readPresentationSources, sha256 } = require('../dist/local/server/skills/presentation/sources.js');
const { compilePresentationSpec } = require('../dist/local/server/skills/presentation/spec.js');
const { presentationFonts } = require('../dist/local/server/skills/presentation/fonts.js');
const { presentationQuality } = require('../dist/local/server/skills/presentation/quality.js');
const { buildStructuredPresentation } = require('../dist/local/server/skills/pptx-deck.js');
const { renderPresentation } = require('../dist/local/server/skills/pptx-render.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const root = path.resolve(__dirname, '..');
const inputDir = path.join(root, 'docs/examples/leader-decision');
const publicDir = path.join(root, 'apps/web/public/presentation-examples/leader-decision');
const jsonBytes = v => Buffer.from(JSON.stringify(v, null, 2) + '\n');
const load = name => JSON.parse(fs.readFileSync(path.join(inputDir, name), 'utf8'));
const csv = rows => rows.map(r => r.map(v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(',')).join('\n') + '\n';
async function main() {
  process.chdir(root);
  const authored = load('plan.json'), evidence = load('evidence-snapshot.json');
  assert.equal(authored.pages.length, 12);
  assert.equal(authored.pages.reduce((n,p) => n + p.suggestedSeconds, 0), 900);
  const staleSourcePaths = [];
  for (const e of evidence.sources) for (const l of e.locations) {
    if (fs.existsSync(l.path) && sha256(fs.readFileSync(l.path)) !== l.fileSHA256) staleSourcePaths.push(l.path);
  }
  // Historical logs are intentionally immutable excerpts: absent caches do not prevent reproduction.
  const materials = {
    'evidence.md': Buffer.from(evidence.sources.map(e => `${e.id} ${e.label}【${e.classification}】 ${e.summary} ${e.locations.map(l => `${l.path}:L${l.startLine}–L${l.endLine}，文件SHA256=${l.fileSHA256}，摘录：${JSON.stringify(l.excerpt)}`).join(' | ')}`).join('\n\n')),
    'test-records.csv': Buffer.from(csv([['检查范围','通过数','失败数','口径'], ['技能后端','240','0','上一轮240项技能后端回归；不是本轮新测'],['相关界面','25','0','上一轮25项相关UI用例；不是全仓UI'],['扩展API','19','4','上一轮23项；隔离HEAD同样复现；不与其他范围合并']])),
    'api-records.csv': Buffer.from(csv([['检查结果','用例数'],['通过','19'],['失败','4']])),
  };
  const wb = new ExcelJS.Workbook();
  wb.created = wb.modified = new Date('2026-10-19T00:00:00Z');
  const tables = {
    '方案比较': [['方案','可获得价值','主要代价或风险','建议判断'],['维持现状','不新增试跑投入','缺少真实使用反馈','不优先'],['受控小范围试点','获得真实复核证据','需授权与复核投入','有条件推荐'],['完善后再试点','先补部分能力缺口','真实反馈仍然缺少','条件不足时采用']],
    '成本口径': [['成本项','当前证据','试点需记录','批准前确认'],['模型调用','有用量字段','账单与实际用量','单价及上限待定'],['人工复核','工时尚无记录','核对及返工工时','人员与工时待定'],['部署运行','仅有执行时限','耗时与资源消耗','资源上限待定'],['材料合规','需单次授权','授权与留存边界','资料范围待定']],
    '风险处置': [['风险','触发信号','建议动作'],['事实误读','引用不支持结论','停止发布并核对原文'],['字体或编辑异常','目标Office重排','装字体并重开验证'],['规划前运行中断','尚无保存的规划','明确重新授权新建'],['既存API失败','影响试点路径','评审后修复或收窄']],
  };
  for (const [name, rows] of Object.entries(tables)) wb.addWorksheet(name).addRows(rows);
  materials['analysis-tables.xlsx'] = Buffer.from(await wb.xlsx.writeBuffer());
  const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, brief: authored.brief, files: Object.entries(materials).map(([name, data]) => ({ name, base64: data.toString('base64') })) }));
  const request = parsePresentationRequest(bytes), inputHash = sha256(bytes);
  const sources = await readPresentationSources(request, inputHash);
  const refMap = Object.fromEntries(evidence.sources.map(e => [e.id, sources.blocks.find(b => b.text.startsWith(e.id + ' '))?.id]));
  Object.assign(refMap, { D01: 'source-2-table-1', D02: 'source-3-table-1', D03: 'source-4-table-1', D04: 'source-4-table-2', D05: 'source-4-table-3' });
  assert(Object.values(refMap).every(Boolean));
  const slidePlans = JSON.parse(JSON.stringify(authored.pages.map(p => p.content)));
  for (const p of slidePlans) {
    p.sourceRefs = p.sourceRefs.map(r => refMap[r]);
    if (p.binding) p.binding.datasetId = refMap[p.binding.datasetId];
    for (const item of p.items || []) if (item.binding) item.binding.datasetId = refMap[item.binding.datasetId];
  }
  const proposal = { title: '领导决策汇报｜PPT引擎试点建议', storyline: '建议有条件试点 → 工程事实与验收缺口 → 三方案取舍 → 成本风险 → 关卡和拍板事项', missingInformation: authored.missingInformation, slides: slidePlans };
  const spec = compilePresentationSpec(proposal, request.brief, sources);
  // Each visible page carries its epistemic label; no claim that the server provider authored this case.
  for (const [i,s] of spec.slides.entries()) {
    const p = authored.pages[i];
    s.content.subtitle = `【${p.classification}】${s.content.subtitle || (p.classification === '事实' ? '仅限所列源码与历史测试范围；不等于商业验收。' : p.classification === '分析' ? '定性判断，非成本收益测算或已批准决定。' : '待决策；责任、资源与启动条件仍需确认。')}`;
    s.content.speakerNotes = s.content.speakerNotes.replace('AI整理，尚未独立核验语义与事实。', '助手基于源码证据编排；未调用后台外部模型，仍需人工事实与Office验收。');
    const readableRefs = p.content.sourceRefs.map(id => { const e = evidence.sources.find(e => e.id === id); return e ? `${id} ${e.locations.map(l => `${l.path}:L${l.startLine}–L${l.endLine}`).join('；')}` : `${id} 见随附来源与字段口径`; });
    s.content.speakerNotes += `\n\n仓库依据（快照）：\n${readableRefs.join('\n')}`;
  }
  const fonts = presentationFonts();
  const built = await buildStructuredPresentation(Buffer.from(JSON.stringify({ title: spec.title, theme: { ...spec.theme, headingFont: 'Noto Sans SC', bodyFont: 'Noto Sans SC' }, slides: spec.slides.map(s => s.content) })), { strictLayout: true, contentOrigin: 'ai-planned' });
  console.log('Native PPTX built. Rendering the same file with LibreOffice.');
  const rendered = await renderPresentation(built.pptxBytes, spec.slides.length, console.log, { fontDirectory: fonts.directory, pdf: true });
  const versionId = sha256(JSON.stringify({ inputHash, spec }));
  const quality = { ...presentationQuality(spec, sources, built.layout, { report: rendered.report }, rendered.report.pdf), versionId, inputHash, pptxSHA256: sha256(built.pptxBytes), planningOrigin: authored.planningOrigin, externalProviderCalls: 0, staleSourcePaths: [...new Set(staleSourcePaths)] };
  if (quality.releaseStatus === 'blocked') throw Error(JSON.stringify(quality.issues));
  assert.equal(rendered.report.pdf.pageCount, 12);
  const outputs = { 'leader-decision.pptx': built.pptxBytes };
  for (const o of rendered.outputs) {
    if (o.name === 'slide-01-preview.jpg') continue;
    outputs[o.name === 'draft-presentation.pdf' ? 'leader-decision.pdf' : o.name] = o.bytes;
  }
  const rasters = unzipSync(outputs['rendered-slides.zip']);
  for (const [name,data] of Object.entries(rasters)) if (/^slides\/\d{2}\.jpg$/.test(name)) outputs[name] = data;
  assert.equal(Object.keys(outputs).filter(n => /^slides\//.test(n)).length, 12);
  // Readable, single-slide cover asset for the built-in template grid (derived from the real rendered cover).
  const cover = await loadImage(outputs['slides/01.jpg']);
  const thumb = createCanvas(480, 270); thumb.getContext('2d').drawImage(cover, 0, 0, 480, 270);
  outputs['cover.jpg'] = thumb.toBuffer('image/jpeg', 85);
  const sourceCatalog = [
    ...evidence.sources.map(e => ({ ...e, resolvedRef: refMap[e.id] })),
    ...Object.entries({ D01: ['历史测试计数','事实','test-records.csv：范围/通过数/失败数/口径。逐行抄录历史记录；不跨范围计算通过率。'], D02: ['扩展API同批计数','事实','api-records.csv：同一批23项，用例数按通过19/失败4原样抄录；无汇总计算。'], D03: ['三方案比较','分析','analysis-tables.xlsx/方案比较：方案、价值、代价与建议判断均为助手定性分析，不是观测数据或评分。'], D04: ['成本口径','分析','analysis-tables.xlsx/成本口径：成本项、当前证据、需记录项与待确认事项；无单价、金额、工时或总额计算。'], D05: ['风险处置','分析','analysis-tables.xlsx/风险处置：风险、触发信号与建议动作；无概率/损失评分，不表示已发生事故。'] }).map(([id,[label,classification,summary]]) => ({ id, resolvedRef: refMap[id], label, classification, summary, locations: [] })),
  ];
  const report = { ...authored, versionId, inputHash, externalProviderCalls: 0, qualitySummary: { releaseStatus: quality.releaseStatus, commercialApproval: false, criticalIssues: quality.issues.filter(i => i.severity === 'critical').length }, evidenceScope: evidence.scope, sourceCatalog, pages: authored.pages.map((p,i) => ({ ...p, sourceRefs: p.content.sourceRefs, content: spec.slides[i].content, bindings: spec.slides[i].bindings, resolvedSourceRefs: spec.slides[i].sourceRefs, preview: `slides/${String(i + 1).padStart(2,'0')}.jpg` })) };
  outputs['report.json'] = jsonBytes(report);
  outputs['presentation-spec.json'] = jsonBytes({ versionId, inputHash, brief: authored.brief, spec, planningOrigin: authored.planningOrigin, externalProviderCalls: 0 });
  outputs['sources-and-notes.json'] = jsonBytes({ versionId, ...sources, sourceCatalog, slides: spec.slides });
  outputs['resolved-layout.json'] = jsonBytes({ versionId, unit: 'inch', textElements: built.layout });
  outputs['quality-report.json'] = jsonBytes(quality);
  outputs['input-request.json'] = bytes;
  outputs['authoring-plan.json'] = jsonBytes(authored);
  outputs['evidence-snapshot.json'] = jsonBytes(evidence);
  for (const [name,data] of Object.entries(materials)) outputs[`materials/${name}`] = data;
  outputs['font-OFL.txt'] = fs.readFileSync(path.join(fonts.directory, 'OFL.txt'));
  const md = ['# 领导决策汇报｜PPT引擎试点建议', '', '## 可用结论', '', authored.recommendation, '', '15分钟建议讲述；12页。事实/分析/建议逐页标注；预算、人员、日期、数量与试点政策均待确认。', '', '## 生成边界', '', '这是助手基于本项目源码及历史测试证据编排的案例，通过项目真实材料解析、编译器和LibreOffice导出。未调用后台外部模型，不能据此声称生产AI规划质量已验收。PPTX含原生文字、表格、图表和讲稿；没有位图铺满替代可编辑页。内置浏览器仅查看，不提供P2局部编辑；请下载PPTX编辑。', '', '所有文件为待人工复核的草稿（needs-human-review；commercialApproval:false）。PPTX未嵌入字体，接收方需安装Noto Sans SC常规/粗体。目标PowerPoint/WPS/Keynote编辑、商业视觉、来源语义、图表内部标签仍需人工验收。历史240/25/19/4不冒称本次新测或全仓通过。', '', ...report.pages.flatMap((p,i) => [`## ${String(i+1).padStart(2,'0')}｜${p.content.title}`, '', `性质：${p.classification}；建议讲述 ${p.suggestedSeconds} 秒。`, '', `![第${i+1}页](${p.preview})`, '', '正文（可编辑对象的真实内容）：', '', ...pageText(p.content).map(t => '- ' + t), '', `图示：${p.chartSuggestion}`, '', `来源：${p.sourceRefs.map(r => `${r} ${sourceCatalog.find(s => s.id === r).label}`).join('；')}`, '', '讲稿：' + p.content.speakerNotes, '']), '## 关键处理依据', '', ...sourceCatalog.flatMap(s => [`### ${s.id}｜${s.label}【${s.classification}】`, '', s.summary, '', ...s.locations.map(l => `- \`${l.path}:L${l.startLine}–L${l.endLine}\`；原文件 SHA-256：\`${l.fileSHA256}\``), '']), '## 复用和复现', '', '修改 authoring-plan.json 的内容及证据后，须重新编译、导出、核对，不能只换截图。原始白名单材料在 materials/；图表和表格绑定的字段、行号和原始单元格在 sources-and-notes.json。所有表均为逐字单元格映射，不进行隐式汇总或成本计算。', '', '`corepack pnpm exec tsc -p server/tsconfig.local.json && node scripts/generate-leader-decision-report.cjs`', '', '未向外部社区、云模板或消息服务发布；本案例仅加入本项目内置模板资源。源码/历史证据是快照，未来变更须重审；重建会报告可访问源文件的哈希变化，不自动改写历史测试计数。', ''];
  outputs['README.md'] = Buffer.from(md.join('\n'));
  const files = Object.entries(outputs).map(([name,data]) => ({ name, bytes: data.length, sha256: sha256(data) }));
  outputs['manifest.json'] = jsonBytes({ caseId: authored.caseId, versionId, inputHash, pages: 12, preparedOn: authored.preparedOn, planningOrigin: authored.planningOrigin, externalProviderCalls: 0, releaseStatus: quality.releaseStatus, commercialApproval: false, files });
  // Publish only the built-in project assets, not the community API. No credentials/full logs are copied.
  fs.mkdirSync(publicDir, { recursive: true });
  for (const [name,data] of Object.entries(outputs)) { const p = path.join(publicDir,name); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,data); }
  outputs['leader-decision-package.zip'] = zipSync(Object.fromEntries(Object.entries(outputs).map(([k,v]) => [k, new Uint8Array(v)])), { level: 6 });
  fs.writeFileSync(path.join(publicDir,'leader-decision-package.zip'), outputs['leader-decision-package.zip']);
  const summary = { pages: 12, criticalIssues: quality.issues.filter(i => i.severity === 'critical').length, releaseStatus: quality.releaseStatus, commercialApproval: false, externalProviderCalls: 0, versionId, totalBytes: Object.values(outputs).reduce((n,v) => n+v.length,0), staleSourcePaths: quality.staleSourcePaths };
  console.log(JSON.stringify(summary,null,2));
}
function pageText(p) {
  return [p.subtitle, p.body, ...(p.bullets || []), ...(p.columns || []).flatMap(c => [c.heading,...c.bullets]), ...(p.items || []).flatMap(i => [i.label, i.value, i.note, i.body].filter(Boolean)), ...(p.headers ? [p.headers.join('｜'),...p.rows.map(r => r.join('｜'))] : []), ...(p.series ? p.categories.map((c,i) => `${c}：${p.series.map(s => `${s.name} ${s.values[i]}`).join('；')}`) : [])].filter(Boolean);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
