import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { openOffice } from './office';
import { json, out, text, xml } from './io';
import type { SkillInput, Output } from './executors';
import { presentationRendererAvailable, renderPresentation } from './pptx-render';

const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const EMU_PER_INCH = 914400;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
type XNode = Record<string, any>;
type Box = { x: number; y: number; cx: number; cy: number };
type FoundColor = { hex: string; count: number; uses: Record<string, number> };

const nodeName = (node: XNode) => Object.keys(node).find(key => key !== ':@') || '';
const children = (node?: XNode): XNode[] => node && Array.isArray(node[nodeName(node)]) ? node[nodeName(node)] : [];
const elements = (nodes: XNode[]) => nodes.filter(node => !nodeName(node).startsWith('#') && !nodeName(node).startsWith('?'));
const child = (node: XNode | undefined, tag: string) => children(node).find(item => nodeName(item) === tag);
const attr = (node: XNode | undefined, key: string) => decodeEntities(node?.[':@']?.[key] ?? '');
function descendants(nodes: XNode[], tag: string): XNode[] {
  return nodes.flatMap(node => [...(nodeName(node) === tag ? [node] : []), ...descendants(children(node), tag)]);
}
function decodeEntities(input: unknown): string {
  return String(input ?? '').replace(/&(?:amp|lt|gt|quot|apos|#x[\da-fA-F]+|#\d+);/g, entity => {
    const named: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
    if (named[entity]) return named[entity];
    const code = entity.startsWith('&#x') ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1));
    if (!Number.isInteger(code) || code < 1 || code === 0xfffe || code === 0xffff || code > 0x10ffff || code >= 0xd800 && code <= 0xdfff) throw Error('PPTX XML 含无效字符实体。');
    return String.fromCodePoint(code);
  });
}
function parseXml(bytes: Uint8Array, part: string): XNode[] {
  const source = text(bytes);
  if (source.length > 8_000_000 || /<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(source) || XMLValidator.validate(source) !== true) throw Error(`${part} XML 损坏或包含不支持的实体/CDATA。`);
  let depth = 0, count = 0;
  for (const match of source.matchAll(/<\/?[A-Za-z_][^<>]*>/g)) {
    if (++count > 30_000) throw Error(`${part} 标签数超过 30000。`);
    if (match[0].startsWith('</')) depth--;
    else if (!match[0].endsWith('/>')) depth++;
    if (depth < 0 || depth > 64) throw Error(`${part} XML 嵌套深度无效或超过 64。`);
  }
  return new XMLParser({
    preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '',
    parseTagValue: false, parseAttributeValue: false, trimValues: false,
    processEntities: false, ignoreDeclaration: true, ignorePiTags: true,
  }).parse(source);
}
function rootNode(nodes: XNode[], expected: string, part: string): XNode {
  const root = elements(nodes)[0];
  if (!root || nodeName(root) !== expected) throw Error(`${part} 缺少 ${expected} 根节点。`);
  return root;
}
function safeNumber(raw: string, field: string, max = 200_000_000): number {
  if (!/^\d+$/.test(raw)) throw Error(`${field} 不是有效的非负整数。`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > max) throw Error(`${field} 超出支持范围。`);
  return value;
}
function safeSignedNumber(raw: string, field: string, max = 200_000_000): number {
  if (!/^-?\d+$/.test(raw)) throw Error(`${field} 不是有效的整数。`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || Math.abs(value) > max) throw Error(`${field} 超出支持范围。`);
  return value;
}
function safeRelTarget(base: string, raw: string): string {
  if (!raw || raw.length > 300 || raw.includes('\\') || raw.includes('%') || /[?#:]/.test(raw) || raw.includes('\0') || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('/')) throw Error('PPTX 包关系含不支持的目标路径。');
  const joined = raw.startsWith('../') ? `${base}/${raw}` : `${base}/${raw}`;
  const segments: string[] = [];
  for (const part of joined.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!segments.length) throw Error('PPTX 包关系路径越界。');
      segments.pop();
    } else segments.push(part);
  }
  const path = segments.join('/');
  if (!path || path.length > 300 || path.includes('//')) throw Error('PPTX 包关系目标路径无效。');
  return path;
}
function parseRelationships(bytes: Uint8Array, part: string, base: string) {
  const root = rootNode(parseXml(bytes, part), 'Relationships', part);
  if (attr(root, 'xmlns') !== REL) throw Error(`${part} 使用了不支持的包关系命名空间。`);
  const relationships = new Map<string, { type: string; target: string }>();
  for (const item of elements(children(root))) {
    if (nodeName(item) !== 'Relationship') throw Error(`${part} 包含不支持的关系元素。`);
    const id = attr(item, 'Id'), type = attr(item, 'Type'), targetMode = attr(item, 'TargetMode');
    if (!id || id.length > 80 || relationships.has(id) || !type || targetMode && targetMode !== 'Internal') throw Error(`${part} 关系 ID 重复、缺失或指向外部目标。`);
    relationships.set(id, { type, target: safeRelTarget(base, attr(item, 'Target')) });
  }
  return relationships;
}
function textContent(node: XNode | undefined): string {
  if (!node) return '';
  return children(node).filter(item => nodeName(item) === '#text').map(item => decodeEntities(item['#text'])).join('');
}
function normalizeHex(raw: string) { return /^[0-9a-f]{6}$/i.test(raw) ? `#${raw.toUpperCase()}` : undefined; }
function themeColorEntries(theme: XNode | undefined): Record<string, string> {
  const colors: Record<string, string> = {};
  if (!theme) return colors;
  const scheme = child(child(theme, 'a:themeElements'), 'a:clrScheme');
  for (const entry of elements(children(scheme))) {
    const item = elements(children(entry))[0];
    const hex = normalizeHex(attr(item, 'val')) || normalizeHex(attr(item, 'lastClr'));
    if (hex) colors[nodeName(entry).replace(/^a:/, '')] = hex;
  }
  return colors;
}
function addColor(colors: Map<string, FoundColor>, hex: string | undefined, use: string) {
  if (!hex) return;
  const found = colors.get(hex) || { hex, count: 0, uses: {} };
  found.count++;
  found.uses[use] = (found.uses[use] || 0) + 1;
  colors.set(hex, found);
}
function colorFromFill(fill: XNode | undefined, theme: Record<string, string>): string | undefined {
  if (!fill) return undefined;
  const srgb = descendants([fill], 'a:srgbClr')[0];
  const direct = normalizeHex(attr(srgb, 'val'));
  if (direct) return direct;
  const scheme = descendants([fill], 'a:schemeClr')[0];
  const key = attr(scheme, 'val');
  const aliases: Record<string, string> = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2', light1: 'lt1', dark1: 'dk1', light2: 'lt2', dark2: 'dk2' };
  return theme[aliases[key] || key];
}
function getBox(shape: XNode): Box | undefined {
  const xfrm = child(child(shape, 'p:spPr'), 'a:xfrm') || child(shape, 'p:xfrm');
  const offset = child(xfrm, 'a:off'), extent = child(xfrm, 'a:ext');
  if (!offset || !extent) return undefined;
  return {
    x: safeSignedNumber(attr(offset, 'x'), 'shape.x'),
    y: safeSignedNumber(attr(offset, 'y'), 'shape.y'),
    cx: safeNumber(attr(extent, 'cx'), 'shape.cx'),
    cy: safeNumber(attr(extent, 'cy'), 'shape.cy'),
  };
}
function slideBackgroundColor(slide: XNode, theme: Record<string, string>): string | undefined {
  const bg = child(child(slide, 'p:cSld'), 'p:bg');
  const direct = colorFromFill(child(child(bg, 'p:bgPr'), 'a:solidFill'), theme);
  return direct || colorFromFill(child(bg, 'p:bgRef'), theme);
}
function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255);
  return (299 * channels[0] + 587 * channels[1] + 114 * channels[2]) / 1000;
}
function shapeText(shape: XNode): string {
  const body = child(shape, 'p:txBody');
  if (!body) return '';
  const paras = descendants(children(body), 'a:p');
  return paras.map(paragraph => descendants(children(paragraph), 'a:t').map(textContent).join('')).filter(Boolean).join('\n').trim();
}
function shapeName(shape: XNode): { id?: string; name?: string } {
  const props = descendants(children(shape), 'p:cNvPr')[0];
  const id = attr(props, 'id'), name = attr(props, 'name');
  return { ...(id ? { id } : {}), ...(name ? { name: name.slice(0, 160) } : {}) };
}
function collectFontsAndColors(shape: XNode, theme: Record<string, string>, fonts: Map<string, number>, sizes: number[], colors: Map<string, FoundColor>) {
  const textRuns = descendants(children(shape), 'a:rPr').concat(descendants(children(shape), 'a:defRPr'), descendants(children(shape), 'a:endParaRPr'));
  for (const run of textRuns) {
    const size = Number(attr(run, 'sz'));
    if (Number.isInteger(size) && size >= 100 && size <= 10000) sizes.push(size / 100);
    for (const tag of ['a:latin', 'a:ea', 'a:cs']) {
      const family = attr(child(run, tag), 'typeface');
      if (family && !family.startsWith('+') && /^[\p{L}\p{N} _.-]{1,64}$/u.test(family)) fonts.set(family, (fonts.get(family) || 0) + 1);
    }
    const textColor = colorFromFill(child(run, 'a:solidFill'), theme);
    addColor(colors, textColor, 'text');
  }
  const shapeProps = child(shape, 'p:spPr');
  const fill = colorFromFill(child(shapeProps, 'a:solidFill'), theme);
  addColor(colors, fill, 'shape-fill');
}
function parseTheme(entries: Record<string, Uint8Array>): { path: string; colors: Record<string, string>; fonts: { headingLatin: string; headingEastAsian: string; bodyLatin: string; bodyEastAsian: string }; warnings: string[] } {
  const paths = Object.keys(entries).filter(path => /^ppt\/theme\/theme\d+\.xml$/i.test(path)).sort();
  if (paths.length > 1) throw Error('包含多个主题部件，无法确定唯一的设计令牌来源。');
  if (!paths.length) return { path: '', colors: {}, fonts: { headingLatin: '', headingEastAsian: '', bodyLatin: '', bodyEastAsian: '' }, warnings: ['PPTX 未含独立主题部件；样式令牌可能来自母版或直接格式。'] };
  const path = paths[0], theme = rootNode(parseXml(entries[path], path), 'a:theme', path);
  if (attr(theme, 'xmlns:a') !== A) throw Error('主题部件使用了不支持的 DrawingML 命名空间。');
  const colors = themeColorEntries(theme);
  const fontScheme = child(child(theme, 'a:themeElements'), 'a:fontScheme');
  const major = child(fontScheme, 'a:majorFont'), minor = child(fontScheme, 'a:minorFont');
  const fonts = {
    headingLatin: attr(child(major, 'a:latin'), 'typeface'),
    headingEastAsian: attr(child(major, 'a:ea'), 'typeface'),
    bodyLatin: attr(child(minor, 'a:latin'), 'typeface'),
    bodyEastAsian: attr(child(minor, 'a:ea'), 'typeface'),
  };
  return { path, colors, fonts, warnings: [] as string[] };
}

function analyzePresentation(bytes: Uint8Array) {
  const entries = openOffice(bytes, 'ppt/presentation.xml', { allowEmbeddedExcel: true });
  const embeddedWorkbooks = unzipSync(bytes, { filter: entry => /^ppt\/embeddings\/Microsoft_Excel_Worksheet\d+\.xlsx$/i.test(entry.name) });
  const embeddedWorkbookParts = Object.entries(embeddedWorkbooks);
  if (embeddedWorkbookParts.length > 4 || embeddedWorkbookParts.reduce((total, [, part]) => total + part.length, 0) > 4_000_000) throw Error('PPTX 内嵌图表工作簿超过 4 个或 4 MB 安全上限。');
  for (const [path, workbookBytes] of embeddedWorkbookParts) {
    if (workbookBytes.length > 2_000_000) throw Error(`${path} 超过 2 MB 内嵌工作簿限制。`);
    openOffice(workbookBytes, 'xl/workbook.xml');
  }
  if (!entries['_rels/.rels'] || !entries['ppt/_rels/presentation.xml.rels'] || !entries['[Content_Types].xml']) throw Error('PPTX 缺少包关系、演示文稿关系或内容类型声明。');
  const contentTypes = rootNode(parseXml(entries['[Content_Types].xml'], '[Content_Types].xml'), 'Types', '[Content_Types].xml');
  if (attr(contentTypes, 'xmlns') !== 'http://schemas.openxmlformats.org/package/2006/content-types' || !elements(children(contentTypes)).some(item => nodeName(item) === 'Override' && attr(item, 'PartName') === '/ppt/presentation.xml' && attr(item, 'ContentType') === 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml')) throw Error('包内容类型不是标准 PPTX 主文稿。');
  const rootRelations = parseRelationships(entries['_rels/.rels'], '_rels/.rels', '');
  const presentationRoot = [...rootRelations.values()].filter(item => item.type.endsWith('/officeDocument'));
  if (presentationRoot.length !== 1 || presentationRoot[0].target !== 'ppt/presentation.xml') throw Error('PPTX 根关系没有唯一指向标准 presentation.xml。');
  const relations = parseRelationships(entries['ppt/_rels/presentation.xml.rels'], 'ppt/_rels/presentation.xml.rels', 'ppt');
  const presentation = rootNode(parseXml(entries['ppt/presentation.xml'], 'ppt/presentation.xml'), 'p:presentation', 'ppt/presentation.xml');
  if (attr(presentation, 'xmlns:p') !== P || attr(presentation, 'xmlns:a') !== A) throw Error('presentation.xml 使用了不支持的 OOXML 命名空间。');
  const slideSizeNode = child(presentation, 'p:sldSz');
  if (!slideSizeNode) throw Error('presentation.xml 缺少幻灯片尺寸。');
  const widthEmu = safeNumber(attr(slideSizeNode, 'cx'), 'slide.width', 200_000_000);
  const heightEmu = safeNumber(attr(slideSizeNode, 'cy'), 'slide.height', 200_000_000);
  if (widthEmu < 1_000_000 || heightEmu < 1_000_000) throw Error('幻灯片宽高过小，无法可靠换算。');
  const idList = child(presentation, 'p:sldIdLst');
  const ids = elements(children(idList)).filter(item => nodeName(item) === 'p:sldId').map(item => attr(item, 'r:id'));
  if (ids.length < 1 || ids.length > 50 || ids.some(id => !id) || new Set(ids).size !== ids.length) throw Error('演示文稿须含 1 至 50 个唯一有效的幻灯片关系。');
  const slideParts = ids.map(id => {
    const relation = relations.get(id);
    if (!relation || !relation.type.endsWith('/slide') || !/^ppt\/slides\/[^/]+\.xml$/i.test(relation.target) || !entries[relation.target]) throw Error(`幻灯片关系 ${id} 缺失、类型不符或目标无效。`);
    return relation.target;
  });
  if (new Set(slideParts).size !== slideParts.length) throw Error('多个幻灯片关系指向同一部件，不支持歧义顺序。');
  const theme = parseTheme(entries);
  const colors = new Map<string, FoundColor>();
  Object.entries(theme.colors).forEach(([key, value]) => addColor(colors, value, `theme:${key}`));
  const fonts = new Map<string, number>(); const fontSizes: number[] = [];
  const warnings = [...theme.warnings];
  const slides: any[] = [];
  let shapeTotal = 0, textShapeTotal = 0, pictureTotal = 0, chartTotal = 0, tableTotal = 0, outOfBoundsTotal = 0, imageDominatedSlides = 0, geometryTotal = 0;
  let objectDetailsRemaining = 1500, extractedTextTotal = 0;

  slideParts.forEach((path, index) => {
    const slide = rootNode(parseXml(entries[path], path), 'p:sld', path);
    if (attr(slide, 'xmlns:p') !== P || attr(slide, 'xmlns:a') !== A) throw Error(`${path} 使用了不支持的 OOXML 命名空间。`);
    const background = slideBackgroundColor(slide, theme.colors);
    addColor(colors, background, 'background');
    const spTree = child(child(slide, 'p:cSld'), 'p:spTree');
    if (!spTree) throw Error(`${path} 缺少形状树。`);
    const items = elements(children(spTree)).filter(item => ['p:sp', 'p:pic', 'p:graphicFrame', 'p:cxnSp', 'p:grpSp'].includes(nodeName(item)));
    shapeTotal += items.length;
    if (shapeTotal > 10_000) throw Error('PPTX 对象超过 10000 个结构分析上限。');
    const objects: any[] = [];
    let textCount = 0, pictures = 0, charts = 0, tables = 0, outOfBounds = 0, geometricCount = 0, objectDetailsOmitted = 0;
    const allSlideText: string[] = [];
    for (const item of items) {
      const kind = nodeName(item);
      const textValue = shapeText(item);
      if (textValue) {
        textCount++; textShapeTotal++; extractedTextTotal += textValue.length;
        if (extractedTextTotal > 150_000) throw Error('PPTX 提取文字超过 150000 字安全上限。');
        allSlideText.push(textValue);
      }
      if (kind === 'p:pic') { pictures++; pictureTotal++; }
      const graphicData = descendants(children(item), 'a:graphicData')[0];
      if (kind === 'p:graphicFrame' && attr(graphicData, 'uri').toLowerCase().includes('chart')) { charts++; chartTotal++; }
      if (descendants(children(item), 'a:tbl').length) { tables++; tableTotal++; }
      collectFontsAndColors(item, theme.colors, fonts, fontSizes, colors);
      const box = getBox(item);
      const isOut = box ? box.x < -1000 || box.y < -1000 || box.cx <= 0 || box.cy <= 0 || box.x + box.cx > widthEmu + 1000 || box.y + box.cy > heightEmu + 1000 : false;
      if (isOut) { outOfBounds++; outOfBoundsTotal++; }
      if (box) { geometricCount++; geometryTotal++; }
      const name = shapeName(item);
      if (objectDetailsRemaining > 0) {
        objects.push({
          type: kind.replace(/^p:/, ''), ...name,
          ...(textValue ? { text: textValue.slice(0, 400), textCharacters: textValue.length, ...(textValue.length > 400 ? { textTruncated: true } : {}) } : {}),
          ...(box ? { boundsInches: { x: +(box.x / EMU_PER_INCH).toFixed(3), y: +(box.y / EMU_PER_INCH).toFixed(3), width: +(box.cx / EMU_PER_INCH).toFixed(3), height: +(box.cy / EMU_PER_INCH).toFixed(3) } } : {}),
          ...(isOut ? { outOfBounds: true } : {}),
          ...(kind === 'p:graphicFrame' && graphicData ? { graphicType: attr(graphicData, 'uri').slice(-80) } : {}),
        });
        objectDetailsRemaining--;
      } else objectDetailsOmitted++;
    }
    const largestPicture = items.filter(item => nodeName(item) === 'p:pic').map(getBox).filter((box): box is Box => !!box).sort((a, b) => b.cx * b.cy - a.cx * a.cy)[0];
    const imageDominated = !!largestPicture && largestPicture.cx * largestPicture.cy >= widthEmu * heightEmu * 0.88 && textCount === 0;
    if (imageDominated) imageDominatedSlides++;
    if (items.some(item => nodeName(item) === 'p:grpSp')) warnings.push(`第 ${index + 1} 页含组合对象；组合内部坐标未单独还原。`);
    if (outOfBounds) warnings.push(`第 ${index + 1} 页有 ${outOfBounds} 个对象框越出幻灯片画布或尺寸无效。`);
    if (geometricCount < items.length) warnings.push(`第 ${index + 1} 页有 ${items.length - geometricCount} 个对象未解析到直接边界（可能继承自占位符/母版或属于组合对象）。`);
    if (imageDominated) warnings.push(`第 ${index + 1} 页看起来由全页位图主导（按图片面积与无文本形状的启发式判断）；需核验可编辑性。`);
    if (!textCount) warnings.push(`第 ${index + 1} 页没有从文本形状中提取到文字；可能是图片、图表或空白页。`);
    if (objectDetailsOmitted) warnings.push(`第 ${index + 1} 页有 ${objectDetailsOmitted} 个对象超出详细列表上限；对象总数与汇总统计仍完整。`);
    slides.push({ page: index + 1, part: path, shapeCount: items.length, textShapeCount: textCount, pictureCount: pictures, chartCount: charts, tableCount: tables, outOfBoundsObjectCount: outOfBounds, objectsWithGeometry: geometricCount, imageDominatedLikely: imageDominated, text: allSlideText.join('\n\n'), objects, objectDetailsOmitted });
  });

  const observed = [...colors.values()].sort((a, b) => b.count - a.count);
  const backgroundColors = observed.filter(item => item.uses.background).sort((a, b) => b.uses.background - a.uses.background);
  const backgroundColor = backgroundColors[0]?.hex || theme.colors.lt1 || theme.colors.bg1 || '#F4F1E9';
  const fillColors = observed.filter(item => item.uses['shape-fill']).sort((a, b) => b.uses['shape-fill'] - a.uses['shape-fill']);
  const primaryColor = theme.colors.accent1 || fillColors.find(item => item.hex !== backgroundColor && relativeLuminance(item.hex) < 0.9)?.hex || '#294C3B';
  const surfaceColor = theme.colors.lt2 || fillColors.filter(item => item.hex !== backgroundColor && item.hex !== primaryColor).sort((a, b) => relativeLuminance(b.hex) - relativeLuminance(a.hex))[0]?.hex || backgroundColor;
  const accentColor = theme.colors.accent2 || fillColors.find(item => item.hex !== backgroundColor && item.hex !== primaryColor && item.hex !== surfaceColor && relativeLuminance(item.hex) < 0.9)?.hex || theme.colors.accent3 || '#D2744C';
  const observedFont = [...fonts.keys()][0] || '';
  const chooseFont = (...candidates: string[]) => candidates.find(font => font && /^[\p{L}\p{N} _.-]{1,64}$/u.test(font)) || 'Microsoft YaHei';
  const textColors = observed.filter(item => item.uses.text).sort((a, b) => b.uses.text - a.uses.text);
  const textColor = textColors[0]?.hex || theme.colors.dk1 || theme.colors.tx1 || '#1C2822';
  const inferredTheme = {
    primary: primaryColor,
    background: backgroundColor,
    surface: surfaceColor,
    text: textColor,
    muted: textColors.find(item => item.hex !== textColor)?.hex || '#66736B',
    accent: accentColor,
    headingFont: chooseFont(theme.fonts.headingEastAsian, theme.fonts.headingLatin, observedFont),
    bodyFont: chooseFont(theme.fonts.bodyEastAsian, theme.fonts.bodyLatin, observedFont),
  };
  const warningsUnique = [...new Set(warnings)];
  const textMarkdown = `# PPTX 页面文字提取\n\n> 仅按 OOXML 文本顺序提取；不复现母版继承、完整图表数据、动画、转场或 PowerPoint 真实分页。\n\n${slides.map(page => `## 第 ${page.page} 页\n\n${page.text || '（未提取到文字）'}\n`).join('\n')}`;
  const designTokens = {
    schemaVersion: 1,
    sourceSHA256: sha(bytes),
    slideSizeInches: { width: +(widthEmu / EMU_PER_INCH).toFixed(3), height: +(heightEmu / EMU_PER_INCH).toFixed(3), ratio: +(widthEmu / heightEmu).toFixed(4) },
    themeColors: theme.colors,
    suggestedThemeForSlidesCompose: inferredTheme,
    themeFonts: theme.fonts,
    observedFonts: [...fonts].map(([family, count]) => ({ family, count })).sort((a, b) => b.count - a.count),
    observedFontSizesPt: fontSizes.length ? { min: Math.min(...fontSizes), max: Math.max(...fontSizes), sampleCount: fontSizes.length, under14PtCount: fontSizes.filter(size => size < 14).length } : null,
    observedColors: observed,
    note: '这是从主题部件和直接格式提取的机器可读样式草案，不等于对母版、占位符、布局继承或视觉角色的完整还原。建议复制 suggestedThemeForSlidesCompose 中的颜色与字体到结构化 JSON 输入，再人工检查。',
  };
  const analysis = {
    schemaVersion: 1,
    inputSHA256: sha(bytes),
    editableObjectEvidence: { slideCount: slides.length, textShapeCount: textShapeTotal, pictureCount: pictureTotal, chartCount: chartTotal, tableCount: tableTotal, shapeCount: shapeTotal, imageDominatedLikelySlideCount: imageDominatedSlides },
    slideSize: designTokens.slideSizeInches,
    checks: [
      { id: 'ooxml-package', status: 'pass', detail: 'ZIP 中央目录、路径、XML 实体及包关系已检查。' },
      { id: 'slide-part-links', status: 'pass', detail: `${slides.length} 个幻灯片 ID 均解析到唯一的内部 OOXML slide 部件。` },
      { id: 'object-canvas-bounds', status: outOfBoundsTotal || geometryTotal < shapeTotal ? 'warning' : 'pass', detail: `${outOfBoundsTotal ? `${outOfBoundsTotal} 个对象框位于画布之外或尺寸无效。 ` : ''}${geometryTotal < shapeTotal ? `${shapeTotal - geometryTotal} 个对象没有可解析的直接几何边界。 ` : ''}这是静态几何检查，不判定文字溢出或重叠。` },
      { id: 'visual-render', status: 'rendered-locally', detail: '下面的预览由本地 LibreOffice 渲染；仍需人工逐页检查。' },
      { id: 'text-overflow-and-overlap', status: 'not-automatically-verified', detail: '没有用像素差异或机器视觉声称溢出、重叠、可读性或设计质量通过。' },
    ],
    warnings: warningsUnique,
    slides,
    limitations: [
      '读取幻灯片关系顺序、主题颜色/字体、直接对象边界、文本、图片/图表/表格数量；不完整展开母版/布局继承或占位符样式。',
      '主题值、样式频次、全页位图判断都是结构或启发式证据；不能证明对象语义或可编辑性达到设计意图。',
      'LibreOffice 渲染不是 Microsoft PowerPoint 像素级结果；字体缺失/替代会改变排版。',
      '本技能只读取与出图，不修改输入 PPTX、不联网、不调用 AI，不自动保证内容事实或视觉质量。',
    ],
    requiresHumanReview: true,
  };
  return { slideCount: slides.length, analysis, designTokens, textMarkdown, warnings: warningsUnique };
}

export async function inspectPresentation(input: SkillInput, event: (message: string) => void) {
  if (!/\.pptx$/i.test(input.filename)) throw Error('此技能只接受标准 .pptx 文件。');
  const inspected = analyzePresentation(input.bytes);
  event(`已读取 ${inspected.slideCount} 页 OOXML；统计可编辑对象、文字、尺寸与主题令牌。`);
  let rendered: Awaited<ReturnType<typeof renderPresentation>> | undefined;
  let renderFailure: Record<string, unknown> | undefined;
  try {
    rendered = await renderPresentation(input.bytes, inspected.slideCount, event, { workDirectory: input.workDirectory });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : '未知渲染错误';
    renderFailure = {
      schemaVersion: 1,
      status: presentationRendererAvailable() ? 'failed' : 'unavailable',
      sourceSHA256: sha(input.bytes),
      renderer: 'LibreOffice via @deepseek-ai/libreoffice-kit',
      pageCount: inspected.slideCount,
      error: message,
      review: { visualReviewRequired: true, automaticVisualPass: false, note: '结构分析已完成，但没有生成逐页渲染图；不可视为完成视觉质检。' },
    };
    event(`OOXML结构分析已完成，但本机渲染未成功：${message}。报告将明确标记，不伪造预览图。`);
  }
  const renderReport = rendered?.report || renderFailure!;
  const analysis = {
    ...inspected.analysis,
    checks: inspected.analysis.checks.map((check: any) => check.id === 'visual-render'
      ? { ...check, status: rendered ? 'rendered-locally' : renderFailure?.status, detail: rendered ? '页面图像由本地 LibreOffice 渲染；仍需人工逐页检查。' : `未能得到本地渲染：${renderFailure?.error}` }
      : check),
    render: renderReport,
  };
  const outputs: Output[] = [
    json('pptx-analysis.json', analysis),
    json('pptx-design-tokens.json', inspected.designTokens),
    out('pptx-text.md', 'text/markdown; charset=utf-8', inspected.textMarkdown),
    ...(rendered ? rendered.outputs.filter(item => item.name !== 'render-report.json') : []),
    json('render-report.json', renderReport),
  ];
  const evidence = inspected.analysis.editableObjectEvidence;
  const missingFonts = Array.isArray(rendered?.report.missingFonts) ? rendered.report.missingFonts.filter((font): font is string => typeof font === 'string').slice(0, 5) : [];
  return {
    summary: rendered
      ? `实际解析 ${inspected.slideCount} 页，提取 ${evidence.textShapeCount} 个含文字对象、${evidence.chartCount} 个图表与 ${evidence.pictureCount} 个图片对象；已用本地 LibreOffice 渲染并输出设计令牌、逐页预览和结构报告。${missingFonts.length ? `当前渲染环境缺少字体（${missingFonts.join('、')}），部分文字可能替代或缺字。` : ''}对象框检查不等于文字溢出检查，仍须人工逐页复核。`
      : `已分析 ${inspected.slideCount} 页 OOXML，提取 ${evidence.textShapeCount} 个含文字对象、${evidence.chartCount} 个图表与 ${evidence.pictureCount} 个图片对象；但本机渲染未成功，结构报告不会冒充视觉验收。`,
    outputs,
  };
}
