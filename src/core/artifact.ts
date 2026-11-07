/**
 * 把「已确认的大纲」变成真的文件。
 *
 * 大纲工作台点「生成」之后，这里负责产出可以带走的成品：
 *
 *   文档   → `.docx`（复用 `office/docx` 的最小可用包，Word / WPS 能直接打开）
 *   轮播图 → 每屏一张 1080×1350 的 SVG，外加一个把这些屏打包的 `.zip`
 *   图片   → 每张 1600×1200 的 SVG，同样打一个 `.zip`
 *   演示文稿 → `.pptx`（复用 `office/pptx` 的 OOXML 生成器，PowerPoint / WPS / Keynote 可直接打开继续编辑）
 *
 * 为什么是 SVG 而不是 PNG：这个进程里没有光栅化器，假装能出 PNG 只会出错图。
 * SVG 是矢量、可无损放大、浏览器能直接显示，界面另外提供「下载 PNG」——
 * 那一步在浏览器里用 canvas 完成，是真正画出来的像素，不是第二份假文件。
 *
 * 所有内容都从 `core/outline` 的结构化字段派生（标题 / 每一屏的要点），
 * 因此**同一句需求产出的文件字节一致**，测试可以直接断言。
 *
 * 演示文稿走 `core/deck` 引擎（需求分析 → 叙事规划 → 大纲 → 逐页 → 审核），
 * 再把 `GeneratedDeck` 适配成统一 `PptPresentation`，最后输出 `.pptx`。
 *
 * @module designbuddy/core/artifact
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { writeDocx } from '../office/docx.ts'
import type { DocxBlock } from '../office/docx.ts'
import { zip } from '../office/zip.ts'
import { escapeXml } from '../office/xml.ts'
import { outlineFor } from './outline.ts'
import type { Outline, OutlineKind, OutlineSection } from './outline.ts'
import { plan, buildDeck } from './deck.ts'
import type { DeckRequest } from './deck.ts'
import { generatedDeckToPresentation } from './deck-to-pptx.ts'
import { writePresentation } from './deck-renderer.ts'

export interface ArtifactRequest {
  prompt: string
  kind: string
  count?: number
}

export interface ArtifactFile {
  /** 文件名（含扩展名），下载时就是这个名字 */
  name: string
  mime: string
  bytes: number
  /** 相对地址，浏览器直接 GET；下载与否由界面决定 */
  url: string
  /** 能在  里直接显示的，给界面做缩略图 */
  inline: boolean
}

export interface Artifact {
  id: string
  kind: OutlineKind
  kindLabel: string
  title: string
  unit: string
  count: number
  summary: string
  files: ArtifactFile[]
  /** 正文预览：文档是段落，图组是每一屏的标题——界面用它画右侧成品页 */
  outline: Outline
}

interface Draft {
  name: string
  mime: string
  data: Buffer
  inline: boolean
}

/* ── 配色：和案例库同一套纸感，按主题哈希取一组，不随机 ───────── */

const PALETTES = [
  { paper: '#F6F1E4', ink: '#1B1B1F', accent: '#2F5BE0', soft: '#E7E0CE', mute: '#6E6A5E' },
  { paper: '#F4F6F3', ink: '#16221C', accent: '#1F7A5A', soft: '#E1E9E2', mute: '#5F6E64' },
  { paper: '#0E1420', ink: '#F2F4F8', accent: '#7AA7FF', soft: '#1A2333', mute: '#9AA8BD' },
  { paper: '#FBF3EF', ink: '#2A1B16', accent: '#C2410C', soft: '#F0DCD2', mute: '#7A6157' },
]

function hashOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function paletteOf(seed: string) {
  return PALETTES[hashOf(seed) % PALETTES.length]!
}

/** 中文按一个字算一格，西文按半个字——够用来断行，不值得引一个排版引擎。 */
function charWeight(char: string): number {
  return /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(char) ? 1 : 0.55
}

function wrap(text: string, perLine: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  let width = 0
  for (const char of text) {
    const w = charWeight(char)
    if (width + w > perLine && line !== '') {
      lines.push(line)
      line = ''
      width = 0
      if (lines.length === maxLines) break
    }
    line += char
    width += w
  }
  if (line !== '' && lines.length < maxLines) lines.push(line)
  if (lines.length === maxLines) {
    // 截断时要看得出来被截了，别把半句话当成整句。
    const rest = text.length > lines.join('').length
    if (rest) lines[maxLines - 1] = lines[maxLines - 1]!.slice(0, -1) + '…'
  }
  return lines.length > 0 ? lines : ['']
}

/* ── 文档：大纲 → DOCX 块 ─────────────────────────────────── */

export function docBlocks(outline: Outline): DocxBlock[] {
  const blocks: DocxBlock[] = [{ type: 'heading', level: 1, text: outline.title }]
  blocks.push({ type: 'paragraph', text: outline.brief })
  for (const section of outline.sections) {
    blocks.push({ type: 'heading', level: 2, text: `${section.n}. ${section.title}` })
    for (const point of section.points) {
      blocks.push({ type: 'bullet', text: point.tag ? `${point.text}（${point.tag}）` : point.text })
    }
  }
  blocks.push({ type: 'paragraph', text: `由 DesignBuddy 按「${outline.shape}」生成 · ${outline.kindLabel}` })
  return blocks
}

/* ── 轮播图 / 图片：HTML 里画不出来的，这里画成 SVG ─────────── */

const CJK_FONT = "Georgia,'Songti SC','Noto Serif SC',serif"
const MONO_FONT = 'ui-monospace,SFMono-Regular,Menlo,monospace'

function carouselPage(outline: Outline, section: OutlineSection, index: number): string {
  const p = paletteOf(outline.title + String(index))
  // 13 个汉字 × 76px 会顶到 1076（画布 1080）：12 字 × 68px 才留得下页边
  const titleLines = wrap(section.title, 12, 3)
  const bullets = section.points.slice(0, 4)
  const titleY = 300
  const parts: string[] = []
  parts.push(`<rect width="1080" height="1350" fill="${p.paper}"/>`)
  parts.push(`<rect x="0" y="0" width="1080" height="14" fill="${p.accent}"/>`)
  parts.push(
    `<text x="88" y="112" font-family="${MONO_FONT}" font-size="26" letter-spacing="6" fill="${p.accent}">` +
      `${String(index + 1).padStart(2, '0')} / ${String(outline.count).padStart(2, '0')} · ${escapeXml(outline.kindLabel)}</text>`,
  )
  titleLines.forEach((line, i) => {
    parts.push(
      `<text x="88" y="${titleY + i * 84}" font-family="${CJK_FONT}" font-size="68" font-weight="700" fill="${p.ink}">${escapeXml(line)}</text>`,
    )
  })
  const bodyY = titleY + titleLines.length * 84 + 40
  parts.push(`<line x1="88" y1="${bodyY - 22}" x2="176" y2="${bodyY - 22}" stroke="${p.accent}" stroke-width="5"/>`)
  bullets.forEach((point, i) => {
    const lines = wrap(point.text, 22, 2)
    lines.forEach((line, j) => {
      const y = bodyY + 46 + i * 128 + j * 44
      if (j === 0) parts.push(`<circle cx="96" cy="${y - 9}" r="5" fill="${p.accent}"/>`)
      parts.push(
        `<text x="120" y="${y}" font-family="${CJK_FONT}" font-size="30" fill="${p.mute}">${escapeXml(line)}</text>`,
      )
    })
  })
  parts.push(`<line x1="88" y1="1216" x2="992" y2="1216" stroke="${p.soft}" stroke-width="2"/>`)
  parts.push(
    `<text x="88" y="1272" font-family="${MONO_FONT}" font-size="24" letter-spacing="4" fill="${p.mute}">` +
      `${escapeXml(outline.title.slice(0, 18))}</text>`,
  )
  parts.push(
    `<text x="992" y="1272" text-anchor="end" font-family="${MONO_FONT}" font-size="24" letter-spacing="4" fill="${p.accent}">DESIGNBUDDY</text>`,
  )
  return svg(1080, 1350, parts.join(''))
}

function imagePage(outline: Outline, section: OutlineSection, index: number): string {
  const p = paletteOf(outline.title + 'art' + String(index))
  const seed = hashOf(outline.title + section.title)
  const titleLines = wrap(section.title, 16, 2)
  const parts: string[] = []
  parts.push(`<rect width="1600" height="1200" fill="${p.paper}"/>`)
  // 抽象主视觉：三条同心弧 + 一个偏移圆，位置由标题哈希决定（同一个主题每次一样）
  const cx = 980 + (seed % 160)
  const cy = 470 + (seed % 120)
  for (let i = 0; i < 3; i += 1) {
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${230 + i * 120}" fill="none" stroke="${i === 1 ? p.accent : p.soft}" stroke-width="${i === 1 ? 6 : 3}" opacity="${i === 1 ? 0.9 : 0.75}"/>`,
    )
  }
  parts.push(`<circle cx="${cx - 210}" cy="${cy + 150}" r="${74 + (seed % 40)}" fill="${p.accent}" opacity="0.9"/>`)
  parts.push(`<rect x="0" y="0" width="36" height="1200" fill="${p.accent}" opacity="0.9"/>`)
  parts.push(
    `<text x="120" y="150" font-family="${MONO_FONT}" font-size="26" letter-spacing="6" fill="${p.accent}">` +
      `${String(index + 1).padStart(2, '0')} / ${String(outline.count).padStart(2, '0')} · ${escapeXml(outline.kindLabel)}</text>`,
  )
  titleLines.forEach((line, i) => {
    parts.push(
      `<text x="120" y="${900 + i * 86}" font-family="${CJK_FONT}" font-size="72" font-weight="700" fill="${p.ink}">${escapeXml(line)}</text>`,
    )
  })
  parts.push(
    `<text x="120" y="${900 + titleLines.length * 86 + 30}" font-family="${CJK_FONT}" font-size="28" fill="${p.mute}">` +
      `${escapeXml((section.points[0]?.text ?? '').slice(0, 42))}</text>`,
  )
  return svg(1600, 1200, parts.join(''))
}

function svg(width: number, height: number, body: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    body +
    `</svg>\n`
  )
}

/* ── 落盘 ─────────────────────────────────────────────────── */

function slugOf(title: string): string {
  const clean = title.replace(/[\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return clean === '' ? 'designbuddy' : clean
}

function nextId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

/** 产出目录：和会话、用量一样落在 .designbuddy/ 下面，两个入口共用。 */
export function outputDir(cwd = process.cwd()): string {
  return process.env.DB_OUTPUT_DIR ?? join(cwd, '.designbuddy', 'output')
}

/**
 * 生成一组文件并落盘。
 *
 * 返回的 `url` 是相对的 `output/<id>/<name>`，由 web server 的 `/output/` 路由取。
 */
export async function createArtifact(request: ArtifactRequest, dir = outputDir()): Promise<Artifact> {
  const kind = request.kind

  /* ── 演示文稿：走 deck 引擎 → 生成 PPTX ── */
  if (/^deck|ppt|presentation$/i.test(kind)) {
    return createDeckArtifact(request, dir)
  }

  const outline = outlineFor(request)
  const id = nextId()
  const slug = slugOf(outline.title)
  const drafts: Draft[] = []

  if (outline.kind === 'doc') {
    drafts.push({
      name: `${slug}.docx`,
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      data: writeDocx(docBlocks(outline)),
      inline: false,
    })
  } else {
    const pages = outline.sections.map((section, index) =>
      outline.kind === 'carousel' ? carouselPage(outline, section, index) : imagePage(outline, section, index),
    )
    pages.forEach((page, index) => {
      drafts.push({
        name: `${slug}-${String(index + 1).padStart(2, '0')}.svg`,
        mime: 'image/svg+xml',
        data: Buffer.from(page, 'utf8'),
        inline: true,
      })
    })
    drafts.push({
      name: `${slug}.zip`,
      mime: 'application/zip',
      data: zip(drafts.map((draft) => ({ name: draft.name, data: draft.data }))),
      inline: false,
    })
  }

  const target = join(dir, id)
  await mkdir(target, { recursive: true })
  for (const draft of drafts) await writeFile(join(target, draft.name), draft.data)

  const files: ArtifactFile[] = drafts.map((draft) => ({
    name: draft.name,
    mime: draft.mime,
    bytes: draft.data.length,
    url: `output/${id}/${encodeURIComponent(draft.name)}`,
    inline: draft.inline,
  }))

  const size = (bytes: number) => (bytes >= 1024 ? (bytes / 1024).toFixed(1) + ' KB' : bytes + ' B')
  const summary =
    outline.kind === 'doc'
      ? `${outline.count} ${outline.unit} · ${size(files[0]!.bytes)} · DOCX`
      : `${outline.count} ${outline.unit} · 每${outline.unit}一张 SVG · 打包 ${size(files[files.length - 1]!.bytes)}`

  return {
    id,
    kind: outline.kind,
    kindLabel: outline.kindLabel,
    title: outline.title,
    unit: outline.unit,
    count: outline.count,
    summary,
    files,
    outline,
  }
}

/* ── 演示文稿：deck 引擎 → PPTX ───────────────────────────── */

interface DeckArtifactRequest extends ArtifactRequest {
  pages?: number
  audience?: string
  style?: string
}

async function createDeckArtifact(request: ArtifactRequest, dir: string): Promise<Artifact> {
  const deckRequest: DeckRequest = {
    prompt: request.prompt,
    pages: request.count,
    audience: (request as DeckArtifactRequest).audience,
    style: (request as DeckArtifactRequest).style,
  }

  const fromPlan = plan(deckRequest)
  const deck = buildDeck(fromPlan)
  const presentation = generatedDeckToPresentation(deck)
  const buffer = await writePresentation(presentation)

  const id = nextId()
  const slug = slugOf(deck.name)
  const name = `${slug}.pptx`
  const target = join(dir, id)
  await mkdir(target, { recursive: true })
  await writeFile(join(target, name), buffer)

  const files: ArtifactFile[] = [
    {
      name,
      mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      bytes: buffer.length,
      url: `output/${id}/${encodeURIComponent(name)}`,
      inline: false,
    },
  ]

  const size = (bytes: number) => (bytes >= 1024 ? (bytes / 1024).toFixed(1) + ' KB' : bytes + ' B')
  const summary = `${deck.slides.length} 页 · ${size(buffer.length)} · PPTX · ${deck.style}`

  // 复用 outline 的结构做正文预览：每页标题作为一段
  const outline: Outline = {
    kind: 'doc',
    kindLabel: '演示文稿',
    title: deck.name,
    unit: '页',
    count: deck.slides.length,
    brief: deck.desc,
    audience: '',
    shape: '开场 → 论据 → 能力 → 证据 → 行动',
    sections: deck.slides.map((slide, index) => ({
      n: index + 1,
      title: String((slide as { title?: string }).title ?? slide.label ?? `第 ${index + 1} 页`),
      points: [],
    })),
    narration: [],
    steps: [],
    items: [],
    spec: 'deck',
  }

  return {
    id,
    kind: 'doc',
    kindLabel: '演示文稿',
    title: deck.name,
    unit: '页',
    count: deck.slides.length,
    summary,
    files,
    outline,
  }
}
