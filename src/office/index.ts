/** 办公文档操作层：统一处理「路径」或「上传的 base64」两种输入。 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { listFormulas, numberFormulas, readDocx, writeDocx } from './docx.ts'
import type { DocxBlock } from './docx.ts'
import { readPptx, formatPptx } from './pptx.ts'
import { readXlsx, formatXlsx, writeXlsx } from './xlsx.ts'
import type { SheetInput } from './xlsx.ts'
import { readPdf, formatPdf } from './pdf.ts'

const MAX_BYTES = 25 * 1024 * 1024

export interface FileInput {
  path?: string
  dataBase64?: string
  filename?: string
}

export interface LoadedFile {
  buffer: Buffer
  name: string
  path: string | null
}

export async function loadInput(input: FileInput): Promise<LoadedFile> {
  if (input.dataBase64) {
    const base64 = input.dataBase64.replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    if (buffer.length === 0) throw new Error('上传内容为空')
    if (buffer.length > MAX_BYTES) throw new Error('文件超过 25MB，请改用本地路径')
    return { buffer, name: input.filename ?? 'upload', path: null }
  }
  if (!input.path) throw new Error('需要 filePath 或上传文件')
  const path = resolve(input.path)
  const buffer = await readFile(path)
  if (buffer.length > MAX_BYTES) throw new Error('文件超过 25MB')
  return { buffer, name: path.split('/').pop() ?? path, path }
}

async function saveOutput(path: string, buffer: Buffer): Promise<string> {
  const target = resolve(path)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, buffer)
  return target
}

export async function readPptxOp(input: FileInput): Promise<string> {
  const file = await loadInput(input)
  return `文件：${file.name}\n\n${formatPptx(readPptx(file.buffer))}`
}

export async function readDocxOp(input: FileInput): Promise<string> {
  const file = await loadInput(input)
  const result = readDocx(file.buffer)
  return `文件：${file.name}（${result.blocks.length} 个块）\n\n${result.text}`
}

export async function readXlsxOp(input: FileInput): Promise<string> {
  const file = await loadInput(input)
  const sheets = readXlsx(file.buffer)
  return `文件：${file.name}（${sheets.length} 个工作表）\n\n${formatXlsx(sheets)}`
}

export async function readPdfOp(input: FileInput): Promise<string> {
  const file = await loadInput(input)
  return `文件：${file.name}\n\n${formatPdf(readPdf(file.buffer))}`
}

function blocksFromText(text: string): DocxBlock[] {
  const blocks: DocxBlock[] = []
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) blocks.push({ type: 'heading', level: heading[1]!.length, text: heading[2]! })
    else if (/^[-*]\s+/.test(line)) blocks.push({ type: 'bullet', text: line.replace(/^[-*]\s+/, '') })
    else blocks.push({ type: 'paragraph', text: line })
  }
  return blocks
}

export async function writeDocxOp(input: FileInput & { outputPath?: string; text?: string; blocks?: DocxBlock[] }): Promise<string> {
  if (!input.outputPath) throw new Error('需要 outputPath（保存位置）')
  const blocks = input.blocks ?? blocksFromText(input.text ?? '')
  if (blocks.length === 0) throw new Error('没有可写入的内容')
  const buffer = writeDocx(blocks)
  const saved = await saveOutput(input.outputPath, buffer)
  return `已写入 ${blocks.length} 个块\n${saved}`
}

export async function writeXlsxOp(input: FileInput & { outputPath?: string; sheets?: SheetInput[] }): Promise<string> {
  if (!input.outputPath) throw new Error('需要 outputPath（保存位置）')
  const sheets = input.sheets ?? []
  if (sheets.length === 0) throw new Error('没有可写入的工作表')
  const buffer = writeXlsx(sheets)
  const saved = await saveOutput(input.outputPath, buffer)
  return `已写入 ${sheets.length} 个工作表\n${saved}`
}

export async function docxFormulasOp(input: FileInput & { action?: string; outputPath?: string; start?: number }): Promise<string> {
  const file = await loadInput(input)
  if (input.action === 'number') {
    if (!input.outputPath) throw new Error('编号模式需要 outputPath（另存位置）')
    const { buffer, count } = numberFormulas(file.buffer, input.start ?? 1)
    const saved = await saveOutput(input.outputPath, buffer)
    return `已为 ${count} 个显示公式编号\n${saved}`
  }

  const formulas = listFormulas(file.buffer)
  if (formulas.length === 0) return `文件：${file.name}\n\n没有找到 OMML 公式（m:oMath）。`
  const lines = formulas.map((f) => `${f.index}. ${f.display ? '[行间]' : '[行内]'} ${f.latex || '(空)'}`)
  return `文件：${file.name}（${formulas.length} 个公式）\n\n${lines.join('\n')}`
}
