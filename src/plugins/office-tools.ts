/**
 * 办公文档工具：PPTX / DOCX / XLSX / PDF。
 *
 * 两种输入：本地绝对路径，或页面上传后的 base64。写入类工具需要 outputPath。
 * 所有解析都在本进程完成，不调用外部二进制。
 */

import type { Context } from '../kernel/index.ts'
import type { JsonSchema, JsonSchemaProperty } from '../core/schema.ts'
import type { ToolRegistry, ToolOutput } from '../core/tools.ts'

import {
  docxFormulasOp,
  readDocxOp,
  readPdfOp,
  readPptxOp,
  readXlsxOp,
  writeDocxOp,
  writeXlsxOp,
} from '../office/index.ts'

export const name = 'office-tools'

const fileProps: Record<string, JsonSchemaProperty> = {
  filePath: { type: 'string', description: '本地文件绝对路径；与 dataBase64 二选一' },
  dataBase64: { type: 'string', description: '上传文件的 base64；与 filePath 二选一' },
  filename: { type: 'string', description: '上传文件名，仅用于展示' },
}

const readSchema: JsonSchema = {
  type: 'object',
  properties: { ...fileProps },
}

const writeDocxSchema: JsonSchema = {
  type: 'object',
  properties: {
    outputPath: { type: 'string', description: '保存到的本地路径' },
    text: { type: 'string', description: '文档内容：# 标题、- 列表、其余为段落' },
  },
  required: ['outputPath', 'text'],
}

const writeXlsxSchema: JsonSchema = {
  type: 'object',
  properties: {
    outputPath: { type: 'string', description: '保存到的本地路径' },
    sheets: {
      type: 'array',
      description: '工作表数组：{ name, rows: [[...]] }',
      items: { type: 'object', properties: { name: { type: 'string' }, rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } } } },
    },
  },
  required: ['outputPath', 'sheets'],
}

const formulaSchema: JsonSchema = {
  type: 'object',
  properties: {
    ...fileProps,
    action: { type: 'string', enum: ['list', 'number'], description: 'list 提取 LaTeX；number 给显示公式编号' },
    outputPath: { type: 'string', description: 'number 模式的另存路径' },
    start: { type: 'integer', description: '编号起始值，默认 1' },
  },
}

function failure(error: unknown): ToolOutput {
  return { content: error instanceof Error ? error.message : String(error), isError: true }
}

function fileArgs(args: Record<string, unknown>) {
  return {
    path: typeof args.filePath === 'string' ? args.filePath : undefined,
    dataBase64: typeof args.dataBase64 === 'string' ? args.dataBase64 : undefined,
    filename: typeof args.filename === 'string' ? args.filename : undefined,
  }
}

export function apply(ctx: Context): void {
  const tools = ctx.require<ToolRegistry>('tools')

  ctx.effect(() =>
    tools.register({
      name: 'office.read_pptx',
      description: '读取 PPTX：逐页提取标题与正文文本',
      parameters: readSchema,
      timeoutMs: 20_000,
      execute: async (args) => {
        try {
          return await readPptxOp(fileArgs(args))
        } catch (error) {
          return failure(error)
        }
      },
    }),
  )

  ctx.effect(() =>
    tools.register({
      name: 'office.read_docx',
      description: '读取 DOCX：段落、标题、列表与表格转为文本',
      parameters: readSchema,
      timeoutMs: 20_000,
      execute: async (args) => {
        try {
          return await readDocxOp(fileArgs(args))
        } catch (error) {
          return failure(error)
        }
      },
    }),
  )

  ctx.effect(() =>
    tools.register({
      name: 'office.read_xlsx',
      description: '读取 XLSX：工作表与单元格值',
      parameters: readSchema,
      timeoutMs: 20_000,
      execute: async (args) => {
        try {
          return await readXlsxOp(fileArgs(args))
        } catch (error) {
          return failure(error)
        }
      },
    }),
  )

  ctx.effect(() =>
    tools.register({
      name: 'office.read_pdf',
      description: '读取 PDF：抽取文本（扫描件与自定义字体可能为空）',
      parameters: readSchema,
      timeoutMs: 20_000,
      execute: async (args) => {
        try {
          return await readPdfOp(fileArgs(args))
        } catch (error) {
          return failure(error)
        }
      },
    }),
  )

  ctx.effect(() =>
    tools.register({
      name: 'office.write_docx',
      description: '生成 DOCX：支持标题、段落、列表',
      parameters: writeDocxSchema,
      timeoutMs: 20_000,
      execute: async (args) => {
        try {
          return await writeDocxOp({
            outputPath: String(args.outputPath ?? ''),
            text: typeof args.text === 'string' ? args.text : '',
          })
        } catch (error) {
          return failure(error)
        }
      },
    }),
  )

  ctx.effect(() =>
    tools.register({
      name: 'office.write_xlsx',
      description: '生成 XLSX：按工作表与行写入单元格',
      parameters: writeXlsxSchema,
      timeoutMs: 20_000,
      execute: async (args) => {
        try {
          const sheets = Array.isArray(args.sheets) ? (args.sheets as Array<{ name?: string; rows?: Array<Array<string | number>> }>) : []
          return await writeXlsxOp({
            outputPath: String(args.outputPath ?? ''),
            sheets: sheets.map((sheet, index) => ({
              name: sheet.name ?? `Sheet${index + 1}`,
              rows: Array.isArray(sheet.rows) ? sheet.rows : [],
            })),
          })
        } catch (error) {
          return failure(error)
        }
      },
    }),
  )

  ctx.effect(() =>
    tools.register({
      name: 'office.docx_formulas',
      description: 'Word 公式：提取 OMML 公式为 LaTeX，或为显示公式批量编号',
      parameters: formulaSchema,
      timeoutMs: 20_000,
      execute: async (args) => {
        try {
          return await docxFormulasOp({
            ...fileArgs(args),
            action: typeof args.action === 'string' ? args.action : 'list',
            outputPath: typeof args.outputPath === 'string' ? args.outputPath : undefined,
            start: typeof args.start === 'number' ? args.start : undefined,
          })
        } catch (error) {
          return failure(error)
        }
      },
    }),
  )
}
