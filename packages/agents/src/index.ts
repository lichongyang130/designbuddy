import type { ConfigSchema, Context, PluginMeta } from '@designbuddy/core'
import type { LlmService } from '@designbuddy/llm'
import type { SessionService } from '@designbuddy/session'
import type { SystemPromptService } from '@designbuddy/system-prompt'
import type { ToolsService } from '@designbuddy/tools'
import { AgentService } from './service'
import { AgentLoopService } from './loop'

export * from './types'
export { AgentService } from './service'
export { AgentLoopService, projectHistory } from './loop'
export type { LoopOptions } from './loop'

export const name = 'agents'
export const inject = ['llm', 'sessions', 'tools', 'systemPrompt']

export const meta: PluginMeta = {
  title: 'Agent 运行时',
  description: 'Agent 注册表 + 默认循环：一次对话由若干 step 组成，每个 step 可调用工具并回灌结果。',
  category: 'agent',
  tags: ['agent', 'runtime', 'loop'],
  order: 12,
}

export const Config: ConfigSchema = [
  {
    key: 'maxSteps',
    label: '单轮最大步数',
    type: 'number',
    default: 6,
    description: '一次用户输入最多允许多少次"模型→工具"往返，防止失控循环。',
  },
  {
    key: 'maxHistoryChars',
    label: '历史字符预算',
    type: 'number',
    default: 24000,
    description: '回放给模型的历史上限（按字符粗略估算），超出后丢弃最旧的消息。',
  },
]

export function apply(ctx: Context, config: { maxSteps?: number; maxHistoryChars?: number }): void {
  const llm = ctx.get<LlmService>('llm')
  const sessions = ctx.get<SessionService>('sessions')
  const tools = ctx.get<ToolsService>('tools')
  const systemPrompt = ctx.get<SystemPromptService>('systemPrompt')
  if (!llm || !sessions || !tools || !systemPrompt) return

  const agents = new AgentService(ctx)
  ctx.set('agents', agents)
  ctx.set(
    'agentLoop',
    new AgentLoopService(
      ctx,
      { llm, sessions, tools, systemPrompt, agents },
      {
        maxSteps: Number(config.maxSteps ?? 6),
        maxHistoryChars: Number(config.maxHistoryChars ?? 24000),
      },
    ),
  )
}
