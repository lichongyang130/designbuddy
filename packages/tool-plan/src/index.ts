import type { Context, PluginMeta } from '@designbuddy/core'
import { registerTool } from '@designbuddy/tools'
import type { Tool, ToolsService } from '@designbuddy/tools'
import type { PlanService, PlanStatus } from '@designbuddy/plan'

export const name = 'tool-plan'
export const inject = ['tools', 'plan']
export const meta: PluginMeta = {
  title: '计划工具',
  description: 'plan.write / plan.update：模型用它写出计划并逐项推进。',
  category: 'tool',
  tags: ['planner'],
  order: 33,
}

export function apply(ctx: Context): void {
  const tools = ctx.get<ToolsService>('tools')
  const plan = ctx.get<PlanService>('plan')
  if (!tools || !plan) return

  const registered: Tool[] = [
    registerTool(ctx, {
      name: 'plan.write',
      title: '写计划',
      description: '为当前任务设定或替换完整计划。复杂任务开始时先写计划，再逐项执行。',
      scope: 'write',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' },
            description: '按执行顺序排列的步骤，每条一句话',
          },
        },
        required: ['items'],
      },
      handler: (args, run) => {
        const items = Array.isArray(args.items) ? (args.items as string[]) : []
        const next = plan.replace(run.sessionId, items)
        return `计划已更新（${next.length} 步）：\n${plan.render(run.sessionId)}`
      },
    }),
    registerTool(ctx, {
      name: 'plan.update',
      title: '更新计划进度',
      description: '把某个计划步骤标记为 doing 或 done。每完成一步就更新一次。',
      scope: 'write',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '步骤 id，例如 p1' },
          status: { type: 'string', enum: ['todo', 'doing', 'done'] },
        },
        required: ['id', 'status'],
      },
      handler: (args, run) => {
        plan.update(run.sessionId, String(args.id), args.status as PlanStatus)
        return plan.render(run.sessionId)
      },
    }),
  ]

  ctx.effect(() => {
    for (const tool of registered) tools.unregister(tool.name)
  })
}
