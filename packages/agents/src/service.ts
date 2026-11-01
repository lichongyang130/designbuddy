import type { Context } from '@designbuddy/core'
import type { Expert } from './types'

/**
 * The expert registry exposed as `ctx.get('agents')`.
 *
 * Experts are data, not code paths: the loop reads the allowlist and the
 * instructions and nothing else. That keeps "multi-agent" honest — the
 * difference between experts is scope and prompt, not a second runtime.
 */
export class AgentService {
  private experts = new Map<string, Expert>()

  constructor(private readonly ctx: Context) {}

  register(expert: Expert): Expert {
    if (!expert.name || !/^[a-z][a-z0-9-]*$/.test(expert.name)) {
      throw new Error(`invalid expert name: ${expert.name}`)
    }
    this.experts.set(expert.name, expert)
    this.ctx.set(`agent:${expert.name}`, expert)
    this.ctx.emit('agents/changed', this.list())
    return expert
  }

  unregister(name: string): void {
    this.experts.delete(name)
    this.ctx.emit('agents/changed', this.list())
  }

  list(): Expert[] {
    return [...this.experts.values()]
  }

  get(name: string): Expert | undefined {
    return this.experts.get(name)
  }

  /** Falls back to the first registered expert so a fresh app still runs. */
  resolve(name?: string): Expert {
    const expert = (name && this.experts.get(name)) || this.experts.values().next().value
    if (!expert) throw new Error('no expert agents registered — load a preset plugin')
    return expert
  }
}
