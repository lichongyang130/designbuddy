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
import { unzip, zip } from '../office/zip.ts'
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
async function elementToPptxGenJS(slide: PptxGenJS.Slide, el: PptElement): Promise<void> {
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
        // data URL → 内联 base64；普通 URL → 先下载再内联（避免 pptxgenjs 在 Node 中无法取远程图）
        const m = /^data:image\/(png|jpe?g);base64,([\s\S]+)$/i.exec(el.src)
        if (m) {
          imgOpts.data = `image/${m[1] === 'png' ? 'png' : 'jpeg'};base64,${m[2]}`
        } else {
          try {
            const dataUrl = await downloadImageAsDataUrl(el.src)
            imgOpts.data = dataUrl
          } catch {
            imgOpts.path = el.src
          }
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

/** transition durationMs → PPTX spd 属性值 */
function transitionSpeed(durationMs?: number): 'fast' | 'med' | 'slow' {
  const d = durationMs ?? 1000
  if (d <= 500) return 'fast'
  if (d <= 2000) return 'med'
  return 'slow'
}

/** transition type → PPTX transition XML 子元素 */
interface SlideTransitionOpt {
  type?: string
  durationMs?: number
}
function transitionXmlBody(type: SlideTransitionOpt | undefined): string {
  if (!type || type.type === 'none') return ''
  const spd = `spd="${transitionSpeed(type.durationMs)}"`
  const dir = 'dir="l"'
  switch (type.type) {
    case 'fade':
      return `<p:transition ${spd}><p:fade/></p:transition>`
    case 'push':
      return `<p:transition ${spd}><p:push ${dir}/></p:transition>`
    case 'wipe':
      return `<p:transition ${spd}><p:wipe dir="r"/></p:transition>`
    case 'zoom':
      return `<p:transition ${spd}><p:zoom/></p:transition>`
    case 'morph':
      return `<p:transition ${spd}><p:morph/></p:transition>`
    default:
      return `<p:transition ${spd}/>`
  }
}

/** 为 PptxGenJS 生成的 .pptx ZIP 注入 slide transition 元素。
 *
 * PptxGenJS 4.0.1 不支持 slide transition API，这里在 ZIP 打包后做最小化后处理：
 * 解压 → 为每个 slide XML 注入 <p:transition> → 重新打包。
 * 这不违反"不手写全部 OOXML"的架构决策：文字/形状/图片/表格/图表等仍由 PptxGenJS 生成，
 * 仅 transition 这一个小功能通过后处理注入。
 */
function injectTransitions(buf: Buffer, presentation: PptPresentation): Buffer {
  const files = unzip(buf)
  const entries: { name: string; data: Buffer }[] = []

  for (const [name, data] of files) {
    if (!name.startsWith('ppt/slides/slide') || !name.endsWith('.xml')) {
      entries.push({ name, data })
      continue
    }

    const slideNo = Number(name.match(/slide(\d+)\.xml$/)![1])
    const slide = presentation.slides[slideNo - 1]
    const xml = data.toString('utf8')
    const tXml = transitionXmlBody(slide?.transition)

    if (!tXml) {
      entries.push({ name, data })
      continue
    }

    // transition 插入在 </p:clrMapOvr> 之后，</p:sld> 之前
    const modified = xml.replace(/<p:clrMapOvr[\s\S]*?<\/p:clrMapOvr>/, (m) => m + tXml)
    entries.push({ name, data: Buffer.from(modified, 'utf8') })
  }

  return zip(entries)
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
      await elementToPptxGenJS(s, el)
    }
  }

  const result = await pptx.write({
    outputType: 'nodebuffer',
  })

  const buf = result instanceof Uint8Array ? result : new Uint8Array(0)
  const pptxBuf = Buffer.from(buf)

  // 注入 slide transition（PptxGenJS 不支持，通过 ZIP 后处理注入）
  return injectTransitions(pptxBuf, presentation)
}

/** 远程图片缓存：URL → data URL，避免重复下载同一张图片。 */
const imageDataUrlCache = new Map<string, string>()

/** 下载远程图片并转为 data URL。失败时抛出错误，由调用方回退到 path。 */
async function downloadImageAsDataUrl(imageUrl: string): Promise<string> {
  // 命中缓存直接返回
  const cached = imageDataUrlCache.get(imageUrl)
  if (cached) return cached

  const res = await fetch(imageUrl, {
    headers: { 'User-Agent': 'DesignBuddy/1.0 (image-download)' },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${imageUrl}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  const buf = Buffer.from(arrayBuffer)

  // 推断 MIME 类型
  const contentType = res.headers.get('content-type') ?? ''
  let mime = 'image/png'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) mime = 'image/jpeg'
  else if (contentType.includes('png')) mime = 'image/png'
  else if (contentType.includes('gif')) mime = 'image/gif'
  else if (contentType.includes('webp')) mime = 'image/webp'
  else {
    // 通过文件扩展名推断
    if (/\.jpe?g$/i.test(imageUrl)) mime = 'image/jpeg'
    else if (/\.png$/i.test(imageUrl)) mime = 'image/png'
    else if (/\.gif$/i.test(imageUrl)) mime = 'image/gif'
    else if (/\.webp$/i.test(imageUrl)) mime = 'image/webp'
  }

  const dataUrl = `${mime};base64,${buf.toString('base64')}`
  imageDataUrlCache.set(imageUrl, dataUrl)
  return dataUrl
}
