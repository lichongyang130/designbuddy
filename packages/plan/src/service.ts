import type { Context } from '@designbuddy/core'

export type PlanStatus = 'todo' | 'doing' | 'done'

export interface PlanItem {
  id: string
  text: string
  status: PlanStatus
}

/**
 * The runtime's shared todo list, scoped to one session.
 *
 * A plan is not a chat message: it is live state the planner and the executor
 * both read. It is also the cheapest way to keep a long task honest, because
 * every step the model takes is checked against the visible plan.
 */
export class PlanService {
  private plans = new Map<string, PlanItem[]>()

  constructor(private readonly ctx: Context) {}

  get(sessionId: string): PlanItem[] {
    return this.plans.get(sessionId) ?? []
  }

  replace(sessionId: string, items: Array<string | { text: string; status?: PlanStatus }>): PlanItem[] {
    const plan = items.map((item, index) => {
      const raw = typeof item === 'string' ? { text: item } : item
      return {
        id: `p${index + 1}`,
        text: raw.text,
        status: (raw.status ?? 'todo') as PlanStatus,
      }
    })
    this.plans.set(sessionId, plan)
    this.changed(sessionId, plan)
    return plan
  }

  update(sessionId: string, id: string, status: PlanStatus): PlanItem[] {
    const plan = this.get(sessionId)
    const item = plan.find((entry) => entry.id === id)
    if (!item) throw new Error(`no plan item "${id}"`)
    item.status = status
    this.changed(sessionId, plan)
    return plan
  }

  progress(sessionId: string): { done: number; total: number } {
    const plan = this.get(sessionId)
    return { done: plan.filter((item) => item.status === 'done').length, total: plan.length }
  }

  render(sessionId: string): string {
    const plan = this.get(sessionId)
    if (!plan.length) return ''
    return plan
      .map((item) => {
        const mark = item.status === 'done' ? '[x]' : item.status === 'doing' ? '[~]' : '[ ]'
        return `${mark} ${item.id} ${item.text}`
      })
      .join('\n')
  }

  private changed(sessionId: string, plan: PlanItem[]): void {
    this.ctx.emit('plan/changed', { sessionId, plan })
  }
}
