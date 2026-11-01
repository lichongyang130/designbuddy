import type { Context, PluginMeta } from '@designbuddy/core'
import type { Tool, ToolsService } from '@designbuddy/tools'
import type { SkillService } from '@designbuddy/skills'

export const name = 'tool-skill'
export const inject = ['tools', 'skills']
export const meta: PluginMeta = {
  title: '技能读取工具',
  description: 'skill.read：模型按需打开一个技能文件。',
  category: 'tool',
  tags: ['skills'],
  order: 34,
}

export function apply(ctx: Context): void {
  const tools = ctx.get<ToolsService>('tools')
  const skills = ctx.get<SkillService>('skills')
  if (!tools || !skills) return

  const tool = tools.register({
    name: 'skill.read',
    title: '打开技能',
    description: '读取一个技能的完整内容。只在确实需要该方法论时调用，以节省上下文。',
    scope: 'read',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: '技能名，见系统提示词中的技能索引' } },
      required: ['name'],
    },
    handler: (args) => {
      const skill = skills.get(String(args.name))
      if (!skill) return `没有名为 "${args.name}" 的技能。可用：${skills.list().map((s) => s.name).join(', ')}`
      return `# ${skill.title}\n\n${skill.body}`
    },
  })

  ctx.effect(() => tools.unregister(tool.name))
}
