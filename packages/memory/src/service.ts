import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Context } from '@designbuddy/core'

export type MemoryKind = 'decision' | 'constraint' | 'preference' | 'fact' | 'glossary'

export interface MemoryEntry {
  id: string
  kind: MemoryKind
  text: string
  tags: string[]
  at: number
}

export interface RememberInput {
  kind?: MemoryKind
  text: string
  tags?: string[]
}

/**
 * Design memory: the decisions, constraints and preferences a design team would
 * otherwise lose between sessions. Kept deliberately small and inspectable —
 * every entry is a sentence a human could have written in a doc.
 */
export class MemoryService {
  private entries: MemoryEntry[] = []

  constructor(
    private readonly ctx: Context,
    private readonly file: string | null = null,
  ) {
    this.load()
  }

  add(input: RememberInput): MemoryEntry {
    const entry: MemoryEntry = {
      id: `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      kind: input.kind ?? 'fact',
      text: input.text.trim(),
      tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      at: Date.now(),
    }
    this.entries.push(entry)
    this.persist()
    this.ctx.emit('memory/changed', this.entries)
    return entry
  }

  all(): MemoryEntry[] {
    return [...this.entries]
  }

  remove(id: string): boolean {
    const before = this.entries.length
    this.entries = this.entries.filter((entry) => entry.id !== id)
    if (this.entries.length === before) return false
    this.persist()
    this.ctx.emit('memory/changed', this.entries)
    return true
  }

  /** Lexical recall. A production build would swap this for embeddings. */
  search(query: string, limit = 6): MemoryEntry[] {
    const tokens = query
      .toLowerCase()
      .split(/[\s，。,.、;；:：!?！？/]+/)
      .filter((token) => token.length > 1)
    if (!tokens.length) return this.entries.slice(-limit)
    const scored = this.entries.map((entry) => {
      const haystack = `${entry.text} ${entry.tags.join(' ')} ${entry.kind}`.toLowerCase()
      let score = 0
      for (const token of tokens) {
        if (haystack.includes(token)) score += token.length
      }
      if (entry.kind === 'constraint') score += 2
      return { entry, score }
    })
    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.entry)
  }

  render(entries: MemoryEntry[]): string {
    if (!entries.length) return ''
    return entries.map((entry) => `- [${entry.kind}] ${entry.text}`).join('\n')
  }

  private persist(): void {
    if (!this.file) return
    try {
      mkdirSync(dirname(resolve(this.file)), { recursive: true })
      writeFileSync(resolve(this.file), JSON.stringify(this.entries, null, 2), 'utf8')
    } catch (error) {
      this.ctx.log('warn', `memory not persisted: ${(error as Error).message}`)
    }
  }

  private load(): void {
    if (!this.file || !existsSync(resolve(this.file))) return
    try {
      const parsed = JSON.parse(readFileSync(resolve(this.file), 'utf8'))
      if (Array.isArray(parsed)) this.entries = parsed
    } catch {
      this.ctx.log('warn', 'memory file unreadable, starting empty')
    }
  }
}
