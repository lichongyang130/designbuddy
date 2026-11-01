import type { Context } from '@designbuddy/core'
import type { ToolCall } from '@designbuddy/llm'
import type { ToolGuard, ToolScope, ToolsService } from '@designbuddy/tools'

export type PolicyMode = 'auto' | 'approve-writes' | 'readonly'

export type ApprovalStatus = 'pending' | 'allowed' | 'denied' | 'timeout' | 'aborted'

export interface ApprovalRequest {
  id: string
  tool: string
  scope: ToolScope
  args: Record<string, unknown>
  sessionId: string
  agent: string
  createdAt: number
  status: ApprovalStatus
  resolvedAt: number | null
}

interface PendingEntry {
  request: ApprovalRequest
  resolve: (allowed: boolean, status: ApprovalStatus) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * The policy layer: the one place that decides whether a side effect may run.
 *
 * It is a plugin, not a prompt instruction and not a check inside the tool.
 * The guard sits in the executor's `before` hook, so a model that ignores every
 * sentence of its system prompt still cannot write without passing through here.
 */
export class PolicyService {
  private pending = new Map<string, PendingEntry>()
  private history: ApprovalRequest[] = []

  constructor(
    private readonly ctx: Context,
    private readonly tools: ToolsService,
    public mode: PolicyMode,
    private readonly timeoutMs: number,
    /** Tool name patterns that never need approval (session-local writes). */
    private allow: string[] = ['plan.*'],
  ) {}

  setAllow(patterns: string[]): void {
    this.allow = patterns
    this.ctx.emit('policy/changed', { mode: this.mode, allow: this.allow })
  }

  allowedByList(tool: string): boolean {
    return this.allow.some((pattern) =>
      pattern.endsWith('*') ? tool.startsWith(pattern.slice(0, -1)) : tool === pattern,
    )
  }

  setMode(mode: PolicyMode): void {
    this.mode = mode
    for (const entry of [...this.pending.values()]) {
      this.resolve(entry.request.id, false, 'denied')
    }
    this.ctx.emit('policy/changed', { mode: this.mode, allow: this.allow })
  }

  get allowList(): string[] {
    return [...this.allow]
  }

  /** Pending first, then the most recent resolved requests. */
  list(): ApprovalRequest[] {
    return [...[...this.pending.values()].map((entry) => entry.request), ...[...this.history].reverse()]
  }

  pendingRequests(): ApprovalRequest[] {
    return [...this.pending.values()].map((entry) => entry.request)
  }

  decide(id: string, allow: boolean): boolean {
    return this.resolve(id, allow, allow ? 'allowed' : 'denied')
  }

  /** Installed by the plugin into the tool executor. */
  guard(): ToolGuard {
    return {
      before: async (call: ToolCall, run) => {
        const scope = this.tools.get(call.name)?.scope ?? 'read'
        if (this.mode === 'auto' || scope === 'read' || this.allowedByList(call.name)) return undefined
        if (this.mode === 'readonly') {
          return `当前是只读模式，${call.name} 属于 ${scope} 操作`
        }
        const allowed = await this.request(call, run.sessionId, run.agent, scope, run.signal)
        if (!allowed) return `用户没有批准 ${call.name}`
        return undefined
      },
    }
  }

  private request(
    call: ToolCall,
    sessionId: string,
    agent: string,
    scope: ToolScope,
    signal?: AbortSignal,
  ): Promise<boolean> {
    const request: ApprovalRequest = {
      id: `ap_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      tool: call.name,
      scope,
      args: call.arguments,
      sessionId,
      agent,
      createdAt: Date.now(),
      status: 'pending',
      resolvedAt: null,
    }

    this.ctx.emit('approval/request', request)
    this.ctx.log('warn', `${agent} 请求执行 ${call.name}（${scope}），等待确认`)

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => this.resolve(request.id, false, 'timeout'), this.timeoutMs)
      const entry: PendingEntry = {
        request,
        timer,
        resolve: (allowed, status) => {
          request.status = status
          request.resolvedAt = Date.now()
          clearTimeout(timer)
          this.pending.delete(request.id)
          this.history.push(request)
          if (this.history.length > 40) this.history.shift()
          this.ctx.emit('approval/resolved', request)
          resolve(allowed)
        },
      }
      this.pending.set(request.id, entry)

      if (signal) {
        const onAbort = () => this.resolve(request.id, false, 'aborted')
        if (signal.aborted) onAbort()
        else signal.addEventListener('abort', onAbort, { once: true })
      }
    })
  }

  private resolve(id: string, allow: boolean, status: ApprovalStatus): boolean {
    const entry = this.pending.get(id)
    if (!entry) return false
    entry.resolve(allow, status)
    return true
  }
}
