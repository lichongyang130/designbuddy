/**
 * DesignBuddy 商业级 PPT 生成器 — 入口整合器
 *
 * 职责：将“用户提示词 + 商业主题 + 幻灯片模板”整合为 PptPresentation，
 * 并调用现有 writePresentation 导出原生 .pptx Buffer。
 *
 * @module designbuddy/core/ppt-generator
 */

import type { PptPresentation } from './deck-model.ts'
import type { ParsedContent } from './content-parser.ts'
import type { CommercialTheme, ThemeScheme } from './commercial-theme.ts'
import { parsePrompt, parsePdfText } from './content-parser.ts'
import { getTheme } from './commercial-theme.ts'
import { buildSlides } from './slide-templates.ts'
import { writePresentation } from './deck-renderer.ts'
import { normalizeIds } from './deck-model.ts'

/** 商业级 PPT 生成器的完整输入 */
export interface GeneratePptxInput {
  /** 用户提示词，如 "生成PPT 河北省辛集市李章村小学课程表" */
  prompt: string
  /** 主题方案：blue | green | orange | multi */
  themeScheme?: ThemeScheme
  /** 可选：PDF 已提取的纯文本，用于补充内容字段 */
  pdfText?: string
  /** 文件名（不含扩展名） */
  filename?: string
}

/** 商业级 PPT 生成器的输出 */
export interface GeneratePptxOutput {
  ok: boolean
  name?: string
  bytes?: number
  buffer?: Buffer
  error?: string
  presentation?: PptPresentation
}

/**
 * 核心生成函数：输入提示词，输出 PptPresentation 模型（不落盘）。
 * 适合前端预览或二次编辑。
 */
export function generatePresentation(input: GeneratePptxInput): PptPresentation {
  const scheme = input.themeScheme ?? 'blue'
  const theme = getTheme(scheme)

  // 1. 解析提示词
  const content = parsePrompt(input.prompt)

  // 2. 如有 PDF 文本，合并补充字段
  if (input.pdfText) {
    const pdfFields = parsePdfText(input.pdfText)
    if (pdfFields.schoolName) content.schoolName = pdfFields.schoolName
  }

  // 3. 构建 7 页商业模板
  const slides = buildSlides(content, theme)

  // 4. 组装统一模型并补全稳定 ID
  const presentation: PptPresentation = normalizeIds({
    id: `presentation-${Date.now().toString(36)}`,
    title: `${content.schoolName} 课程表（${scheme} 方案）`,
    author: 'DesignBuddy',
    ratio: '16:9',
    theme,
    slides,
  })

  return presentation
}

/**
 * 一键生成 PPTX Buffer：输入提示词，直接输出原生 .pptx Buffer。
 * 内部调用现有 writePresentation（PptxGenJS 渲染器）。
 */
export async function generatePptxBuffer(input: GeneratePptxInput): Promise<GeneratePptxOutput> {
  try {
    const presentation = generatePresentation(input)
    const buffer = await writePresentation(presentation)
    const rawName = (input.filename || presentation.title)
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
      .replace(/\.pptx$/i, '')
      .trim()
      .slice(0, 60) || 'presentation'
    const name = `${rawName}.pptx`

    return {
      ok: true,
      name,
      bytes: buffer.length,
      buffer,
      presentation,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
