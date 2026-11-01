import type { Context, PluginMeta } from '@designbuddy/core'
import { registerTool } from '@designbuddy/tools'
import type { Tool, ToolsService } from '@designbuddy/tools'
import type { AgentService, AgentLoopService } from '@designbuddy/agents'

export const name = 'tool-agent'
export const inject = ['tools', 'agents', 'agentLoop']
export const meta: PluginMeta = {
  title: '子 Agent 委派',
  description: 'agent.delegate：把子任务交给另一个专家，在独立会话里跑完后回填结论。',
  category: 'tool',
  tags: ['subagent', 'multi-agent'],
  order: 35,
}

export function apply(ctx: Context): void {
  const tools = ctx.get<ToolsService>('tools')
  const agents = ctx.get<AgentService>('agents')
  const loop = ctx.get<AgentLoopService>('agentLoop')
  if (!tools || !agents || !loop) return

  const tool: Tool = registerTool(ctx, {
    name: 'agent.delegate',
    title: '委派给其他专家',
    description:
      '当子任务需要另一个专业视角（用户研究、交互流程、视觉品牌、设计评审）时，把任务描述清楚交给该专家，它会在独立会话中完成并返回结论。',
    scope: 'write',
    parameters: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          description: '专家名，必须来自可用专家列表',
          enum: agents.list().map((expert) => expert.name),
        },
        task: { type: 'string', description: '自包含的任务描述，包含背景、目标与期望产出' },
      },
      required: ['agent', 'task'],
    },
    handler: async (args, run) => {
      if (!agents.get(String(args.agent))) {
        return `没有名为 "${args.agent}" 的专家。可用：${agents.list().map((e) => e.name).join(', ')}`
      }
      const result = await loop.delegate(run.sessionId, String(args.agent), String(args.task))
      return `子会话 ${result.sessionId} 已完成：\n${result.text || '（无文本产出）'}`
    },
  })

  ctx.effect(() => tools.unregister(tool.name))
}
