/**
 * 统一 PPT 模型 → PPTX 输入的渲染器。
 *
 * 把 `PptPresentation`（无 Office 概念，稳定 id，逻辑像素）转成 `PptxDeckInput`，
 * 然后复用现有 `src/office/pptx.ts` 的 `writePptx()` 输出标准 `.pptx` 包。
 *
 * 颜色：统一模型用 `#RRGGBB`，PPTX 层用不带 `#` 的 `RRGGBB`；这里统一剥 `#`。
 * 尺寸：统一模型用逻辑像素（1280×720 画布），PPTX 层原本也用像素（96 DPI，1px=9525 EMU），
 * 直接沿用即可，无需换算。
 *
 * @module designbuddy/core/deck-renderer
 */

import { writePptx } from '../office/pptx.ts'
import type { PptxDeckInput, PptxSlideInput, PptxElementInput, PptxElementStyle, PptxSlideBackground } from '../office/pptx.ts'
import type {
  PptPresentation,
  PptSlide,
  PptElement,
  PptTextElement,
  PptShapeElement,
  PptImageElement,
  PptTableElement,
  PptChartElement,
  PptTheme,
  PptTextStyle,
  PptShapeStyle,
  defaultTheme,
} from './deck-model.ts'

function stripHash(color: string | undefined): string | undefined {
  if (!color) return undefined
  return color.startsWith('#') ? color.slice(1) : color
}

function textStyleToPptx(style: PptTextStyle = {}): PptxElementStyle {
  return {
    fontSize: style.fontSize,
    bold: style.bold,
    italic: style.italic,
    underline: style.underline,
    color: stripHash(style.color),
    highlight: stripHash(style.highlight),
    align: style.align,
    valign: style.valign,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    bullet: style.bullet,
    fill: stripHash(style.fill),
    radius: style.radius,
    opacity: style.opacity,
  }
}

function shapeStyleToPptx(style: PptShapeStyle = {}): PptxElementStyle {
  return {
    fill: stripHash(style.fill),
    fillGradient: style.fillGradient
      ? {
          from: stripHash(style.fillGradient.from),
          to: stripHash(style.fillGradient.to),
          angle: style.fillGradient.angle,
        }
      : undefined,
    stroke: stripHash(style.stroke),
    strokeWidth: style.strokeWidth,
    strokeDash: style.strokeDash,
    radius: style.radius,
    opacity: style.opacity,
  }
}

function backgroundToPptx(bg: PptSlideBackground | undefined): PptxSlideBackground | undefined {
  if (!bg) return undefined
  if (bg.gradient) {
    return {
      gradient: {
        from: stripHash(bg.gradient.from),
        to: stripHash(bg.gradient.to),
        angle: bg.gradient.angle,
      },
    }
  }
  if (bg.image) {
    const buffer = extractDataUrlImage(bg.image)
    if (buffer) return { imageBuffer: buffer.buffer, imageExt: buffer.ext }
    return { color: stripHash(bg.color) }
  }
  return { color: stripHash(bg.color) }
}

function extractDataUrlImage(dataUrl: string): { buffer: Buffer; ext: 'png' | 'jpeg' } | null {
  const m = /^data:image\/(png|jpe?g);base64,([\s\S]+)$/i.exec(dataUrl)
  if (!m) return null
  const ext = m[1]!.toLowerCase() === 'png' ? 'png' : 'jpeg'
  return { buffer: Buffer.from(m[2]!, 'base64'), ext }
}

function elementToPptx(el: PptElement): PptxElementInput {
  const base: PptxElementInput = {
    id: el.id,
    x: el.x,
    y: el.y,
    w: el.w,
    h: el.h,
    rotation: el.rotation,
    hyperlink: el.hyperlink,
  }

  switch (el.type) {
    case 'text':
      return { ...base, type: 'text', text: el.text, style: textStyleToPptx(el.style) }
    case 'shape':
      return { ...base, type: 'shape', shape: el.shape, style: shapeStyleToPptx(el.style) }
    case 'image':
      if (el.imageBuffer && el.imageExt) {
        return { ...base, type: 'image', imageBuffer: Buffer.from(el.imageBuffer), imageExt: el.imageExt }
      }
      return { ...base, type: 'image', src: el.src }
    case 'table':
      return {
        ...base,
        type: 'table',
        rows: el.rows,
        headerRow: el.headerRow,
        zebra: el.zebra,
        headerFill: stripHash(el.headerFill),
        headerColor: stripHash(el.headerColor),
        borderColor: stripHash(el.borderColor),
      }
    case 'chart':
      return {
        ...base,
        type: 'chart',
        chartType: el.chartType,
        chartTitle: el.chartTitle,
        categories: el.categories,
        series: el.series.map((s) => ({ name: s.name, values: s.values, color: stripHash(s.color) })),
        showValues: el.showValues,
        showLegend: el.showLegend,
      }
    default:
      return { ...base, type: 'shape', shape: 'rect' }
  }
}

function slideToPptx(slide: PptSlide, theme: PptTheme): PptxSlideInput {
  return {
    title: slide.title,
    hidden: slide.hidden,
    notes: slide.notes,
    transition: slide.transition,
    background: slide.background ? backgroundToPptx(slide.background) : { color: stripHash(theme.paper) },
    elements: slide.elements.map((el) => elementToPptx(el)),
  }
}

function themeToPptx(theme: PptTheme): PptxDeckInput['theme'] {
  return {
    paper: stripHash(theme.paper),
    ink: stripHash(theme.ink),
    accent: stripHash(theme.accent),
    second: stripHash(theme.second),
    muted: stripHash(theme.muted),
    rule: stripHash(theme.rule),
  }
}

/**
 * 把统一 PPT 模型转成现有 `PptxDeckInput`，可直接交给 `writePptx()`。
 * 缺少的字段（author、ratio 等）会补上合理默认值。
 */
export function presentationToPptxDeckInput(presentation: PptPresentation): PptxDeckInput {
  const { slides, theme, title, author, ratio } = presentation
  return {
    title: title || 'DesignBuddy 演示文稿',
    author: author || 'DesignBuddy',
    ratio: ratio === '4:3' ? '4:3' : '16:9',
    theme: themeToPptx(theme),
    slides: slides.map((slide) => slideToPptx(slide, theme)),
  }
}

/**
 * 把统一 PPT 模型直接写成 `.pptx` Buffer。
 * 等价于 `writePptx(presentationToPptxDeckInput(presentation))`，多一层类型安全。
 */
export function writePresentation(presentation: PptPresentation): Buffer {
  return writePptx(presentationToPptxDeckInput(presentation))
}
