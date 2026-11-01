/**
 * Client side of the split: requests, event handling, and a UI-shaped projection.
 *
 * DSH equivalent: `packages/client/connection` + `client/store` + the `client/ui-*`
 * plugins. The `ClientStore` below is the part worth copying: it is the only
 * place that decides what a user sees, and it is driven exclusively by frames.
 *
 * @module designbuddy/sdk/client
 */

import type { Disposer } from '../kernel/index.ts'
import type { AgentEvent } from '../core/agent.ts'
import type { Message } from '../core/llm.ts'
import type { SessionEvent } from '../core/session.ts'
import type { ClientFrame, ClientMethod, HostFrame, Transport } from './protocol.ts'

export interface AgentRunResult {
  status: string
  text: string
}

export class HostClient {
  #transport: Transport
  #pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  #handlers = new Set<(frame: HostFrame) => void>()
  #seq = 0

  constructor(transport: Transport) {
    this.#transport = transport
    transport.onFrame((frame: HostFrame) => this.#receive(frame))
  }

  request(method: ClientMethod, params: Record<string, unknown> = {}): Promise<unknown> {
    this.#seq += 1
    const id = `req-${this.#seq}`
    return new Promise<unknown>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject })
      const frame: ClientFrame = { id, method, params }
      this.#transport.send(frame)
    })
  }

  /** Run one agent turn and resolve when the host reports `agent/end`. */
  async run(input: { sessionId: string; presetId?: string; prompt: string }): Promise<AgentRunResult> {
    const result = (await this.request('agent.run', {
      sessionId: input.sessionId,
      presetId: input.presetId ?? 'default',
      prompt: input.prompt,
    })) as AgentRunResult
    return result
  }

  onFrame(handler: (frame: HostFrame) => void): Disposer {
    this.#handlers.add(handler)
    return () => {
      this.#handlers.delete(handler)
    }
  }

  #receive(frame: HostFrame): void {
    if (frame.type === 'rpc.result') {
      const pending = this.#pending.get(frame.id)
      if (pending) {
        this.#pending.delete(frame.id)
        pending.resolve(frame.result)
      }
      return
    }
    if (frame.type === 'rpc.error') {
      const pending = this.#pending.get(frame.id)
      if (pending) {
        this.#pending.delete(frame.id)
        pending.reject(new Error(frame.message))
      }
      return
    }
    for (const handler of [...this.#handlers]) handler(frame)
  }
}

export interface TranscriptEntry {
  kind: 'user' | 'assistant' | 'tool'
  text: string
  name?: string
}

export interface SessionView {
  id: string
  title: string
  status: 'idle' | 'running' | 'done' | 'failed'
  /** Built from durable `message` events only, so reconnects are idempotent. */
  transcript: TranscriptEntry[]
  /** Live activity: may be ahead of the transcript and is never replayed. */
  activity: string | null
  steps: number
  toolCalls: number
}

/**
 * Minimal client-side store: the presentation layer's state machine.
 *
 * Design rule borrowed from DSH: the transcript is derived from durable session
 * events, the spinner from live agent events. Mixing them is how UIs end up
 * duplicating text after a reconnect.
 */
export class ClientStore {
  #sessions = new Map<string, SessionView>()

  get session(): SessionView[] {
    return [...this.#sessions.values()]
  }

  get(sessionId: string): SessionView | undefined {
    return this.#sessions.get(sessionId)
  }

  track(sessionId: string, title = '未命名会话'): SessionView {
    const existing = this.#sessions.get(sessionId)
    if (existing) return existing
    const view: SessionView = {
      id: sessionId,
      title,
      status: 'idle',
      transcript: [],
      activity: null,
      steps: 0,
      toolCalls: 0,
    }
    this.#sessions.set(sessionId, view)
    return view
  }

  apply(frame: HostFrame): void {
    if (frame.type === 'event') {
      this.#applySessionEvent(frame.sessionId, frame.event)
      return
    }
    if (frame.type === 'agent-event') {
      this.#applyAgentEvent(frame.sessionId, frame.event)
    }
  }

  #applySessionEvent(sessionId: string, event: SessionEvent): void {
    const view = this.track(sessionId)
    if (event.type === 'message') {
      const message = event.payload as Message
      if (message.role === 'system') return
      const text = message.content
        .filter((part) => part.type === 'text')
        .map((part) => (part as { text: string }).text)
        .join('')
      if (message.role === 'user') view.transcript.push({ kind: 'user', text })
      else if (message.role === 'assistant') view.transcript.push({ kind: 'assistant', text })
      else if (message.role === 'tool') {
        view.transcript.push({ kind: 'tool', text, name: message.name })
      }
      return
    }
    if (event.type === 'agent/start') {
      view.status = 'running'
      view.steps = 0
      view.toolCalls = 0
      view.activity = '正在思考'
      return
    }
    if (event.type === 'agent/end') {
      view.status = (event.payload as { status: string }).status === 'done' ? 'done' : 'failed'
      view.activity = null
    }
  }

  #applyAgentEvent(sessionId: string, event: AgentEvent): void {
    const view = this.track(sessionId)
    if (event.type === 'agent/step') {
      view.steps = event.step
      view.activity = `第 ${event.step} 步`
      return
    }
    if (event.type === 'agent/tool-call') {
      view.toolCalls += 1
      view.activity = `调用工具 ${event.call.name}`
      return
    }
    if (event.type === 'agent/tool-result') {
      view.activity = `${event.name} ${event.isError ? '失败' : '完成'} (${event.durationMs}ms)`
      return
    }
    if (event.type === 'agent/text') {
      view.activity = '正在输出'
    }
  }
}
