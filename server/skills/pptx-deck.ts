import PptxGenJS from 'pptxgenjs';
import { buildAdaptivePresentation, type ResolvedObject, type ResolvedSlide } from './presentation/layouts';
import type { PresentationDesign } from '../../shared/presentationDesign';
import { applyStructuredTheme } from './pptx-theme';
import { json, out, text, xml } from './io';
import type { Output } from './executors';

export type Colors = { primary: string; background: string; surface: string; text: string; muted: string; accent: string };
type SlideBase = { type: string; title: string; subtitle?: string; speakerNotes?: string; sources?: string[] };
export type StructuredSlide =
  | (SlideBase & { type: 'cover'; subtitle?: string })
  | (SlideBase & { type: 'bullets'; body?: string; bullets: string[] })
  | (SlideBase & { type: 'metrics'; items: { label: string; value: string; note?: string }[] })
  | (SlideBase & { type: 'timeline'; items: { date?: string; label: string; body: string }[] })
  | (SlideBase & { type: 'chart'; chartType: 'bar' | 'line'; categories: string[]; series: { name: string; values: number[] }[]; unit?: string })
  | (SlideBase & { type: 'quote'; quote: string; attribution?: string })
  | (SlideBase & { type: 'comparison'; columns: { heading: string; bullets: string[] }[] })
  | (SlideBase & { type: 'table'; headers: string[]; rows: string[][] });

type StructuredDeck = { title: string; theme: Colors; headingFont: string; bodyFont: string; slides: StructuredSlide[] };

const DEFAULT_COLORS: Colors = {
  primary: '#294C3B', background: '#F4F1E9', surface: '#FFFFFF', text: '#1C2822', muted: '#66736B', accent: '#D2744C',
};
const ROOT_KEYS = new Set(['title', 'theme', 'slides']);
const THEME_KEYS = new Set(['primary', 'background', 'surface', 'text', 'muted', 'accent', 'headingFont', 'bodyFont']);
const SLIDE_KEYS: Record<string, Set<string>> = {
  cover: new Set(['type', 'title', 'subtitle', 'speakerNotes', 'sources']),
  bullets: new Set(['type', 'title', 'subtitle', 'body', 'bullets', 'speakerNotes', 'sources']),
  metrics: new Set(['type', 'title', 'subtitle', 'items', 'speakerNotes', 'sources']),
  timeline: new Set(['type', 'title', 'subtitle', 'items', 'speakerNotes', 'sources']),
  chart: new Set(['type', 'title', 'subtitle', 'chartType', 'categories', 'series', 'unit', 'speakerNotes', 'sources']),
  table: new Set(['type', 'title', 'subtitle', 'headers', 'rows', 'speakerNotes', 'sources']),
  comparison: new Set(['type', 'title', 'subtitle', 'columns', 'speakerNotes', 'sources']),
  quote: new Set(['type', 'title', 'subtitle', 'quote', 'attribution', 'speakerNotes', 'sources']),
};

function record(value: unknown, where: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${where} 必须是 JSON 对象。`);
  return value as Record<string, unknown>;
}
function rejectUnknownKeys(value: Record<string, unknown>, allowed: Set<string>, where: string) {
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length) throw Error(`${where} 含不支持字段：${unknown.join('、')}。`);
}
function stringValue(value: unknown, field: string, max: number, required = true): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) throw Error(`${field} 为必填文字。`);
    return undefined;
  }
  if (typeof value !== 'string' || value.length > max || !value.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) {
    throw Error(`${field} 必须是 1 至 ${max} 字的安全文本。`);
  }
  return value.trim();
}
function fontValue(value: unknown, field: string, fallback: string): string {
  if (value === undefined || value === '') return fallback;
  const font = stringValue(value, field, 64)!;
  if (!/^[\p{L}\p{N} _.-]+$/u.test(font)) throw Error(`${field} 含不支持的字体名称字符。`);
  return font;
}
function colorValue(value: unknown, field: string, fallback: string): string {
  if (value === undefined || value === '') return fallback;
  const color = stringValue(value, field, 7)!;
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw Error(`${field} 必须是 #RRGGBB 十六进制颜色。`);
  return color.toUpperCase();
}
function stringArray(value: unknown, field: string, min: number, max: number, maxItemLength: number): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw Error(`${field} 数量须为 ${min} 至 ${max} 项。`);
  return value.map((item, index) => stringValue(item, `${field}[${index + 1}]`, maxItemLength)!);
}
function sourceArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  return stringArray(value, 'sources', 1, 10, 200);
}
function optionalCommon(raw: Record<string, unknown>) {
  return {
    ...(raw.subtitle === undefined ? {} : { subtitle: stringValue(raw.subtitle, 'subtitle', 300, false) }),
    ...(raw.speakerNotes === undefined ? {} : { speakerNotes: stringValue(raw.speakerNotes, 'speakerNotes', 1000, false) }),
    ...(raw.sources === undefined ? {} : { sources: sourceArray(raw.sources) }),
  };
}

function parseSlide(value: unknown, index: number): StructuredSlide {
  const raw = record(value, `slides[${index + 1}]`);
  const type = stringValue(raw.type, `slides[${index + 1}].type`, 20)!;
  const keys = SLIDE_KEYS[type];
  if (!keys) throw Error(`第 ${index + 1} 页类型不支持；可用 cover/bullets/metrics/timeline/chart/quote/comparison/table。`);
  rejectUnknownKeys(raw, keys, `第 ${index + 1} 页`);
  const title = stringValue(raw.title, `slides[${index + 1}].title`, 80)!;
  const common = optionalCommon(raw);
  if (type === 'cover') return { type, title, ...common };
  if (type === 'bullets') return { type, title, ...common, ...(raw.body === undefined ? {} : { body: stringValue(raw.body, 'body', 500, false) }), bullets: stringArray(raw.bullets, 'bullets', 2, 6, 180) };
  if (type === 'table') {
    const headers = stringArray(raw.headers, 'headers', 2, 5, 40);
    if (!Array.isArray(raw.rows) || raw.rows.length < 1 || raw.rows.length > 6) throw Error('表格需要 1–6 行数据。');
    const rows = raw.rows.map((r, i) => {
      if (!Array.isArray(r) || r.length !== headers.length || r.some(v => typeof v !== 'string' || v.length > 80 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))) throw Error(`表格第 ${i + 1} 行不合法。`);
      return r as string[];
    });
    return { type, title, ...common, headers, rows };
  }
  if (type === 'comparison') {
    if (!Array.isArray(raw.columns) || raw.columns.length !== 2) throw Error('对比页需要两栏。');
    const columns = raw.columns.map(v => {
      const c = record(v, 'comparison.columns'); rejectUnknownKeys(c, new Set(['heading', 'bullets']), 'comparison.columns');
      return { heading: stringValue(c.heading, 'heading', 30)!, bullets: stringArray(c.bullets, 'bullets', 2, 4, 100) };
    });
    return { type, title, ...common, columns };
  }
  if (type === 'metrics') {
    if (!Array.isArray(raw.items) || raw.items.length < 2 || raw.items.length > 4) throw Error('metrics.items 须为 2 至 4 项。');
    const items = raw.items.map((item, i) => {
      const metric = record(item, `metrics.items[${i + 1}]`);
      rejectUnknownKeys(metric, new Set(['label', 'value', 'note']), `metrics.items[${i + 1}]`);
      return { label: stringValue(metric.label, 'label', 40)!, value: stringValue(metric.value, 'value', 40)!, ...(metric.note === undefined ? {} : { note: stringValue(metric.note, 'note', 100, false) }) };
    });
    return { type, title, ...common, items };
  }
  if (type === 'timeline') {
    if (!Array.isArray(raw.items) || raw.items.length < 2 || raw.items.length > 6) throw Error('timeline.items 须为 2 至 6 项。');
    const items = raw.items.map((item, i) => {
      const step = record(item, `timeline.items[${i + 1}]`);
      rejectUnknownKeys(step, new Set(['date', 'label', 'body']), `timeline.items[${i + 1}]`);
      return { ...(step.date === undefined ? {} : { date: stringValue(step.date, 'date', 32, false) }), label: stringValue(step.label, 'label', 60)!, body: stringValue(step.body, 'body', 180)! };
    });
    return { type, title, ...common, items };
  }
  if (type === 'chart') {
    const chartType = stringValue(raw.chartType, 'chartType', 10)!;
    if (chartType !== 'bar' && chartType !== 'line') throw Error('chartType 仅支持 bar 或 line 原生图表。');
    const categories = stringArray(raw.categories, 'categories', 2, 12, 48);
    if (!Array.isArray(raw.series) || raw.series.length < 1 || raw.series.length > 3) throw Error('chart.series 须为 1 至 3 个序列。');
    const series = raw.series.map((item, i) => {
      const recordValue = record(item, `series[${i + 1}]`);
      rejectUnknownKeys(recordValue, new Set(['name', 'values']), `series[${i + 1}]`);
      if (!Array.isArray(recordValue.values) || recordValue.values.length !== categories.length) throw Error(`series[${i + 1}].values 须与 categories 数量一致。`);
      const values = recordValue.values.map((n, j) => {
        if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 1e12) throw Error(`series[${i + 1}].values[${j + 1}] 必须是绝对值不超过 1e12 的有限数字。`);
        return n;
      });
      return { name: stringValue(recordValue.name, 'series.name', 40)!, values };
    });
    return { type, title, ...common, chartType, categories, series, ...(raw.unit === undefined ? {} : { unit: stringValue(raw.unit, 'unit', 24, false) }) };
  }
  return { type: 'quote', title, ...common, quote: stringValue(raw.quote, 'quote', 600)!, ...(raw.attribution === undefined ? {} : { attribution: stringValue(raw.attribution, 'attribution', 80, false) }) };
}

export function parseStructuredDeck(bytes: Uint8Array): StructuredDeck {
  let parsed: unknown;
  try { parsed = JSON.parse(text(bytes)); } catch { throw Error('JSON 演示文稿格式无效。'); }
  const root = record(parsed, '演示文稿');
  rejectUnknownKeys(root, ROOT_KEYS, '演示文稿');
  const title = stringValue(root.title, 'title', 100)!;
  const themeRaw = root.theme === undefined ? {} : record(root.theme, 'theme');
  rejectUnknownKeys(themeRaw, THEME_KEYS, 'theme');
  const theme: Colors = {
    primary: colorValue(themeRaw.primary, 'theme.primary', DEFAULT_COLORS.primary),
    background: colorValue(themeRaw.background, 'theme.background', DEFAULT_COLORS.background),
    surface: colorValue(themeRaw.surface, 'theme.surface', DEFAULT_COLORS.surface),
    text: colorValue(themeRaw.text, 'theme.text', DEFAULT_COLORS.text),
    muted: colorValue(themeRaw.muted, 'theme.muted', DEFAULT_COLORS.muted),
    accent: colorValue(themeRaw.accent, 'theme.accent', DEFAULT_COLORS.accent),
  };
  if (!Array.isArray(root.slides) || root.slides.length < 1 || root.slides.length > 50) throw Error('slides 须包含 1 至 50 页。');
  const slides = root.slides.map(parseSlide);
  const headingFont = fontValue(themeRaw.headingFont, 'theme.headingFont', 'Microsoft YaHei');
  const bodyFont = fontValue(themeRaw.bodyFont, 'theme.bodyFont', 'Microsoft YaHei');
  const charCount = JSON.stringify({ title, theme, slides }).length;
  if (charCount > 60_000) throw Error('规范化演示文稿超过 60000 字安全上限。');
  return { title, theme, headingFont, bodyFont, slides };
}

const wide = 13.333;
const canvasHeight = 7.5;
const emu = (value: string) => value.replace(/^#/, '').toUpperCase();

function addText(slide: any, value: string, options: Record<string, unknown>, fontFace: string) {
  slide.addText(value, { fontFace, breakLine: false, fit: 'shrink', margin: 0, valign: 'middle', ...options });
}
function addCommonChrome(slide: any, pptx: any, deck: StructuredDeck, page: number) {
  const { theme } = deck;
  slide.background = { color: emu(theme.background) };
  slide.addShape(pptx.ShapeType.rect, { x: 0.74, y: 0.55, w: 0.42, h: 0.07, fill: { color: emu(theme.accent) }, line: { color: emu(theme.accent), transparency: 100 } });
  addText(slide, `${String(page).padStart(2, '0')}  /  ${String(deck.slides.length).padStart(2, '0')}`, { x: 11.5, y: 7.08, w: 1.0, h: 0.18, fontSize: 8, color: emu(theme.muted), align: 'right' }, deck.bodyFont);
}
function addTitle(slide: any, deck: StructuredDeck, title: string, subtitle?: string) {
  addText(slide, title, { x: 0.74, y: 0.82, w: 11.85, h: 0.68, fontSize: 28, bold: true, color: emu(deck.theme.text), valign: 'middle' }, deck.headingFont);
  if (subtitle) addText(slide, subtitle, { x: 0.78, y: 1.55, w: 11.4, h: 0.45, fontSize: 14, color: emu(deck.theme.muted), valign: 'top' }, deck.bodyFont);
}
function shape(slide: any, pptx: any, x: number, y: number, w: number, h: number, fill: string, transparency = 0) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: emu(fill), transparency }, line: { color: emu(fill), transparency: 100 } });
}
export type ResolvedText = { slideId: string; elementId: string; text: string; x: number; y: number; w: number; h: number; fontSize: number; fontFace: string; color?: string; fill?: string; bold?: boolean; role: 'text' | 'table-cell' };
export type PresentationBuildOptions = { strictLayout?: boolean; contentOrigin?: 'ai-planned'; adaptiveDesigns?: PresentationDesign[]; visual?: import("./presentation/visuals").VisualBuildOptions };
function createSlide(pptx: any, deck: StructuredDeck, spec: StructuredSlide, page: number, layout: ResolvedText[], options: PresentationBuildOptions) {
  const slide = pptx.addSlide();
  let element = 0;
  const capture = (value: string, o: any, role: ResolvedText['role'] = 'text') => layout.push({ slideId: `slide-${String(page).padStart(2, '0')}`, elementId: `slide-${String(page).padStart(2, '0')}-text-${++element}`, text: value, x: o.x, y: o.y, w: o.w, h: o.h, fontSize: o.fontSize, fontFace: o.fontFace, color: o.color, fill: o.fill?.color, bold: !!o.bold, role });
  const original = slide.addText.bind(slide);
  slide.addText = (value: string, o: any) => {
    capture(value, o);
    // P1 never hides overflow by shrinking or dropping facts. The quality gate checks these boxes.
    const fixed = { ...o }; if (options.strictLayout) delete fixed.fit;
    return original(value, fixed);
  };
  const colors = deck.theme;
  addCommonChrome(slide, pptx, deck, page);
  const sources = spec.sources?.length ? `\n\n来源：${spec.sources.join('；')}` : '';
  const notes = [spec.speakerNotes, spec.sources?.length ? `来源：${spec.sources.join('\n')}` : ''].filter(Boolean).join('\n\n');

  if (spec.type === 'cover') {
    shape(slide, pptx, 0.74, 0.88, 0.16, 4.8, colors.primary);
    slide.addShape(pptx.ShapeType.ellipse, { x: 9.65, y: 1.05, w: 2.75, h: 2.75, fill: { color: emu(colors.accent), transparency: 86 }, line: { color: emu(colors.accent), transparency: 100 } });
    addText(slide, 'DESIGNBUDDY  ·  PRESENTATION', { x: 1.18, y: 1.45, w: 6.3, h: 0.32, fontSize: 11, bold: true, charSpacing: 1.5, color: emu(colors.primary) }, deck.bodyFont);
    addText(slide, spec.title, { x: 1.15, y: 2.15, w: 10.9, h: 1.45, fontSize: 34, bold: true, color: emu(colors.text), valign: 'middle' }, deck.headingFont);
    if (spec.subtitle) addText(slide, spec.subtitle, { x: 1.18, y: 3.9, w: 8.8, h: 0.85, fontSize: 19, color: emu(colors.muted), valign: 'top' }, deck.bodyFont);
    addText(slide, deck.title, { x: 1.18, y: 5.82, w: 8.5, h: 0.45, fontSize: 12, color: emu(colors.muted) }, deck.bodyFont);
  } else {
    addTitle(slide, deck, spec.title, spec.subtitle);
    if (spec.type === 'bullets') {
      if (spec.body) addText(slide, spec.body, { x: 0.8, y: 2.0, w: 11.5, h: 0.7, fontSize: 15, color: emu(colors.muted), valign: 'top' }, deck.bodyFont);
      const startY = spec.body ? 2.85 : 2.05;
      const available = 4.45;
      const gap = 0.13;
      const cardH = Math.min(0.76, (available - (spec.bullets.length - 1) * gap) / spec.bullets.length);
      spec.bullets.forEach((bullet, index) => {
        const y = startY + index * (cardH + gap);
        shape(slide, pptx, 0.82, y, 11.55, cardH, colors.surface);
        slide.addShape(pptx.ShapeType.ellipse, { x: 1.04, y: y + cardH / 2 - 0.055, w: 0.11, h: 0.11, fill: { color: emu(index % 2 ? colors.accent : colors.primary) }, line: { color: emu(index % 2 ? colors.accent : colors.primary), transparency: 100 } });
        addText(slide, bullet, { x: 1.32, y: y + 0.08, w: 10.75, h: cardH - 0.14, fontSize: 15, color: emu(colors.text), valign: 'middle' }, deck.bodyFont);
      });
    } else if (spec.type === 'metrics') {
      const n = spec.items.length;
      const gap = 0.18;
      const cardW = (11.55 - gap * (n - 1)) / n;
      spec.items.forEach((item, index) => {
        const x = 0.82 + index * (cardW + gap);
        shape(slide, pptx, x, 2.45, cardW, 2.65, colors.surface);
        addText(slide, item.label, { x: x + 0.22, y: 2.77, w: cardW - 0.44, h: 0.42, fontSize: 12, bold: true, color: emu(colors.muted) }, deck.bodyFont);
        addText(slide, item.value, { x: x + 0.22, y: 3.35, w: cardW - 0.44, h: 0.86, fontSize: 29, bold: true, color: emu(index % 2 ? colors.accent : colors.primary) }, deck.headingFont);
        if (item.note) addText(slide, item.note, { x: x + 0.22, y: 4.38, w: cardW - 0.44, h: 0.48, fontSize: 10, color: emu(colors.muted), valign: 'top' }, deck.bodyFont);
      });
    } else if (spec.type === 'timeline') {
      const n = spec.items.length;
      const gap = 0.13;
      const cardW = (11.55 - gap * (n - 1)) / n;
      const y = 2.55;
      slide.addShape(pptx.ShapeType.line, { x: 0.95, y: y + 0.22, w: 11.25, h: 0, line: { color: emu(colors.primary), width: 1.4, transparency: 40, beginArrowType: 'none', endArrowType: 'none' } });
      spec.items.forEach((item, index) => {
        const x = 0.82 + index * (cardW + gap);
        slide.addShape(pptx.ShapeType.ellipse, { x: x + cardW / 2 - 0.11, y: y + 0.11, w: 0.22, h: 0.22, fill: { color: emu(index % 2 ? colors.accent : colors.primary) }, line: { color: emu(colors.background), width: 1 } });
        shape(slide, pptx, x, y + 0.66, cardW, 2.55, colors.surface);
        if (item.date) addText(slide, item.date, { x: x + 0.15, y: y + 0.85, w: cardW - 0.3, h: 0.28, fontSize: 9, bold: true, color: emu(colors.accent) }, deck.bodyFont);
        addText(slide, item.label, { x: x + 0.15, y: y + 1.2, w: cardW - 0.3, h: 0.55, fontSize: 16, bold: true, color: emu(colors.text), valign: 'top' }, deck.headingFont);
        addText(slide, item.body, { x: x + 0.15, y: y + 1.82, w: cardW - 0.3, h: 1.15, fontSize: 14, color: emu(colors.muted), valign: 'top' }, deck.bodyFont);
      });
    } else if (spec.type === 'chart') {
      if (spec.unit) addText(slide, `单位：${spec.unit}`, { x: 9.85, y: 1.61, w: 2.4, h: 0.22, fontSize: 9, color: emu(colors.muted), align: 'right' }, deck.bodyFont);
      slide.addChart(spec.chartType === 'line' ? pptx.ChartType.line : pptx.ChartType.bar,
        spec.series.map(series => ({ name: series.name, labels: spec.categories, values: series.values })),
        {
          x: 0.82, y: 2.0, w: 11.55, h: 4.35,
          showLegend: spec.series.length > 1, legendPos: 'b',
          showValue: spec.categories.length <= 8,
          dataLabelFormatCode: '0.############', valAxisLabelFormatCode: '0.############',
          dataLabelFontFace: deck.bodyFont, dataLabelFontSize: 10, dataLabelColor: emu(colors.text),
          legendFontFace: deck.bodyFont, legendFontSize: 10, legendColor: emu(colors.text),
          catAxisLabelColor: emu(colors.muted), valAxisLabelColor: emu(colors.muted),
          chartArea: { fill: { color: emu(colors.background) } }, plotArea: { fill: { color: emu(colors.background) } },
          catAxisLabelFontFace: deck.bodyFont, catAxisLabelFontSize: 10,
          valAxisLabelFontFace: deck.bodyFont, valAxisLabelFontSize: 9,
          chartColors: [emu(colors.primary), emu(colors.accent), '6B8E7D'],
          valGridLine: { color: 'D9E0DB', width: 1 },
          showTitle: false,
          border: { pt: 0, color: emu(colors.background) },
        });
    } else if (spec.type === 'comparison') {
      spec.columns.forEach((column, index) => {
        const x = 0.82 + index * 5.88;
        shape(slide, pptx, x, 2.05, 5.67, 4.55, colors.surface);
        addText(slide, column.heading, { x: x + 0.25, y: 2.35, w: 5.17, h: 0.6, fontSize: 21, bold: true, color: emu(index ? colors.accent : colors.primary) }, deck.headingFont);
        column.bullets.forEach((bullet, i) => addText(slide, bullet, { x: x + 0.25, y: 3.15 + i * 0.78, w: 5.17, h: 0.66, fontSize: 15, color: emu(colors.text), valign: 'top' }, deck.bodyFont));
      });
    } else if (spec.type === 'table') {
      const colW = 11.55 / spec.headers.length, rowH = 0.58;
      const values = [spec.headers, ...spec.rows];
      values.forEach((row, r) => row.forEach((cell, c) => capture(cell, { x: 0.82 + c * colW + 0.08, y: 2.1 + r * rowH + 0.06, w: colW - 0.16, h: rowH - 0.12, fontSize: 14, fontFace: deck.bodyFont, bold: !r, color: emu(r ? colors.text : colors.background), fill: { color: emu(r ? colors.surface : colors.primary) } }, 'table-cell')));
      slide.addTable(values.map((row, r) => row.map(cell => ({ text: cell, options: { bold: !r, color: emu(r ? colors.text : colors.background), fill: emu(r ? colors.surface : colors.primary) } }))), { x: 0.82, y: 2.1, w: 11.55, h: rowH * values.length, colW: Array(spec.headers.length).fill(colW), rowH, fontFace: deck.bodyFont, fontSize: 14, margin: [4, 6, 4, 6], border: { type: 'solid', pt: 0.5, color: emu(colors.muted) }, autoPage: false, valign: 'mid', verbose: false });
    } else if (spec.type === 'quote') {
      shape(slide, pptx, 0.9, 2.35, 0.15, 2.7, colors.accent);
      addText(slide, `“${spec.quote}”`, { x: 1.45, y: 2.45, w: 10.25, h: 2.45, fontSize: 24, bold: true, color: emu(colors.text), valign: 'middle' }, deck.headingFont);
      if (spec.attribution) addText(slide, spec.attribution, { x: 1.48, y: 5.22, w: 9.5, h: 0.4, fontSize: 13, color: emu(colors.muted) }, deck.bodyFont);
    }
  }
  if (notes || sources) slide.addNotes(notes || sources);
  return slide;
}

function previewSlide(spec: StructuredSlide): string {
  const subtitle = spec.subtitle ? `<p>${xml(spec.subtitle)}</p>` : '';
  if (spec.type === 'cover') return `<section><small>封面</small><h2>${xml(spec.title)}</h2>${subtitle}</section>`;
  if (spec.type === 'bullets') return `<section><small>要点页</small><h2>${xml(spec.title)}</h2>${subtitle}${spec.body ? `<p>${xml(spec.body)}</p>` : ''}<ul>${spec.bullets.map(item => `<li>${xml(item)}</li>`).join('')}</ul></section>`;
  if (spec.type === 'metrics') return `<section><small>指标页</small><h2>${xml(spec.title)}</h2>${subtitle}<div class="grid">${spec.items.map(item => `<article><b>${xml(item.value)}</b><strong>${xml(item.label)}</strong>${item.note ? `<p>${xml(item.note)}</p>` : ''}</article>`).join('')}</div></section>`;
  if (spec.type === 'timeline') return `<section><small>时间线</small><h2>${xml(spec.title)}</h2>${subtitle}<div class="grid">${spec.items.map(item => `<article><b>${xml(item.date || '')}</b><strong>${xml(item.label)}</strong><p>${xml(item.body)}</p></article>`).join('')}</div></section>`;
  if (spec.type === 'chart') return `<section><small>原生图表 · ${xml(spec.chartType)}</small><h2>${xml(spec.title)}</h2>${subtitle}<table><thead><tr><th>序列</th>${spec.categories.map(category => `<th>${xml(category)}</th>`).join('')}</tr></thead><tbody>${spec.series.map(series => `<tr><th>${xml(series.name)}</th>${series.values.map(value => `<td>${xml(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>${spec.unit ? `<p>单位：${xml(spec.unit)}</p>` : ''}</section>`;
  if (spec.type === 'table') return `<section><h2>${xml(spec.title)}</h2><table>${[spec.headers, ...spec.rows].map(row => `<tr>${row.map(v => `<td>${xml(v)}</td>`).join('')}</tr>`).join('')}</table></section>`;
  if (spec.type === 'comparison') return `<section><h2>${xml(spec.title)}</h2><div class="grid">${spec.columns.map(c => `<article><h3>${xml(c.heading)}</h3><ul>${c.bullets.map(v => `<li>${xml(v)}</li>`).join('')}</ul></article>`).join('')}</div></section>`;
  return `<section><small>引用页</small><h2>${xml(spec.title)}</h2>${subtitle}<blockquote>${xml(spec.quote)}</blockquote>${spec.attribution ? `<p>${xml(spec.attribution)}</p>` : ''}</section>`;
}

export async function buildStructuredPresentation(bytes: Uint8Array, options: PresentationBuildOptions = {}): Promise<{ title: string; slideCount: number; pptxBytes: Uint8Array; outputs: Output[]; layout: ResolvedText[]; resolvedObjects?: ResolvedObject[]; adaptiveLayout?: { schemaVersion: number; engineVersion: string; slides: ResolvedSlide[] } }> {
  const deck = parseStructuredDeck(bytes);
  if (options.adaptiveDesigns) return buildAdaptivePresentation(deck, options.adaptiveDesigns, options.visual);
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'DesignBuddy';
  pptx.title = deck.title;
  pptx.subject = '结构化内容生成的原生可编辑幻灯片';
  pptx.theme = { headFontFace: deck.headingFont, bodyFontFace: deck.bodyFont };
  const layout: ResolvedText[] = [];
  deck.slides.forEach((slide, index) => createSlide(pptx, deck, slide, index + 1, layout, options));
  const rawBytes = new Uint8Array(await pptx.write({ outputType: 'nodebuffer' }) as Buffer);
  const bytesOut = applyStructuredTheme(rawBytes, deck.theme, deck.headingFont, deck.bodyFont);
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${xml(deck.title)}</title><style>body{font:16px/1.7 system-ui,sans-serif;background:#e8ece8;color:${deck.theme.text};padding:24px}section{max-width:960px;min-height:440px;background:${deck.theme.background};margin:24px auto;padding:48px;border-radius:14px;box-shadow:0 2px 14px #0001}small{color:${deck.theme.accent};font-weight:700;letter-spacing:.08em}h2{font-size:30px;margin:12px 0 16px}li{margin:10px 0}blockquote{font-size:22px;border-left:4px solid ${deck.theme.accent};padding:18px 24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-top:28px}article{background:${deck.theme.surface};padding:20px;border-radius:10px}article b{display:block;font-size:26px;color:${deck.theme.primary}}article strong{display:block}table{border-collapse:collapse;width:100%;background:${deck.theme.surface}}td,th{border:1px solid #d7ddd8;padding:10px;text-align:left}footer{max-width:960px;margin:8px auto;color:#65736b}</style><h1>${xml(deck.title)}</h1>${deck.slides.map(previewSlide).join('')}${deck.slides.map((slide, index) => slide.sources?.length ? `<footer>第 ${index + 1} 页来源：${slide.sources.map(xml).join('；')}</footer>` : '').join('')}</html>`;
  const sourceMap = {
    schemaVersion: 1,
    source: options.contentOrigin === 'ai-planned' ? 'AI-planned from explicitly authorized source content; source references require human fact review' : 'user-provided structured JSON; content was not AI-rewritten or fact-checked',
    title: deck.title,
    theme: { ...deck.theme, headingFont: deck.headingFont, bodyFont: deck.bodyFont },
    slides: deck.slides.map((slide, index) => ({ page: index + 1, ...slide, editableObjectTypes: slide.type === 'chart' ? ['text', 'shape', 'native-chart'] : ['text', 'shape'] })),
    limitations: [
      'Text, shape cards and bar/line charts are authored as native PowerPoint objects; style tokens are not a template-import or pixel-matching system.',
      options.contentOrigin === 'ai-planned' ? 'AI planned the supplied content; no external research or independent semantic fact verification was performed.' : 'No AI content planning, external research, image generation, or fact checking is performed.',
      'The output PPTX can still reflow when opened with different fonts or PowerPoint-compatible applications.',
    ],
  };
  return {
    title: deck.title,
    slideCount: deck.slides.length,
    pptxBytes: bytesOut,
    layout,
    outputs: [
      out('content-preview.html', 'text/html; charset=utf-8', html),
      json('source-slides.json', sourceMap),
    ],
  };
}
