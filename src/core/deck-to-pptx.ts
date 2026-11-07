/**
 * 旧版 `GeneratedDeck` → 统一 `PptPresentation` 的适配器。
 *
 * `GeneratedDeck` 的 `DeckSlide = { k, label } & Record<string, unknown>` 是松散结构，
 * 每个版式（k）携带不同字段。这里把各版式拆成统一模型的元素（text / shape / image / table），
 * 每个元素都带稳定 `id`，方便第二阶段做在线编辑和局部修改。
 *
 * 尺寸沿用 1280×720 逻辑画布；颜色从 deck 的 theme 字段（paper/ink/accent/second/muted/rule）取。
 *
 * @module designbuddy/core/deck-to-pptx
 */

import type { GeneratedDeck, SlideKind } from './deck.ts'
import { SLIDE_WIDTH_PX, SLIDE_HEIGHT_PX } from './deck-model.ts'
import type {
  PptPresentation,
  PptSlide,
  PptElement,
  PptTextElement,
  PptShapeElement,
  PptChartElement,
  PptImageElement,
  PptTheme,
} from './deck-model.ts'
import { escapeXml } from '../office/xml.ts'
import { imageSource } from './image-source.ts'

/** 估算中英文混合文本在给定框内是否会溢出，并在需要时自动缩小 fontSize。 */
function fitFontSize(text: string, w: number, h: number, fontSize: number, lineHeight: number): number {
  if (!text || fontSize <= 8) return fontSize
  let size = fontSize
  // 中文字符近似宽度 ≈ fontSize * 0.52 px，英文 ≈ fontSize * 0.28 px；取中间偏保守值 0.5
  const charW = size * 0.5
  const lineH = size * lineHeight
  const maxCharsPerLine = Math.max(1, Math.floor(w / charW))
  const maxLines = Math.max(1, Math.floor(h / lineH))
  while (size > 8) {
    const charsPerLine = Math.max(1, Math.floor(w / (size * 0.5)))
    const linesNeeded = Math.ceil(text.length / charsPerLine)
    if (linesNeeded <= maxLines) break
    size -= 1
  }
  return size
}

function elText(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  theme: PptTheme,
  opts: {
    fontSize?: number
    bold?: boolean
    color?: string
    align?: 'left' | 'center' | 'right' | 'justify'
    valign?: 'top' | 'middle' | 'bottom'
    bullet?: boolean
    lineHeight?: number
    fill?: string
    radius?: number
  } = {},
): PptTextElement {
  const lineHeight = opts.lineHeight ?? 1.35
  const fontSize = fitFontSize(text, w, h, opts.fontSize ?? 18, lineHeight)
  return {
    id,
    type: 'text',
    x,
    y,
    w,
    h,
    text,
    style: {
      fontSize,
      bold: opts.bold,
      color: opts.color ?? theme.ink,
      align: opts.align ?? 'left',
      valign: opts.valign ?? 'top',
      bullet: opts.bullet,
      lineHeight,
      fill: opts.fill,
      radius: opts.radius,
    },
  }
}

function elShape(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  shape: 'rect' | 'roundRect' | 'ellipse' | 'line' | 'arrowRight' | 'chevron' | 'diamond' | 'pill' | 'badge',
  theme: PptTheme,
  opts: { fill?: string; stroke?: string; strokeWidth?: number; radius?: number; opacity?: number } = {},
): PptShapeElement {
  return {
    id,
    type: 'shape',
    x,
    y,
    w,
    h,
    shape,
    style: {
      fill: opts.fill,
      stroke: opts.stroke,
      strokeWidth: opts.strokeWidth,
      radius: opts.radius,
      opacity: opts.opacity,
    },
  }
}

function elImage(id: string, x: number, y: number, w: number, h: number, src?: string): PptElement {
  return { id, type: 'image', x, y, w, h, src }
}

/** 将长文本按字符数平均切分成多列，每列一个文本片段（PptxGenJS 不支持 text columns，故在模型层拆分）。 */
function splitIntoColumns(text: string, count: number): string[] {
  if (!text || count <= 1) return [text]
  const len = text.length
  const perCol = Math.ceil(len / count)
  const cols: string[] = []
  for (let i = 0; i < count; i++) {
    cols.push(text.slice(i * perCol, (i + 1) * perCol))
  }
  return cols.filter(Boolean)
}

/** 生成多列并排的文本元素（模型层多列方案，PptxGenJS 渲染时各列各自独立）。 */
function elTextColumns(
  idBase: string,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  theme: PptTheme,
  colCount: number,
  opts: {
    fontSize?: number
    bold?: boolean
    color?: string
    align?: 'left' | 'center' | 'right' | 'justify'
    valign?: 'top' | 'middle' | 'bottom'
    bullet?: boolean
    lineHeight?: number
    fill?: string
    radius?: number
  } = {},
  counter: number,
): { elements: PptElement[]; nextCounter: number } {
  const cols = splitIntoColumns(text, colCount)
  const gap = 24 // 列间距 px
  const colW = (w - gap * (cols.length - 1)) / cols.length
  const elements: PptElement[] = []
  let c = counter
  cols.forEach((colText, i) => {
    const colX = x + i * (colW + gap)
    elements.push(elText(`el-${idBase}-${c++}`, colX, y, colW, h, colText, theme, {
      fontSize: opts.fontSize,
      bold: opts.bold,
      color: opts.color ?? theme.ink,
      align: opts.align ?? 'left',
      valign: opts.valign ?? 'top',
      bullet: opts.bullet,
      lineHeight: opts.lineHeight,
      fill: opts.fill,
      radius: opts.radius,
    }))
  })
  return { elements, nextCounter: c }
}

/** 从 `img` 字段创建图片元素或矢量艺术。
 *
 * - `data:image/...;base64,...` → 真实图片元素（src=data URL，由 renderer 解析为 ppt/media 嵌入）
 * - `#art:xxx` → 矢量艺术（纯图形，不依赖外部图片）
 * - `#img:keyword` → 商业级占位图（基于关键词生成 SVG data URL，不依赖外部网络）
 * - 普通 URL → 图片元素（src 指向 URL；写入时 renderer 会先下载再内联）
 */

/** 基于关键词生成 SVG 占位图 data URL（不依赖外部网络，可直接嵌入 PPTX）。 */
function placeholderImage(keyword: string, w: number, h: number): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#F3F4F6"/>
  <text x="${w / 2}" y="${h / 2 - 10}" font-family="sans-serif" font-size="14" fill="#6B7280" text-anchor="middle">${escapeXml(keyword)}</text>
  <text x="${w / 2}" y="${h / 2 + 12}" font-family="sans-serif" font-size="12" fill="#9CA3AF" text-anchor="middle">${w}×${h}</text>
</svg>
`.trim()
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

async function imageOrArt(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  img: string | undefined,
  deck: GeneratedDeck,
  slideIndex: number,
  counter: number,
  theme: PptTheme,
): Promise<{ elements: PptElement[]; next: number }> {
  if (!img) return { elements: [], next: counter }

  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(img)) {
    const el: PptImageElement = {
      id: `el-${slideId(deck, slideIndex)}-${counter}`,
      type: 'image',
      x, y, w, h,
      src: img,
      source: 'dataurl',
      license: 'cc0',
    }
    return { elements: [el], next: counter + 1 }
  }

  if (img.startsWith('#art:')) {
    const art = img.replace(/^#art:/, '')
    const { elements: artEls, next } = artElements(deck, slideIndex, counter, art, theme)
    return { elements: artEls, next }
  }

  if (img.startsWith('#img:')) {
    const keyword = img.replace(/^#img:/, '')
    const dataUrl = placeholderImage(keyword, w, h)
    const el: PptImageElement = {
      id: `el-${slideId(deck, slideIndex)}-${counter}`,
      type: 'image',
      x, y, w, h,
      src: dataUrl,
      source: 'placeholder',
      license: 'cc0',
      attribution: `Illustration: ${keyword}`,
    }
    return { elements: [el], next: counter + 1 }
  }

  if (img.startsWith('#photo:')) {
    const keyword = img.replace(/^#photo:/, '')
    try {
      const assets = await imageSource.search(keyword, w, h, 1)
      if (assets.length > 0) {
        const asset = assets[0]
        const el: PptImageElement = {
          id: `el-${slideId(deck, slideIndex)}-${counter}`,
          type: 'image',
          x, y, w, h,
          src: asset.url,
          source: asset.source,
          license: asset.license,
          attribution: asset.attribution,
        }
        return { elements: [el], next: counter + 1 }
      }
    } catch {
      // 商业源不可用，降级到 SVG 占位
    }
    const dataUrl = placeholderImage(keyword, w, h)
    const el: PptImageElement = {
      id: `el-${slideId(deck, slideIndex)}-${counter}`,
      type: 'image',
      x, y, w, h,
      src: dataUrl,
      source: 'placeholder',
      license: 'cc0',
      attribution: `Illustration: ${keyword}`,
    }
    return { elements: [el], next: counter + 1 }
  }

  const el: PptImageElement = {
    id: `el-${slideId(deck, slideIndex)}-${counter}`,
    type: 'image',
    x, y, w, h,
    src: img,
    source: 'url',
    license: 'cc0',
  }
  return { elements: [el], next: counter + 1 }
}

const M = 88 // 页边距（px）
const CW = SLIDE_WIDTH_PX - M * 2 // 内容宽 1104

function themeOf(deck: GeneratedDeck): PptTheme {
  return {
    paper: deck.paper ?? '#FFFFFF',
    ink: deck.ink ?? '#17171B',
    accent: deck.accent ?? '#2A5CF0',
    second: deck.second ?? '#0F766E',
    muted: deck.muted ?? '#6B7280',
    rule: deck.rule ?? '#E5E7EB',
    font: { display: deck.display ?? 'sans', mono: deck.mono ?? 'ui-monospace,SFMono-Regular,Menlo,monospace' },
  }
}

function slideId(deck: GeneratedDeck, index: number): string {
  return `slide-${index + 1}`
}

function elId(deck: GeneratedDeck, slideIndex: number, elIndex: number): string {
  return `el-${slideId(deck, slideIndex)}-${elIndex + 1}`
}

/** 把一条 `#art:xxx` 主视觉占位换成一组抽象图形元素（纯矢量，不依赖外部图片）。 */
function artElements(
  deck: GeneratedDeck,
  slideIndex: number,
  startEl: number,
  kind: string,
  theme: PptTheme,
): { elements: PptElement[]; next: number } {
  const elements: PptElement[] = []
  let i = startEl
  const cx = SLIDE_WIDTH_PX - 260
  const cy = 320
  const r = 120
  const accent = theme.accent
  const second = theme.second
  const soft = theme.rule

  if (kind === 'orbit') {
    elements.push(elShape(`el-${slideId(deck, slideIndex)}-${i++}`, cx - r, cy - r, r * 2, r * 2, 'ellipse', theme, { stroke: accent, strokeWidth: 3, opacity: 0.6 }))
    elements.push(elShape(`el-${slideId(deck, slideIndex)}-${i++}`, cx - r * 0.6, cy - r * 0.6, r * 1.2, r * 1.2, 'ellipse', theme, { stroke: second, strokeWidth: 2, opacity: 0.4 }))
    elements.push(elShape(`el-${slideId(deck, slideIndex)}-${i++}`, cx - 24, cy - 24, 48, 48, 'ellipse', theme, { fill: accent }))
  } else if (kind === 'grid') {
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        elements.push(elShape(`el-${slideId(deck, slideIndex)}-${i++}`, cx - 100 + col * 52, cy - 100 + row * 52, 36, 36, 'rect', theme, { fill: row === 1 && col === 1 ? accent : soft, radius: 6 }))
      }
    }
  } else if (kind === 'mesh') {
    elements.push(elShape(`el-${slideId(deck, slideIndex)}-${i++}`, cx - 140, cy - 60, 280, 120, 'rect', theme, { fill: soft, radius: 8 }))
    elements.push(elShape(`el-${slideId(deck, slideIndex)}-${i++}`, cx - 120, cy - 40, 40, 40, 'rect', theme, { fill: accent }))
    elements.push(elShape(`el-${slideId(deck, slideIndex)}-${i++}`, cx - 40, cy - 20, 40, 40, 'rect', theme, { fill: second }))
    elements.push(elShape(`el-${slideId(deck, slideIndex)}-${i++}`, cx + 40, cy, 40, 40, 'rect', theme, { fill: accent }))
  } else if (kind === 'wave') {
    elements.push(elShape(`el-${slideId(deck, slideIndex)}-${i++}`, cx - 160, cy - 80, 320, 160, 'ellipse', theme, { stroke: accent, strokeWidth: 2, opacity: 0.5 }))
    elements.push(elShape(`el-${slideId(deck, slideIndex)}-${i++}`, cx - 120, cy - 40, 240, 80, 'ellipse', theme, { stroke: second, strokeWidth: 2, opacity: 0.4 }))
  } else {
    // stack：默认抽象块
    elements.push(elShape(`el-${slideId(deck, slideIndex)}-${i++}`, cx - 100, cy - 60, 200, 120, 'rect', theme, { fill: theme.rule, radius: 8 }))
    elements.push(elShape(`el-${slideId(deck, slideIndex)}-${i++}`, cx - 60, cy - 20, 120, 40, 'rect', theme, { fill: theme.accent, radius: 6 }))
  }
  return { elements, next: i }
}

async function coverSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): Promise<{ slide: PptSlide; counter: number }> {
  const slide = slideId(deck, index)
  const elements: PptElement[] = []
  let c = counter

  // 背景色条（顶部强调条）
  elements.push(elShape(`el-${slide}-${c++}`, 0, 0, SLIDE_WIDTH_PX, 10, 'rect', theme, { fill: theme.accent }))

  // kicker
  if (deck.slides[index]!.kicker) {
    elements.push(elText(`el-${slide}-${c++}`, M, 150, CW, 34, String(deck.slides[index]!.kicker), theme, {
      fontSize: 14, bold: true, color: theme.accent, letterSpacing: 2,
    }))
  }

  // 标题
  elements.push(elText(`el-${slide}-${c++}`, M, 200, CW, 120, String(deck.slides[index]!.title || deck.name), theme, {
    fontSize: 48, bold: true, color: theme.ink, valign: 'middle', lineHeight: 1.1,
  }))

  // 副标题 / meta
  const meta = (deck.slides[index] as { meta?: string }).meta ?? deck.desc
  if (meta) {
    elements.push(elText(`el-${slide}-${c++}`, M, 360, CW, 40, meta, theme, { fontSize: 16, color: theme.muted }))
  }

  // 主视觉
  const s = deck.slides[index] as { img?: string; notes?: string }
  const { elements: imgEls, next: imgNext } = await imageOrArt(
    `el-${slide}-${c++}`, SLIDE_WIDTH_PX - 340, 200, 300, 300, s.img, deck, index, c, theme,
  )
  elements.push(...imgEls)
  c = imgNext

  return { slide: { id: slide, title: deck.slides[index]!.title, layout: 'cover', elements, background: { color: theme.paper }, notes: s.notes }, counter: c }
}

async function sectionSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): Promise<{ slide: PptSlide; counter: number }> {
  const slide = slideId(deck, index)
  const elements: PptElement[] = []
  let c = counter
  const s = deck.slides[index] as { num?: string; title?: string; note?: string; img?: string }

  // 大编号
  if (s.num) {
    elements.push(elText(`el-${slide}-${c++}`, M, 120, 200, 140, s.num, theme, { fontSize: 96, bold: true, color: theme.accent }))
  }

  // 标题
  elements.push(elText(`el-${slide}-${c++}`, M + 220, 160, CW - 220, 120, s.title || '', theme, {
    fontSize: 40, bold: true, color: theme.ink, valign: 'middle', lineHeight: 1.15,
  }))

  if (s.note) {
    elements.push(elText(`el-${slide}-${c++}`, M + 220, 320, CW - 220, 40, s.note, theme, { fontSize: 16, color: theme.muted }))
  }

  const { elements: imgEls, next: imgNext } = await imageOrArt(
    `el-${slide}-${c++}`, SLIDE_WIDTH_PX - 340, 200, 300, 300, s.img, deck, index, c, theme,
  )
  elements.push(...imgEls)
  c = imgNext

  return { slide: { id: slide, title: s.title, layout: 'section', elements, background: { color: theme.paper }, notes: s.notes }, counter: c }
}

function statementSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  const slide = slideId(deck, index)
  const s = deck.slides[index] as { text?: string; foot?: string }
  const text = s.text || ''
  const elements: PptElement[] = []

  // 长文本（>120 字符）自动拆成 2 列并排显示，PptxGenJS 不支持 text columns 故在模型层拆分
  if (text.length > 120) {
    const { elements: cols, nextCounter } = elTextColumns(`el-${slide}`, M, 260, CW, 100, text, theme, 2, {
      fontSize: 32, bold: true, color: theme.ink, align: 'center', valign: 'middle', lineHeight: 1.3,
    }, counter)
    elements.push(...cols)
    counter = nextCounter
  } else {
    elements.push(elText(`el-${slide}-${counter++}`, M, 260, CW, 100, text, theme, {
      fontSize: 32, bold: true, color: theme.ink, align: 'center', valign: 'middle', lineHeight: 1.3,
    }))
  }

  if (s.foot) {
    elements.push(elText(`el-${slide}-${counter++}`, M, 380, CW, 34, s.foot, theme, { fontSize: 14, color: theme.muted, align: 'center' }))
  }
  return { slide: { id: slide, title: s.text?.slice(0, 30), layout: 'statement', elements, background: { color: theme.paper } }, counter }
}

function statsSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  const slide = slideId(deck, index)
  const s = deck.slides[index] as { title?: string; items?: unknown[]; note?: string }
  const elements: PptElement[] = []
  let c = counter

  if (s.title) {
    elements.push(elText(`el-${slide}-${c++}`, M, 60, CW, 44, s.title, theme, { fontSize: 24, bold: true, color: theme.ink }))
  }

  const items = (s.items ?? []).slice(0, 3)
  const colW = CW / 3
  items.forEach((item, i) => {
    const row = Array.isArray(item) ? item : [String(item), '', '']
    const value = String(row[0] ?? '')
    const label = String(row[1] ?? '')
    const desc = String(row[2] ?? '')
    const x = M + i * colW
    elements.push(elText(`el-${slide}-${c++}`, x, 140, colW, 60, value, theme, {
      fontSize: 40, bold: true, color: theme.accent, align: 'center', valign: 'middle',
    }))
    elements.push(elText(`el-${slide}-${c++}`, x, 210, colW, 34, label, theme, {
      fontSize: 14, color: theme.muted, align: 'center',
    }))
    if (desc) {
      elements.push(elText(`el-${slide}-${c++}`, x, 250, colW, 40, desc, theme, {
        fontSize: 12, color: theme.muted, align: 'center', lineHeight: 1.3,
      }))
    }
    // 分隔线
    if (i < items.length - 1) {
      elements.push(elShape(`el-${slide}-${c++}`, x + colW - 1, 130, 2, 160, 'rect', theme, { fill: theme.rule, opacity: 0.5 }))
    }
  })

  if (s.note) {
    elements.push(elText(`el-${slide}-${c++}`, M, 420, CW, 34, s.note, theme, { fontSize: 12, color: theme.muted }))
  }

  return { slide: { id: slide, title: s.title, layout: 'stats', elements, background: { color: theme.paper } }, counter: c }
}

function columnsSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  const slide = slideId(deck, index)
  const s = deck.slides[index] as { title?: string; note?: string; cols?: { t?: string; d?: string }[] }
  const elements: PptElement[] = []
  let c = counter

  if (s.title) {
    elements.push(elText(`el-${slide}-${c++}`, M, 60, CW, 44, s.title, theme, { fontSize: 24, bold: true, color: theme.ink }))
  }

  const cols = (s.cols ?? []).slice(0, 3)
  const colW = CW / 3
  cols.forEach((col, i) => {
    const x = M + i * colW
    if (col.t) {
      elements.push(elText(`el-${slide}-${c++}`, x, 140, colW, 34, col.t, theme, {
        fontSize: 16, bold: true, color: theme.ink,
      }))
    }
    if (col.d) {
      elements.push(elText(`el-${slide}-${c++}`, x, 180, colW, 140, col.d, theme, {
        fontSize: 13, color: theme.ink, lineHeight: 1.5,
      }))
    }
    elements.push(elShape(`el-${slide}-${c++}`, x + 12, 340, colW - 24, 1, 'rect', theme, { fill: theme.rule, opacity: 0.6 }))
  })

  if (s.note) {
    elements.push(elText(`el-${slide}-${c++}`, M, 380, CW, 30, s.note, theme, { fontSize: 11, color: theme.muted }))
  }

  return { slide: { id: slide, title: s.title, layout: 'columns', elements, background: { color: theme.paper } }, counter: c }
}

function barsSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  const slide = slideId(deck, index)
  const s = deck.slides[index] as { title?: string; items?: unknown[]; unit?: string; max?: number; note?: string }
  const elements: PptElement[] = []
  let c = counter

  if (s.title) {
    elements.push(elText(`el-${slide}-${c++}`, M, 60, CW, 44, s.title, theme, { fontSize: 24, bold: true, color: theme.ink }))
  }

  const items = (s.items ?? []).slice(0, 4)
  const categories = items.map((item) => {
    const row = Array.isArray(item) ? item : [String(item), 0]
    return String(row[0] ?? '')
  })
  const values = items.map((item) => {
    const row = Array.isArray(item) ? item : [String(item), 0]
    return Number(row[1]) || 0
  })
  const max = s.max ?? 100

  // 原生图表对象（非形状模拟），PptxGenJS 会渲染为真正的 PowerPoint 图表
  elements.push({
    id: `el-${slide}-${c++}`,
    type: 'chart',
    x: M,
    y: 160,
    w: CW,
    h: 220,
    chartType: 'bar',
    chartTitle: s.title,
    categories,
    series: [{ name: s.unit ?? '数值', values }],
    showValues: true,
    showLegend: false,
  } as PptChartElement)

  if (s.note) {
    elements.push(elText(`el-${slide}-${c++}`, M, 400, CW, 30, s.note, theme, {
      fontSize: 11, color: theme.muted,
    }))
  }

  return { slide: { id: slide, title: s.title, layout: 'bars', elements, background: { color: theme.paper } }, counter: c }
}

function stepsSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  const slide = slideId(deck, index)
  const s = deck.slides[index] as { title?: string; kicker?: string; items?: { n?: string; t?: string; d?: string }[]; note?: string }
  const elements: PptElement[] = []
  let c = counter

  if (s.kicker) {
    elements.push(elText(`el-${slide}-${c++}`, M, 50, CW, 30, s.kicker, theme, { fontSize: 13, bold: true, color: theme.accent }))
  }
  if (s.title) {
    elements.push(elText(`el-${slide}-${c++}`, M, 90, CW, 44, s.title, theme, { fontSize: 22, bold: true, color: theme.ink }))
  }

  const items = (s.items ?? []).slice(0, 4)
  const stepW = CW / 4
  items.forEach((item, i) => {
    const x = M + i * stepW
    if (item.n) {
      elements.push(elText(`el-${slide}-${c++}`, x, 160, 50, 40, item.n, theme, {
        fontSize: 24, bold: true, color: theme.accent, align: 'center',
      }))
    }
    if (item.t) {
      elements.push(elText(`el-${slide}-${c++}`, x + 55, 160, stepW - 65, 34, item.t, theme, {
        fontSize: 15, bold: true, color: theme.ink,
      }))
    }
    if (item.d) {
      elements.push(elText(`el-${slide}-${c++}`, x + 55, 200, stepW - 65, 100, item.d, theme, {
        fontSize: 12, color: theme.muted, lineHeight: 1.5,
      }))
    }
    if (i < items.length - 1) {
      elements.push(elShape(`el-${slide}-${c++}`, x + stepW - 6, 200, 2, 80, 'rect', theme, { fill: theme.rule, opacity: 0.5 }))
    }
  })

  if (s.note) {
    elements.push(elText(`el-${slide}-${c++}`, M, 380, CW, 30, s.note, theme, { fontSize: 11, color: theme.muted }))
  }

  return { slide: { id: slide, title: s.title, layout: 'steps', elements, background: { color: theme.paper } }, counter: c }
}

function metricSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  const slide = slideId(deck, index)
  const s = deck.slides[index] as { kicker?: string; big?: string; label?: string; note?: string }
  const elements: PptElement[] = []
  let c = counter

  if (s.kicker) {
    elements.push(elText(`el-${slide}-${c++}`, M, 120, CW, 34, s.kicker, theme, { fontSize: 14, bold: true, color: theme.accent }))
  }
  if (s.big) {
    elements.push(elText(`el-${slide}-${c++}`, M, 170, CW, 100, s.big, theme, {
      fontSize: 64, bold: true, color: theme.accent, align: 'center', valign: 'middle',
    }))
  }
  if (s.label) {
    elements.push(elText(`el-${slide}-${c++}`, M, 290, CW, 40, s.label, theme, {
      fontSize: 18, color: theme.ink, align: 'center',
    }))
  }
  if (s.note) {
    elements.push(elText(`el-${slide}-${c++}`, M, 350, CW, 34, s.note, theme, { fontSize: 12, color: theme.muted, align: 'center' }))
  }

  return { slide: { id: slide, title: s.label, layout: 'metric', elements, background: { color: theme.paper } }, counter: c }
}

function tableSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  const slide = slideId(deck, index)
  const s = deck.slides[index] as { title?: string; head?: string[]; rows?: string[][]; note?: string }
  const elements: PptElement[] = []
  let c = counter

  if (s.title) {
    elements.push(elText(`el-${slide}-${c++}`, M, 60, CW, 44, s.title, theme, { fontSize: 22, bold: true, color: theme.ink }))
  }

  const head = s.head ?? []
  const rows = s.rows ?? []
  const colCount = Math.max(head.length, ...rows.map((r) => r.length), 1)
  const colW = CW / colCount
  const rowH = 44
  const startY = 140

  head.forEach((h, i) => {
    elements.push(elShape(`el-${slide}-${c++}`, M + i * colW, startY, colW, rowH, 'rect', theme, {
      fill: theme.accent, opacity: 0.9,
    }))
    elements.push(elText(`el-${slide}-${c++}`, M + i * colW + 12, startY + 10, colW - 24, rowH - 20, h, theme, {
      fontSize: 13, bold: true, color: '#FFFFFF', valign: 'middle',
    }))
  })

  rows.forEach((row, rIdx) => {
    const y = startY + (rIdx + 1) * rowH
    const zebra = rIdx % 2 === 1
    elements.push(elShape(`el-${slide}-${c++}`, M, y, CW, rowH, 'rect', theme, {
      fill: zebra ? '#F4F6FA' : '#FFFFFF', opacity: zebra ? 0.6 : 1,
    }))
    row.forEach((cell, cIdx) => {
      elements.push(elText(`el-${slide}-${c++}`, M + cIdx * colW + 12, y + 10, colW - 24, rowH - 20, cell, theme, {
        fontSize: 12, color: theme.ink, valign: 'middle',
      }))
    })
  })

  if (s.note) {
    elements.push(elText(`el-${slide}-${c++}`, M, startY + (rows.length + 1) * rowH + 10, CW, 30, s.note, theme, {
      fontSize: 11, color: theme.muted,
    }))
  }

  return { slide: { id: slide, title: s.title, layout: 'table', elements, background: { color: theme.paper } }, counter: c }
}

function timelineSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  const slide = slideId(deck, index)
  const s = deck.slides[index] as { title?: string; items?: string[][]; note?: string }
  const elements: PptElement[] = []
  let c = counter

  if (s.title) {
    elements.push(elText(`el-${slide}-${c++}`, M, 60, CW, 44, s.title, theme, { fontSize: 22, bold: true, color: theme.ink }))
  }

  const items = (s.items ?? []).slice(0, 4)
  const itemW = CW / 4
  const midY = 240

  // 时间轴线
  elements.push(elShape(`el-${slide}-${c++}`, M + itemW / 2, midY - 60, 2, 120, 'rect', theme, { fill: theme.accent }))

  items.forEach((item, i) => {
    const x = M + i * itemW + itemW / 2 - 70
    const label = item[0] ?? ''
    const title = item[1] ?? ''
    const desc = item[2] ?? ''
    const y = midY - 40

    elements.push(elShape(`el-${slide}-${c++}`, x + 68, y - 10, 20, 20, 'ellipse', theme, { fill: theme.accent }))
    elements.push(elText(`el-${slide}-${c++}`, x, y + 30, 140, 30, label, theme, { fontSize: 13, bold: true, color: theme.accent, align: 'center' }))
    elements.push(elText(`el-${slide}-${c++}`, x, y + 62, 140, 30, title, theme, { fontSize: 15, bold: true, color: theme.ink, align: 'center' }))
    if (desc) {
      elements.push(elText(`el-${slide}-${c++}`, x, y + 96, 140, 40, desc, theme, { fontSize: 11, color: theme.muted, align: 'center', lineHeight: 1.4 }))
    }
  })

  if (s.note) {
    elements.push(elText(`el-${slide}-${c++}`, M, 400, CW, 30, s.note, theme, { fontSize: 11, color: theme.muted }))
  }

  return { slide: { id: slide, title: s.title, layout: 'timeline', elements, background: { color: theme.paper } }, counter: c }
}

function quoteSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  const slide = slideId(deck, index)
  const s = deck.slides[index] as { text?: string; by?: string }
  const elements: PptElement[] = []
  let c = counter

  elements.push(elShape(`el-${slide}-${c++}`, M, 180, 6, 240, 'rect', theme, { fill: theme.accent }))
  elements.push(elText(`el-${slide}-${c++}`, M + 24, 160, CW - 48, 200, s.text || '', theme, {
    fontSize: 26, color: theme.ink, align: 'center', lineHeight: 1.5,
  }))
  if (s.by) {
    elements.push(elText(`el-${slide}-${c++}`, M + 24, 380, CW - 48, 34, s.by, theme, { fontSize: 14, color: theme.muted, align: 'center' }))
  }

  return { slide: { id: slide, title: s.text?.slice(0, 30), layout: 'quote', elements, background: { color: theme.paper } }, counter: c }
}

function tocSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  const slide = slideId(deck, index)
  const elements: PptElement[] = []
  let c = counter

  elements.push(elText(`el-${slide}-${c++}`, M, 60, CW, 44, '目录', theme, {
    fontSize: 24, bold: true, color: theme.ink,
  }))

  deck.slides.forEach((s, i) => {
    if (i === index) return
    const y = 140 + i * 42
    elements.push(elShape(`el-${slide}-${c++}`, M, y + 8, 24, 24, 'roundRect', theme, {
      fill: theme.accent, radius: 12,
    }))
    elements.push(elText(`el-${slide}-${c++}`, M + 36, y, CW - 48, 34, s.title || `第 ${i + 1} 页`, theme, {
      fontSize: 15, color: theme.ink, valign: 'middle', lineHeight: 1.2,
    }))
  })

  return { slide: { id: slide, title: '目录', layout: 'toc', elements, background: { color: theme.paper } }, counter: c }
}

async function endSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): Promise<{ slide: PptSlide; counter: number }> {
  const slide = slideId(deck, index)
  const s = deck.slides[index] as { title?: string; lines?: string[]; mark?: string }
  const elements: PptElement[] = []
  let c = counter

  elements.push(elText(`el-${slide}-${c++}`, M, 200, CW, 80, s.title || '现在就可以试一次', theme, {
    fontSize: 36, bold: true, color: theme.ink, align: 'center', valign: 'middle',
  }))

  const lines = s.lines ?? []
  lines.forEach((line, i) => {
    elements.push(elText(`el-${slide}-${c++}`, M, 320 + i * 34, CW, 30, line, theme, {
      fontSize: 16, color: theme.muted, align: 'center',
    }))
  })

  if (s.mark) {
    elements.push(elShape(`el-${slide}-${c++}`, SLIDE_WIDTH_PX / 2 - 24, 440, 48, 48, 'roundRect', theme, {
      fill: theme.accent, radius: 24,
    }))
    elements.push(elText(`el-${slide}-${c++}`, SLIDE_WIDTH_PX / 2 - 24, 440, 48, 48, s.mark, theme, {
      fontSize: 22, bold: true, color: '#FFFFFF', align: 'center', valign: 'middle',
    }))
  }

  return { slide: { id: slide, title: s.title, layout: 'end', elements, background: { color: theme.paper } }, counter: c }
}

function contextSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  // context 与 stats 版式基本一致，复用
  return statsSlide(deck, index, theme, counter)
}

function painSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  // pain 与 columns 版式一致，复用
  return columnsSlide(deck, index, theme, counter)
}

function productSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  // product 与 columns 版式一致，复用
  return columnsSlide(deck, index, theme, counter)
}

function capabilitySlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  return columnsSlide(deck, index, theme, counter)
}

function architectureSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  // architecture 与 steps 版式一致，复用
  return stepsSlide(deck, index, theme, counter)
}

function demoSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  // demo 与 steps 版式一致，复用
  return stepsSlide(deck, index, theme, counter)
}

function workflowSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  // workflow 与 bars 版式一致，复用
  return barsSlide(deck, index, theme, counter)
}

function documentSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  // document 与 table 版式一致，复用
  return tableSlide(deck, index, theme, counter)
}

function dataSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  // data 与 metric 版式一致，复用
  return metricSlide(deck, index, theme, counter)
}

function businessSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  // business 与 table 版式一致，复用
  return tableSlide(deck, index, theme, counter)
}

function compareSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  // compare 与 bars 版式一致，复用
  return barsSlide(deck, index, theme, counter)
}

function matrixSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  // matrix 与 table 版式一致，复用
  return tableSlide(deck, index, theme, counter)
}

function trendSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  // trend 与 statement 版式一致，复用
  return statementSlide(deck, index, theme, counter)
}

function caseSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  // case 与 quote 版式一致，复用
  return quoteSlide(deck, index, theme, counter)
}

function ctaSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
  // cta 与 end 版式一致，复用
  return endSlide(deck, index, theme, counter)
}

/** 把同步 slide builder 包装成 async，统一 BUILDERS 类型。 */
function asyncify(
  fn: (deck: GeneratedDeck, index: number, theme: PptTheme, counter: number) => { slide: PptSlide; counter: number }
): (deck: GeneratedDeck, index: number, theme: PptTheme, counter: number) => Promise<{ slide: PptSlide; counter: number }> {
  return async (deck, index, theme, counter) => fn(deck, index, theme, counter)
}

const BUILDERS: Record<SlideKind, (deck: GeneratedDeck, index: number, theme: PptTheme, counter: number) => Promise<{ slide: PptSlide; counter: number }>> = {
  cover: coverSlide,
  toc: asyncify(tocSlide),
  section: sectionSlide,
  statement: asyncify(statementSlide),
  stats: asyncify(statsSlide),
  columns: asyncify(columnsSlide),
  bars: asyncify(barsSlide),
  steps: asyncify(stepsSlide),
  metric: asyncify(metricSlide),
  table: asyncify(tableSlide),
  timeline: asyncify(timelineSlide),
  quote: asyncify(quoteSlide),
  end: endSlide,
  context: asyncify(contextSlide),
  pain: asyncify(painSlide),
  product: asyncify(productSlide),
  capability: asyncify(capabilitySlide),
  architecture: asyncify(architectureSlide),
  demo: asyncify(demoSlide),
  workflow: asyncify(workflowSlide),
  document: asyncify(documentSlide),
  data: asyncify(dataSlide),
  business: asyncify(businessSlide),
  compare: asyncify(compareSlide),
  matrix: asyncify(matrixSlide),
  trend: asyncify(trendSlide),
  case: asyncify(caseSlide),
  cta: asyncify(ctaSlide),
}

/** 把 `GeneratedDeck` 转成统一 `PptPresentation`，可直接交给 `writePresentation()`。
 * 旧的 `fmt: 'deck'` 字段、色板、页边距等全部带入，每页元素都有稳定 id。
 */
export async function generatedDeckToPresentation(deck: GeneratedDeck): Promise<PptPresentation> {
  const theme = themeOf(deck)
  const slides: PptSlide[] = []
  let counter = 1

  for (let i = 0; i < deck.slides.length; i += 1) {
    const slide = deck.slides[i]
    const builder = BUILDERS[slide.k] ?? end
    const result = await builder(deck, i, theme, counter)
    // 从 GeneratedDeck 的 slide 中读取 background（含 gradient）与 transition 字段
    const slideBg = (slide as { background?: { color?: string; gradient?: { from: string; to: string; angle?: number } } }).background
    const transition = (slide as { transition?: { type?: string; durationMs?: number } }).transition
    slides.push({ ...result.slide, ...(slideBg ? { background: slideBg } : {}), ...(transition ? { transition } : {}) })
    counter = result.counter
  }

  return {
    id: deck.id,
    title: deck.name,
    author: deck.by ?? 'DesignBuddy',
    ratio: deck.ratio ?? '16:9',
    theme,
    slides,
  }
}
