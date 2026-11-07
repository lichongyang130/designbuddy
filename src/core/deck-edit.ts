/**
 * PPT 元素局部修改 API（阶段 1 扩展，面向第二阶段在线编辑器预留）。
 *
 * 基于统一模型 `PptPresentation` 的稳定 ID，提供：
 *   - `editElement(presentation, elementId, updates)`：按元素 ID 定位并修改单个元素（文本、位置、大小、颜色等）
   - `editSlide(presentation, slideId, updates)`：按 slide ID 定位并修改幻灯片（标题、背景、过渡等）
   - `applyEdits(presentation, edits)`：批量应用一系列编辑操作
   - `findElement(presentation, elementId)`：按元素 ID 查找元素及其所在 slide
   - `findSlide(presentation, slideId)`：按 slide ID 查找幻灯片
 *
 * 所有操作都返回新的 presentation 副本（不可变），方便撤销/重做。
 *
 * @module designbuddy/core/deck-edit
 */

import type {
  PptPresentation,
  PptSlide,
  PptElement,
  PptTextElement,
  PptShapeElement,
  PptImageElement,
  PptTableElement,
  PptChartElement,
  PptTextStyle,
  PptShapeStyle,
} from './deck-model.ts'

/** 单个元素可更新的字段。 */
export interface ElementUpdate {
  /** 要修改的元素稳定 ID（全文唯一） */
  elementId: string
  x?: number
  y?: number
  w?: number
  h?: number
  rotation?: number
  hyperlink?: string
  /** 文本元素：新文本内容 */
  text?: string
  /** 文本元素：样式覆盖 */
  style?: Partial<{
    fontSize: number
    bold: boolean
    italic: boolean
    color: string
    align: 'left' | 'center' | 'right' | 'justify'
    valign: 'top' | 'middle' | 'bottom'
  }>
  /** 形状元素：样式覆盖 */
  shapeStyle?: Partial<{
    fill: string
    stroke: string
    radius: number
    opacity: number
  }>
}

/** 单个幻灯片可更新的字段。 */
export interface SlideUpdate {
  slideId: string
  title?: string
  hidden?: boolean
  notes?: string
  background?: {
    color?: string
    image?: string
  }
}

/** 查找元素及其所在 slide。 */
export function findElement(
  presentation: PptPresentation,
  elementId: string,
): { slide: PptSlide; element: PptElement; slideIndex: number; elementIndex: number } | null {
  for (let sIdx = 0; sIdx < presentation.slides.length; sIdx += 1) {
    const slide = presentation.slides[sIdx]
    for (let eIdx = 0; eIdx < slide.elements.length; eIdx += 1) {
      if (slide.elements[eIdx]!.id === elementId) {
        return { slide, element: slide.elements[eIdx]!, slideIndex: sIdx, elementIndex: eIdx }
      }
    }
  }
  return null
}

/** 按 slide ID 查找幻灯片。 */
export function findSlide(
  presentation: PptPresentation,
  slideId: string,
): { slide: PptSlide; index: number } | null {
  for (let i = 0; i < presentation.slides.length; i += 1) {
    if (presentation.slides[i]!.id === slideId) {
      return { slide: presentation.slides[i]!, index: i }
    }
  }
  return null
}

/** 按元素 ID 修改单个元素。返回新的 presentation 副本。 */
export function editElement(
  presentation: PptPresentation,
  update: ElementUpdate,
): PptPresentation {
  const found = findElement(presentation, update.elementId)
  if (!found) {
    throw new Error(`Element not found: ${update.elementId}`)
  }

  const slides = [...presentation.slides]
  const slide = { ...found.slide }
  const elements = [...slide.elements]
  const el = { ...found.element }

  // 通用字段
  if (update.x !== undefined) el.x = update.x
  if (update.y !== undefined) el.y = update.y
  if (update.w !== undefined) el.w = update.w
  if (update.h !== undefined) el.h = update.h
  if (update.rotation !== undefined) el.rotation = update.rotation
  if (update.hyperlink !== undefined) el.hyperlink = update.hyperlink

  // 文本元素
  if (el.type === 'text') {
    if (update.text !== undefined) el.text = update.text
    if (update.style) {
      el.style = { ...el.style, ...update.style }
    }
  }

  // 形状元素
  if (el.type === 'shape') {
    if (update.shapeStyle) {
      el.style = { ...el.style, ...update.shapeStyle }
    }
  }

  elements[found.elementIndex] = el
  slide.elements = elements
  slides[found.slideIndex] = slide

  return { ...presentation, slides }
}

/** 修改单个幻灯片。返回新的 presentation 副本。 */
export function editSlide(
  presentation: PptPresentation,
  update: SlideUpdate,
): PptPresentation {
  const found = findSlide(presentation, update.slideId)
  if (!found) {
    throw new Error(`Slide not found: ${update.slideId}`)
  }

  const slides = [...presentation.slides]
  const slide = { ...found.slide }

  if (update.title !== undefined) slide.title = update.title
  if (update.hidden !== undefined) slide.hidden = update.hidden
  if (update.notes !== undefined) slide.notes = update.notes
  if (update.background) {
    slide.background = {
      ...(slide.background ?? {}),
      ...(update.background.color !== undefined ? { color: update.background.color } : {}),
      ...(update.background.image !== undefined ? { image: update.background.image } : {}),
    }
  }

  slides[found.index] = slide
  return { ...presentation, slides }
}

/** 批量应用一系列编辑操作。返回新的 presentation 副本。 */
export function applyEdits(
  presentation: PptPresentation,
  edits: (ElementUpdate | SlideUpdate)[],
): PptPresentation {
  let result = presentation
  for (const edit of edits) {
    if ('elementId' in edit) {
      result = editElement(result, edit)
    } else {
      result = editSlide(result, edit)
    }
  }
  return result
}
