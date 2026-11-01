import type { ConfigSchema, Context, PluginMeta } from '@designbuddy/core'
import type { SystemPromptService } from '@designbuddy/system-prompt'
import { SkillService } from './service'

export { SkillService } from './service'
export type { Skill } from './service'

export const name = 'skills'

export const meta: PluginMeta = {
  title: '技能库',
  description: '把方法论写成 Markdown 技能文件，按需注入而不是全部塞进提示词。',
  category: 'skill',
  tags: ['skills', 'prompt'],
  order: 18,
}

export const Config: ConfigSchema = [
  {
    key: 'dir',
    label: '技能目录',
    type: 'string',
    default: 'skills',
    description: '存放 *.md 技能文件的目录。',
  },
]

export function apply(ctx: Context, config: { dir?: string }): void {
  const skills = ctx.set('skills', new SkillService(ctx, config.dir || 'skills'))

  ctx.inject(['systemPrompt'], (scoped) => {
    const prompt = scoped.get<SystemPromptService>('systemPrompt')
    if (!prompt || !skills.list().length) return
    const remove = prompt.add({
      id: 'skills',
      order: 40,
      render: () => `## 技能索引
以下方法论按需打开，不要全部预读。需要时调用 skill.read：
${skills.index()}`,
    })
    scoped.effect(remove)
  })
}

export default SkillService
