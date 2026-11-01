import type { ConfigSchema, Context, PluginMeta } from '@designbuddy/core'
import type { SystemPromptService } from '@designbuddy/system-prompt'
import { MemoryService } from './service'

export { MemoryService } from './service'
export type { MemoryEntry, MemoryKind, RememberInput } from './service'

export const name = 'memory'

export const meta: PluginMeta = {
  title: '设计记忆',
  description: '把决策、约束和偏好记下来，跨会话复用，注入到系统提示词里。',
  category: 'memory',
  tags: ['memory', 'context'],
  order: 15,
}

export const Config: ConfigSchema = [
  {
    key: 'file',
    label: '记忆文件',
    type: 'string',
    default: '.data/memory.json',
    description: 'JSON 文件路径；留空则只在内存中保存。',
  },
]

export function apply(ctx: Context, config: { file?: string }): void {
  const memory = ctx.set('memory', new MemoryService(ctx, config.file || null))

  // The prompt is another capability's surface. Asking for it with ctx.inject
  // keeps memory usable (and testable) even when systemPrompt is not loaded.
  ctx.inject(['systemPrompt'], (scoped) => {
    const prompt = scoped.get<SystemPromptService>('systemPrompt')
    if (!prompt) return
    const remove = prompt.add({
      id: 'memory',
      order: 30,
      render: (input) => {
        const entries = input.input ? memory.search(input.input, 8) : memory.all().slice(-8)
        if (!entries.length) return ''
        return `## 设计记忆（来自过去会话，注意可能有冲突，冲突时以用户当前说法为准）
${memory.render(entries)}`
      },
    })
    scoped.effect(remove)
  })
}

export default MemoryService
