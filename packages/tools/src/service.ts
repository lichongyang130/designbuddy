import type { Context } from '@designbuddy/core'
import type { ToolCall } from '@designbuddy/llm'
import type { Tool, ToolDescriptor, ToolGuard, ToolOutcome, ToolRunContext } from './types'

interface Registered {
  tool: Tool
  owner: string
}

/**
 * The tool registry and the only path a tool call may take.
 *
 * Guards are enforced here rather than in prompts: a tool that the policy
 * forbids cannot be executed even if the model asks for it directly.
 */
export class ToolsService {
  private tools = new Map<string, Registered>()
  private guards: Array<{ guard: ToolGuard; owner: string }> = []

  constructor(private readonly ctx: Context) {}

  register(tool: Tool): Tool {
    if (!tool.name || !/^[a-z][a-z0-9_.-]*$/i.test(tool.name)) {
      throw new Error(`invalid tool name: ${tool.name}`)
    }
    this.tools.set(tool.name, { tool, owner: this.owner() })
    this.ctx.set(`tool:${tool.name}`, tool)
    this.ctx.emit('tools/changed', this.list())
    return tool
  }

  use(guard: ToolGuard): void {
    this.guards.push({ guard, owner: this.owner() })
  }

  /** Called by the owning plugin's dispose hook. */
  unregister(name: string): void {
    this.tools.delete(name)
    this.ctx.emit('tools/changed', this.list())
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)?.tool
  }

  list(): ToolDescriptor[] {
    return [...this.tools.values()].map(({ tool }) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      parameters: tool.parameters,
      scope: tool.scope ?? 'read',
      owner: this.tools.get(tool.name)!.owner,
    }))
  }

  /** What the model is allowed to see. */
  schemas(): ToolDescriptor[] {
    return this.list().sort((a, b) => a.name.localeCompare(b.name))
  }

  async execute(call: ToolCall, run: ToolRunContext): Promise<ToolOutcome> {
    const started = Date.now()
    const entry = this.tools.get(call.name)
    const finish = (outcome: Omit<ToolOutcome, 'durationMs'>): ToolOutcome => {
      const full = { ...outcome, durationMs: Date.now() - started }
      this.ctx.emit('tool/after', { call, outcome: full })
      for (const { guard } of this.guards) {
        try {
          guard.after?.(call, full, run)
        } catch (error) {
          this.ctx.log('warn', `tool guard failed: ${(error as Error).message}`)
        }
      }
      return full
    }

    if (!entry) {
      return finish({ ok: false, output: '', error: `unknown tool "${call.name}"` })
    }

    const missing = requiredButMissing(entry.tool.parameters, call.arguments)
    if (missing.length) {
      return finish({ ok: false, output: '', error: `missing required argument(s): ${missing.join(', ')}` })
    }

    this.ctx.emit('tool/before', { call })

    for (const { guard } of this.guards) {
      try {
        const denial = await guard.before?.(call, run)
        if (denial) {
          return finish({ ok: false, output: '', error: `denied: ${denial}` })
        }
      } catch (error) {
        return finish({ ok: false, output: '', error: `guard error: ${(error as Error).message}` })
      }
    }

    try {
      const raw = await entry.tool.handler(call.arguments, run)
      if (typeof raw === 'string') return finish({ ok: true, output: raw })
      const { durationMs: _ignored, ...rest } = raw
      return finish(rest)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return finish({ ok: false, output: '', error: message })
    }
  }

  private owner(): string {
    return this.ctx.fork?.name ?? 'root'
  }
}

function requiredButMissing(parameters: Record<string, unknown>, args: Record<string, unknown>): string[] {
  const required = (parameters.required as string[] | undefined) ?? []
  return required.filter((key) => args[key] === undefined || args[key] === null)
}
