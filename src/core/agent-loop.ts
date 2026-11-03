/**
 * The default agent loop.
 *
 * This is DSH's `core/agent-loop` in miniature: one turn is a step, a step is a
 * model call, and the loop ends when the model stops asking for tools. Every
 * observable moment goes out as an `AgentEvent`, and every durable fact is
 * appended to the session log — the same split DSH documents between "agent
 * events carry a live Agent" and "session events must survive a reload".
 *
 * Dependencies are resolved through `ctx.require(...)` **at run time**, not in
 * the constructor. That is deliberate: a plugin can replace `tools` or `llm`
 * while a session is open, and the next step picks up the new service without
 * restarting the loop.
 *
 * @module designbuddy/core/agent-loop
 */

import type { Context } from '../kernel/index.ts'
import type { AgentEvent, AgentLoop, AgentPreset, AgentRunOptions } from './agent.ts'
import { AgentPresetRegistry } from './agent.ts'
import type { Message, ToolCallPart } from './llm.ts'
import { assistantMessage, textMessage, toolResultMessage, textOf } from './llm.ts'
import type { SystemPromptService } from './prompt.ts'
import { ModelRouter } from './router.ts'
import { nextId } from './schema.ts'
import type { SessionService } from './session.ts'
import type { ToolRegistry } from './tools.ts'

const DEFAULT_MAX_STEPS = 6

/** 「技能」卡会往输入框里写 `@工具名`；这里把点名解析成系统提示，真模型也照办。 */
export function mentionedTools(prompt: string, available: readonly string[]): string[] {
  const names = new Set(available)
  const found: string[] = []
  for (const match of prompt.matchAll(/@([a-zA-Z][\w.-]*)/g)) {
    const candidate = match[1]!
    if (names.has(candidate) && !found.includes(candidate)) found.push(candidate)
  }
  return found
}

function mentionHint(names: string[]): string {
  return [
    `用户点名要用工具：${names.map((n) => '`' + n + '`').join('、')}。`,
    '第一轮就调用它，参数从用户消息里取；缺参数就问一句，不要用别的工具顶替。',
  ].join('')
}

export class DefaultAgentLoop implements AgentLoop {
  #ctx: Context

  constructor(ctx: Context) {
    this.#ctx = ctx
  }

  async *run(options: AgentRunOptions): AsyncIterable<AgentEvent> {
    const sessions = this.#ctx.require<SessionService>('sessions')
    const tools = this.#ctx.require<ToolRegistry>('tools')
    const router = this.#ctx.require<ModelRouter>('llm')
    const prompts = this.#ctx.require<SystemPromptService>('systemPrompt')
    const presets = this.#ctx.require<AgentPresetRegistry>('agents')

    const preset: AgentPreset = presets.require(options.presetId)
    const agentId = nextId('agent')
    const session = sessions.ensure(options.sessionId)

    sessions.append(session.id, 'agent/start', {
      agentId,
      presetId: preset.id,
      parentAgentId: options.parentAgentId ?? null,
      prompt: options.prompt,
    })
    sessions.appendMessage(session.id, textMessage('user', options.prompt))

    yield {
      type: 'agent/created',
      agentId,
      presetId: preset.id,
      sessionId: session.id,
      parentAgentId: options.parentAgentId,
    }

    const maxSteps = preset.maxSteps ?? DEFAULT_MAX_STEPS
    let accumulatedText = ''

    for (let step = 1; step <= maxSteps; step += 1) {
      if (options.signal?.aborted) {
        yield await this.#end(sessions, session.id, agentId, 'failed', accumulatedText, 'aborted')
        return
      }

      yield { type: 'agent/step', agentId, step }

      const schemas = tools.schemas(preset.tools)
      const system = await prompts.build(this.#ctx, preset.instructions)
      const mention = mentionedTools(options.prompt, schemas.map((tool) => tool.name))
      const messages: Message[] = [
        textMessage('system', mention.length === 0 ? system : `${system}\n\n${mentionHint(mention)}`),
        ...sessions.messages(session.id),
      ]

      let stepText = ''
      const calls: ToolCallPart[] = []

      for await (const chunk of router.stream({
        kind: preset.kind,
        model: preset.model,
        messages,
        tools: schemas,
        signal: options.signal,
      })) {
        if (chunk.type === 'text-delta') {
          stepText += chunk.text
          yield { type: 'agent/text', agentId, text: chunk.text }
        } else if (chunk.type === 'tool-call') {
          calls.push(chunk.call)
        }
      }

      accumulatedText += stepText
      sessions.appendMessage(session.id, assistantMessage(stepText, calls))

      if (calls.length === 0) {
        const reason = stepText.trim() === '' ? 'empty-response' : undefined
        yield await this.#end(
          sessions,
          session.id,
          agentId,
          reason ? 'failed' : 'done',
          accumulatedText,
          reason,
        )
        return
      }

      for (const call of calls) {
        yield { type: 'agent/tool-call', agentId, call }
        sessions.append(session.id, 'tool/call', {
          agentId,
          callId: call.id,
          name: call.name,
          arguments: call.arguments,
        })

        const outcome = await tools.execute(call.name, call.arguments, {
          sessionId: session.id,
          agentId,
          callId: call.id,
          signal: options.signal,
        })

        sessions.appendMessage(session.id, toolResultMessage(call.id, call.name, outcome.content))
        sessions.append(session.id, 'tool/result', {
          agentId,
          callId: call.id,
          name: call.name,
          isError: outcome.isError,
          durationMs: outcome.durationMs,
          truncated: outcome.truncated,
        })

        yield {
          type: 'agent/tool-result',
          agentId,
          name: call.name,
          content: outcome.content,
          isError: outcome.isError,
          durationMs: outcome.durationMs,
        }

        if (options.signal?.aborted) {
          yield await this.#end(sessions, session.id, agentId, 'failed', accumulatedText, 'aborted')
          return
        }
      }
    }

    yield await this.#end(
      sessions,
      session.id,
      agentId,
      'failed',
      accumulatedText,
      `reached max steps (${maxSteps})`,
    )
  }

  async #end(
    sessions: SessionService,
    sessionId: string,
    agentId: string,
    status: 'done' | 'failed',
    text: string,
    reason?: string,
  ): Promise<AgentEvent> {
    sessions.append(sessionId, 'agent/end', { agentId, status, reason: reason ?? null, text })
    return { type: 'agent/end', agentId, status, reason, text }
  }
}

/** Convenience for sub-agents: run to completion and return the final text. */
export async function runToText(loop: AgentLoop, options: AgentRunOptions): Promise<string> {
  let text = ''
  for await (const event of loop.run(options)) {
    if (event.type === 'agent/text') text += event.text
    if (event.type === 'agent/end') return event.text || text
  }
  return text
}

/** Convenience for UIs that only need the transcript of one assistant turn. */
export function lastAssistantText(messages: Message[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message && message.role === 'assistant') return textOf(message)
  }
  return ''
}
