/**
 * `decks` 插件 —— 把 `core/deck` 的生成流程包成一个有状态的服务。
 *
 * 界面需要的不只是「一份结果」，而是「现在进行到哪一步、这一页为什么这么排」。
 * 所以这里对外暴露两样东西：
 *
 *   - `start()` / `revise()`：开一次生成，立刻返回 id，不阻塞 RPC；
 *   - `onEvent()`：订阅过程事件（阶段、思考摘要、逐页、审核、完成）。
 *
 * 生成的稿子留在内存里（最近 `historySize` 份），刷新页面后 `get()` 还能拿回来，
 * 不用把整份 deck 塞进会话日志。
 *
 * @module designbuddy/plugins/deck-engine
 */

import type { Context, Disposer } from '../kernel/index.ts'
import {
  analyze,
  plan,
  revise,
  stream,
} from '../core/deck.ts'
import type {
  DeckEvent,
  DeckPlan,
  DeckRequest,
  GeneratedDeck,
  RevisionResult,
} from '../core/deck.ts'
import type { CopyAnswer } from '../core/deck-copy.ts'
import { copyFor } from '../core/deck-copy.ts'
import { JsonClient } from '../core/llm-json.ts'
import { ModelRouter } from '../core/router.ts'

export const name = 'decks'

export interface DeckRecord {
  id: string
  request: DeckRequest
  plan: DeckPlan
  deck: GeneratedDeck | null
  events: DeckEvent[]
 /** `planned`：计划已经出来，等用户点「开始生成」。 */
  status: 'planned' | 'running' | 'done' | 'error' | 'cancelled'
  /** 逐页文案是谁写的：模型 / 规则模板（界面标出来，不假装）。 */
  copySource?: 'llm' | 'rules'
  copyModel?: string
  copyReason?: string
  error?: string
  startedAt: number
  finishedAt?: number
}

export interface DeckEngineOptions {
  historySize?: number
  /** 节流：每页之间的间隔，测试里传 0。 */
  paceMs?: number
  /** 逐页文案的来源（接上模型时由 `core/deck-copy` 提供）；不传就全走模板。 */
  copy?: (plan: DeckPlan) => Promise<CopyAnswer>
  /** 一次生成的文案溯源，界面用来说明「这页是谁写的」。 */
  onCopy?: (id: string, answer: CopyAnswer) => void
}

type Listener = (record: DeckRecord, event: DeckEvent) => void

export class DeckEngine {
  #records = new Map<string, DeckRecord>()
  #listeners = new Set<Listener>()
  #controllers = new Map<string, AbortController>()
  #historySize: number
  #paceMs?: number
  #copy?: (plan: DeckPlan) => Promise<CopyAnswer>
  #onCopy?: (id: string, answer: CopyAnswer) => void
  #seq = 0

  constructor(options: DeckEngineOptions = {}) {
    this.#historySize = options.historySize ?? 12
    this.#paceMs = options.paceMs
    this.#copy = options.copy
    this.#onCopy = options.onCopy
  }

  onEvent(listener: Listener): Disposer {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  get(id: string): DeckRecord | undefined {
    return this.#records.get(id)
  }

  list(): { id: string; name: string; status: DeckRecord['status']; pages: number }[] {
    return [...this.#records.values()].map((record) => ({
      id: record.id,
      name: record.deck?.name ?? record.plan.brief.topic,
      status: record.status,
      pages: record.deck?.slides.length ?? record.plan.outline.length,
    }))
  }

  /** 开一次生成。立刻返回 id，过程中用 `onEvent` 收事件。 */
  start(request: DeckRequest): { id: string; plan: DeckPlan } {
    const fromPlan = plan(request)
    this.#seq += 1
    const id = `deck-${Date.now().toString(36)}-${this.#seq}`
    const record: DeckRecord = {
      id,
      request,
      plan: fromPlan,
      deck: null,
      events: [],
      status: 'running',
      startedAt: Date.now(),
    }
    this.#records.set(id, record)
    this.#trim()
    const mode = request.mode ?? 'plan'
    // 规划 / 研究模式先只出计划，用户确认后再逐页生成；快速模式一口气跑完。
    record.status = mode === 'express' ? 'running' : 'planned'
    void this.#run(record, { ...request, paceMs: this.#paceMs ?? request.paceMs }, mode === 'express' ? 'full' : 'plan')
    return { id, plan: fromPlan }
  }

  /** 用户确认计划之后，从这里开始逐页生成。 */
  build(id: string): { id: string } {
    const record = this.#records.get(id)
    if (!record) throw new Error('找不到这份演示文稿：' + id)
    if (record.status === 'done' || record.status === 'running') return { id }
    record.status = 'running'
    void this.#run(record, { ...record.request, paceMs: this.#paceMs }, 'build')
    return { id }
  }

  /** 对话式局部修改：只动命中的页，其余保持原样。 */
  revise(id: string, instruction: string): RevisionResult & { id: string } {
    const record = this.#records.get(id)
    if (!record) throw new Error('找不到这份演示文稿：' + id)
    if (!record.deck) throw new Error('这份演示文稿还没生成完，先等它跑完')
    const result = revise(record.deck, record.plan, instruction)
    if (result.indexes.length === 0) return { ...result, id }
    record.deck = result.deck
    const event: DeckEvent = {
      type: 'deck/patch',
      instruction,
      indexes: result.indexes,
      summary: result.summary,
    }
    record.events.push(event)
    for (const listener of [...this.#listeners]) {
      try {
        listener(record, event)
      } catch {
        /* 订阅方自己的错误不影响引擎 */
      }
    }
    return { ...result, id }
  }

  cancel(id: string): boolean {
    const controller = this.#controllers.get(id)
    if (!controller) return false
    controller.abort()
    const record = this.#records.get(id)
    if (record && record.status === 'running') record.status = 'cancelled'
    return true
  }

  dispose(): void {
    for (const controller of this.#controllers.values()) controller.abort()
    this.#controllers.clear()
    this.#listeners.clear()
  }

  async #run(record: DeckRecord, request: DeckRequest, phase: 'full' | 'plan' | 'build' = 'full'): Promise<void> {
    const controller = new AbortController()
    this.#controllers.set(record.id, controller)
    const emit = (event: DeckEvent) => {
      record.events.push(event)
      if (event.type === 'deck/done') {
        record.deck = event.deck
        record.status = 'done'
        record.finishedAt = Date.now()
      }
      for (const listener of [...this.#listeners]) {
        try {
          listener(record, event)
        } catch {
          /* 一个客户端断开不该拖垮生成 */
        }
      }
    }
    let copy: CopyAnswer | null = null
    if (phase !== 'plan' && this.#copy) {
      // 先报一句再等：文案要几秒，界面不能在这几秒里一动不动。
      emit({ type: 'deck/thinking', agent: 'copy', text: '正在让模型写逐页文案，写完一页贴一页；没写到的先用模板顶住。' })
      try {
        copy = await this.#copy(record.plan)
      } catch (error) {
        copy = {
          pages: new Map(),
          source: 'rules',
          calls: 0,
          ms: 0,
          reason: error instanceof Error ? error.message : String(error),
        }
      }
      record.copySource = copy.source
      record.copyModel = copy.model
      record.copyReason = copy.reason
      this.#onCopy?.(record.id, copy)
      // 文案这一步要说出来：不然用户只看到「生成中」，不知道有的是模型写的、有的不是。
      const note =
        copy.source === 'llm'
          ? `逐页文案由 ${copy.model ?? '模型'} 写好了 ${copy.pages.size} 页${copy.reason ? `（有 ${copy.reason} 的一批走了模板）` : ''}。`
          : `逐页文案走规则模板${copy.reason ? `（${copy.reason}）` : ''}。`
      emit({ type: 'deck/thinking', agent: 'copy', text: note })
    }
    try {
      for await (const event of stream(request, {
        signal: controller.signal,
        phase,
        copy: copy?.pages,
        copySource: copy?.source,
      })) emit(event)
      if (record.status === 'running') {
        // 中途被 abort 时 stream 直接 return，补一条明确的状态而不是假装成功。
        record.status = controller.signal.aborted ? 'cancelled' : phase === 'plan' ? 'planned' : 'done'
        record.finishedAt = Date.now()
      }
    } catch (error) {
      record.status = 'error'
      record.error = error instanceof Error ? error.message : String(error)
      record.finishedAt = Date.now()
      emit({ type: 'deck/qa', issues: [{ level: 'error', page: 0, code: 'order', message: record.error, fixed: false }], score: 0, pass: 0 })
    } finally {
      this.#controllers.delete(record.id)
    }
  }

  /** 只留最近 N 份，别让一个长会话把内存撑爆。 */
  #trim(): void {
    while (this.#records.size > this.#historySize) {
      const oldest = [...this.#records.values()].sort((a, b) => a.startedAt - b.startedAt)[0]
      if (!oldest) return
      this.#records.delete(oldest.id)
    }
  }
}

export function apply(ctx: Context): Disposer {
  // 有模型就让它写文案，没有（或调用失败）就自动回落模板——copyFor 内部保证不抛。
  const router = ctx.has('llm') ? ctx.require<ModelRouter>('llm') : null
  const client = router ? new JsonClient({ router, timeoutMs: 25_000 }) : null
  const engine = new DeckEngine({
    copy: client ? (plan) => copyFor(client, plan) : undefined,
    onCopy: (id, answer) =>
      ctx.logger.info(
        `deck ${id}: 文案 ${answer.source}${answer.model ? ` / ${answer.model}` : ''}` +
          (answer.reason ? ` (${answer.reason})` : '') +
          ` · ${answer.calls} 次调用 · ${answer.ms}ms`,
      ),
  })
  ctx.provide('decks', engine)
  ctx.logger.info('decks: 演示文稿引擎已就绪（需求分析 → 策划 → 视觉 → 逐页 → 审核）')
  return () => engine.dispose()
}

/** 这些导出方便别处复用同一套判断，不用重复实现。 */
export { analyze }
