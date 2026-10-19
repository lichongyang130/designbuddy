import type { ResolvedText } from '../pptx-deck';
import type { PresentationSources } from '../../../shared/presentation';
import type { ResolvedObject } from './layouts';
import type { PresentationSpec } from './spec';
import { presentationFonts, presentationFont } from './fonts';
export type QualityIssue = { severity: 'critical' | 'warning'; code: string; slideId?: string; elementId?: string; message: string };
const rgb = (c: string) => c.replace('#', '').match(/../g)!.map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (c: string) => { const [r, g, b] = rgb(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export function checkPresentationLayout(layout: ResolvedText[]): QualityIssue[] {
  const fonts = presentationFonts(), issues: QualityIssue[] = [];
  for (const box of layout) {
    const font = box.bold ? fonts.boldFont : fonts.font;
    const add = (code: string, message: string) => issues.push({ severity: 'critical', code, slideId: box.slideId, elementId: box.elementId, message });
    if (![box.x, box.y, box.w, box.h, box.fontSize].every(Number.isFinite) || box.x < 0 || box.y < 0 || box.w <= 0 || box.h <= 0 || box.x + box.w > 13.334 || box.y + box.h > 7.501) { add('OUT_OF_BOUNDS', '文字框超出画布或几何信息不合法。'); continue; }
    const missing = [...new Set(Array.from(box.text).filter(c => !/\s/.test(c) && !font.hasGlyphForCodePoint(c.codePointAt(0))))];
    if (missing.length) add('MISSING_GLYPH', `指定字体缺少字符：${missing.slice(0, 12).join('')}。`);
    // Conservative deterministic measurement with the exact shipped font. This is NOT Office's shaping engine.
    const width = (v: string) => font.layout(v).positions.reduce((n: number, p: any) => n + p.xAdvance, 0) / font.unitsPerEm * box.fontSize / 72;
    let lines = 0, unbreakable = false;
    for (const paragraph of box.text.split('\n')) {
      let line = 0; lines++;
      for (const token of paragraph.match(/[A-Za-z0-9_@./:%+-]+|[^A-Za-z0-9_@./:%+-]/gu) || []) {
        const w = width(token);
        if (w > box.w + 0.01) unbreakable = true;
        if (line + w > box.w && line > 0) { lines++; line = 0; }
        line += w;
      }
    }
    const required = lines * box.fontSize * 1.2 / 72;
    if (unbreakable || required > box.h + 0.025) add('TEXT_DENSITY', `字体度量预计 ${lines} 行需要 ${required.toFixed(2)} 英寸，框高 ${box.h.toFixed(2)} 英寸；不缩字或删除事实，需调整文本或版式后重生成。`);
  }
  // Text/text intersections matter; decorative cards and intentional background layering are excluded.
  for (let i = 0; i < layout.length; i++) for (let j = i + 1; j < layout.length; j++) {
    const a = layout[i], b = layout[j];
    if (a.slideId !== b.slideId) continue;
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (w > 0.03 && h > 0.03) issues.push({ severity: 'critical', code: 'TEXT_INTERSECTION', slideId: a.slideId, elementId: a.elementId, message: `与 ${b.elementId} 的文字框相交。` });
  }
  return issues;
}
/** Outer geometry only; native chart labels and decorative occlusions remain manual checks. */
export function checkPresentationObjects(objects: ResolvedObject[]): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const ids = new Set<string>();
  for(const a of objects) {
    if(ids.has(a.elementId))issues.push({severity:'critical',code:'DUPLICATE_ELEMENT_ID',slideId:a.slideId,elementId:a.elementId,message:'元素标识重复。'});
    ids.add(a.elementId);
    if(![a.x,a.y,a.w,a.h].every(Number.isFinite)||a.x<0||a.y<0||a.w<=0||a.h<=0||a.x+a.w>13.334||a.y+a.h>7.501)issues.push({severity:'critical',code:'OBJECT_OUT_OF_BOUNDS',slideId:a.slideId,elementId:a.elementId,message:'对象外框超出画布或几何无效。'});
  }
  for(let i=0;i<objects.length;i++)for(let j=i+1;j<objects.length;j++){
    const a=objects[i],b=objects[j];
    const evidenceImage=(a.kind==='image'&&!a.decorative)||(b.kind==='image'&&!b.decorative);
    if(a.slideId!==b.slideId||((a.decorative||b.decorative)&&!evidenceImage)||a.parentId===b.elementId||b.parentId===a.elementId||(a.kind==='text'&&b.kind==='text'))continue;
    const w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
    if(w>.03&&h>.03)issues.push({severity:'critical',code:'OBJECT_INTERSECTION',slideId:a.slideId,elementId:a.elementId,message:`与 ${b.elementId} 的非装饰对象外框相交。`});
  }
  return issues;
}
export function presentationQuality(spec: PresentationSpec, sources: PresentationSources, layout: ResolvedText[], render: { report?: Record<string, any>; error?: string }, pdf: { pageCount?: number; missingFonts?: string[]; error?: string }, objects?: ResolvedObject[]) {
  const issues = [...checkPresentationLayout(layout), ...(objects ? checkPresentationObjects(objects) : [])];
  const sourceNumbers = new Set((sources.blocks.filter(b=>!(sources.assets||[]).some(a=>a.id===b.id)).map(b => b.text).join('\n').match(/[-+]?\d+(?:\.\d+)?(?:%|％)?/g) || []));
  for (const slide of spec.slides) {
    const { sources: _refs, speakerNotes: _notes, ...visible } = slide.content;
    const numbers = [...new Set(JSON.stringify({ ...visible, ...(slide.design?.takeaway ? { takeaway: slide.design.takeaway } : {}) }).match(/[-+]?\d+(?:\.\d+)?(?:%|％)?/g) || [])].filter(n => !sourceNumbers.has(n));
    if (numbers.length) issues.push({ severity: 'warning', code: 'UNMATCHED_NUMBER', slideId: slide.id, message: `材料中未按相同字面找到数字 ${numbers.slice(0, 12).join('、')}；可能是建议/编号/格式差异，必须逐项核对，不自动认定真实或伪造。` });
  }
  for (const box of layout) {
    if (box.color && ratio(box.color, box.fill || spec.theme.background) < (box.fontSize >= 18 ? 3 : 4.5)) issues.push({ severity: 'critical', code: 'LOW_TEXT_CONTRAST', slideId: box.slideId, elementId: box.elementId, message: '文字与已知背景的色彩对比度不足。' });
  }
  if (render.error || !render.report) issues.push({ severity: 'critical', code: 'RENDER_FAILED', message: render.error || '无逐页渲染证据。' });
  if (render.report && (render.report.pageCount !== spec.slides.length || render.report.missingFontCount)) issues.push({ severity: 'critical', code: 'RENDER_COUNT_OR_FONTS', message: '渲染页数不一致或存在缺失字体。' });
  if (pdf.error || pdf.pageCount !== spec.slides.length || pdf.missingFonts?.length) issues.push({ severity: 'critical', code: 'PDF_FAILED', message: pdf.error || 'PDF页数不一致或字体缺失。' });
  spec.missingInformation.forEach(message => issues.push({ severity: 'warning', code: 'MISSING_INFORMATION', message }));
  return {
    schemaVersion: 1, executionStatus: 'completed', releaseStatus: issues.some(i => i.severity === 'critical') ? 'blocked' : 'needs-human-review', commercialApproval: false,
    checks: { schema: 'passed', sourceReferences: 'all IDs resolved; semantic support NOT verified', chartAndTableData: 'deterministic verbatim cell bindings; no model-supplied values or implicit aggregation', nativeEditableObjects: 'compiler-authored text/shapes/charts/tables with separately bounded raster assets; no target-application editing certification', boundingBoxesAndTextMetrics: 'checked with bundled font; conservative heuristic, not Office text-overflow proof', textIntersections: 'checked; backgrounds and chart-internal labels excluded', objectGeometry: objects ? 'V2 outer boxes checked; explicit decorative and table-parent relationships excluded except evidence-image collisions; chart internals NOT checked' : 'V1 text/table-cell scope only', raster: render.report ? 'all pages rendered by LibreOffice' : 'failed', pdf: pdf.error ? 'failed' : `${pdf.pageCount ?? 0} physical pages checked` },
    issues, sourceWarnings: sources.warnings, font: { ...presentationFont, bundledFontHashVerified: true, embeddedInPPTX: false },
    repair: { maxPlanningSchemaRetries: spec.direction ? 2 : 1, ...(spec.direction ? { maxPlanningSchemaRetriesPerStage: 1, maxModelCallsAcrossStagesAndResume: 4 } : {}), automaticVisualRepair: false, factsDroppedToFit: false, fontShrinkingEnabled: false },
    notChecked: ['Independent semantic fact verification and contradiction resolution', 'Source rights, trademarks, confidential-data policy and provider retention', 'Office-native line breaking, native chart label collisions, aesthetic balance and all shape/shape occlusions', 'Editable reopening in Microsoft PowerPoint / Keynote / WPS and font substitution on recipient machines', 'Commercial approval by a named human reviewer'],
    nextAction: '对照 sources-and-notes.json、PDF及每页JPEG复核；blocked 时不得作为正式稿。没有critical也仍是待人工验收的草稿。',
  };
}
