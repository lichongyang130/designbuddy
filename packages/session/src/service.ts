import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@designbuddy/core'
import type { Session, SessionEvent, StoredEvent } from './types'

export interface SessionSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  model: string
  agent: string
  eventCount: number
}

export interface CreateSessionOptions {
  title?: string
  model: string
  agent: string
}

/**
 * The append-only log every other capability reads from.
 *
 * A new event type (a plan update, a handoff, a sandbox result) is additive:
 * append it, project it, render it. No migration, no second store.
 */
export class SessionService {
  private sessions = new Map<string, Session>()

  constructor(
    private readonly ctx: Context,
    private readonly dir: string | null = null,
  ) {
    if (this.dir) this.loadFromDisk()
  }

  create(options: CreateSessionOptions): Session {
    const now = Date.now()
    const session: Session = {
      id: `s_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      title: options.title?.trim() || '新的设计会话',
      createdAt: now,
      updatedAt: now,
      model: options.model,
      agent: options.agent,
      events: [],
    }
    this.sessions.set(session.id, session)
    this.persistMeta(session)
    this.ctx.emit('session/created', this.summary(session))
    return session
  }

  list(): SessionSummary[] {
    return [...this.sessions.values()]
      .map((session) => this.summary(session))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  summary(session: Session): SessionSummary {
    return {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      model: session.model,
      agent: session.agent,
      eventCount: session.events.length,
    }
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  require(id: string): Session {
    const session = this.sessions.get(id)
    if (!session) throw new Error(`session not found: ${id}`)
    return session
  }

  /** The only write path. Everything else derives from it. */
  append(id: string, event: SessionEvent): StoredEvent {
    const session = this.require(id)
    const stored: StoredEvent = { seq: session.events.length + 1, at: Date.now(), event }
    session.events.push(stored)
    session.updatedAt = stored.at
    if (this.dir) {
      appendFileSync(join(this.dir, `${id}.jsonl`), `${JSON.stringify(stored)}\n`, 'utf8')
    }
    this.ctx.emit('session/append', { sessionId: id, stored })
    return stored
  }

  update(id: string, patch: Partial<Pick<Session, 'title' | 'model' | 'agent'>>): Session {
    const session = this.require(id)
    Object.assign(session, patch)
    session.updatedAt = Date.now()
    this.persistMeta(session)
    this.ctx.emit('session/updated', this.summary(session))
    return session
  }

  delete(id: string): boolean {
    if (!this.sessions.delete(id)) return false
    if (this.dir) {
      try {
        rmSync(join(this.dir, `${id}.jsonl`), { force: true })
        rmSync(join(this.dir, `${id}.meta.json`), { force: true })
      } catch {
        /* best effort */
      }
    }
    this.ctx.emit('session/deleted', id)
    return true
  }

  /** Events of one kind, newest last. */
  filter(sessionId: string, type: SessionEvent['type']): SessionEvent[] {
    return this.require(sessionId)
      .events.filter((item) => item.event.type === type)
      .map((item) => item.event)
  }

  private persistMeta(session: Session): void {
    if (!this.dir) return
    const { id, title, createdAt, updatedAt, model, agent } = session
    writeFileSync(
      join(this.dir, `${id}.meta.json`),
      JSON.stringify({ id, title, createdAt, updatedAt, model, agent }, null, 2),
      'utf8',
    )
  }

  private loadFromDisk(): void {
    if (!existsSync(this.dir!)) {
      mkdirSync(this.dir!, { recursive: true })
      return
    }
    for (const file of readdirSync(this.dir!)) {
      if (!file.endsWith('.meta.json')) continue
      const id = file.replace('.meta.json', '')
      try {
        const meta = JSON.parse(readFileSync(join(this.dir!, file), 'utf8'))
        const session: Session = { ...meta, events: [] }
        const logPath = join(this.dir!, `${id}.jsonl`)
        if (existsSync(logPath)) {
          for (const line of readFileSync(logPath, 'utf8').split('\n')) {
            if (!line.trim()) continue
            session.events.push(JSON.parse(line))
          }
        }
        this.sessions.set(id, session)
      } catch (error) {
        this.ctx.log('warn', `could not restore session ${id}`)
      }
    }
  }
}
