/**
 * 一次「要结构化结果」的模型调用：发消息 → 收流 → 抠出 JSON → 校验 → 不行就重试一次。
 *
 * 为什么单独一层：大纲、逐页文案、审核意见都要 JSON，而不同网关吐 JSON 的花样太多
 * （```json 围栏、前后带解释、多个对象、流式分片切开）。这些脏活只写一遍，
 * 上层只关心「给我一节 `sections` 数组」。
 *
 * 三条硬规则，和 `core/router` 的口径一致：
 *   1. **只有真适配器才算可用**：链上全是 `mock-*` 时直接报不可用，让上层回落规则模板，
 *      而不是把 mock 的演示文案当成模型写的；
 *   2. **超时一定中止**：`AbortSignal` 一路传到 fetch，慢网不该把界面挂死；
 *   3. **失败要带原因**：上层把这些原因原样显示成「规则模板 · Key 无效」，
 *      这样「降级」是看得见的，不是假装成功。
 *
 * @module designbuddy/core/llm-json
 */

import type { Message } from './llm.ts'
import { collectStream, textMessage } from './llm.ts'
import type { ModelRouter, RouteAttempt } from './router.ts'
import { errorMessage } from './tools.ts'

export interface JsonRequest<T> {
  /** 路由种类：planning / copy / review … 决定走哪条候选链。 */
  kind: string
  system: string
  user: string
  /** 把解析出来的对象变成有类型的值；不满足契约就抛错（会重试一次再放弃）。 */
  parse: (raw: unknown) => T
  model?: string
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  /** 首次失败后再试几次，默认 1。 */
  retries?: number
}

export interface JsonResult<T> {
  value: T
  model: string
  ms: number
  /** 真实发出的请求次数（含重试）。 */
  calls: number
  inputTokens: number
  outputTokens: number
}

export class JsonCallError extends Error {
  readonly reason: string
  constructor(reason: string) {
    super(reason)
    this.name = 'JsonCallError'
    this.reason = reason
  }
}

/**
 * 从一段自由文本里抠出第一个完整的 JSON 值。
 *
 * 模型常见的三种脏输出都在这里处理：```json 围栏、前后带一句解释、流式分片把括号切开。
 * 用括号配对扫描（跳过字符串里的括号和转义），而不是正则——正则在「文本里本身含 `}`」时必错。
 */
export function extractJson(text: string): string | null {
  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/)
  const body = (fence ? fence[1]! : text).trim()
  const start = body.search(/[[{]/)
  if (start < 0) return null
  const open = body[start]!
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < body.length; index += 1) {
    const char = body[index]!
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === open) depth += 1
    else if (char === close) {
      depth -= 1
      if (depth === 0) return body.slice(start, index + 1)
    }
  }
  return null
}

function timeoutLabel(ms: number): string {
  return ms >= 1000 ? `超时 ${Math.round(ms / 1000)}s` : `超时 ${ms}ms`
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 140)
}

/** 链上有没有真模型：mock 适配器只用来演示，不能算「接入了模型」。 */
export function hasLiveAdapter(router: ModelRouter, kind: string): boolean {
  return router.candidatesFor(kind).some((id) => !id.startsWith('mock'))
}

export interface JsonClientOptions {
  router: ModelRouter
  timeoutMs?: number
  /** 观察面：一次调用失败/成功都要能被界面看到。 */
  onAttempt?: (attempt: RouteAttempt) => void
}

export class JsonClient {
  #router: ModelRouter
  #timeoutMs: number
  #onAttempt?: (attempt: RouteAttempt) => void

  constructor(options: JsonClientOptions) {
    this.#router = options.router
    this.#timeoutMs = options.timeoutMs ?? 25_000
    this.#onAttempt = options.onAttempt
  }

  get router(): ModelRouter {
    return this.#router
  }

  available(kind = 'planning'): boolean {
    return hasLiveAdapter(this.#router, kind)
  }

  /** 最近一次失败的适配器摘要，用来在界面上写「为什么降级」。 */
  lastFailure(): string | undefined {
    const failed = [...this.#router.attempts].reverse().find((attempt) => !attempt.ok)
    if (!failed) return undefined
    return failed.error ? `${failed.adapter}: ${failed.error}` : failed.adapter
  }

  /** 这条链上能接结构化请求的适配器：mock 一律排除。 */
  liveChain(kind: string): string[] {
    return this.#router.candidatesFor(kind).filter((id) => !id.startsWith('mock'))
  }

  async run<T>(request: JsonRequest<T>): Promise<JsonResult<T>> {
    const retries = request.retries ?? 1
    const timeoutMs = request.timeoutMs ?? this.#timeoutMs
    const only = this.liveChain(request.kind)
    if (only.length === 0) throw new JsonCallError('还没有可用的模型（在设置 → 模型里添加并填好 Key）')
    // 只记「这一次调用」新增的路由尝试，别把历史失败当成这次的原因
    const mark = this.#router.attempts.length
    let calls = 0
    let lastReason = '未知错误'

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      calls += 1
      const messages: Message[] = [
        textMessage('system', attempt === 0 ? request.system : `${request.system}\n\n上一次的输出无法解析。只返回 JSON，不要任何解释、不要 Markdown 围栏。`),
        textMessage('user', request.user),
      ]
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const collected = await collectStream(
          this.#router.stream({
            kind: request.kind,
            model: request.model,
            only,
            messages,
            tools: [],
            temperature: request.temperature,
            maxTokens: request.maxTokens,
            signal: controller.signal,
          }),
        )
        const json = extractJson(collected.text)
        if (json === null) {
          lastReason = '模型没有返回 JSON'
          continue
        }
        let raw: unknown
        try {
          raw = JSON.parse(json)
        } catch (error) {
          lastReason = 'JSON 解析失败：' + errorMessage(error)
          continue
        }
        let value: T
        try {
          value = request.parse(raw)
        } catch (error) {
          lastReason = '不符合约定：' + errorMessage(error)
          continue
        }
        return {
          value,
          model: this.#lastModel() ?? request.model ?? 'unknown',
          ms: 0,
          calls,
          inputTokens: collected.usage?.inputTokens ?? 0,
          outputTokens: collected.usage?.outputTokens ?? 0,
        }
      } catch (error) {
        const aborted = controller.signal.aborted
        lastReason = aborted ? timeoutLabel(timeoutMs) : this.#reasonSince(mark, error)
      } finally {
        clearTimeout(timer)
      }
    }
    throw new JsonCallError(lastReason)
  }

  /** 这一次调用里最后一条真实失败（适配器 + 原始错误），比路由那句总结有用。 */
  #reasonSince(mark: number, fallback: unknown): string {
    const attempts = this.#router.attempts.slice(mark)
    for (let index = attempts.length - 1; index >= 0; index -= 1) {
      const attempt = attempts[index]!
      if (attempt.error) return clean(`${attempt.adapter}: ${attempt.error}`)
    }
    return clean(errorMessage(fallback))
  }

  #lastModel(): string | undefined {
    const attempts = this.#router.attempts
    const last = attempts[attempts.length - 1]
    if (!last || !last.ok) return undefined
    this.#onAttempt?.(last)
    return last.model
  }
}
