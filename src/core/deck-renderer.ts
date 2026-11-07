/**
 * 统一 PPT 模型 → PPTX 渲染器（基于 PptxGenJS）。
 *
 * 架构决策（阶段 1）：
 *   Agent 只负责生成结构化中间文档（PptPresentation，JSON 可校验、可编辑）
 *   本渲染器负责把 PptPresentation 转成 PptxGenJS 调用 → 原生 .pptx Buffer
 *   不在 Agent 层直接拼接 OOXML XML，避免关系文件、主题、母版、内容类型等
 *   OOXML 细节全部交给 PptxGenJS 专用库维护。
 *
 * 尺寸：统一模型用逻辑像素（1280×720 画布），PptxGenJS 用英寸。
 *   1280 px = 13.333 英寸（16:9）→ 1 px = 1/96 英寸
 * 颜色：统一模型用 #RRGGBB，PptxGenJS 用不带 # 的 RRGGBB。
 * 稳定 ID：PptElement.id 映射到 PptxGenJS 的 objectName，方便第二阶段定位。
 *
 * @module designbuddy/core/deck-renderer
 */

import PptxGenJS from 'pptxgenjs'
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
} from './deck-model.ts'

function stripHash(color: string | undefined): string | undefined {
  if (!color) return undefined
  return color.startsWith('#') ? color.slice(1) : color
}

/** 逻辑像素 → 英寸（96 DPI，1280 px = 13.333 in） */
function pxToInches(px: number): number {
  return px / 96
}

/** 统一模型图表类型 → PptxGenJS CHART_NAME */
function mapChartType(chartType: PptChartElement['chartType']): PptxGenJS.CHART_NAME {
  const map: Record<string, PptxGenJS.CHART_NAME> = {
    column: 'bar',
    bar: 'bar',
    line: 'line',
    area: 'area',
    pie: 'pie',
    donut: 'doughnut',
  }
  return map[chartType] ?? 'bar'
}

/** 统一模型形状名 → PptxGenJS SHAPE_NAME 字符串 */
function shapeNameOf(shape: PptShapeElement['shape']): string {
  const map: Record<string, string> = {
    rect: 'rect',
    roundRect: 'roundRect',
    ellipse: 'oval',
    line: 'line',
    arrowRight: 'rightArrow',
    chevron: 'chevron',
    diamond: 'diamond',
    pill: 'roundRect',
    badge: 'roundRect',
  }
  return map[shape] ?? 'rect'
}

/** PptTextStyle → PptxGenJS TextPropsOptions */
function textStyleToPptxGenJS(style: PptTextStyle = {}): PptxGenJS.TextPropsOptions {
  return {
    fontSize: style.fontSize,
    bold: style.bold,
    italic: style.italic,
    underline: style.underline,
    color: stripHash(style.color),
    align: style.align,
    valign: style.valign,
    lineSpacingMultiple: style.lineHeight,
    charSpacing: style.letterSpacing,
    bullet: style.bullet,
    fit: 'shrink',
    wrap: true,
  } as PptxGenJS.TextPropsOptions
}

/** PptShapeStyle → PptxGenJS ShapeProps */
function shapeStyleToPptxGenJS(style: PptShapeStyle = {}): PptxGenJS.ShapeProps {
  const fill = style.fill ? { color: stripHash(style.fill) } : undefined
  const line = style.stroke
    ? {
        color: stripHash(style.stroke),
        width: style.strokeWidth ?? 1,
        ...(style.strokeDash ? { dashType: style.strokeDash } : {}),
      }
    : undefined
  return {
    fill,
    line,
    rectRadius: style.radius,
    ...(style.opacity !== undefined ? { transparency: Math.round(style.opacity * 100) } : {}),
  } as PptxGenJS.ShapeProps
}

/** 把单个统一模型元素渲染到 PptxGenJS Slide 上 */
function elementToPptxGenJS(slide: PptxGenJS.Slide, el: PptElement): void {
  const base: Record<string, unknown> = {
    x: pxToInches(el.x),
    y: pxToInches(el.y),
    w: pxToInches(el.w),
    h: pxToInches(el.h),
    objectName: el.id,
    ...(el.hyperlink ? { hyperlink: { url: el.hyperlink } } : {}),
    ...(el.rotation ? { rotate: el.rotation } : {}),
  }

  switch (el.type) {
    case 'text': {
      const opts: PptxGenJS.TextPropsOptions = {
        ...(base as PptxGenJS.TextPropsOptions),
        ...textStyleToPptxGenJS(el.style),
      }
      slide.addText(el.text ?? '', opts)
      break
    }
    case 'shape': {
      const opts: PptxGenJS.ShapeProps = {
        ...(base as PptxGenJS.ShapeProps),
        ...shapeStyleToPptxGenJS(el.style),
      }
      if (el.shape === 'roundRect' && opts.rectRadius == null) {
        opts.rectRadius = 0.12
      }
      slide.addShape(shapeNameOf(el.shape) as PptxGenJS.SHAPE_NAME, opts)
      break
    }
    case 'image': {
      const imgOpts: PptxGenJS.ImageProps = {
        ...(base as PptxGenJS.ImageProps),
      }
      if (el.imageBuffer) {
        const buf = Buffer.from(el.imageBuffer)
        imgOpts.data = `image/${el.imageExt ?? 'png'};base64,${buf.toString('base64')}`
      } else if (el.src) {
        // data URL → 内联 base64；普通 URL → 外部路径
        const m = /^data:image\/(png|jpe?g);base64,([\s\S]+)$/i.exec(el.src)
        if (m) {
          imgOpts.data = `image/${m[1] === 'png' ? 'png' : 'jpeg'};base64,${m[2]}`
        } else {
          imgOpts.path = el.src
        }
      }
      slide.addImage(imgOpts)
      break
    }
    case 'table': {
      const colCount = Math.max(el.rows[0]?.length ?? 1, 1)
      const rows = el.rows.map((row) =>
        row.map((cell) => ({ text: cell })),
      )
      const opts: PptxGenJS.TableProps = {
        ...(base as PptxGenJS.TableProps),
        colW: pxToInches(el.w) / colCount,
      }
      slide.addTable(rows as unknown as PptxGenJS.TableRow[], opts)
      break
    }
    case 'chart': {
      const chartEl = el as PptChartElement
      const chartType = mapChartType(chartEl.chartType)
      // PptxGenJS 数据格式：每个系列一项，包含 labels(类别)、name(系列名)、values(数值)
      const chartData = chartEl.series.map((s, si) => ({
        labels: chartEl.categories,
        name: s.name,
        values: s.values,
        ...(s.color ? { color: stripHash(s.color) } : {}),
      }))
      const opts: PptxGenJS.IChartOpts = {
        ...(base as PptxGenJS.IChartOpts),
        chartTitle: chartEl.chartTitle ? { text: chartEl.chartTitle } : undefined,
        showValue: chartEl.showValues ?? false,
        showLegend: chartEl.showLegend ?? true,
      } as PptxGenJS.IChartOpts
      slide.addChart(chartType, chartData as unknown as never[], opts)
      break
    }
  }
}

/** 幻灯片背景 → PptxGenJS Slide.background */
function slideBackgroundToPptxGenJS(
  slide: PptxGenJS.Slide,
  bg: PptSlideBackground | undefined,
  theme: PptTheme,
): void {
  const paper = stripHash(theme.paper)
  if (!bg) {
    slide.background = { color: paper }
    return
  }
  if (bg.image) {
    const m = /^data:image\/(png|jpe?g);base64,([\s\S]+)$/i.exec(bg.image)
    if (m) {
      slide.background = {
        data: `image/${m[1] === 'png' ? 'png' : 'jpeg'};base64,${m[2]}`,
      }
    } else {
      slide.background = { color: stripHash(bg.color ?? theme.paper) }
    }
    return
  }
  if (bg.gradient) {
    slide.background = { color: stripHash(bg.gradient.from) }
    return
  }
  slide.background = { color: stripHash(bg.color ?? theme.paper) }
}

/**
 * 把统一 PPT 模型直接写成 `.pptx` Buffer。
 * 内部使用 PptxGenJS 生成原生 PowerPoint 对象（文字/形状/图片/表格均为独立对象）。
 */
export async function writePresentation(presentation: PptPresentation): Promise<Buffer> {
  const pptx = new PptxGenJS()

  // 文档元数据
  pptx.author = presentation.author ?? 'DesignBuddy'
  pptx.title = presentation.title ?? 'DesignBuddy 演示文稿'
  pptx.company = 'DesignBuddy'

  // 幻灯片尺寸（英寸）
  pptx.layout = presentation.ratio === '4:3' ? 'LAYOUT_4x3' : 'LAYOUT_WIDE'

  // 主题字体
  pptx.theme = {
    headFontFace: presentation.theme.font.display,
    bodyFontFace: presentation.theme.font.display,
  }

  for (const slide of presentation.slides) {
    const s = pptx.addSlide()
    s.hidden = slide.hidden ?? false

    // 背景
    slideBackgroundToPptxGenJS(s, slide.background, presentation.theme)

    // 演讲者备注
    if (slide.notes) {
      s.addNotes(slide.notes)
    }

    // 元素
    for (const el of slide.elements) {
      elementToPptxGenJS(s, el)
    }
  }

  const result = await pptx.write({
    outputType: 'nodebuffer',
  })

  const buf = result instanceof Uint8Array ? result : new Uint8Array(0)
  return Buffer.from(buf)
}
