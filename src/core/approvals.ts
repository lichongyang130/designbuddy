/**
 * 写操作审批：让「会改动远端数据」的工具在执行前停下来问一句。
 *
 * 形状是一个很窄的中介：工具守卫（`ToolGuard`）在这里 `request()` 并等一个答案，
 * 客户端拿到 `onRequest` 抛出的请求后，用 `respond()` 回一个「允许/拒绝」。
 * 中间没有 DOM、没有网络、没有事件循环之外的状态，所以三条路径都能直接测：
 *
 *   允许 → resolve({approved:true})，守卫放行
 *   拒绝 → resolve({approved:false, reason})，守卫返回 reason，工具不执行
 *   没人应答 → 到点自动拒绝（**默认拒绝**，不是默认放行）
 *
 * 一条硬规则：没有监听者（比如终端客户端、批处理）时立即拒绝，绝不默默放行。
 *
 * @module designbuddy/core/approvals
 */

import type { Disposer } from '../kernel/index.ts'

export interface ApprovalRequest {
  id: string
  sessionId: string
  /** 工具名，例如 `feishu.send_message`。 */
  tool: string
  /** 一行动作摘要，直接给人看。 */
  title: string
  /** 具体会改什么，越具体越好。 */
  detail: string
  args: Record<string, unknown>
  at: number
  expiresAt: number
}

export interface ApprovalAnswer {
  approved: boolean
  reason?: string
}

export interface ApprovalInput {
  sessionId: string
  tool: string
  title: string
  detail: string
  args?: Record<string, unknown>
  signal?: AbortSignal
}

export interface ApprovalBrokerOptions {
  /** 等多久算放弃。默认 90 秒——够人看一眼，又不至于把界面挂死。 */
  timeoutMs?: number
  now?: () => number
  /** 请求 id 的前缀，测试里可读性更好。 */
  idPrefix?: string
}

interface Pending {
  request: ApprovalRequest
  resolve: (answer: ApprovalAnswer) => void
  timer: ReturnType<typeof setTimeout>
  onAbort?: () => void
}

const DEFAULT_TIMEOUT_MS = 90_000

export class ApprovalBroker {
  #pending = new Map<string, Pending>()
  #listeners = new Set<(request: ApprovalRequest) => void>()
  #timeoutMs: number
  #now: () => number
  #seq = 0
  #prefix: string

  constructor(options: ApprovalBrokerOptions = {}) {
    this.#timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    this.#now = options.now ?? (() => Date.now())
    this.#prefix = options.idPrefix ?? 'ap'
  }

  get timeoutMs(): number {
    return this.#timeoutMs
  }

  /** 还没被回答的请求，按时间顺序。 */
  pending(): ApprovalRequest[] {
    return [...this.#pending.values()].map((entry) => entry.request)
  }

  /** 客户端订阅请求；没有订阅者时 `request()` 直接拒绝。 */
  onRequest(listener: (request: ApprovalRequest) => void): Disposer {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  async request(input: ApprovalInput): Promise<ApprovalAnswer> {
    if (this.#listeners.size === 0) {
      // 没有审批通道 = 没人能同意 = 拒绝。悄悄放行才是真的危险。
      return { approved: false, reason: '当前客户端不支持写操作确认，已拒绝执行' }
    }
    if (input.signal?.aborted) return { approved: false, reason: '这次运行已被取消，写操作没有执行' }

    this.#seq += 1
    const at = this.#now()
    const request: ApprovalRequest = {
      id: `${this.#prefix}-${this.#seq}`,
      sessionId: input.sessionId,
      tool: input.tool,
      title: input.title,
      detail: input.detail,
      args: input.args ?? {},
      at,
      expiresAt: at + this.#timeoutMs,
    }

    return new Promise<ApprovalAnswer>((resolve) => {
      const settle = (answer: ApprovalAnswer) => {
        const entry = this.#pending.get(request.id)
        if (!entry) return
        clearTimeout(entry.timer)
        if (entry.onAbort && input.signal) input.signal.removeEventListener('abort', entry.onAbort)
        this.#pending.delete(request.id)
        resolve(answer)
      }

      const timer = setTimeout(() => {
        settle({
          approved: false,
          reason: `等了 ${Math.round(this.#timeoutMs / 1000)} 秒没等到确认，已拒绝这次写操作`,
        })
      }, this.#timeoutMs)
      timer.unref?.()

      const entry: Pending = { request, resolve: settle, timer }
      if (input.signal) {
        entry.onAbort = () => settle({ approved: false, reason: '这次运行已被取消，写操作没有执行' })
        input.signal.addEventListener('abort', entry.onAbort, { once: true })
      }
      this.#pending.set(request.id, entry)

      for (const listener of [...this.#listeners]) {
        try {
          listener(request)
        } catch {
          /* 客户端自己的错误不该拖垮工具，超时兜底 */
        }
      }
    })
  }

  /** 客户端回答。返回 false 表示这个请求已经不在了（超时或重复点击）。 */
  respond(id: string, approved: boolean, reason?: string): boolean {
    const entry = this.#pending.get(id)
    if (!entry) return false
    entry.resolve(
      approved
        ? { approved: true }
        : { approved: false, reason: reason ?? '你拒绝了这次写操作' },
    )
    return true
  }

  /** 会话结束时把挂着的请求都收掉，别让旧卡片一直等人点。 */
  cancelSession(sessionId: string, reason = '会话已结束，写操作没有执行'): void {
    for (const entry of [...this.#pending.values()]) {
      if (entry.request.sessionId === sessionId) entry.resolve({ approved: false, reason })
    }
  }

  dispose(): void {
    for (const entry of [...this.#pending.values()]) {
      entry.resolve({ approved: false, reason: '审批通道已关闭，写操作没有执行' })
    }
    this.#listeners.clear()
  }
}
