import type { Context, PluginMeta } from '@designbuddy/core'
import { registerTool } from '@designbuddy/tools'
import type { Tool, ToolsService } from '@designbuddy/tools'
import type { MemoryService } from '@designbuddy/memory'

export const name = 'tool-memory'
export const inject = ['tools', 'memory']
export const meta: PluginMeta = {
  title: '记忆工具',
  description: 'memory.save / memory.search：让 Agent 主动沉淀与召回设计决策。',
  category: 'tool',
  tags: ['memory'],
  order: 32,
}

export function apply(ctx: Context): void {
  const tools = ctx.get<ToolsService>('tools')
  const memory = ctx.get<MemoryService>('memory')
  if (!tools || !memory) return

  const registered: Tool[] = [
    registerTool(ctx, {
      name: 'memory.save',
      title: '记住一条决策',
      description: '把一条值得跨会话保留的设计决策、约束或偏好写入设计记忆。',
      scope: 'write',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '一句话描述，尽量具体可执行' },
          kind: {
            type: 'string',
            enum: ['decision', 'constraint', 'preference', 'fact', 'glossary'],
            description: '条目类型',
          },
          tags: { type: 'array', items: { type: 'string' }, description: '检索标签' },
        },
        required: ['text'],
      },
      handler: (args) => {
        const entry = memory.add({
          text: String(args.text),
          kind: (args.kind as never) ?? 'fact',
          tags: Array.isArray(args.tags) ? (args.tags as string[]) : [],
        })
        return `已记住（${entry.kind}）：${entry.text}`
      },
    }),
    registerTool(ctx, {
      name: 'memory.search',
      title: '检索设计记忆',
      description: '按关键词召回与当前任务相关的历史决策与约束。',
      scope: 'read',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: '检索词' } },
        required: ['query'],
      },
      handler: (args) => {
        const hits = memory.search(String(args.query))
        if (!hits.length) return '没有相关的历史记忆'
        return hits.map((entry) => `- [${entry.kind}] ${entry.text}`).join('\n')
      },
    }),
  ]

  ctx.effect(() => {
    for (const tool of registered) tools.unregister(tool.name)
  })
}
