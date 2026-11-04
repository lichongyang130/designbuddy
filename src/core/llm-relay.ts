/**
 * 浏览器中转：当**服务端出不了网**（沙箱、只放行白名单的内网、某些云函数）时，
 * 让用户自己的浏览器替服务端发这一次 HTTP 请求。
 *
 * 为什么值得这么做：
 *   - 预览跑在别人的容器里，出口只放行少数域名，`api.deepseek.com` 这类地址直接不通；
 *   - 但**用户的浏览器**是通的。它已经连着这条 SSE 通道，顺手就能当一次性的出口。
 *
 * 安全上的取舍（明确写下来，别靠猜）：
 *   - Key 只存在浏览器（`localStorage`），服务端这一侧拿不到，也**不要**让它经过这里；
 *     服务端发出去的 `llm/fetch` 帧里只有地址、方法、非敏感头与请求体；
 *   - 浏览器收到后自己补 `authorization`，再把结果回传；
 *   - 所以这条路是「用你的浏览器当一根网线」，不是「把 Key 存在服务器上」。
 *
 * 代价也要说清：中转是**整段回传**而不是逐字流，长文生成时界面上会一次性到齐。
 *
 * @module designbuddy/core/llm-relay
 */

import type { HostFrame } from '../sdk/protocol.ts'

export interface RelaySink {
  send(frame: HostFrame): void
}

export interface RelayAskFrame {
  type: 'llm/fetch'
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

export interface RelayReplyInput {
  id: string
  status?: number
  body?: string
  headers?: Record<string, string>
  /** 浏览器侧 fetch 直接抛错时（多半是 CORS）把原因带回来。 */
  error?: string
}

interface Pending {
  resolve: (reply: RelayReplyInput) => void
  timer: ReturnType<typeof setTimeout>
}

export interface RelayStats {
  online: boolean
  calls: number
  failures: number
  lastError: string
}

/** 浏览器中转的可读超时：整段回传，别按首字节算。 */
const DEFAULT_TIMEOUT_MS = 120_000

export class BrowserRelay {
  #sinks = new Set<RelaySink>()
  #pending = new Map<string, Pending>()
  #timeoutMs: number
  #seq = 0
  #calls = 0
  #failures = 0
  #lastError = ''

  constructor(options: { timeoutMs?: number } = {}) {
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  /** 每开一条连接就登记一次；连接关掉要撤，否则请求会发到已经断开的页面。 */
  attach(sink: RelaySink): () => void {
    this.#sinks.add(sink)
    return () => {
      this.#sinks.delete(sink)
    }
  }

  get online(): boolean {
    return this.#sinks.size > 0
  }

  stats(): RelayStats {
    return { online: this.online, calls: this.#calls, failures: this.#failures, lastError: this.#lastError }
  }

  /** `fetch` 的同形实现：签名对齐，好直接塞进 `OpenAiAdapter({ fetchImpl })`。 */
  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    if (!this.online) {
      this.#fail('没有在线的浏览器可以中转（页面没开着）')
      throw new Error('浏览器中转不可用：没有页面连着，先把预览页开着再生成。')
    }
    const id = `relay-${Date.now().toString(36)}-${(++this.#seq).toString(36)}`
    const headers: Record<string, string> = {}
    const raw = (init.headers ?? {}) as Record<string, string>
    for (const [key, value] of Object.entries(raw)) {
      // 只转发协议必需的头；authorization 由浏览器自己补，服务端不碰 Key。
      if (key.toLowerCase() === 'authorization') continue
      headers[key.toLowerCase()] = String(value)
    }
    const frame: RelayAskFrame = {
      type: 'llm/fetch',
      id,
      url,
      method: (init.method ?? 'GET').toUpperCase(),
      headers,
      body: typeof init.body === 'string' ? init.body : undefined,
    }

    const reply = await new Promise<RelayReplyInput>((resolve) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id)
        resolve({ id, error: `浏览器 ${Math.round(this.#timeoutMs / 1000)} 秒内没有回话（生成太久或页面被切走了）` })
      }, this.#timeoutMs)
      this.#pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value) }, timer })
      this.#calls += 1
      for (const sink of this.#sinks) {
        try {
          sink.send(frame as unknown as HostFrame)
        } catch {
          /* 单条连接写失败不影响其他页面 */
        }
      }
      // 用户点了停止：别等满 120 秒
      const signal = init.signal
      if (signal) {
        const abort = () => {
          const pending = this.#pending.get(id)
          if (!pending) return
          clearTimeout(pending.timer)
          this.#pending.delete(id)
          pending.resolve({ id, error: '已取消' })
        }
        if (signal.aborted) abort()
        else signal.addEventListener('abort', abort, { once: true })
      }
    })

    if (reply.error) {
      this.#fail(reply.error)
      throw new Error(`浏览器中转失败：${reply.error}`)
    }
    const status = Number(reply.status ?? 0)
    if (!Number.isInteger(status) || status < 200 || status > 599) {
      this.#fail('浏览器没有拿到响应')
      throw new Error(`浏览器中转失败：请求没有拿到响应（status ${reply.status ?? '空'}）`)
    }
    return new Response(reply.body ?? '', {
      status,
      headers: { 'content-type': reply.headers?.['content-type'] ?? 'text/event-stream; charset=utf-8' },
    })
  }

  /** 浏览器回话：返回 false 表示这条请求已经超时或不存在，别静默丢掉。 */
  reply(input: RelayReplyInput): boolean {
    const pending = this.#pending.get(String(input?.id ?? ''))
    if (!pending) return false
    this.#pending.delete(input.id)
    clearTimeout(pending.timer)
    pending.resolve(input)
    return true
  }

  dispose(): void {
    for (const [, pending] of this.#pending) {
      clearTimeout(pending.timer)
      pending.resolve({ id: '', error: '服务已关闭' })
    }
    this.#pending.clear()
    this.#sinks.clear()
  }

  #fail(reason: string): void {
    this.#failures += 1
    this.#lastError = reason
  }
}
