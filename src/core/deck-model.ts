/**
 * DesignBuddy PPT 统一文档模型（第一阶段）。
 *
 * 这套类型是「演示文稿」本身的抽象，不带 PPTX 后缀、不带 Office XML 概念：
 *   - 每个元素都有稳定 `id`（第二阶段做在线编辑和局部修改时引用）
 *   - 尺寸用逻辑像素（16:9 默认 1280×720），渲染器再换算成 EMU/英寸
 *   - 颜色用 `#RRGGBB`，字体用 `sans` / `serif` 两大类，中英文回退各自处理
 *
 * 下游有两条消费路径：
 *   1. `presentationToPptxDeckInput()` → 复用现有 `writePptx()` 输出 `.pptx`（本阶段）
 *   2. 前端在线编辑器直接消费（第二阶段，暂不碰）
 *
 * @module designbuddy/core/deck-model
 */

/** 16:9 宽屏，默认 13.333 × 7.5 英寸。逻辑画布 1280×720 px，渲染时 1 px = 9525 EMU。 */
export const SLIDE_WIDTH_PX = 1280
export const SLIDE_HEIGHT_PX = 720

export type PptRatio = '16:9' | '4:3'

export type PptSlideKind =
  | 'cover'
  | 'toc'
  | 'section'
  | 'statement'
  | 'stats'
  | 'columns'
  | 'bars'
  | 'steps'
  | 'metric'
  | 'table'
  | 'timeline'
  | 'quote'
  | 'end'
  | 'blank'

export type PptAlign = 'left' | 'center' | 'right' | 'justify'
export type PptValign = 'top' | 'middle' | 'bottom'

export type PptShapeKind =
  | 'rect'
  | 'roundRect'
  | 'ellipse'
  | 'line'
  | 'arrowRight'
  | 'arrowLeft'
  | 'arrowUp'
  | 'arrowDown'
  | 'diamond'
  | 'triangle'
  | 'chevron'
  | 'star5'
  | 'pentagon'
  | 'hexagon'
  | 'parallelogram'
  | 'pill'
  | 'badge'
  | 'frame'

export type PptChartType = 'column' | 'bar' | 'line' | 'area' | 'pie' | 'donut'

export interface PptTheme {
  /** 背景色，整套文档共用，各页可覆盖 */
  paper: string
  /** 主文字色 */
  ink: string
  /** 强调色 */
  accent: string
  /** 次要色 */
  second: string
  /** 辅助/次要文字色 */
  muted: string
  /** 分隔线与浅色边框色 */
  rule: string
  /** 字体家族：display 用于标题，mono 用于代码/编号 */
  font: { display: 'sans' | 'serif'; mono: string }
}

export function defaultTheme(): PptTheme {
  return {
    paper: '#FFFFFF',
    ink: '#17171B',
    accent: '#2A5CF0',
    second: '#0F766E',
    muted: '#6B7280',
    rule: '#E5E7EB',
    font: { display: 'sans', mono: 'ui-monospace,SFMono-Regular,Menlo,monospace' },
  }
}

export interface PptTextStyle {
  fontSize?: number   // pt
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string      // #RRGGBB
  highlight?: string  // #RRGGBB 文字高亮底色
  align?: PptAlign
  valign?: PptValign
  lineHeight?: number // 倍数，默认 1.35
  letterSpacing?: number
  bullet?: boolean | 'disc' | 'number'
  fill?: string       // 文本框底色
  radius?: number     // 文本框圆角（px）
  opacity?: number    // 0-1
}

export interface PptShapeStyle {
  fill?: string                        // #RRGGBB
  fillGradient?: { from: string; to: string; angle?: number }
  stroke?: string                      // #RRGGBB
  strokeWidth?: number                 // px
  strokeDash?: 'solid' | 'dashed' | 'dotted'
  radius?: number                      // 圆角 px，rect/roundRect 有效
  opacity?: number                     // 0-1
}

export interface PptElementBase {
  /** 稳定 ID，全文唯一。第二阶段在线编辑按此 ID 定位元素并做局部修改。 */
  id: string
  x: number   // px，相对幻灯片左上角
  y: number   // px
  w: number   // px
  h: number   // px
  rotation?: number // 角度，顺时针
  hyperlink?: string
}

export interface PptTextElement extends PptElementBase {
  type: 'text'
  text: string
  style?: PptTextStyle
}

export interface PptShapeElement extends PptElementBase {
  type: 'shape'
  shape: PptShapeKind
  style?: PptShapeStyle
}

export interface PptImageElement extends PptElementBase {
  type: 'image'
  /** data URL 或外部地址；导出时由 renderer 解析为二进制。服务端直接写入时用 imageBuffer。 */
  src?: string
  imageBuffer?: Uint8Array
  imageExt?: 'png' | 'jpeg'
}

export interface PptTableElement extends PptElementBase {
  type: 'table'
  rows: string[][]
  headerRow?: boolean
  zebra?: boolean
  headerFill?: string   // #RRGGBB
  headerColor?: string  // #RRGGBB
  borderColor?: string  // #RRGGBB
}

export interface PptChartSeries {
  name: string
  values: number[]
  color?: string   // #RRGGBB
}

export interface PptChartElement extends PptElementBase {
  type: 'chart'
  chartType: PptChartType
  chartTitle?: string
  categories: string[]
  series: PptChartSeries[]
  showValues?: boolean
  showLegend?: boolean
}

export type PptElement = PptTextElement | PptShapeElement | PptImageElement | PptTableElement | PptChartElement

export interface PptSlideBackground {
  color?: string    // #RRGGBB
  image?: string    // data URL
  gradient?: { from: string; to: string; angle?: number }
}

export interface PptSlide {
  id: string
  title?: string
  layout: PptSlideKind
  elements: PptElement[]
  background?: PptSlideBackground
  notes?: string
  hidden?: boolean
  transition?: {
    type?: 'none' | 'fade' | 'push' | 'wipe' | 'zoom' | 'morph'
    durationMs?: number
  }
}

export interface PptPresentation {
  id: string
  title: string
  author?: string
  ratio: PptRatio
  theme: PptTheme
  slides: PptSlide[]
}

/** 给一份没有 id 的 presentation 批量补上稳定 id（slide-xN / el-xNM）。 */
export function normalizeIds(presentation: PptPresentation): PptPresentation {
  const slides: PptSlide[] = []
  presentation.slides.forEach((slide, sIdx) => {
    const slideId = slide.id || `slide-${sIdx + 1}`
    const elements: PptElement[] = []
    slide.elements.forEach((el, eIdx) => {
      elements.push({ ...el, id: el.id || `el-${slideId}-${eIdx + 1}` })
    })
    slides.push({ ...slide, id: slideId, elements })
  })
  return { ...presentation, id: presentation.id || `presentation-${Date.now().toString(36)}`, slides }
}

/** 把逻辑像素（1280×720 画布）换算成 PPTX EMU。16:9 下 1280 px = 12,192,000 EMU。 */
export function pxToEmu(px: number): number {
  if (!Number.isFinite(px) || px < 0) return 0
  return Math.round((px / SLIDE_WIDTH_PX) * 12_192_000)
}

export function pxToEmuSize(wPx: number, hPx: number): { cx: number; cy: number } {
  return { cx: pxToEmu(wPx), cy: pxToEmu(hPx) }
}
