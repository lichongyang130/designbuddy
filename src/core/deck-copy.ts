/**
 * 逐页文案由模型写，版式仍由模板决定。
 *
 * 这是接模型后就该做的事，也是**唯一能让「像模板」消失**的一步：结构（哪一页用哪个版式、
 * 放几个块、多少字放得下）是工程问题，模板算得比模型准；但「这一页到底说什么」是内容问题，
 * 模板永远写不出来。所以分工是：
 *
 *   模板出骨架（`core/deck` 的 `slideFor`）→ 模型填文案 → 本文件把文案贴回骨架 → 容量校验。
 *
 * 校验不过就整页保留模板文案（`applyCopy` 返回原 slide），并在事件里标 `copySource: 'rules'`，
 * 界面上看得见「这一页是模板写的」。宁可标出来，也不要硬塞进去把版式撑破。
 *
 * @module designbuddy/core/deck-copy
 */

import type { JsonClient } from './llm-json.ts'
import { JsonCallError } from './llm-json.ts'
import type { DeckOutlineItem, DeckPlan, PageCopy } from './deck.ts'
import { errorMessage } from './tools.ts'

export { applyCopy } from './deck.ts'
export type { PageCopy } from './deck.ts'

export interface CopyAnswer {
  pages: Map<number, PageCopy>
  source: 'llm' | 'rules'
  model?: string
  calls: number
  ms: number
  reason?: string
}

export interface CopyOptions {
  /** 一次调用写几页，默认 5。 */
  batch?: number
  /** 单次调用的超时。 */
  timeoutMs?: number
  /**
   * 整步文案的总预算，默认 12s。超了就用手上已经拿到的部分，剩下的页走模板——
   * 用户宁可先看到页面出来，也不想对着空墙等模型。
   */
  budgetMs?: number
}

const MAX_TEXT = 60
const MAX_HEAD = 18

/** 只收能用的字段：长度、类型不对就当没给，绝不让它进渲染。 */
export function parsePages(raw: unknown, total: number): PageCopy[] {
  const body = raw as Record<string, unknown>
  const rows = Array.isArray(body) ? body : body?.pages
  if (!Array.isArray(rows)) throw new Error('缺少 pages 数组')
  const out: PageCopy[] = []
  for (const row of rows) {
    const item = row as Record<string, unknown>
    const n = Number(item?.n)
    if (!Number.isInteger(n) || n < 1 || n > total) continue
    const copy: PageCopy = { n }
    if (typeof item?.title === 'string' && item.title.trim() !== '') copy.title = item.title.trim().slice(0, 40)
    if (typeof item?.lead === 'string' && item.lead.trim() !== '') copy.lead = item.lead.trim().slice(0, 60)
    if (Array.isArray(item?.points)) {
      const points = item.points
        .map((point) => {
          if (typeof point === 'string') return { d: point.trim().slice(0, MAX_TEXT) }
          const obj = point as Record<string, unknown>

          const d = typeof obj?.d === 'string' ? obj.d.trim() : typeof obj?.text === 'string' ? obj.text.trim() : ''
          const h = typeof obj?.h === 'string' && obj.h.trim() !== '' ? obj.h.trim().slice(0, MAX_HEAD) : undefined
          if (d === '') return null
          return h ? { h, d: d.slice(0, MAX_TEXT) } : { d: d.slice(0, MAX_TEXT) }
        })
        .filter((point): point is { h?: string; d: string } => point !== null)
        .slice(0, 4)
      if (points.length > 0) copy.points = points
    }
    if (copy.title || copy.lead || copy.points) out.push(copy)
  }
  if (out.length === 0) throw new Error('没有一个可用的页面文案')
  return out
}

const SYSTEM = [
  '你是中文商业演示的文案，负责把大纲里的一页写成能直接上屏的文字。',
  '只输出 JSON，不要解释、不要 Markdown 围栏。',
  '规则：',
  '1. 每页返回 title（不超过 20 字）与 1–4 条 points（每条不超过 40 字，具体、可读、不堆形容词）；',
  '2. 不要编造数字、公司名、人名；需要数据的地方写「待补数据」；',
  '3. 同一份稿子里每页说的必须是不同的事，禁止套话重复；',
  '4. 版式是排版决定的，你只写内容：不要写「本页将介绍…」这类旁白。',
].join('\n')

function buildUserPrompt(plan: DeckPlan, batch: DeckOutlineItem[]): string {
  return [
    `主题：${plan.brief.topic}`,
    `用途：${plan.brief.purposeLabel}；受众：${plan.brief.audience}；语气：${plan.brief.style}`,
    `叙事：${plan.narrative}`,
    '',
    '这几页的骨架（n / 版式 / 这一页要解决的问题）：',
    JSON.stringify(
      batch.map((item) => ({ n: item.n, layout: item.layout, topic: item.topic, goal: item.goal })),
      null,
      2,
    ),
    '',
    '输出格式：',
    '{"pages":[{"n":1,"title":"…","lead":"一句话主张","points":[{"h":"小标题","d":"正文"}]}]}',
    `只写这 ${batch.length} 页，n 必须与上面一致。`,
  ].join('\n')
}

/** 分批要文案；某一批失败就只丢那一批，其它批照用。 */
export async function copyFor(
  client: JsonClient | null | undefined,
  plan: DeckPlan,
  options: CopyOptions = {},
): Promise<CopyAnswer> {
  const started = Date.now()
  const pages = new Map<number, PageCopy>()
  if (!client || !client.available('copy')) {
    return { pages, source: 'rules', calls: 0, ms: 0, reason: client ? '没有可用的模型' : '没有挂载模型' }
  }
  const batchSize = Math.max(1, Math.min(8, options.batch ?? 5))
  const items = plan.outline
  const budget = options.budgetMs ?? 12_000
  let calls = 0
  let model: string | undefined
  const reasons: string[] = []

  for (let index = 0; index < items.length; index += batchSize) {
    const remaining = budget - (Date.now() - started)
    if (remaining <= 0) {
      reasons.push('文案预算用完了，剩下的页走模板')
      break
    }
    const batch = items.slice(index, index + batchSize)
    try {
      const result = await client.run({
        kind: 'copy',
        system: SYSTEM,
        user: buildUserPrompt(plan, batch),
        maxTokens: 1200,
        temperature: 0.5,
        timeoutMs: Math.min(options.timeoutMs ?? remaining, remaining),
        parse: (raw) => parsePages(raw, plan.outline.length),
      })
      calls += result.calls
      model = result.model
      for (const page of result.value) pages.set(page.n, page)
    } catch (error) {
      reasons.push(error instanceof JsonCallError ? error.reason : errorMessage(error))
    }
  }

  if (pages.size === 0) {
    return { pages, source: 'rules', calls, ms: Date.now() - started, reason: reasons[0] ?? '模型没有返回可用文案' }
  }
  return { pages, source: 'llm', model, calls, ms: Date.now() - started, reason: reasons[0] }
}
