/**
 * 演示文稿的大纲也交给模型：**版式与角色还是规则定的，讲什么由模型定**。
 *
 * 分工和逐页文案一样：`core/deck` 的规则引擎知道「第 4 页该是个对比页、要解决什么疑问」，
 * 但不知道「这份季度复盘的第 4 页具体该说哪件事」。所以这里把规则算出来的
 * `{n, role, layout, topic, goal}` 当骨架递给模型，让它只改 `topic / goal / narrative`——
 * 角色、版式、页数一个都不许动，动了就整份退回规则（否则页面会跟版式对不上）。
 *
 * @module designbuddy/core/deck-plan-llm
 */

import type { JsonClient } from './llm-json.ts'
import { JsonCallError } from './llm-json.ts'
import type { DeckPlan, DeckRequest } from './deck.ts'
import { plan as rulesPlan } from './deck.ts'
import { errorMessage } from './tools.ts'

export interface PlanLlmAnswer {
  plan: DeckPlan
  source: 'llm' | 'rules'
  model?: string
  ms: number
  calls?: number
  inputTokens?: number
  outputTokens?: number
  /** 降级时为什么降级。 */
  reason?: string
}

const SYSTEM = [
  '你是中文商业演示的内容策划，负责把一页页的「讲什么」定准。',
  '只输出 JSON，不要解释、不要 Markdown 围栏。',
  '规则：',
  '1. pages 的条数与 n 必须与给定骨架完全一致，不许增删页；',
  '2. 每页只改 topic（不超过 18 字，说出这一页的主张）与 goal（不超过 40 字，说清要解决谁的什么疑问）；',
  '3. 不许编造数字、公司、人名；需要数据的地方写「待补数据」；',
  '4. 页与页之间是递进，不是把同一件事换个说法；',
  '5. narrative 用一句话点明整份材料的推进逻辑。',
].join('\n')

function buildPrompt(request: DeckRequest, base: DeckPlan): string {
  return [
    `主题：${base.brief.topic}`,
    `用途：${base.brief.purposeLabel}；受众：${base.brief.audience}；风格：${base.brief.style}`,
    `页数：${base.outline.length}（pages 必须正好这么多条）`,
    `原始需求：${request.prompt}`,
    '',
    '骨架（n / 角色 / 版式 / 现在的主题 / 这一页的职责）：',
    JSON.stringify(
      base.outline.map((item) => ({
        n: item.n,
        role: item.role,
        layout: item.layout,
        topic: item.topic,
        goal: item.goal,
      })),
      null,
      2,
    ),
    '',
    '输出格式：',
    '{"narrative":"一句话讲清推进逻辑","pages":[{"n":1,"topic":"…","goal":"…"}]}',
  ].join('\n')
}

interface ParsedPlan {
  narrative?: string
  pages: { n: number; topic: string; goal: string }[]
}

/** 契约：页数一致、n 齐全、字数上限。任何一条不满足都视为失败。 */
export function parsePlan(raw: unknown, expected: number): ParsedPlan {
  const body = raw as Record<string, unknown>
  const rows = Array.isArray(body) ? body : body?.pages
  if (!Array.isArray(rows)) throw new Error('缺少 pages 数组')
  if (rows.length !== expected) throw new Error(`页数应为 ${expected}，实际 ${rows.length}`)
  const seen = new Set<number>()
  const pages = rows.map((row) => {
    const item = row as Record<string, unknown>
    const n = Number(item?.n)
    if (!Number.isInteger(n) || n < 1 || n > expected) throw new Error(`第 ${String(item?.n)} 页编号越界`)
    if (seen.has(n)) throw new Error(`第 ${n} 页重复`)
    seen.add(n)
    const topic = typeof item?.topic === 'string' ? item.topic.trim() : ''
    const goal = typeof item?.goal === 'string' ? item.goal.trim() : ''
    if (topic === '' || topic.length > 24) throw new Error(`第 ${n} 页 topic 缺失或过长`)
    if (goal === '' || goal.length > 48) throw new Error(`第 ${n} 页 goal 缺失或过长`)
    return { n, topic, goal }
  })
  const narrative = typeof body?.narrative === 'string' && body.narrative.trim() !== '' ? body.narrative.trim().slice(0, 120) : undefined
  return { narrative, pages }
}

export interface PlanLlmOptions {
  timeoutMs?: number
}

export async function planWithLlm(
  request: DeckRequest,
  client?: JsonClient | null,
  options: PlanLlmOptions = {},
): Promise<PlanLlmAnswer> {
  const base = rulesPlan(request)
  const started = Date.now()
  if (!client || !client.available('planning')) {
    return { plan: base, source: 'rules', ms: 0, reason: client ? '没有可用的模型（还没配 Key 或地址）' : '没有挂载模型' }
  }

  try {
    const result = await client.run({
      kind: 'planning',
      system: SYSTEM,
      user: buildPrompt(request, base),
      maxTokens: 1600,
      temperature: 0.5,
      timeoutMs: options.timeoutMs,
      parse: (raw) => parsePlan(raw, base.outline.length),
    })
    const byNumber = new Map(result.value.pages.map((page) => [page.n, page]))
    const outline = base.outline.map((item) => {
      const page = byNumber.get(item.n)
      // 角色、版式、为什么这么排都由规则保留：模型只拿到「讲什么」这一票。
      return page ? { ...item, topic: page.topic, goal: page.goal } : item
    })
    return {
      plan: { ...base, outline, narrative: result.value.narrative ?? base.narrative },
      source: 'llm',
      model: result.model,
      ms: Date.now() - started,
      calls: result.calls,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    }
  } catch (error) {
    const reason = error instanceof JsonCallError ? error.reason : errorMessage(error)
    return { plan: base, source: 'rules', ms: Date.now() - started, reason }
  }
}
