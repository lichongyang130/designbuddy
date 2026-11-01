/**
 * Append-only session log plus the in-memory message store.
 *
 * Mirrors DSH's `core/session` + `session/session-persistence`: the log is a
 * sequence of durable facts (`SessionEvent`), while `messages` is the projection
 * the model reads. Keeping them separate is what lets you replay a session,
 * render a transcript, or resume after a reload without re-running the model.
 *
 * DSH persists to JSONL (`session/session-persistence-jsonl`) and SQLite. Here
 * the log is in memory and `toJsonl()` gives you the same records as text, so a
 * persistence plugin can be added without touching the loop.
 *
 * @module designbuddy/core/session
 */

import type { Disposer } from '../kernel/index.ts'
import type { Message } from './llm.ts'
import { nextId } from './schema.ts'

export interface SessionEvent {
  /** Monotonic per session. DSH calls this `seq`. */
  seq: number
  sessionId: string
  type: string
  at: number
  payload: unknown
}

export interface SessionState {
  id: string
  title: string
  createdAt: number
  events: SessionEvent[]
  messages: Message[]
}

export type SessionSubscriber = (event: SessionEvent) => void

export class SessionService {
  #sessions = new Map<string, SessionState>()
  #subscribers = new Map<string, Set<SessionSubscriber>>()

  create(options: { id?: string; title?: string } = {}): SessionState {
    const id = options.id ?? nextId('sess')
    if (this.#sessions.has(id)) throw new Error(`session "${id}" already exists`)
    const state: SessionState = {
      id,
      title: options.title ?? '未命名会话',
      createdAt: Date.now(),
      events: [],
      messages: [],
    }
    this.#sessions.set(id, state)
    return state
  }

  /** Get or create. The agent loop uses this so a run never fails on a cold id. */
  ensure(id: string, title?: string): SessionState {
    return this.#sessions.get(id) ?? this.create({ id, title })
  }

  get(id: string): SessionState | undefined {
    return this.#sessions.get(id)
  }

  list(): SessionState[] {
    return [...this.#sessions.values()]
  }

  /**
   * Append a durable fact and fan it out to subscribers.
   *
   * Subscribers are notified synchronously after the record is stored, so a
   * subscriber that throws cannot lose the record — it only loses its own
   * notification.
   */
  append(sessionId: string, type: string, payload: unknown): SessionEvent {
    const session = this.ensure(sessionId)
    const event: SessionEvent = {
      seq: session.events.length + 1,
      sessionId: session.id,
      type,
      at: Date.now(),
      payload,
    }
    session.events.push(event)
    for (const subscriber of this.#subscribers.get(session.id) ?? []) {
      try {
        subscriber(event)
      } catch {
        // Notification failures are the subscriber's problem, not the log's.
      }
    }
    return event
  }

  appendMessage(sessionId: string, message: Message): Message {
    const session = this.ensure(sessionId)
    session.messages.push(message)
    this.append(session.id, 'message', {
      id: message.id,
      role: message.role,
      content: message.content,
      toolCallId: message.toolCallId,
      name: message.name,
    })
    return message
  }

  messages(sessionId: string): Message[] {
    return [...(this.#sessions.get(sessionId)?.messages ?? [])]
  }

  events(sessionId: string): SessionEvent[] {
    return [...(this.#sessions.get(sessionId)?.events ?? [])]
  }

  /** Subscribe to durable facts. Returned disposer detaches the subscriber. */
  subscribe(sessionId: string, subscriber: SessionSubscriber): Disposer {
    let set = this.#subscribers.get(sessionId)
    if (!set) {
      set = new Set()
      this.#subscribers.set(sessionId, set)
    }
    set.add(subscriber)
    return () => {
      const current = this.#subscribers.get(sessionId)
      if (!current) return
      current.delete(subscriber)
      if (current.size === 0) this.#subscribers.delete(sessionId)
    }
  }

  /** One record per line, the format DSH's JSONL persistence writes. */
  toJsonl(sessionId: string): string {
    return this.events(sessionId)
      .map((event) => JSON.stringify(event))
      .join('\n')
  }

  /** Rebuild a session from a JSONL log. Corrupt lines are reported, not fatal. */
  loadJsonl(jsonl: string): { session: SessionState; skipped: number } {
    const events: SessionEvent[] = []
    let skipped = 0
    for (const line of jsonl.split('\n')) {
      if (line.trim() === '') continue
      try {
        events.push(JSON.parse(line) as SessionEvent)
      } catch {
        skipped += 1
      }
    }
    const first = events[0]
    const session = this.create({ id: first?.sessionId ?? nextId('sess') })
    for (const event of events) {
      session.events.push(event)
      if (event.type === 'message') {
        const payload = event.payload as Message
        session.messages.push({
          id: payload.id,
          role: payload.role,
          content: payload.content,
          toolCallId: payload.toolCallId,
          name: payload.name,
          at: event.at,
        })
      }
    }
    return { session, skipped }
  }
}
