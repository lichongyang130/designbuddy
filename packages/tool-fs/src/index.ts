import type { Context, PluginMeta } from '@designbuddy/core'
import { registerTool } from '@designbuddy/tools'
import type { Tool, ToolsService } from '@designbuddy/tools'
import type { WorkspaceService } from '@designbuddy/workspace'

export const name = 'tool-fs'
export const inject = ['tools', 'workspace']
export const meta: PluginMeta = {
  title: '文件工具',
  description: '让 Agent 读写工作目录：fs.list / fs.read / fs.write / fs.search。',
  category: 'tool',
  tags: ['workspace', 'filesystem'],
  order: 30,
}

export function apply(ctx: Context): void {
  const tools = ctx.get<ToolsService>('tools')
  const workspace = ctx.get<WorkspaceService>('workspace')
  if (!tools || !workspace) return

  const registered: Tool[] = [
    registerTool(ctx, {
      name: 'fs.list',
      title: '列出文件',
      description: '列出工作目录中的文件。用于建立对项目现状的认识。',
      scope: 'read',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对工作目录的路径，默认 .' },
          recursive: { type: 'boolean', description: '是否递归列出子目录' },
        },
      },
      handler: (args) => {
        const entries = workspace.list(String(args.path ?? '.'), { recursive: Boolean(args.recursive) })
        if (!entries.length) return '（空目录）'
        return entries.map((entry) => `${entry.path} (${entry.size}B)`).join('\n')
      },
    }),
    registerTool(ctx, {
      name: 'fs.read',
      title: '读取文件',
      description: '读取工作目录中一个文本文件的内容。',
      scope: 'read',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: '相对路径' } },
        required: ['path'],
      },
      handler: (args) => {
        const content = workspace.read(String(args.path))
        return content.length > 8000 ? `${content.slice(0, 8000)}\n…（已截断）` : content
      },
    }),
    registerTool(ctx, {
      name: 'fs.write',
      title: '写入文件',
      description: '在工作目录中创建或覆盖一个文件。写入前应确认内容完整。',
      scope: 'write',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对路径' },
          content: { type: 'string', description: '文件全文' },
        },
        required: ['path', 'content'],
      },
      handler: (args) => {
        const entry = workspace.write(String(args.path), String(args.content))
        return `已写入 ${entry.path}（${entry.size}B）`
      },
    }),
    registerTool(ctx, {
      name: 'fs.search',
      title: '搜索项目',
      description: '在工作目录的文本文件中搜索关键词，返回命中的文件与行。',
      scope: 'read',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: '关键词' } },
        required: ['query'],
      },
      handler: (args) => {
        const hits = workspace.search(String(args.query))
        if (!hits.length) return '没有命中'
        return hits.map((hit) => `${hit.path}:${hit.line}  ${hit.text}`).join('\n')
      },
    }),
  ]

  ctx.effect(() => {
    for (const tool of registered) tools.unregister(tool.name)
  })
}
