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
  PptTheme,
} from './deck-model.ts'

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

/** 从 `img` 字段创建图片元素或矢量艺术。
 *
 * - `data:image/...;base64,...` → 真实图片元素（src=data URL，由 renderer 解析为 ppt/media 嵌入）
 * - `#art:xxx` → 矢量艺术（纯图形，不依赖外部图片）
 * - 普通 URL → 图片元素（src 指向 URL；写入时若无法解析为二进制会降级为占位形状）
 */
function imageOrArt(
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
): { elements: PptElement[]; next: number } {
  if (!img) return { elements: [], next: counter }

  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(img)) {
    const el = elImage(`el-${slideId(deck, slideIndex)}-${counter}`, x, y, w, h, img)
    return { elements: [el], next: counter + 1 }
  }

  if (img.startsWith('#art:')) {
    const art = img.replace(/^#art:/, '')
    const { elements: artEls, next } = artElements(deck, slideIndex, counter, art, theme)
    return { elements: artEls, next }
  }

  const el = elImage(`el-${slideId(deck, slideIndex)}-${counter}`, x, y, w, h, img)
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

function coverSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
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
  const { elements: imgEls, next: imgNext } = imageOrArt(
    `el-${slide}-${c++}`, SLIDE_WIDTH_PX - 340, 200, 300, 300, s.img, deck, index, c, theme,
  )
  elements.push(...imgEls)
  c = imgNext

  return { slide: { id: slide, title: deck.slides[index]!.title, layout: 'cover', elements, background: { color: theme.paper }, notes: s.notes }, counter: c }
}

function sectionSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
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

  const { elements: imgEls, next: imgNext } = imageOrArt(
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
  const elements: PptElement[] = [
    elText(`el-${slide}-${counter++}`, M, 260, CW, 100, s.text || '', theme, {
      fontSize: 32, bold: true, color: theme.ink, align: 'center', valign: 'middle', lineHeight: 1.3,
    }),
  ]
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
  const max = s.max ?? 100
  const barH = 26
  const gap = 30
  const startY = 160
  const maxBarW = CW * 0.6

  items.forEach((item, i) => {
    const row = Array.isArray(item) ? item : [String(item), 0]
    const label = String(row[0] ?? '')
    const value = Number(row[1]) || 0
    const y = startY + i * (barH + gap)
    const pct = Math.min(1, value / max)

    elements.push(elText(`el-${slide}-${c++}`, M, y, 180, barH, label, theme, {
      fontSize: 13, color: theme.ink, valign: 'middle',
    }))
    elements.push(elShape(`el-${slide}-${c++}`, M + 180, y + 6, maxBarW * pct, barH - 12, 'roundRect', theme, {
      fill: theme.accent, radius: 6,
    }))
    elements.push(elText(`el-${slide}-${c++}`, M + 180 + maxBarW * pct + 8, y, 100, barH, String(value) + (s.unit ?? ''), theme, {
      fontSize: 12, bold: true, color: theme.muted, valign: 'middle',
    }))
  })

  if (s.note) {
    elements.push(elText(`el-${slide}-${c++}`, M, startY + items.length * (barH + gap) + 10, CW, 30, s.note, theme, {
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

function endSlide(
  deck: GeneratedDeck,
  index: number,
  theme: PptTheme,
  counter: number,
): { slide: PptSlide; counter: number } {
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

const BUILDERS: Record<SlideKind, (deck: GeneratedDeck, index: number, theme: PptTheme, counter: number) => { slide: PptSlide; counter: number }> = {
  cover: coverSlide,
  toc: tocSlide,
  section: sectionSlide,
  statement: statementSlide,
  stats: statsSlide,
  columns: columnsSlide,
  bars: barsSlide,
  steps: stepsSlide,
  metric: metricSlide,
  table: tableSlide,
  timeline: timelineSlide,
  quote: quoteSlide,
  end: endSlide,
  context: contextSlide,
  pain: painSlide,
  product: productSlide,
  capability: capabilitySlide,
  architecture: architectureSlide,
  demo: demoSlide,
  workflow: workflowSlide,
  document: documentSlide,
  data: dataSlide,
  business: businessSlide,
  compare: compareSlide,
  matrix: matrixSlide,
  trend: trendSlide,
  case: caseSlide,
  cta: ctaSlide,
}

/** 把 `GeneratedDeck` 转成统一 `PptPresentation`，可直接交给 `writePresentation()`。
 * 旧的 `fmt: 'deck'` 字段、色板、页边距等全部带入，每页元素都有稳定 id。
 */
export function generatedDeckToPresentation(deck: GeneratedDeck): PptPresentation {
  const theme = themeOf(deck)
  const slides: PptSlide[] = []
  let counter = 1

  deck.slides.forEach((slide, index) => {
    const builder = BUILDERS[slide.k] ?? end
    const result = builder(deck, index, theme, counter)
    slides.push(result.slide)
    counter = result.counter
  })

  return {
    id: deck.id,
    title: deck.name,
    author: deck.by ?? 'DesignBuddy',
    ratio: deck.ratio ?? '16:9',
    theme,
    slides,
  }
}
