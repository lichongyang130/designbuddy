/**
 * PPTX 读取：ZIP → ppt/slides/slideN.xml → 每个段落的 <a:t> 文本。
 * 不渲染版式，只取可检索的文字；图片与图表不会出现在结果里。
 */

import { unzip } from './zip.ts'
import { decodeXml } from './xml.ts'

export interface SlideText {
  index: number
  title: string
  lines: string[]
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
    slides.push({ index: number, title: lines[0] ?? '', lines })
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
  }
  return out.join('\n')
}
