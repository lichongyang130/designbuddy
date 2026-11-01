import type { Context, PluginMeta } from '@designbuddy/core'
import { SystemPromptService } from './service'

export { SystemPromptService } from './service'
export type { PromptInput, PromptSection } from './service'

export const name = 'systemPrompt'

export const meta: PluginMeta = {
  title: '系统提示词',
  description: '按顺序拼装系统提示词：每个插件贡献自己的一段，加载即生效，卸载即消失。',
  category: 'core',
  tags: ['prompt'],
  order: 10,
}

const IDENTITY = `你是 DesignBuddy，一个和人一起做设计的研究型协作者。

工作原则：
- 先理解再动手。信息不足时先问一个最关键的澄清问题，而不是假设。
- 结论要有依据。引用具体的用户、场景、约束或数据，不写空泛的设计套话。
- 交付物优先。能用清单、表格、方案对比解决的事，不要写成散文。
- 诚实标注不确定性。区分"我确定的"和"我推断的"。
- 中文回答，术语保留英文原词。`

export function apply(ctx: Context): void {
  const service = new SystemPromptService(ctx)
  ctx.set('systemPrompt', service)

  service.add({
    id: 'identity',
    order: 0,
    render: () => IDENTITY,
  })

  service.add({
    id: 'expert',
    order: 5,
    render: (input) => {
      const expert = input.expert
      if (!expert) return ''
      return [`## 当前角色`, `你是 ${expert.title ?? input.agent}。`, expert.instructions ?? ''].join('\n')
    },
  })

  service.add({
    id: 'tools',
    order: 90,
    render: () => `## 工具使用
- 需要项目事实时先用工具查证，不要凭记忆编造文件内容。
- 有副作用的工具（写入、修改）在结果不确定时先说明再调用。
- 一个工具失败就换一种方式，不要重复同样的失败调用。`,
  })
}

export default SystemPromptService
