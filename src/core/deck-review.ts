/**
 * 主观审核：客观项（溢出、太薄、重复、页数、数字没出处）规则算得比模型准，
 * 这里只补规则看不见的两件事——**逻辑跳没跳**、**主张空不空**。
 *
 * 三条自我约束，避免「审核变成第二个生成器」：
 *   1. 只说问题，不给重写建议（免得和逐页文案打架）；
 *   2. 每条不超过一句、必须指到具体页；
 *   3. 模型编出来的事实一律不采信：消息里出现用户没给过的数字，就丢掉这条。
 *
 * @module designbuddy/core/deck-review
 */

import type { JsonClient } from './llm-json.ts'
import { JsonCallError } from './llm-json.ts'
import type { DeckIssue, DeckPlan, GeneratedDeck } from './deck.ts'
import { textOfSlide } from './deck.ts'
import { errorMessage } from './tools.ts'

export interface ReviewAnswer {
  issues: DeckIssue[]
  source: 'llm' | 'rules'
  model?: string
  ms: number
  inputTokens?: number
  outputTokens?: number
  reason?: string
}

const MAX_ISSUES = 3

const SYSTEM = [
  '你是演示文稿的审稿人，只挑真正影响说服力的问题。',
  '只输出 JSON，不要解释、不要 Markdown 围栏。',
  '规则：',
  '1. 最多 3 条，每条指到具体页（page 从 1 开始），message 不超过 40 字；',
  '2. 只报这三类问题：页与页之间逻辑跳跃、这一页的主张空泛（看了不知道要做什麼）、缺少证据/数据支撑；',
  '3. 不要提改写建议，不要评论排版与配色；',
  '4. 没问题就返回空数组——宁可少说，不要凑数。',
].join('\n')

/** 一句里出现的数字，用来核对模型有没有编数据。 */
function numbers(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?%?/g) ?? []
}

export function parseIssues(raw: unknown, pages: number, allowed: Set<string>): DeckIssue[] {
  const body = raw as Record<string, unknown>
  const rows = Array.isArray(body) ? body : body?.issues
  if (!Array.isArray(rows)) throw new Error('缺少 issues 数组')
  const out: DeckIssue[] = []
  for (const row of rows) {
    const item = row as Record<string, unknown>
    const page = Number(item?.page)
    if (!Number.isInteger(page) || page < 1 || page > pages) continue
    const message = typeof item?.message === 'string' ? item.message.trim() : ''
    if (message === '' || message.length > 60) continue
    // 数字必须在原文里出现过：模型不能凭空造「下降了 30%」这种问题
    const invented = numbers(message).filter((number) => !allowed.has(number))
    if (invented.length > 0) continue
    if (out.some((issue) => issue.page === page && issue.message === message)) continue
    out.push({ level: 'warn', page, code: 'thin', message, fixed: false })
    if (out.length >= MAX_ISSUES) break
  }
  return out
}

export interface ReviewOptions {
  timeoutMs?: number
}

export async function reviewWithLlm(
  plan: DeckPlan,
  deck: GeneratedDeck,
  client?: JsonClient | null,
  options: ReviewOptions = {},
): Promise<ReviewAnswer> {
  const started = Date.now()
  if (!client || !client.available('review')) {
    return { issues: [], source: 'rules', ms: 0, reason: client ? '没有可用的模型' : '没有挂载模型' }
  }

  const allowed = new Set(numbers(plan.brief.topic + plan.outline.map((item) => item.goal + item.topic).join(' ')))
  const pages = deck.slides.map((slide, index) => ({
    page: index + 1,
    layout: slide.k,
    text: textOfSlide(slide).slice(0, 80),
  }))

  try {
    const result = await client.run({
      kind: 'review',
      system: SYSTEM,
      user: [
        `主题：${plan.brief.topic}`,
        `用途：${plan.brief.purposeLabel}；受众：${plan.brief.audience}`,
        `叙事：${plan.narrative}`,
        '',
        '逐页内容：',
        JSON.stringify(pages, null, 2),
        '',
        '输出格式：{"issues":[{"page":3,"message":"…"}]}',
      ].join('\n'),
      maxTokens: 500,
      temperature: 0.2,
      timeoutMs: options.timeoutMs,
      parse: (raw) => parseIssues(raw, deck.slides.length, allowed),
    })
    return {
      issues: result.value,
      source: 'llm',
      model: result.model,
      ms: Date.now() - started,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    }
  } catch (error) {
    const reason = error instanceof JsonCallError ? error.reason : errorMessage(error)
    return { issues: [], source: 'rules', ms: Date.now() - started, reason }
  }
}
