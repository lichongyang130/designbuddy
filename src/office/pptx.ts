/**
 * PPTX 读写（零第三方依赖，基于标准 OOXML PresentationML + Node zlib）。
 *
 * - `readPptx`：ZIP → ppt/slides/slideN.xml → 提取每页标题与段落文本。
 * - `writePptx`：把前端可视化编辑器的结构化场景图（1280×720 / 960×720 逻辑画布）
 *   编译为标准 `.pptx` 包，WPS 演示 / PowerPoint / Keynote / LibreOffice 可直接打开继续编辑。
 */

import { unzip, zip } from './zip.ts'
import type { ZipEntry } from './zip.ts'
import { decodeXml, escapeXml } from './xml.ts'

export interface SlideText {
  index: number
  title: string
  lines: string[]
  notes?: string
}

export interface PptxResult {
  slides: SlideText[]
}

export function readPptx(buf: Buffer): PptxResult {
  const files = unzip(buf)
  const slides: SlideText[] = []

  const names = [...files.keys()]
    .map((name) => ({ name, match: /^ppt\/slides\/slide(\d+)\.xml$/.exec(name) }))
    .filter((item) => item.match !== null)
    .sort((a, b) => Number(a.match![1]) - Number(b.match![1]))

  for (const { name } of names) {
    const xml = files.get(name)!.toString('utf8')
    const lines: string[] = []
    const paragraphRe = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g
    for (const para of xml.matchAll(paragraphRe)) {
      const body = para[1] ?? ''
      const parts: string[] = []
      for (const text of body.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)) {
        parts.push(decodeXml(text[1] ?? ''))
      }
      const line = parts.join('').replace(/\s+/g, ' ').trim()
      if (line !== '') lines.push(line)
    }
    const number = Number(/slide(\d+)\.xml$/.exec(name)![1])
    const notesXml = files.get(`ppt/notesSlides/notesSlide${number}.xml`)?.toString('utf8')
    let notes: string | undefined
    if (notesXml) {
      const noteParts: string[] = []
      for (const para of notesXml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)) {
        const segs: string[] = []
        for (const t of (para[1] ?? '').matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)) {
          segs.push(decodeXml(t[1] ?? ''))
        }
        const txt = segs.join('').trim()
        if (txt !== '' && txt !== String(number)) noteParts.push(txt)
      }
      if (noteParts.length > 0) notes = noteParts.join('\n')
    }
    slides.push({ index: number, title: lines[0] ?? '', lines, ...(notes ? { notes } : {}) })
  }

  return { slides }
}

export function formatPptx(result: PptxResult): string {
  if (result.slides.length === 0) return '没有找到幻灯片（ppt/slides 为空）。'
  const out: string[] = [`共 ${result.slides.length} 页`]
  for (const slide of result.slides) {
    out.push('', `## 第 ${slide.index} 页${slide.title ? ` · ${slide.title}` : ''}`)
    const body = slide.lines.slice(1)
    if (body.length === 0) out.push('（无正文）')
    else for (const line of body) out.push(line)
    if (slide.notes) out.push(`> 备注：${slide.notes}`)
  }
  return out.join('\n')
}

/* ── PPTX 写出模型与生成器 ──────────────────────────────────────── */

export interface PptxElementStyle {
  fontFamily?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  color?: string
  highlight?: string
  align?: 'left' | 'center' | 'right' | 'justify'
  valign?: 'top' | 'middle' | 'bottom'
  lineHeight?: number
  letterSpacing?: number
  bullet?: boolean | 'disc' | 'number'
  fill?: string
  fillGradient?: { from: string; to: string; angle?: number }
  opacity?: number
  stroke?: string
  strokeWidth?: number
  strokeDash?: 'solid' | 'dashed' | 'dotted'
  radius?: number
  padding?: number
}

export interface PptxChartSeries {
  name: string
  values: number[]
  color?: string
}

export interface PptxElementInput {
  id?: string
  type: 'text' | 'shape' | 'image' | 'table' | 'chart'
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  hyperlink?: string
  text?: string
  shape?: string
  style?: PptxElementStyle
  /** image: data URL 或服务端已解析好的二进制 */
  src?: string
  imageBuffer?: Buffer
  imageExt?: 'png' | 'jpeg'
  /** table */
  rows?: string[][]
  headerRow?: boolean
  zebra?: boolean
  headerFill?: string
  headerColor?: string
  borderColor?: string
  /** chart */
  chartType?: 'column' | 'bar' | 'line' | 'area' | 'pie' | 'donut'
  chartTitle?: string
  categories?: string[]
  series?: PptxChartSeries[]
  showValues?: boolean
  showLegend?: boolean
}

export interface PptxSlideBackground {
  color?: string
  gradient?: { from: string; to: string; angle?: number }
  imageBuffer?: Buffer
  imageExt?: 'png' | 'jpeg'
}

export interface PptxSlideInput {
  title?: string
  hidden?: boolean
  notes?: string
  background?: PptxSlideBackground
  transition?: {
    type?: 'none' | 'fade' | 'push' | 'wipe' | 'zoom' | 'morph'
    durationMs?: number
  }
  elements: PptxElementInput[]
}

export interface PptxDeckInput {
  title?: string
  author?: string
  ratio?: '16:9' | '4:3'
  theme?: {
    paper?: string
    ink?: string
    accent?: string
    second?: string
    muted?: string
    rule?: string
  }
  slides: PptxSlideInput[]
}

/** 96 DPI 下 1px = 9525 EMU；1280×720 对应 12192000×6858000 EMU（标准 16:9 宽屏）。 */
const EMU_PER_PX = 9525

function emu(px: number): number {
  if (!Number.isFinite(px)) return 0
  return Math.round(px * EMU_PER_PX)
}

interface ParsedColor {
  hex: string
  alpha?: number
}

function parseColor(raw: string | undefined, fallback = '17171B'): ParsedColor | null {
  if (!raw) return fallback ? { hex: fallback } : null
  const trimmed = raw.trim().toLowerCase()
  if (trimmed === 'transparent' || trimmed === 'none' || trimmed === '') return null

  const hex6 = /^#?([0-9a-f]{6})$/i.exec(trimmed)
  if (hex6) return { hex: hex6[1]!.toUpperCase() }

  const hex8 = /^#?([0-9a-f]{6})([0-9a-f]{2})$/i.exec(trimmed)
  if (hex8) {
    const a = Math.round((Number.parseInt(hex8[2]!, 16) / 255) * 100_000)
    return { hex: hex8[1]!.toUpperCase(), alpha: a }
  }

  const hex3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(trimmed)
  if (hex3) {
    return { hex: (hex3[1]! + hex3[1]! + hex3[2]! + hex3[2]! + hex3[3]! + hex3[3]!).toUpperCase() }
  }

  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)$/.exec(trimmed)
  if (rgba) {
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
    const r = clamp(Number(rgba[1])).toString(16).padStart(2, '0')
    const g = clamp(Number(rgba[2])).toString(16).padStart(2, '0')
    const b = clamp(Number(rgba[3])).toString(16).padStart(2, '0')
    const alphaRaw = rgba[4] !== undefined ? Number(rgba[4]) : 1
    if (alphaRaw <= 0) return null
    const alpha = alphaRaw < 1 ? Math.round(Math.max(0, Math.min(1, alphaRaw)) * 100_000) : undefined
    return { hex: (r + g + b).toUpperCase(), alpha }
  }

  return fallback ? { hex: fallback } : null
}

function solidFillXml(color: string | undefined, opacity = 1, fallback = ''): string {
  const parsed = parseColor(color, fallback)
  if (!parsed) return '<a:noFill/>'
  const baseAlpha = parsed.alpha !== undefined ? parsed.alpha / 100_000 : 1
  const combined = Math.max(0, Math.min(1, baseAlpha * (Number.isFinite(opacity) ? opacity : 1)))
  if (combined <= 0.001) return '<a:noFill/>'
  const alphaTag = combined < 0.999 ? `<a:alpha val="${Math.round(combined * 100_000)}"/>` : ''
  return `<a:solidFill><a:srgbClr val="${parsed.hex}">${alphaTag}</a:srgbClr></a:solidFill>`
}

function gradFillXml(from: string, to: string, angleDeg = 135, opacity = 1): string {
  const c1 = parseColor(from, 'FFFFFF') ?? { hex: 'FFFFFF' }
  const c2 = parseColor(to, 'E5E7EB') ?? { hex: 'E5E7EB' }
  const ang = (((angleDeg % 360) + 360) % 360) * 60_000
  const alphaTag = opacity < 0.999 ? `<a:alpha val="${Math.round(Math.max(0, opacity) * 100_000)}"/>` : ''
  return (
    `<a:gradFill rotWithShape="1"><a:gsLst>` +
    `<a:gs pos="0"><a:srgbClr val="${c1.hex}">${alphaTag}</a:srgbClr></a:gs>` +
    `<a:gs pos="100000"><a:srgbClr val="${c2.hex}">${alphaTag}</a:srgbClr></a:gs>` +
    `</a:gsLst><a:lin ang="${ang}" scaled="1"/></a:gradFill>`
  )
}

function strokeXml(style: PptxElementStyle | undefined): string {
  if (!style || !style.stroke || (style.strokeWidth ?? 0) <= 0) return '<a:ln><a:noFill/></a:ln>'
  const parsed = parseColor(style.stroke, '')
  if (!parsed) return '<a:ln><a:noFill/></a:ln>'
  const w = Math.max(6350, emu(style.strokeWidth ?? 1))
  const dash =
    style.strokeDash === 'dashed'
      ? '<a:prstDash val="dash"/>'
      : style.strokeDash === 'dotted'
        ? '<a:prstDash val="sysDot"/>'
        : ''
  const alphaTag = parsed.alpha !== undefined ? `<a:alpha val="${parsed.alpha}"/>` : ''
  return `<a:ln w="${w}"><a:solidFill><a:srgbClr val="${parsed.hex}">${alphaTag}</a:srgbClr></a:solidFill>${dash}</a:ln>`
}

const SHAPE_MAP: Record<string, string> = {
  rect: 'rect',
  roundRect: 'roundRect',
  pill: 'roundRect',
  ellipse: 'ellipse',
  circle: 'ellipse',
  triangle: 'triangle',
  rightTriangle: 'rtTriangle',
  diamond: 'diamond',
  parallelogram: 'parallelogram',
  hexagon: 'hexagon',
  pentagon: 'pentagon',
  star5: 'star5',
  badge: 'homePlate',
  frame: 'frame',
  line: 'line',
  arrowRight: 'rightArrow',
  arrowLeft: 'leftArrow',
  arrowUp: 'upArrow',
  arrowDown: 'downArrow',
  arrowBoth: 'leftRightArrow',
  chevron: 'chevron',
  flowStart: 'flowChartTerminator',
  flowProcess: 'flowChartProcess',
  flowDecision: 'flowChartDecision',
  flowDoc: 'flowChartDocument',
  callout: 'wedgeRoundRectCallout',
}

function mapFontName(raw: string | undefined): { latin: string; ea: string } {
  const f = (raw ?? '').toLowerCase()
  if (f.includes('serif') || f.includes('song') || f.includes('宋')) {
    return { latin: 'Georgia', ea: 'Songti SC' }
  }
  if (f.includes('mono') || f.includes('code')) {
    return { latin: 'Consolas', ea: 'PingFang SC' }
  }
  return { latin: 'Calibri', ea: 'Microsoft YaHei' }
}

function alignAttr(align: PptxElementStyle['align']): string {
  if (align === 'center') return 'ctr'
  if (align === 'right') return 'r'
  if (align === 'justify') return 'just'
  return 'l'
}

function valignAttr(valign: PptxElementStyle['valign']): string {
  if (valign === 'middle') return 'ctr'
  if (valign === 'bottom') return 'b'
  return 't'
}

function textBodyXml(text: string, style: PptxElementStyle = {}, defaultValign: 'top' | 'middle' = 'top'): string {
  const pad = emu(style.padding ?? 8)
  const anchor = valignAttr(style.valign ?? defaultValign)
  const fontSizePt100 = Math.max(600, Math.round((style.fontSize ?? 18) * 75))
  const color = parseColor(style.color, '17171B') ?? { hex: '17171B' }
  const highlight = style.highlight ? parseColor(style.highlight, '') : null
  const fonts = mapFontName(style.fontFamily)
  const algn = alignAttr(style.align)
  const lnSpc = Math.round(Math.max(90, Math.min(300, (style.lineHeight ?? 1.35) * 100)) * 1000)
  const spc = style.letterSpacing ? ` spc="${Math.round(style.letterSpacing * 75)}"` : ''

  const rPrAttrs = [
    'lang="zh-CN"',
    'altLang="en-US"',
    `sz="${fontSizePt100}"`,
    style.bold ? 'b="1"' : 'b="0"',
    style.italic ? 'i="1"' : 'i="0"',
    style.underline ? 'u="sng"' : '',
    style.strike ? 'strike="sngStrike"' : '',
    spc,
    'dirty="0"',
  ]
    .filter(Boolean)
    .join(' ')

  const rPrInner =
    `<a:solidFill><a:srgbClr val="${color.hex}"/></a:solidFill>` +
    (highlight ? `<a:highlight><a:srgbClr val="${highlight.hex}"/></a:highlight>` : '') +
    `<a:latin typeface="${escapeXml(fonts.latin)}"/>` +
    `<a:ea typeface="${escapeXml(fonts.ea)}"/>`

  const lines = String(text ?? '').split(/\r?\n/)
  const bulletXml =
    style.bullet === 'number'
      ? '<a:buAutoNum type="arabicPeriod"/>'
      : style.bullet
        ? '<a:buChar char="•"/>'
        : '<a:buNone/>'

  const paras = lines
    .map((line) => {
      const pPr = `<a:pPr algn="${algn}">${bulletXml}<a:lnSpc><a:spcPct val="${lnSpc}"/></a:lnSpc></a:pPr>`
      if (line === '') {
        return `<a:p>${pPr}<a:endParaRPr lang="zh-CN" sz="${fontSizePt100}"/></a:p>`
      }
      return `<a:p>${pPr}<a:r><a:rPr ${rPrAttrs}>${rPrInner}</a:rPr><a:t>${escapeXml(line)}</a:t></a:r></a:p>`
    })
    .join('')

  return (
    `<p:txBody>` +
    `<a:bodyPr wrap="square" rtlCol="0" anchor="${anchor}" lIns="${pad}" tIns="${pad}" rIns="${pad}" bIns="${pad}"><a:spAutoFit/></a:bodyPr>` +
    `<a:lstStyle/>` +
    paras +
    `</p:txBody>`
  )
}

function shapeElementXml(id: number, name: string, el: PptxElementInput, linkId?: string): string {
  const style = el.style ?? {}
  const x = emu(el.x)
  const y = emu(el.y)
  const cx = Math.max(emu(4), emu(el.w))
  const cy = Math.max(emu(4), emu(el.h))
  const rot = el.rotation ? ` rot="${Math.round(el.rotation * 60_000)}"` : ''

  const rawShape = el.type === 'text' ? (style.radius && style.radius > 2 ? 'roundRect' : 'rect') : (el.shape ?? 'rect')
  const prst = SHAPE_MAP[rawShape] ?? (style.radius && style.radius > 2 ? 'roundRect' : 'rect')
  const isRound = prst === 'roundRect' && (style.radius ?? 0) > 0
  const shortSide = Math.max(1, Math.min(el.w, el.h))
  const adjVal = isRound ? Math.min(50000, Math.round(((style.radius ?? 12) / shortSide) * 100_000)) : 0
  const avLst = isRound ? `<a:avLst><a:gd name="adj" fmla="val ${adjVal}"/></a:avLst>` : '<a:avLst/>'

  const opacity = style.opacity ?? 1
  const fill = style.fillGradient
    ? gradFillXml(style.fillGradient.from, style.fillGradient.to, style.fillGradient.angle ?? 135, opacity)
    : solidFillXml(style.fill, opacity, '')

  const ln = rawShape === 'line'
    ? strokeXml({ ...style, stroke: style.stroke || style.fill || '#17171B', strokeWidth: style.strokeWidth || Math.max(1.5, el.h) })
    : strokeXml(style)

  const txBoxAttr = el.type === 'text' ? ' txBox="1"' : ''
  const defaultValign = el.type === 'shape' ? 'middle' : 'top'
  const txBody =
    rawShape === 'line'
      ? '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>'
      : textBodyXml(el.text ?? '', style, defaultValign)

  return (
    `<p:sp>` +
    `<p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}">${linkId ? `<a:hlinkClick r:id="${linkId}"/>` : ''}</p:cNvPr><p:cNvSpPr${txBoxAttr}/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr>` +
    `<a:xfrm${rot}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="${prst}">${avLst}</a:prstGeom>` +
    (rawShape === 'line' ? '<a:noFill/>' : fill) +
    ln +
    `</p:spPr>` +
    txBody +
    `</p:sp>`
  )
}

function picElementXml(id: number, name: string, rId: string, el: PptxElementInput, linkId?: string): string {
  const x = emu(el.x)
  const y = emu(el.y)
  const cx = Math.max(emu(10), emu(el.w))
  const cy = Math.max(emu(10), emu(el.h))
  const rot = el.rotation ? ` rot="${Math.round(el.rotation * 60_000)}"` : ''
  const prst = el.shape === 'circle' ? 'ellipse' : (el.style?.radius ?? 0) > 4 ? 'roundRect' : 'rect'
  return (
    `<p:pic>` +
    `<p:nvPicPr><p:cNvPr id="${id}" name="${escapeXml(name)}">${linkId ? `<a:hlinkClick r:id="${linkId}"/>` : ''}</p:cNvPr><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr>` +
    `<a:xfrm${rot}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>` +
    strokeXml(el.style) +
    `</p:spPr>` +
    `</p:pic>`
  )
}

function tableElementXml(id: number, name: string, el: PptxElementInput, themeAccent = '1F4FFF'): string {
  const rows = el.rows && el.rows.length > 0 ? el.rows : [['列 1', '列 2'], ['数据', '100']]
  const colCount = Math.max(1, ...rows.map((r) => r.length))
  const rowCount = rows.length
  const x = emu(el.x)
  const y = emu(el.y)
  const cx = Math.max(emu(60), emu(el.w))
  const cy = Math.max(emu(40), emu(el.h))
  const colW = Math.floor(cx / colCount)
  const rowH = Math.floor(cy / rowCount)

  const style = el.style ?? {}
  const fontSize = Math.max(800, Math.round((style.fontSize ?? 15) * 75))
  const fonts = mapFontName(style.fontFamily)
  const borderHex = (parseColor(el.borderColor ?? style.stroke, 'D6D9E0') ?? { hex: 'D6D9E0' }).hex
  const headerFillHex = (parseColor(el.headerFill, themeAccent) ?? { hex: themeAccent }).hex
  const headerColorHex = (parseColor(el.headerColor, 'FFFFFF') ?? { hex: 'FFFFFF' }).hex
  const bodyColorHex = (parseColor(style.color, '17171B') ?? { hex: '17171B' }).hex
  const bodyFillHex = parseColor(style.fill, '')?.hex
  const algn = alignAttr(style.align)

  const gridCols = new Array(colCount).fill(`<a:gridCol w="${colW}"/>`).join('')
  const borderLine = `<a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="${borderHex}"/></a:solidFill></a:ln>`
  const cellBorders = `<a:lnL w="9525"><a:solidFill><a:srgbClr val="${borderHex}"/></a:solidFill></a:lnL><a:lnR w="9525"><a:solidFill><a:srgbClr val="${borderHex}"/></a:solidFill></a:lnR><a:lnT w="9525"><a:solidFill><a:srgbClr val="${borderHex}"/></a:solidFill></a:lnT><a:lnB w="9525"><a:solidFill><a:srgbClr val="${borderHex}"/></a:solidFill></a:lnB>`

  const trs = rows
    .map((row, rIdx) => {
      const isHead = el.headerRow !== false && rIdx === 0
      const tcs = new Array(colCount)
        .fill('')
        .map((_, cIdx) => {
          const val = String(row[cIdx] ?? '')
          const textHex = isHead ? headerColorHex : bodyColorHex
          const bold = isHead || style.bold ? '1' : '0'
          const cellBg = isHead
            ? `<a:solidFill><a:srgbClr val="${headerFillHex}"/></a:solidFill>`
            : el.zebra && rIdx % 2 === 1
              ? `<a:solidFill><a:srgbClr val="F4F6FA"/></a:solidFill>`
              : bodyFillHex
                ? `<a:solidFill><a:srgbClr val="${bodyFillHex}"/></a:solidFill>`
                : '<a:noFill/>'

          return (
            `<a:tc>` +
            `<a:txBody><a:bodyPr anchor="ctr" lIns="76200" rIns="76200" tIns="45720" bIns="45720"/><a:lstStyle/>` +
            `<a:p><a:pPr algn="${algn}"/>` +
            `<a:r><a:rPr lang="zh-CN" sz="${fontSize}" b="${bold}">` +
            `<a:solidFill><a:srgbClr val="${textHex}"/></a:solidFill>` +
            `<a:latin typeface="${escapeXml(fonts.latin)}"/><a:ea typeface="${escapeXml(fonts.ea)}"/>` +
            `</a:rPr><a:t>${escapeXml(val)}</a:t></a:r></a:p></a:txBody>` +
            `<a:tcPr marL="76200" marR="76200" marT="45720" marB="45720" anchor="ctr">${cellBorders}${cellBg}</a:tcPr>` +
            `</a:tc>`
          )
        })
        .join('')
      void borderLine
      return `<a:tr h="${rowH}">${tcs}</a:tr>`
    })
    .join('')

  return (
    `<p:graphicFrame>` +
    `<p:nvGraphicFramePr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>` +
    `<p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">` +
    `<a:tbl><a:tblPr firstRow="${el.headerRow !== false ? '1' : '0'}" bandRow="${el.zebra ? '1' : '0'}"/>` +
    `<a:tblGrid>${gridCols}</a:tblGrid>${trs}</a:tbl>` +
    `</a:graphicData></a:graphic>` +
    `</p:graphicFrame>`
  )
}

/**
 * 图表写出为可编辑矢量组合图形（Group Shape），
 * 这样在 WPS / PowerPoint / Keynote 里 100% 零兼容告警打开，且每根柱子、标签都能点击微调。
 */
function chartGroupXml(startId: number, el: PptxElementInput, palette: string[], inkHex: string, mutedHex: string, ruleHex: string): { xml: string; nextId: number } {
  let id = startId
  const grpId = id++
  const children: string[] = []

  const cats = el.categories && el.categories.length > 0 ? el.categories : ['Q1', 'Q2', 'Q3', 'Q4']
  const series = el.series && el.series.length > 0 ? el.series : [{ name: '系列 1', values: [35, 58, 74, 92] }]
  const allVals = series.flatMap((s) => s.values.map((v) => Number(v) || 0))
  const maxVal = Math.max(1, ...allVals)

  // 背景容器
  if (el.style?.fill && el.style.fill !== 'transparent') {
    children.push(
      shapeElementXml(id++, '图表背景', {
        type: 'shape',
        shape: 'roundRect',
        x: el.x,
        y: el.y,
        w: el.w,
        h: el.h,
        style: { fill: el.style.fill, stroke: el.style.stroke, strokeWidth: el.style.strokeWidth, radius: el.style.radius ?? 10 },
      }),
    )
  }

  let padTop = 18
  if (el.chartTitle) {
    children.push(
      shapeElementXml(id++, '图表标题', {
        type: 'text',
        x: el.x + 16,
        y: el.y + 10,
        w: el.w - 32,
        h: 30,
        text: el.chartTitle,
        style: { fontSize: 16, bold: true, color: '#' + inkHex, padding: 2 },
      }),
    )
    padTop = 46
  }

  const padLeft = el.chartType === 'bar' ? 110 : 52
  const padRight = 28
  const padBottom = el.showLegend !== false && series.length > 1 ? 56 : 38
  const plotX = el.x + padLeft
  const plotY = el.y + padTop
  const plotW = Math.max(80, el.w - padLeft - padRight)
  const plotH = Math.max(60, el.h - padTop - padBottom)

  if (el.chartType === 'bar') {
    const rowH = plotH / Math.max(1, cats.length)
    cats.forEach((cat, cIdx) => {
      const cy = plotY + cIdx * rowH
      children.push(
        shapeElementXml(id++, `分类-${cIdx + 1}`, {
          type: 'text',
          x: el.x + 12,
          y: cy + rowH * 0.15,
          w: padLeft - 18,
          h: Math.max(20, rowH * 0.7),
          text: cat,
          style: { fontSize: 12, color: '#' + mutedHex, align: 'right', valign: 'middle', padding: 2 },
        }),
      )
      const barBandH = Math.max(10, (rowH * 0.64) / series.length)
      series.forEach((s, sIdx) => {
        const val = Math.max(0, Number(s.values[cIdx]) || 0)
        const bw = Math.max(6, (val / maxVal) * plotW)
        const color = s.color || palette[sIdx % palette.length] || '#1F4FFF'
        const by = cy + rowH * 0.18 + sIdx * (barBandH + 2)
        children.push(
          shapeElementXml(id++, `${s.name}-${cat}`, {
            type: 'shape',
            shape: 'roundRect',
            x: plotX,
            y: by,
            w: bw,
            h: barBandH,
            style: { fill: color, radius: 4 },
          }),
        )
        if (el.showValues !== false) {
          children.push(
            shapeElementXml(id++, `数值-${cIdx}`, {
              type: 'text',
              x: plotX + bw + 6,
              y: by - 2,
              w: 64,
              h: barBandH + 4,
              text: String(val),
              style: { fontSize: 11, bold: true, color: '#' + inkHex, valign: 'middle', padding: 0 },
            }),
          )
        }
      })
    })
  } else if (el.chartType === 'pie' || el.chartType === 'donut') {
    const values = (series[0]?.values ?? [40, 30, 20, 10]).map((v) => Math.max(0, Number(v) || 0))
    const total = Math.max(1, values.reduce((a, b) => a + b, 0))
    const rowH = Math.min(38, plotH / Math.max(1, cats.length))
    cats.forEach((cat, idx) => {
      const val = values[idx] ?? 0
      const pct = Math.round((val / total) * 100)
      const color = palette[idx % palette.length] || '#1F4FFF'
      const ry = plotY + idx * rowH
      children.push(
        shapeElementXml(id++, `图例块-${idx}`, {
          type: 'shape',
          shape: 'roundRect',
          x: plotX,
          y: ry + 6,
          w: 16,
          h: 16,
          style: { fill: color, radius: 4 },
        }),
      )
      children.push(
        shapeElementXml(id++, `占比条-${idx}`, {
          type: 'shape',
          shape: 'roundRect',
          x: plotX + 26,
          y: ry + 6,
          w: Math.max(12, (pct / 100) * (plotW * 0.52)),
          h: 16,
          style: { fill: color, radius: 4 },
        }),
      )
      children.push(
        shapeElementXml(id++, `占比文-${idx}`, {
          type: 'text',
          x: plotX + 32 + plotW * 0.52,
          y: ry + 2,
          w: plotW * 0.42,
          h: 24,
          text: `${cat}：${val} (${pct}%)`,
          style: { fontSize: 12, color: '#' + inkHex, valign: 'middle', padding: 0 },
        }),
      )
    })
  } else {
    // 柱形图 / 折线图 / 面积图：绘制网格线 + 柱体/节点 + 分类轴
    for (let g = 0; g <= 4; g += 1) {
      const gy = plotY + (plotH * g) / 4
      const tickVal = Math.round(maxVal * (1 - g / 4))
      children.push(
        shapeElementXml(id++, `网格-${g}`, {
          type: 'shape',
          shape: 'line',
          x: plotX,
          y: gy,
          w: plotW,
          h: 1,
          style: { stroke: '#' + ruleHex, strokeWidth: 1 },
        }),
      )
      children.push(
        shapeElementXml(id++, `刻度-${g}`, {
          type: 'text',
          x: el.x + 6,
          y: gy - 10,
          w: padLeft - 12,
          h: 20,
          text: String(tickVal),
          style: { fontSize: 10, color: '#' + mutedHex, align: 'right', valign: 'middle', padding: 0 },
        }),
      )
    }

    const groupW = plotW / Math.max(1, cats.length)
    cats.forEach((cat, cIdx) => {
      const gx = plotX + cIdx * groupW
      children.push(
        shapeElementXml(id++, `轴标签-${cIdx}`, {
          type: 'text',
          x: gx,
          y: plotY + plotH + 6,
          w: groupW,
          h: 22,
          text: cat,
          style: { fontSize: 11, color: '#' + mutedHex, align: 'center', padding: 0 },
        }),
      )

      const colBandW = Math.max(8, (groupW * 0.62) / series.length)
      series.forEach((s, sIdx) => {
        const val = Math.max(0, Number(s.values[cIdx]) || 0)
        const bh = Math.max(4, (val / maxVal) * plotH)
        const bx = gx + groupW * 0.19 + sIdx * (colBandW + 3)
        const by = plotY + plotH - bh
        const color = s.color || palette[sIdx % palette.length] || '#1F4FFF'

        if (el.chartType === 'line' || el.chartType === 'area') {
          children.push(
            shapeElementXml(id++, `节点-${sIdx}-${cIdx}`, {
              type: 'shape',
              shape: 'ellipse',
              x: gx + groupW / 2 - 6,
              y: by - 6,
              w: 12,
              h: 12,
              style: { fill: color, stroke: '#FFFFFF', strokeWidth: 2 },
            }),
          )
        } else {
          children.push(
            shapeElementXml(id++, `柱-${sIdx}-${cIdx}`, {
              type: 'shape',
              shape: 'roundRect',
              x: bx,
              y: by,
              w: colBandW,
              h: bh,
              style: { fill: color, radius: 4 },
            }),
          )
        }
        if (el.showValues !== false) {
          children.push(
            shapeElementXml(id++, `值-${sIdx}-${cIdx}`, {
              type: 'text',
              x: bx - 10,
              y: Math.max(el.y + 4, by - 20),
              w: colBandW + 20,
              h: 18,
              text: String(val),
              style: { fontSize: 10, bold: true, color: '#' + inkHex, align: 'center', padding: 0 },
            }),
          )
        }
      })
    })
  }

  const x = emu(el.x)
  const y = emu(el.y)
  const cx = Math.max(emu(60), emu(el.w))
  const cy = Math.max(emu(40), emu(el.h))

  const xml =
    `<p:grpSp>` +
    `<p:nvGrpSpPr><p:cNvPr id="${grpId}" name="${escapeXml(el.chartTitle || '图表')}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/><a:chOff x="${x}" y="${y}"/><a:chExt cx="${cx}" cy="${cy}"/></a:xfrm></p:grpSpPr>` +
    children.join('') +
    `</p:grpSp>`

  return { xml, nextId: id }
}

function transitionXml(tr: PptxSlideInput['transition']): string {
  if (!tr || !tr.type || tr.type === 'none') return ''
  const dur = Math.max(200, Math.min(3000, tr.durationMs ?? 500))
  const spd = dur <= 350 ? 'fast' : dur >= 900 ? 'slow' : 'med'
  let inner = '<p:fade/>'
  if (tr.type === 'push') inner = '<p:push dir="l"/>'
  else if (tr.type === 'wipe') inner = '<p:wipe dir="r"/>'
  else if (tr.type === 'zoom') inner = '<p:zoom dir="in"/>'
  else if (tr.type === 'morph') inner = '<p:fade thruBlk="0"/>'
  return `<p:transition spd="${spd}">${inner}</p:transition>`
}

function extractDataUrlImage(dataUrl: string | undefined): { buffer: Buffer; ext: 'png' | 'jpeg' } | null {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null
  const m = /^data:image\/(png|jpe?g);base64,([\s\S]+)$/i.exec(dataUrl)
  if (!m) return null
  const ext = m[1]!.toLowerCase() === 'png' ? 'png' : 'jpeg'
  return { buffer: Buffer.from(m[2]!, 'base64'), ext }
}

export function writePptx(deck: PptxDeckInput): Buffer {
  const entries: ZipEntry[] = []
  const addXml = (name: string, body: string) => {
    entries.push({ name, data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${body}`, 'utf8') })
  }

  const ratio = deck.ratio === '4:3' ? '4:3' : '16:9'
  const sldCx = ratio === '4:3' ? 9_144_000 : 12_192_000
  const sldCy = 6_858_000

  const paperHex = (parseColor(deck.theme?.paper, 'FFFFFF') ?? { hex: 'FFFFFF' }).hex
  const inkHex = (parseColor(deck.theme?.ink, '17171B') ?? { hex: '17171B' }).hex
  const accentHex = (parseColor(deck.theme?.accent, '1F4FFF') ?? { hex: '1F4FFF' }).hex
  const secondHex = (parseColor(deck.theme?.second, '0F766E') ?? { hex: '0F766E' }).hex
  const mutedHex = (parseColor(deck.theme?.muted, '6B7280') ?? { hex: '6B7280' }).hex
  const ruleHex = (parseColor(deck.theme?.rule, 'E5E7EB') ?? { hex: 'E5E7EB' }).hex
  const chartPalette = ['#' + accentHex, '#' + secondHex, '#F59E0B', '#EC4899', '#8B5CF6', '#10B981']

  const slides = deck.slides.length > 0 ? deck.slides : [{ elements: [] }]
  const hasAnyNotes = slides.some((s) => Boolean(s.notes && s.notes.trim() !== ''))

  let mediaSeq = 0
  const mediaExts = new Set<string>()
  const noteOverrides: string[] = []

  slides.forEach((slide, idx) => {
    const slideNo = idx + 1
    const slideRels: { id: string; type: string; target: string; external?: boolean }[] = [
      {
        id: 'rId1',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout',
        target: '../slideLayouts/slideLayout1.xml',
      },
    ]
    let relSeq = 1
    const nextRelId = () => {
      relSeq += 1
      return `rId${relSeq}`
    }

    const embedImage = (buf: Buffer, ext: 'png' | 'jpeg'): string => {
      mediaSeq += 1
      const fileExt = ext === 'jpeg' ? 'jpg' : 'png'
      mediaExts.add(fileExt)
      const mediaName = `image${mediaSeq}.${fileExt}`
      entries.push({ name: `ppt/media/${mediaName}`, data: buf })
      const rId = nextRelId()
      slideRels.push({
        id: rId,
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
        target: `../media/${mediaName}`,
      })
      return rId
    }

    // 背景
    let bgXml = ''
    const bg = slide.background
    if (bg?.imageBuffer && bg.imageExt) {
      const rId = embedImage(bg.imageBuffer, bg.imageExt)
      bgXml = `<p:bg><p:bgPr><a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></a:blipFill><a:effectLst/></p:bgPr></p:bg>`
    } else if (bg?.gradient) {
      bgXml = `<p:bg><p:bgPr>${gradFillXml(bg.gradient.from, bg.gradient.to, bg.gradient.angle ?? 135)}<a:effectLst/></p:bgPr></p:bg>`
    } else {
      const bgHex = (parseColor(bg?.color, paperHex) ?? { hex: paperHex }).hex
      bgXml = `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${bgHex}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`
    }

    let shapeId = 2
    const shapesXml: string[] = []

    for (const el of slide.elements ?? []) {
      let linkId: string | undefined
      if (el.hyperlink && /^https?:\/\//i.test(el.hyperlink) && ['image', 'shape', 'text'].includes(el.type)) {
        linkId = nextRelId()
        slideRels.push({ id: linkId, type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', target: el.hyperlink, external: true })
      }
      if (el.type === 'image') {
        const inline = el.imageBuffer && el.imageExt ? { buffer: el.imageBuffer, ext: el.imageExt } : extractDataUrlImage(el.src)
        if (inline) {
          const rId = embedImage(inline.buffer, inline.ext)
          shapesXml.push(picElementXml(shapeId++, el.id ?? `图片-${shapeId}`, rId, el, linkId))
        } else {
          shapesXml.push(
            shapeElementXml(shapeId++, el.id ?? `图位-${shapeId}`, {
              type: 'shape',
              shape: 'roundRect',
              x: el.x,
              y: el.y,
              w: el.w,
              h: el.h,
              text: el.text || '[配图]',
              style: { fill: '#' + ruleHex, color: '#' + mutedHex, align: 'center', valign: 'middle', radius: 8 },
            }),
          )
        }
      } else if (el.type === 'table') {
        shapesXml.push(tableElementXml(shapeId++, el.id ?? `表格-${shapeId}`, el, accentHex))
      } else if (el.type === 'chart') {
        const res = chartGroupXml(shapeId, el, chartPalette, inkHex, mutedHex, ruleHex)
        shapeId = res.nextId
        shapesXml.push(res.xml)
      } else {
        shapesXml.push(shapeElementXml(shapeId++, el.id ?? `元素-${shapeId}`, el, linkId))
      }
    }

    // 演讲者备注
    if (slide.notes && slide.notes.trim() !== '') {
      const notesRelId = nextRelId()
      slideRels.push({
        id: notesRelId,
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide',
        target: `../notesSlides/notesSlide${slideNo}.xml`,
      })
      noteOverrides.push(
        `<Override PartName="/ppt/notesSlides/notesSlide${slideNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`,
      )
      const noteParas = slide.notes
        .split(/\r?\n/)
        .map(
          (line) =>
            `<a:p><a:r><a:rPr lang="zh-CN" sz="1200"/><a:t>${escapeXml(line)}</a:t></a:r></a:p>`,
        )
        .join('')
      addXml(
        `ppt/notesSlides/notesSlide${slideNo}.xml`,
        `<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
          `<p:cSld><p:spTree>` +
          `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
          `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
          `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${noteParas}</p:txBody></p:sp>` +
          `</p:spTree></p:cSld></p:notes>`,
      )
      addXml(
        `ppt/notesSlides/_rels/notesSlide${slideNo}.xml.rels`,
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/>` +
          `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${slideNo}.xml"/>` +
          `</Relationships>`,
      )
    }

    const showAttr = slide.hidden ? ' show="0"' : ''
    addXml(
      `ppt/slides/slide${slideNo}.xml`,
      `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"${showAttr}>` +
        `<p:cSld name="${escapeXml(slide.title ?? `Slide ${slideNo}`)}">` +
        bgXml +
        `<p:spTree>` +
        `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
        `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
        shapesXml.join('') +
        `</p:spTree>` +
        `</p:cSld>` +
        `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
        transitionXml(slide.transition) +
        `</p:sld>`,
    )

    addXml(
      `ppt/slides/_rels/slide${slideNo}.xml.rels`,
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        slideRels.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${escapeXml(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`).join('') +
        `</Relationships>`,
    )
  })

  if (hasAnyNotes) {
    noteOverrides.unshift(
      `<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>`,
    )
    addXml(
      'ppt/notesMasters/notesMaster1.xml',
      `<p:notesMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
        `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>` +
        `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
        `</p:notesMaster>`,
    )
    addXml(
      'ppt/notesMasters/_rels/notesMaster1.xml.rels',
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>` +
        `</Relationships>`,
    )
  }

  // Presentation 关系与主体
  const presRels: { id: string; type: string; target: string }[] = [
    { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster', target: 'slideMasters/slideMaster1.xml' },
    { id: 'rId2', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps', target: 'presProps.xml' },
    { id: 'rId3', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps', target: 'viewProps.xml' },
    { id: 'rId4', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme', target: 'theme/theme1.xml' },
    { id: 'rId5', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles', target: 'tableStyles.xml' },
  ]
  let presRelSeq = 5
  let notesMasterRelId = ''
  if (hasAnyNotes) {
    presRelSeq += 1
    notesMasterRelId = `rId${presRelSeq}`
    presRels.push({
      id: notesMasterRelId,
      type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster',
      target: 'notesMasters/notesMaster1.xml',
    })
  }
  const sldIdsXml = slides
    .map((_, idx) => {
      presRelSeq += 1
      const rId = `rId${presRelSeq}`
      presRels.push({
        id: rId,
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
        target: `slides/slide${idx + 1}.xml`,
      })
      return `<p:sldId id="${256 + idx}" r:id="${rId}"/>`
    })
    .join('')

  addXml(
    'ppt/_rels/presentation.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      presRels.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${escapeXml(r.target)}"/>`).join('') +
      `</Relationships>`,
  )

  addXml(
    'ppt/presentation.xml',
    `<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">` +
      `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
      (notesMasterRelId ? `<p:notesMasterIdLst><p:notesMasterId r:id="${notesMasterRelId}"/></p:notesMasterIdLst>` : '') +
      `<p:sldIdLst>${sldIdsXml}</p:sldIdLst>` +
      `<p:sldSz cx="${sldCx}" cy="${sldCy}"/>` +
      `<p:notesSz cx="6858000" cy="9144000"/>` +
      `<p:defaultTextStyle><a:defPPr><a:defRPr lang="zh-CN"/></a:defPPr></p:defaultTextStyle>` +
      `</p:presentation>`,
  )

  addXml(
    'ppt/presProps.xml',
    `<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`,
  )
  addXml(
    'ppt/viewProps.xml',
    `<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:normalViewPr/><p:slideViewPr><p:cSldViewPr><p:cViewPr varScale="1"><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr></p:cSldViewPr></p:slideViewPr></p:viewPr>`,
  )
  addXml(
    'ppt/tableStyles.xml',
    `<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`,
  )

  addXml(
    'ppt/slideLayouts/slideLayout1.xml',
    `<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">` +
      `<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>` +
      `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
      `</p:sldLayout>`,
  )
  addXml(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>` +
      `</Relationships>`,
  )

  addXml(
    'ppt/slideMasters/slideMaster1.xml',
    `<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
      `<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>` +
      `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
      `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
      `<p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>` +
      `</p:sldMaster>`,
  )
  addXml(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>` +
      `</Relationships>`,
  )

  addXml(
    'ppt/theme/theme1.xml',
    `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="DesignBuddy Theme">` +
      `<a:themeElements>` +
      `<a:clrScheme name="DesignBuddy">` +
      `<a:dk1><a:srgbClr val="${inkHex}"/></a:dk1>` +
      `<a:lt1><a:srgbClr val="${paperHex}"/></a:lt1>` +
      `<a:dk2><a:srgbClr val="${mutedHex}"/></a:dk2>` +
      `<a:lt2><a:srgbClr val="${ruleHex}"/></a:lt2>` +
      `<a:accent1><a:srgbClr val="${accentHex}"/></a:accent1>` +
      `<a:accent2><a:srgbClr val="${secondHex}"/></a:accent2>` +
      `<a:accent3><a:srgbClr val="F59E0B"/></a:accent3>` +
      `<a:accent4><a:srgbClr val="EC4899"/></a:accent4>` +
      `<a:accent5><a:srgbClr val="8B5CF6"/></a:accent5>` +
      `<a:accent6><a:srgbClr val="10B981"/></a:accent6>` +
      `<a:hlink><a:srgbClr val="${accentHex}"/></a:hlink>` +
      `<a:folHlink><a:srgbClr val="${secondHex}"/></a:folHlink>` +
      `</a:clrScheme>` +
      `<a:fontScheme name="DesignBuddy Fonts">` +
      `<a:majorFont><a:latin typeface="Calibri"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface=""/></a:majorFont>` +
      `<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface=""/></a:minorFont>` +
      `</a:fontScheme>` +
      `<a:fmtScheme name="DesignBuddy Format">` +
      `<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>` +
      `<a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="28575"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>` +
      `<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>` +
      `<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>` +
      `</a:fmtScheme>` +
      `</a:themeElements>` +
      `<a:objectDefaults/><a:extraClrSchemeLst/>` +
      `</a:theme>`,
  )

  const nowIso = new Date().toISOString()
  addXml(
    'docProps/core.xml',
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<dc:title>${escapeXml(deck.title ?? 'DesignBuddy 演示文稿')}</dc:title>` +
      `<dc:creator>${escapeXml(deck.author ?? 'DesignBuddy')}</dc:creator>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:created>` +
      `<dcterms:modified xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:modified>` +
      `</cp:coreProperties>`,
  )
  addXml(
    'docProps/app.xml',
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
      `<Application>DesignBuddy Presentation Studio</Application>` +
      `<Slides>${slides.length}</Slides>` +
      `<Notes>${slides.filter((s) => Boolean(s.notes?.trim())).length}</Notes>` +
      `<HiddenSlides>${slides.filter((s) => Boolean(s.hidden)).length}</HiddenSlides>` +
      `</Properties>`,
  )

  addXml(
    '_rels/.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
      `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
      `</Relationships>`,
  )

  const slideOverrides = slides
    .map(
      (_, idx) =>
        `<Override PartName="/ppt/slides/slide${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
    )
    .join('')

  const mediaDefaults = [...mediaExts]
    .map((ext) => `<Default Extension="${ext}" ContentType="${ext === 'png' ? 'image/png' : 'image/jpeg'}"/>`)
    .join('')

  addXml(
    '[Content_Types].xml',
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      mediaDefaults +
      `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
      `<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>` +
      `<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>` +
      `<Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>` +
      `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>` +
      `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>` +
      `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>` +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
      `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
      slideOverrides +
      noteOverrides.join('') +
      `</Types>`,
  )

  return zip(entries)
}
