/**
 * JSONL usage store — one appended line per run.
 *
 * Deliberately dumber than the session store: usage is a flat ledger, so a
 * single file is enough, and a corrupt line can be dropped without losing the
 * rest of the history. Same trade as sessions: synchronous append, because a
 * lost metering line is worse than a couple of milliseconds.
 *
 * @module designbuddy/core/usage-store
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

import type { UsageEntry } from './usage.ts'

export interface UsageStore {
  file: string
  append(entry: UsageEntry): void
  readAll(): UsageEntry[]
}

export function createUsageStore(file: string): UsageStore {
  mkdirSync(dirname(file), { recursive: true })
  return {
    file,
    append(entry) {
      appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8')
    },
    readAll() {
      if (!existsSync(file)) return []
      const entries: UsageEntry[] = []
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const parsed = JSON.parse(trimmed) as UsageEntry
          if (typeof parsed?.at === 'number') entries.push(parsed)
        } catch {
          /* 半行 / 断电写入：跳过这一行，其余照常回放 */
        }
      }
      return entries
    },
  }
}
