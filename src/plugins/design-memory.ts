/**
 * `design-memory` — DesignBuddy's design memory, as a plugin.
 *
 * This is the plugin that proves the architecture pays for itself: it adds a
 * service, a prompt section and two tools, and unloading it removes all four
 * with no other plugin changing a line. DSH does the same thing with
 * `context/*` and `session-query/*`.
 *
 * Service key: `designMemory`.
 *
 * @module designbuddy/plugins/design-memory
 */

import type { Context } from '../kernel/index.ts'
import type { JsonSchema } from '../core/schema.ts'
import type { SystemPromptService } from '../core/prompt.ts'
import type { ToolRegistry } from '../core/tools.ts'

export const name = 'designMemory'

export const inject = ['tools', 'systemPrompt']

export interface DesignDecision {
  id: string
  topic: string
  content: string
  at: number
}

export interface Config {
  /** Seed decisions, useful for tests and demos. */
  seed?: { topic: string; content: string }[]
  /** How many entries the prompt section may inject. */
  promptLimit?: number
}

export class DesignMemoryService {
  #entries: DesignDecision[] = []
  #seq = 0

  save(topic: string, content: string): DesignDecision {
    this.#seq += 1
    const entry: DesignDecision = {
      id: `dm-${this.#seq}`,
      topic,
      content,
      at: Date.now(),
    }
    // Same topic replaces the old decision: a design system should not carry two
    // contradictory answers to one question.
    const existing = this.#entries.findIndex((candidate) => candidate.topic === topic)
    if (existing >= 0) this.#entries[existing] = entry
    else this.#entries.push(entry)
    return entry
  }

  /** Substring recall, newest first. A real implementation would embed + rank. */
  recall(query: string | undefined, limit = 3): DesignDecision[] {
    const matched = query
      ? this.#entries.filter(
          (entry) => entry.topic.includes(query) || entry.content.includes(query),
        )
      : this.#entries
    return [...matched].sort((a, b) => b.at - a.at).slice(0, limit)
  }

  list(): DesignDecision[] {
    return [...this.#entries]
  }
}

const recallSchema: JsonSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', description: '要检索的设计决策关键词' },
  },
}

const saveSchema: JsonSchema = {
  type: 'object',
  properties: {
    topic: { type: 'string', description: '决策主题，例如「主色」' },
    content: { type: 'string', description: '决策内容' },
  },
  required: ['topic', 'content'],
}

export function apply(ctx: Context, config: Config = {}): void {
  const memory = new DesignMemoryService()
  for (const entry of config.seed ?? []) memory.save(entry.topic, entry.content)

  ctx.provide('designMemory', memory)

  const prompts = ctx.require<SystemPromptService>('systemPrompt')
  ctx.effect(() =>
    prompts.add({
      id: 'design-memory',
      order: 20,
      title: '设计记忆',
      render: () => {
        const entries = memory.recall(undefined, config.promptLimit ?? 5)
        if (entries.length === 0) return ''
        return entries.map((entry) => `- ${entry.topic}：${entry.content}`).join('\n')
      },
    }),
  )

  const tools = ctx.require<ToolRegistry>('tools')
  ctx.effect(() =>
    tools.register({
      name: 'memory.recall',
      description: '检索历史设计决策（配色、字体、布局规范）',
      parameters: recallSchema,
      execute: (args) => {
        const entries = memory.recall(args.query as string | undefined)
        if (entries.length === 0) return '没有匹配的设计决策。'
        return entries.map((entry) => `${entry.topic}: ${entry.content}`).join('\n')
      },
    }),
  )

  ctx.effect(() =>
    tools.register({
      name: 'memory.save',
      description: '记录一条新的设计决策，供后续会话复用',
      parameters: saveSchema,
      execute: (args) => {
        const entry = memory.save(String(args.topic), String(args.content))
        return `已记录设计决策 ${entry.id}：${entry.topic}`
      },
    }),
  )
}
