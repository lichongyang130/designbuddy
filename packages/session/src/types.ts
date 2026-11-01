import type { Usage } from '@designbuddy/llm'

/**
 * Everything an agent does is an event. History is never stored as messages;
 * it is projected from this log, which keeps replay, branching and handoffs
 * possible without a second source of truth.
 */
export type SessionEvent =
  | { type: 'turn-start'; turnId: string; agent: string; model: string; text: string }
  | { type: 'user'; text: string }
  | { type: 'assistant'; text: string; agent: string; model: string; usage?: Usage }
  | { type: 'tool-call'; callId: string; name: string; args: Record<string, unknown>; agent: string }
  | {
      type: 'tool-result'
      callId: string
      name: string
      ok: boolean
      result?: string
      error?: string
      durationMs: number
    }
  | { type: 'note'; title: string; text: string }
  | { type: 'handoff'; from: string; to: string; reason: string }
  | { type: 'error'; message: string }
  | { type: 'turn-end'; turnId: string; reason: 'stop' | 'tool_calls' | 'max-steps' | 'error' | 'aborted' }

export interface StoredEvent {
  seq: number
  at: number
  event: SessionEvent
}

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  model: string
  agent: string
  events: StoredEvent[]
}
