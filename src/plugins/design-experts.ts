/**
 * `design-experts` — Manager + 多专家 Agent, built on the generic agent loop.
 *
 * DSH equivalent: `experimental/agent-team` + `subagent/subagent-fork-in-process`.
 * The shape worth copying is that delegation is *just a tool*. The manager agent
 * does not know what an agent is; it knows it has a tool called `expert.consult`,
 * and the plugin implements that tool by running another preset in a forked
 * session.
 *
 * Consequence, and the reason this beats hard-coded orchestration: an expert is a
 * preset, so it can be installed, replaced or removed at runtime, and the manager
 * prompt never has to change.
 *
 * @module designbuddy/plugins/design-experts
 */

import type { Context } from '../kernel/index.ts'
import type { AgentLoop } from '../core/agent.ts'
import { AgentPresetRegistry } from '../core/agent.ts'
import { textOf } from '../core/llm.ts'
import type { JsonSchema } from '../core/schema.ts'
import type { SessionService } from '../core/session.ts'
import type { ToolRegistry } from '../core/tools.ts'

export const name = 'designExperts'

export const inject = ['agents', 'agentLoop', 'tools', 'sessions']

export interface Config {
  /** Extra expert ids to expose through `expert.consult`. */
  experts?: string[]
}

interface ExpertProfile {
  id: string
  name: string
  role: string
  instructions: string
  tools?: string[]
}

const EXPERTS: ExpertProfile[] = [
  {
    id: 'visual',
    name: '视觉设计专家',
    role: '负责配色、字体、视觉层级与品牌调性',
    instructions: '你只负责视觉方向。给出具体的色值、字体与 spacing 建议，不要讨论交互流程。',
    tools: ['figma.inspect_frame'],
  },
  {
    id: 'interaction',
    name: '交互设计专家',
    role: '负责流程、状态、信息架构与可用性',
    instructions: '你只负责交互与信息架构。输出状态机或步骤列表，不要给出色值。',
    tools: ['memory.recall'],
  },
  {
    id: 'brand',
    name: '品牌设计专家',
    role: '负责品牌一致性、语气与跨渠道表达',
    instructions: '你只负责品牌一致性。指出与既有品牌决策冲突的地方。',
    tools: ['memory.recall'],
  },
]

const consultSchema: JsonSchema = {
  type: 'object',
  properties: {
    expert: {
      type: 'string',
      description: '专家 id：visual / interaction / brand',
      enum: EXPERTS.map((expert) => expert.id),
    },
    question: { type: 'string', description: '要交给该专家的问题' },
  },
  required: ['expert', 'question'],
}

export function apply(ctx: Context, config: Config = {}): void {
  const presets = ctx.require<AgentPresetRegistry>('agents')
  const tools = ctx.require<ToolRegistry>('tools')
  const sessions = ctx.require<SessionService>('sessions')

  const requested = config.experts ? EXPERTS.filter((expert) => config.experts!.includes(expert.id)) : EXPERTS
  const registry = new Map(requested.map((expert) => [expert.id, expert]))

  for (const expert of registry.values()) {
    ctx.effect(() =>
      presets.register({
        id: expert.id,
        name: expert.name,
        role: expert.role,
        kind: 'design',
        instructions: expert.instructions,
        tools: expert.tools,
        maxSteps: 3,
      }),
    )
  }

  // The manager. Note `tools`: it gets the delegation tool and nothing else, so
  // it cannot silently do an expert's job and skip the review.
  ctx.effect(() =>
    presets.register({
      id: 'manager',
      name: '设计经理',
      role: '拆解需求、分派专家、汇总成方案',
      kind: 'planning',
      instructions:
        '你是设计经理。先用工具收集事实，再分派专家，最后汇总成可执行方案。' +
        '不要替专家给结论；专家没覆盖到的部分要明确说明。',
      tools: ['expert.consult', 'memory.recall', 'memory.save', 'figma.inspect_frame', 'office.read_docx', 'office.read_pptx', 'office.read_xlsx', 'office.read_pdf'],
      maxSteps: 8,
    }),
  )

  ctx.effect(() =>
    tools.register({
      name: 'expert.consult',
      description: '把一个子问题交给某个设计专家，返回该专家的独立结论',
      parameters: consultSchema,
      timeoutMs: 60_000,
      execute: async (args, callCtx) => {
        const expert = registry.get(String(args.expert))
        if (!expert) {
          return {
            content: `未知专家 "${String(args.expert)}"，可用：${[...registry.keys()].join(', ')}`,
            isError: true,
          }
        }

        const loop = ctx.require<AgentLoop>('agentLoop')
        // Fork a child session: the manager's transcript must not fill up with
        // the expert's deliberation. DSH's in-process subagent does the same.
        const child = sessions.create({ title: `${expert.name} · ${callCtx.agentId}` })
        let answer = ''
        for await (const event of loop.run({
          presetId: expert.id,
          sessionId: child.id,
          prompt: String(args.question),
          parentAgentId: callCtx.agentId,
        })) {
          if (event.type === 'agent/text') answer += event.text
          if (event.type === 'agent/end') answer = event.text || answer
        }
        return `[${expert.name}] ${answer.trim()}`
      },
    }),
  )

  /** Exposed so the demo can show the preset list changing on unload. */
  ctx.on('dispose', () => {
    ctx.logger.debug(`design-experts unloaded (${registry.size} experts)`)
  })
}

/** Helper for the demo: read the manager's answer out of a session transcript. */
export function managerAnswer(sessions: SessionService, sessionId: string): string {
  const messages = sessions.messages(sessionId)
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message && message.role === 'assistant' && textOf(message).trim() !== '') {
      return textOf(message)
    }
  }
  return ''
}
