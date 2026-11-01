import type { ConfigSchema, Context, PluginMeta } from '@designbuddy/core'
import type { SystemPromptService } from '@designbuddy/system-prompt'
import { WorkspaceService } from './service'

export { WorkspaceService } from './service'
export type { FileEntry } from './service'

export const name = 'workspace'

export const Config: ConfigSchema = [
  {
    key: 'root',
    label: '工作目录',
    type: 'string',
    default: 'workspace',
    description: 'Agent 可以读写的项目目录，所有路径都被沙箱限制在这里。',
  },
]

export const meta: PluginMeta = {
  title: '项目工作区',
  description: 'Agent 只能在这个目录里读写，路径越界会被拒绝。',
  category: 'core',
  tags: ['workspace', 'sandbox'],
  order: 16,
}

export function apply(ctx: Context, config: { root?: string }): void {
  const workspace = ctx.set('workspace', new WorkspaceService(ctx, config.root || 'workspace'))

  ctx.inject(['systemPrompt'], (scoped) => {
    const prompt = scoped.get<SystemPromptService>('systemPrompt')
    if (!prompt) return
    const remove = prompt.add({
      id: 'workspace',
      order: 60,
      render: () => {
        const files = workspace.list('.', { recursive: true }).slice(0, 40)
        const listing = files.map((file) => `- ${file.path}`).join('\n')
        return `## 项目工作区
根目录：${workspace.root}
${files.length ? listing : '（空目录）'}

需要文件内容时用 fs.read 读取，不要臆测内容。`
      },
    })
    scoped.effect(remove)
  })
}

export default WorkspaceService
