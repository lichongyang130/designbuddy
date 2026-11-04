/**
 * 大纲优先走模型，失败就回落规则模板 —— 但**回落这件事要写在返回里**。
 *
 * 提示词的取法很关键：我们不把「写什么」整段交给模型自由发挥，而是先把规则引擎算出来的
 * 骨架塞进 prompt，让模型做「具体化」——把「做法与取舍」换成用户这个主题下真正的做法，
 * 把「三个能观察到的现象」换成真实的观察。这样三件事同时成立：
 *
 *   - 结构不会跑偏（段数、每段要点条数由契约卡死）；
 *   - 内容确实比模板具体（这是接模型唯一值得的收益）；
 *   - 断网 / Key 错时行为一致（同一份骨架照样能用）。
 *
 * @module designbuddy/core/outline-llm
 */

import type { JsonClient } from './llm-json.ts'
import { JsonCallError } from './llm-json.ts'
import type { Outline, OutlinePoint, OutlineRequest, OutlineSection } from './outline.ts'
import { outlineFor, withSections } from './outline.ts'
import { errorMessage } from './tools.ts'

export type OutlineSource = 'llm' | 'rules'

export interface OutlineAnswer {
  outline: Outline
  source: OutlineSource
  model?: string
  ms: number
  /** 降级时为什么降级，界面照实显示。 */
  reason?: string
  calls?: number
  inputTokens?: number
  outputTokens?: number
}

const TAGS = new Set(['建议', '待补数据', '需确认'])

function textOfPoint(raw: unknown): OutlinePoint {
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (text === '') throw new Error('要点不能为空')
    return { text: text.slice(0, 90) }
  }
  if (!raw || typeof raw !== 'object') throw new Error('要点必须是字符串或对象')
  const item = raw as Record<string, unknown>
  const text = typeof item.text === 'string' ? item.text.trim() : ''
  if (text === '') throw new Error('要点的 text 不能为空')
  const tag = typeof item.tag === 'string' && TAGS.has(item.tag) ? (item.tag as OutlinePoint['tag']) : undefined
  return tag ? { text: text.slice(0, 90), tag } : { text: text.slice(0, 90) }
}

/**
 * 校验并归一化模型给的 sections。
 * 任何一条不满足就抛错——调用方会重试一次，再不行才回落，绝不「半个大纲」。
 */
export function parseSections(raw: unknown, expected: number): { title?: string; sections: OutlineSection[] } {
  const body = raw as Record<string, unknown>
  const rows = Array.isArray(body) ? body : body?.sections
  if (!Array.isArray(rows)) throw new Error('缺少 sections 数组')
  if (rows.length !== expected) throw new Error(`段数应为 ${expected}，实际 ${rows.length}`)
  const sections: OutlineSection[] = rows.map((row, index) => {
    const item = row as Record<string, unknown>
    const title = typeof item?.title === 'string' ? item.title.trim() : ''
    if (title === '' || title.length > 40) throw new Error(`第 ${index + 1} 段标题缺失或过长`)
    const pointsRaw = Array.isArray(item?.points) ? item.points : []
    if (pointsRaw.length < 1 || pointsRaw.length > 4) throw new Error(`第 ${index + 1} 段要点应为 1–4 条`)
    return { n: index + 1, title, points: pointsRaw.map(textOfPoint) }
  })
  const title = typeof body?.title === 'string' && body.title.trim() !== '' ? body.title.trim().slice(0, 28) : undefined
  return { title, sections }
}

const SYSTEM = [
  '你是资深内容架构师，负责给中文商业文档 / 轮播图 / 图片组定结构。',
  '只输出 JSON，不要解释、不要 Markdown 围栏。',
  '规则：',
  '1. 段数必须等于用户要求的数量，不多不少；',
  '2. 每段 1–4 条要点，每条一句话、不超过 40 字，具体到能直接照着写，禁止空话；',
  '3. 不许编造数字和来源；需要数据但不确定的地方，给要点加 tag: "待补数据"；',
  '4. tag 只能是 "建议" / "待补数据" / "需确认" 三个值之一，可以省略；',
  '5. 标题要说出这一段的主张，不要用「背景」「概述」这类空标题。',
].join('\n')

function buildUserPrompt(request: OutlineRequest, base: Outline): string {
  const skeleton = base.sections.map((section) => ({
    n: section.n,
    title: section.title,
    points: section.points.map((point) => point.text),
  }))
  return [
    `需求：${request.prompt}`,
    `产出类型：${base.kindLabel}（单位「${base.unit}」）`,
    `受众：${base.audience}`,
    `数量：${base.count} ${base.unit}（sections 必须是 ${base.count} 段）`,
    `结构口径：${base.shape}`,
    '',
    '下面这套骨架是规则引擎给的，结构别动，把每一段换成针对这个需求真正该讲的内容：',
    JSON.stringify({ title: base.title, sections: skeleton }, null, 2),
    '',
    '输出格式：',
    '{"title":"…","sections":[{"title":"…","points":[{"text":"…","tag":"建议"}]}]}',
    `title 不超过 28 字，整个 JSON 不超过 1800 token。`,
  ].join('\n')
}

export interface OutlineLlmOptions {
  client?: JsonClient | null
  /** 超时时间，默认 25s。 */
  timeoutMs?: number
  /** 缓存命中时用，省一次调用；键由调用方算。 */
  cache?: Map<string, string>
  cacheKey?: string
}

export async function outlineWithLlm(request: OutlineRequest, options: OutlineLlmOptions = {}): Promise<OutlineAnswer> {
  const base = outlineFor(request)
  const started = Date.now()
  const client = options.client
  if (!client || !client.available('planning')) {
    return { outline: base, source: 'rules', ms: 0, reason: client ? '没有可用的模型（还没配 Key 或地址）' : '没有挂载模型' }
  }

  const cache = options.cache
  const cached = cache && options.cacheKey ? cache.get(options.cacheKey) : undefined
  if (cached) {
    try {
      const parsed = parseSections(JSON.parse(cached), base.count)
      return { outline: withSections(base, parsed.sections, parsed.title), source: 'llm', model: 'cache', ms: 0, calls: 0 }
    } catch {
      /* 缓存坏了就当没命中 */
    }
  }

  try {
    const result = await client.run({
      kind: 'planning',
      system: SYSTEM,
      user: buildUserPrompt(request, base),
      maxTokens: 1800,
      temperature: 0.4,
      timeoutMs: options.timeoutMs,
      parse: (raw) => parseSections(raw, base.count),
    })
    if (cache && options.cacheKey) cache.set(options.cacheKey, JSON.stringify(result.value))
    return {
      outline: withSections(base, result.value.sections, result.value.title),
      source: 'llm',
      model: result.model,
      ms: Date.now() - started,
      calls: result.calls,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    }
  } catch (error) {
    const reason = error instanceof JsonCallError ? error.reason : errorMessage(error)
    return { outline: base, source: 'rules', ms: Date.now() - started, reason }
  }
}
