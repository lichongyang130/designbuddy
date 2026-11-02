/**
 * JSONL session store — one append-only file per session.
 *
 * Same shape DSH's `session/session-persistence-jsonl` writes: every line is a
 * `SessionEvent`, so a log can be replayed, grepped or shipped elsewhere without
 * a migration step. Writes are synchronous and append-only, which is the right
 * trade at this scale: a chat turn produces a handful of lines, and losing a
 * line because the process exited mid-flush would be worse than a few ms of I/O.
 *
 * @module designbuddy/core/session-store
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { SessionEvent } from './session.ts'
import type { SessionPersister } from './session.ts'

export interface SessionStore extends SessionPersister {
  /** Raw JSONL for every session on disk, oldest file first. */
  readAll(): string[]
  dir: string
}

/** Replace characters that would escape the sessions directory. */
function safeId(sessionId: string): string {
  return String(sessionId).replace(/[^A-Za-z0-9._-]/g, '_')
}

export function createSessionStore(dir: string): SessionStore {
  mkdirSync(dir, { recursive: true })
  return {
    dir,
    append(event: SessionEvent) {
      appendFileSync(join(dir, safeId(event.sessionId) + '.jsonl'), JSON.stringify(event) + '\n', 'utf8')
    },
    readAll() {
      if (!existsSync(dir)) return []
      return readdirSync(dir)
        .filter((name) => name.endsWith('.jsonl'))
        .sort()
        .map((name) => readFileSync(join(dir, name), 'utf8'))
    },
  }
}
