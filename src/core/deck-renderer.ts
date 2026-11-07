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
import http from 'node:http'
import https from 'node:https'
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
import { imageSource } from './image-source.ts'

function stripHash(color: string | undefined): string | undefined {
  if (!color) return undefined
  return color.startsWith('#') ? color.slice(1) : color
}

/** 逻辑像素 → 英寸（96 DPI，1280 px = 13.333 in） */
function pxToInches(px: number): number {
  return px / 96
}

/** 幻灯片页边距（px，对应 deck-to-pptx.ts 中的 M） */
const M = 88
/** 内容宽度（px，对应 deck-to-pptx.ts 中的 CW） */
const CW = 1280 - M * 2

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
    arrowLeft: 'leftArrow',
    arrowUp: 'upArrow',
    arrowDown: 'downArrow',
    chevron: 'chevron',
    diamond: 'diamond',
    triangle: 'triangle',
    star5: 'star5',
    pentagon: 'pentagon',
    hexagon: 'hexagon',
    parallelogram: 'parallelogram',
    pill: 'roundRect',
    badge: 'roundRect',
    frame: 'rect',
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
    highlight: stripHash(style.highlight),
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
        // data URL → 内联 base64。PptxGenJS 仅支持位图（png/jpeg/gif/webp），不支持 SVG。
        // SVG 占位图（#img:keyword）在 renderer 中回退为占位文本。
        const m = /^data:image\/([\w+.-]+);base64,([\s\S]+)$/i.exec(el.src)
        if (m) {
          const mime = m[1]!.toLowerCase()
          if (mime === 'svg+xml') {
            // SVG 不被 PptxGenJS addImage 支持，回退为占位文本
            slide.addText('[图片]', {
              x: pxToInches(el.x),
              y: pxToInches(el.y),
              w: pxToInches(el.w),
              h: pxToInches(el.h),
              fontSize: 12,
              color: '#6B7280',
              align: 'center',
              valign: 'middle',
            } as PptxGenJS.TextPropsOptions)
            break
          }
          imgOpts.data = el.src
        } else {
          // 普通 URL：回退为占位文本，避免网络依赖导致导出失败。
          // 真实商业图片请使用 #photo:keyword（Unsplash/Pexels）或 #img:keyword（SVG 占位）。
          slide.addText('[图片]', {
            x: pxToInches(el.x),
            y: pxToInches(el.y),
            w: pxToInches(el.w),
            h: pxToInches(el.h),
            fontSize: 12,
            color: '#6B7280',
            align: 'center',
            valign: 'middle',
          } as PptxGenJS.TextPropsOptions)
          break
        }
      } else {
        // 没有图片源：回退为占位文本
        slide.addText('[图片]', {
          x: pxToInches(el.x),
          y: pxToInches(el.y),
          w: pxToInches(el.w),
          h: pxToInches(el.h),
          fontSize: 12,
          color: '#6B7280',
          align: 'center',
          valign: 'middle',
        } as PptxGenJS.TextPropsOptions)
        break
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
    // PptxGenJS 4.0.1 不直接支持 slide 背景 gradient，先用 from 色做 solid 占位，
    // 并将 gradient 元数据挂到 slide 对象上，供 writePresentation 尾部的 injectGradients 注入 <a:gradFill>。
    slide.background = { color: stripHash(bg.gradient.from) }
    ;(slide as any)._gradient = {
      from: stripHash(bg.gradient.from),
      to: stripHash(bg.gradient.to),
      angle: bg.gradient.angle ?? 90,
    }
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

/** slide 背景 gradient → 注入 <a:gradFill>（PptxGenJS 不直接支持） */
function injectGradients(buf: Buffer, presentation: PptPresentation): Buffer {
  const files = unzip(buf)
  const entries: { name: string; data: Buffer }[] = []

  for (const [name, data] of files) {
    if (!name.startsWith('ppt/slides/slide') || !name.endsWith('.xml')) {
      entries.push({ name, data })
      continue
    }

    const slideNo = Number(name.match(/slide(\d+)\.xml$/)![1])
    const slide = presentation.slides[slideNo - 1]
    const gradient = slide.background?.gradient
    if (!gradient) {
      entries.push({ name, data })
      continue
    }

    const xml = data.toString('utf8')
    const from = stripHash(gradient.from)
    const to = stripHash(gradient.to)
    const ang = Math.round((gradient.angle ?? 90) * 60000)

    const gradXml = [
      '<a:gradFill rotWithShape="1">',
      '  <a:gsLst>',
      `    <a:gs pos="0"><a:srgbClr val="${from}"/></a:gs>`,
      `    <a:gs pos="100000"><a:srgbClr val="${to}"/></a:gs>`,
      '  </a:gsLst>',
      `  <a:lin ang="${ang}" scaled="0"/>`,
      '</a:gradFill>',
    ].join('\n')

    // 将 <p:bg><p:bgPr> 中的 <a:solidFill> 替换为 <a:gradFill>
    const modified = xml.replace(
      /(<p:bg>\s*<p:bgPr>\s*)<a:solidFill>[\s\S]*?<\/a:solidFill>(\s*<\/p:bgPr>\s*<\/p:bg>)/,
      (m, pre, post) => `${pre}<a:gradFill rotWithShape="1">
  <a:gsLst>
    <a:gs pos="0"><a:srgbClr val="${from}"/></a:gs>
    <a:gs pos="100000"><a:srgbClr val="${to}"/></a:gs>
  </a:gsLst>
  <a:lin ang="${ang}" scaled="0"/></a:gradFill>${post}`
    )

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

    // 自动页码：封面与结束页不显示，其余页右下角显示「当前页 / 总页数」
    const isCoverOrEnd = slide.layout === 'cover' || slide.layout === 'end'
    if (!isCoverOrEnd) {
      const idx = presentation.slides.indexOf(slide)
      const total = presentation.slides.length
      s.addText(`${idx + 1} / ${total}`, {
        x: pxToInches(CW - 100),
        y: pxToInches(690),
        w: pxToInches(90),
        h: pxToInches(24),
        fontSize: 11,
        color: stripHash(presentation.theme.muted),
        align: 'right',
        valign: 'bottom',
      } as PptxGenJS.TextPropsOptions)
    }

    // 尝试将图片下载并缓存到本地（离线复用、版权追溯）
    for (const el of slide.elements) {
      if (el.type === 'image' && el.src && !/^data:image/i.test(el.src)) {
        try {
          const buf = await imageSource.downloadCached(el.src)
          imageSource.saveToCache(el.src, buf)
        } catch {
          // 下载失败不影响主流程
        }
      }
    }
  }

  // 收集所有图片署名信息，用于生成版权清单页
  const imageAttributions: { attribution: string; source: string; license: string }[] = []
  for (const slide of presentation.slides) {
    for (const el of slide.elements) {
      if (el.type === 'image' && el.attribution) {
        imageAttributions.push({
          attribution: el.attribution,
          source: el.source ?? 'unknown',
          license: el.license ?? 'cc0',
        })
      }
    }
  }

  // 如果有图片署名，自动追加一张“图片版权清单”页
  if (imageAttributions.length > 0) {
    const creditsSlide = pptx.addSlide()
    creditsSlide.background = { color: stripHash(presentation.theme.paper) }

    creditsSlide.addText('图片版权清单', {
      x: pxToInches(M),
      y: pxToInches(60),
      w: pxToInches(CW),
      h: pxToInches(50),
      fontSize: 24,
      bold: true,
      color: stripHash(presentation.theme.ink),
      align: 'left',
    } as PptxGenJS.TextPropsOptions)

    let y = 140
    for (const attr of imageAttributions) {
      creditsSlide.addText(`• ${attr.attribution}`, {
        x: pxToInches(M),
        y: pxToInches(y),
        w: pxToInches(CW),
        h: pxToInches(30),
        fontSize: 12,
        color: stripHash(presentation.theme.muted),
        align: 'left',
      } as PptxGenJS.TextPropsOptions)
      y += 32
      if (y > 650) break // 避免超出页面
    }
  }

  const result = await pptx.write({
    outputType: 'nodebuffer',
  })

  const buf = result instanceof Uint8Array ? result : new Uint8Array(0)
  const pptxBuf = Buffer.from(buf)

  // 注入 slide transition（PptxGenJS 不支持，通过 ZIP 后处理注入）
  let finalBuf = injectTransitions(pptxBuf, presentation)

  // 注入 slide 背景 gradient（PptxGenJS 不直接支持）
  finalBuf = injectGradients(finalBuf, presentation)

  return finalBuf
}

/** 远程图片缓存：URL → data URL，避免重复下载同一张图片。 */
const imageDataUrlCache = new Map<string, string>()

/** 下载远程图片并转为 data URL。失败时抛出错误，由调用方回退到占位文本。 */
async function downloadImageAsDataUrl(imageUrl: string): Promise<string> {
  // 命中缓存直接返回
  const cached = imageDataUrlCache.get(imageUrl)
  if (cached) return cached

  return new Promise<string>((resolve, reject) => {
    const url = new URL(imageUrl)
    const client = url.protocol === 'https:' ? https : http
    const req = client.get(url, {
      headers: { 'User-Agent': 'DesignBuddy/1.0 (image-download)' },
    }, (res) => {
      if (res.statusCode! < 200 || res.statusCode! >= 300) {
        reject(new Error(`HTTP ${res.statusCode} for ${imageUrl}`))
        res.resume()
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const buf = Buffer.concat(chunks)
        if (buf.length === 0) {
          reject(new Error(`Empty response for ${imageUrl}`))
          return
        }
        const contentType = (res.headers['content-type'] as string) ?? ''
        let mime = 'image/png'
        if (contentType.includes('jpeg') || contentType.includes('jpg')) mime = 'image/jpeg'
        else if (contentType.includes('png')) mime = 'image/png'
        else if (contentType.includes('gif')) mime = 'image/gif'
        else if (contentType.includes('webp')) mime = 'image/webp'
        else if (/^image\/svg\+xml$/i.test(contentType)) mime = 'image/svg+xml'
        else {
          if (/\.jpe?g$/i.test(imageUrl)) mime = 'image/jpeg'
          else if (/\.png$/i.test(imageUrl)) mime = 'image/png'
          else if (/\.gif$/i.test(imageUrl)) mime = 'image/gif'
          else if (/\.webp$/i.test(imageUrl)) mime = 'image/webp'
        }

        const dataUrl = `${mime};base64,${buf.toString('base64')}`
        imageDataUrlCache.set(imageUrl, dataUrl)
        resolve(dataUrl)
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(10000, () => {
      req.destroy(new Error('Timeout'))
    })
  })
}
