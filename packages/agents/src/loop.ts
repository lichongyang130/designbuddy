import type { Context } from '@designbuddy/core'
import type { ChatMessage, LlmChunk, LlmService, ToolCall } from '@designbuddy/llm'
import type { SessionService } from '@designbuddy/session'
import type { SystemPromptService } from '@designbuddy/system-prompt'
import type { ToolsService } from '@designbuddy/tools'
import type { AgentPhase, Expert, RunOptions, TurnResult } from './types'
import type { AgentService } from './service'

export interface LoopOptions {
  maxSteps: number
  /** Rough character budget for replayed history. */
  maxHistoryChars: number
}

interface Deps {
  llm: LlmService
  sessions: SessionService
  tools: ToolsService
  systemPrompt: SystemPromptService
  agents: AgentService
}

/**
 * The default agent driver: turn → steps → tool calls → next step.
 *
 * It owns the lifecycle only. What the model sees (prompt sections, tool
 * schemas) and what it can do (guarded tools) come from plugins, so this file
 * stays small even as the product grows.
 */
export class AgentLoopService {
  private controllers = new Map<string, AbortController>()

  constructor(
    private readonly ctx: Context,
    private readonly deps: Deps,
    private readonly options: LoopOptions,
  ) {}

  isRunning(sessionId: string): boolean {
    return this.controllers.has(sessionId)
  }

  abort(sessionId: string): boolean {
    const controller = this.controllers.get(sessionId)
    if (!controller) return false
    controller.abort()
    return true
  }

  async run(input: RunOptions): Promise<TurnResult> {
    const { llm, sessions, tools, systemPrompt, agents } = this.deps
    const session = sessions.require(input.sessionId)
    if (this.controllers.has(session.id)) throw new Error('this session is already running a turn')

    const controller = new AbortController()
    this.controllers.set(session.id, controller)

    const expert: Expert = agents.resolve(input.agent ?? session.agent)
    const model = input.model || session.model || llm.defaultModel()
    const turnId = `t_${Date.now().toString(36)}`
    let text = ''
    let steps = 0

    const state = (phase: AgentPhase) =>
      this.ctx.emit('agent/state', { sessionId: session.id, turnId, phase, agent: expert.name })

    sessions.append(session.id, {
      type: 'turn-start',
      turnId,
      agent: expert.name,
      model,
      text: input.input ?? '',
    })
    if (input.input) {
      sessions.append(session.id, { type: 'user', text: input.input })
      const isFirstUserMessage = session.events.filter((entry) => entry.event.type === 'user').length === 1
      if (isFirstUserMessage && /^(新的设计会话|New session)$/.test(session.title)) {
        sessions.update(session.id, { title: input.input.replace(/\s+/g, ' ').slice(0, 22) })
      }
    }

    try {
      for (let step = 1; step <= this.options.maxSteps; step++) {
        steps = step
        if (controller.signal.aborted) break
        state('thinking')

        const system = await systemPrompt.assemble({
          sessionId: session.id,
          agent: expert.name,
          expert,
          input: step === 1 ? input.input : undefined,
        })
        const messages = projectHistory(session.events, system, this.options.maxHistoryChars)
        const schemas = this.schemasFor(expert)

        let assistantText = ''
        const calls: ToolCall[] = []
        for await (const chunk of llm.stream({
          model,
          messages,
          tools: schemas,
          signal: controller.signal,
        }) as AsyncIterable<LlmChunk>) {
          if (chunk.type === 'text') {
            assistantText += chunk.text
            this.ctx.emit('agent/delta', { sessionId: session.id, turnId, text: chunk.text })
          } else if (chunk.type === 'tool_call') {
            calls.push(chunk.call)
          }
        }

        if (assistantText.trim()) {
          sessions.append(session.id, {
            type: 'assistant',
            text: assistantText,
            agent: expert.name,
            model,
          })
          text = assistantText
        }

        if (!calls.length) {
          sessions.append(session.id, { type: 'turn-end', turnId, reason: 'stop' })
          return { turnId, text, steps, reason: 'stop' }
        }

        state('tools')
        for (const call of calls) {
          sessions.append(session.id, {
            type: 'tool-call',
            callId: call.id,
            name: call.name,
            args: call.arguments,
            agent: expert.name,
          })
          const outcome = await tools.execute(call, {
            sessionId: session.id,
            agent: expert.name,
            ctx: this.ctx,
            signal: controller.signal,
          })
          sessions.append(session.id, {
            type: 'tool-result',
            callId: call.id,
            name: call.name,
            ok: outcome.ok,
            result: outcome.output,
            error: outcome.error,
            durationMs: outcome.durationMs,
          })
          if (outcome.ok && call.name === 'plan.write') this.ctx.emit('plan/sync', session.id)
        }
      }

      sessions.append(session.id, { type: 'turn-end', turnId, reason: 'max-steps' })
      return { turnId, text, steps, reason: 'max-steps' }
    } catch (error) {
      const aborted = controller.signal.aborted
      const message = error instanceof Error ? error.message : String(error)
      sessions.append(session.id, { type: 'error', message })
      sessions.append(session.id, { type: 'turn-end', turnId, reason: aborted ? 'aborted' : 'error' })
      this.ctx.log('error', `turn failed: ${message}`)
      return { turnId, text, steps, reason: aborted ? 'aborted' : 'error', error: message }
    } finally {
      this.controllers.delete(session.id)
      this.ctx.emit('agent/state', { sessionId: session.id, turnId, phase: 'idle', agent: expert.name })
    }
  }

  /**
   * Hands a task to another expert in its own session, then records the handoff
   * in the parent log. Sub-agent output is a note, not a chat message, so the
   * parent's history stays readable.
   */
  async delegate(parentSessionId: string, agent: string, task: string): Promise<{ sessionId: string; text: string }> {
    const { sessions, agents } = this.deps
    const parent = sessions.require(parentSessionId)
    const expert = agents.resolve(agent)
    const child = sessions.create({
      title: `${expert.title} · ${task.slice(0, 24)}`,
      model: parent.model,
      agent: expert.name,
    })
    sessions.append(parentSessionId, {
      type: 'handoff',
      from: parent.agent,
      to: expert.name,
      reason: task,
    })
    this.ctx.emit('agent/subagent', { parentSessionId, childSessionId: child.id, agent: expert.name })

    const result = await this.run({ sessionId: child.id, input: task, agent: expert.name })
    sessions.append(parentSessionId, {
      type: 'note',
      title: `${expert.title}的产出`,
      text: result.text || `（没有产出：${result.reason}）`,
    })
    return { sessionId: child.id, text: result.text }
  }

  private schemasFor(expert: Expert) {
    const all = this.deps.tools.schemas()
    if (!expert.tools || expert.tools.includes('*')) return all
    return all.filter((tool) => expert.tools!.includes(tool.name))
  }
}

/**
 * Projects the event log into model messages.
 *
 * History is derived, never stored twice: replaying the log through this
 * function is the definition of "what the model saw".
 */
export function projectHistory(
  events: Array<{ event: any }>,
  system: string,
  maxChars: number,
): ChatMessage[] {
  const messages: ChatMessage[] = system ? [{ role: 'system', content: system }] : []
  let pendingAssistant: ChatMessage | null = null

  for (const { event } of events) {
    switch (event.type) {
      case 'user':
        pendingAssistant = null
        messages.push({ role: 'user', content: event.text })
        break
      case 'assistant': {
        pendingAssistant = { role: 'assistant', content: event.text }
        messages.push(pendingAssistant)
        break
      }
      case 'tool-call': {
        if (!pendingAssistant || pendingAssistant.role !== 'assistant') {
          pendingAssistant = { role: 'assistant', content: '' }
          messages.push(pendingAssistant)
        }
        pendingAssistant.toolCalls = [
          ...(pendingAssistant.toolCalls ?? []),
          { id: event.callId, name: event.name, arguments: event.args ?? {} },
        ]
        break
      }
      case 'tool-result': {
        messages.push({
          role: 'tool',
          toolCallId: event.callId,
          name: event.name,
          content: event.ok ? event.result ?? '' : JSON.stringify({ error: event.error }),
        })
        break
      }
      default:
        break
    }
  }

  // Keep the first system message plus the newest exchanges within budget.
  const head = messages[0]?.role === 'system' ? [messages[0]] : []
  const tail: ChatMessage[] = []
  let budget = maxChars
  for (let index = messages.length - 1; index >= (head.length ? 1 : 0); index--) {
    const message = messages[index]
    budget -= message.content.length
    if (budget < 0) break
    tail.unshift(message)
  }
  // Never start the replay with an orphan tool message.
  while (tail.length && tail[0].role === 'tool') tail.shift()
  return [...head, ...tail]
}
