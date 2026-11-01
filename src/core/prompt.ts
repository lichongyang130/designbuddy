/**
 * System-prompt assembly.
 *
 * Mirrors DSH's `core/system-prompt`: no single giant string, but ordered
 * sections that plugins contribute. A plugin that unloads takes its section with
 * it, so the prompt always describes what is actually mounted.
 *
 * This is the cheapest place to see the difference between a plugin system and a
 * config file: `design-memory` adds design tokens to the prompt only while it is
 * loaded, and nothing else has to know about it.
 *
 * @module designbuddy/core/prompt
 */

import type { Context, Disposer } from '../kernel/index.ts'

export interface PromptSection {
  id: string
  /** Lower sorts first. Defaults to 100. */
  order?: number
  title?: string
  render(ctx: Context): string | Promise<string>
}

interface Entry {
  section: PromptSection
  order: number
}

export class SystemPromptService {
  #sections = new Map<string, Entry>()

  add(section: PromptSection): Disposer {
    if (this.#sections.has(section.id)) {
      throw new Error(`prompt section "${section.id}" is already registered`)
    }
    this.#sections.set(section.id, { section, order: section.order ?? 100 })
    return () => {
      const current = this.#sections.get(section.id)
      if (current?.section === section) this.#sections.delete(section.id)
    }
  }

  list(): PromptSection[] {
    return [...this.#sections.values()]
      .sort((a, b) => a.order - b.order || a.section.id.localeCompare(b.section.id))
      .map((entry) => entry.section)
  }

  /**
   * Render all sections. `extra` is the preset's own instructions, appended last
   * so the agent's persona wins on conflicts.
   */
  async build(ctx: Context, extra?: string): Promise<string> {
    const blocks: string[] = []
    for (const section of this.list()) {
      const rendered = (await section.render(ctx)).trim()
      if (rendered === '') continue
      blocks.push(section.title ? `## ${section.title}\n${rendered}` : rendered)
    }
    if (extra && extra.trim() !== '') blocks.push(`## 角色要求\n${extra.trim()}`)
    return blocks.join('\n\n')
  }
}
