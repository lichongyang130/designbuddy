import type { Context, PluginMeta } from '@designbuddy/core'
import type { SystemPromptService } from '@designbuddy/system-prompt'
import { PlanService } from './service'

export { PlanService } from './service'
export type { PlanItem, PlanStatus } from './service'

export const name = 'plan'

export const meta: PluginMeta = {
  title: '计划器',
  description: '把复杂任务拆成可勾选的步骤，让 Agent 的执行过程对用户可见。',
  category: 'agent',
  tags: ['planner', 'runtime'],
  order: 20,
}

export function apply(ctx: Context): void {
  const plan = ctx.set('plan', new PlanService(ctx))

  ctx.inject(['systemPrompt'], (scoped) => {
    const prompt = scoped.get<SystemPromptService>('systemPrompt')
    if (!prompt) return
    const remove = prompt.add({
      id: 'plan',
      order: 50,
      render: (input) => {
        const rendered = plan.render(input.sessionId)
        if (!rendered) return ''
        const { done, total } = plan.progress(input.sessionId)
        return `## 当前计划（${done}/${total} 完成）
${rendered}

每完成一步就用 plan.update 标记，不要静默跳过步骤。`
      },
    })
    scoped.effect(remove)
  })
}

export default PlanService
