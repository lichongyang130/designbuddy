import type { Context } from '@designbuddy/core'

export interface PromptInput {
  sessionId: string
  /** The user's new message for this turn, if any. Lets sections retrieve
   *  what is relevant instead of dumping everything they know. */
  input?: string
  /** Expert that owns this turn. Shape is owned by @designbuddy/agents. */
  agent: string
  expert?: { title?: string; instructions?: string; skills?: string[] }
}

export interface PromptSection {
  id: string
  order: number
  /** Rendered verbatim; return '' to contribute nothing this turn. */
  render(input: PromptInput): string | Promise<string>
}

/**
 * The prompt is assembled, never hardcoded.
 *
 * Each capability contributes a section at a declared order, so loading the
 * memory plugin makes the model aware of memory and unloading it removes both
 * the text and the token cost — no branching in the agent loop.
 */
export class SystemPromptService {
  private sections: PromptSection[] = []

  constructor(private readonly ctx: Context) {}

  add(section: PromptSection): () => void {
    this.sections.push(section)
    this.sections.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    this.ctx.emit('systemPrompt/changed', this.ids())
    return () => {
      this.sections = this.sections.filter((item) => item !== section)
      this.ctx.emit('systemPrompt/changed', this.ids())
    }
  }

  ids(): string[] {
    return this.sections.map((section) => section.id)
  }

  async assemble(input: PromptInput): Promise<string> {
    const parts: string[] = []
    for (const section of this.sections) {
      try {
        const text = await section.render(input)
        if (text && text.trim()) parts.push(text.trim())
      } catch (error) {
        this.ctx.log('warn', `prompt section "${section.id}" failed: ${(error as Error).message}`)
      }
    }
    return parts.join('\n\n')
  }
}
