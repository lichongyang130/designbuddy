/**
 * ConnectorHub：目录 ↔ 凭据 ↔ 工具注册表之间的那层胶水。
 *
 * 一次 `connect()` 做四件事，顺序不能反：
 *   1. 校验必需凭据（缺什么直接说缺什么，不要只说「失败」）
 *   2. 用凭据探测远端（探测失败就不落盘、不注册工具）
 *   3. 保存凭据到 0600 文件
 *   4. 注册工具，写连接状态
 *
 * `disconnect()` 反过来：注销工具 → 删凭据 → 删状态。工具随连接消失，
 * 会话里下一次调用会明确报「未知工具」，不会悄悄调到一个已断开的服务。
 *
 * 审计：所有连接器工具调用都记一行（谁、多久、成没成），内存里留最近 200 条，
 * 同时追加到 `connectors.log.jsonl`，重启后详情页还能看到历史。
 *
 * @module designbuddy/connectors/hub
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

import type { AuthField, ConnectorManifest, ConnectorRecord, ConnectorStore } from '../core/connectors.ts'
import type { CredentialStore } from '../core/credentials.ts'
import type { Disposer, ToolDefinition, ToolRegistry } from '../core/tools.ts'
import { createAdapter } from './adapters.ts'
import type { AdapterRuntime } from './adapters.ts'
import { CONNECTORS, findConnector } from './catalog.ts'

export interface ConnectorAuditEntry {
  at: number
  connector: string
  tool: string
  ok: boolean
  ms: number
  error?: string
}

export interface ConnectorSummary {
  id: string
  name: string
  desc: string
  vendor: string
  kind: ConnectorManifest['kind']
  demo: boolean
  note?: string
  scopes: string[]
  auth: AuthField[]
  tools: { name: string; desc: string; write: boolean }[]
  state: 'idle' | 'connected' | 'error'
  hasKey: boolean
  account?: string
  since?: number
  error?: string
  allowWrite: boolean
  /** 当前真正注册进工具表的工具名。 */
  activeTools: string[]
}

export interface ConnectResult {
  id: string
  state: 'connected'
  account?: string
  tools: string[]
  allowWrite: boolean
}

export interface TestResult {
  ok: boolean
  account?: string
  error?: string
  ms: number
}

export interface ConnectorHubOptions {
  store: ConnectorStore
  credentials: CredentialStore
  tools: ToolRegistry
  /** 审计文件；留空则只留内存。 */
  logFile?: string
  fetchImpl?: typeof fetch
  now?: () => number
}

interface Live {
  adapter: AdapterRuntime
  disposers: Disposer[]
  manifest: ConnectorManifest
}

export class ConnectorHub {
  #store: ConnectorStore
  #credentials: CredentialStore
  #tools: ToolRegistry
  #logFile: string
  #fetchImpl?: typeof fetch
  #now: () => number
  #live = new Map<string, Live>()
  #audit: ConnectorAuditEntry[] = []

  constructor(options: ConnectorHubOptions) {
    this.#store = options.store
    this.#credentials = options.credentials
    this.#tools = options.tools
    this.#logFile = options.logFile ?? ''
    this.#fetchImpl = options.fetchImpl
    this.#now = options.now ?? (() => Date.now())
    this.#audit = this.#readAudit()
  }

  catalog(): ConnectorManifest[] {
    return CONNECTORS
  }

  list(): ConnectorSummary[] {
    return CONNECTORS.map((manifest) => {
      const record = this.#store.get(manifest.id)
      const live = this.#live.get(manifest.id)
      return {
        id: manifest.id,
        name: manifest.name,
        desc: manifest.desc,
        vendor: manifest.vendor,
        kind: manifest.kind,
        demo: manifest.demo === true,
        note: manifest.note,
        scopes: manifest.scopes ?? [],
        auth: manifest.auth,
        tools: manifest.tools.map((item) => ({ name: item.name, desc: item.desc, write: item.write === true })),
        state: live ? 'connected' : record?.state === 'error' ? 'error' : 'idle',
        hasKey: this.#credentials.has(manifest.id),
        account: record?.account,
        since: record?.since,
        error: live ? undefined : record?.error,
        allowWrite: record?.allowWrite === true,
        activeTools: live ? live.adapter.tools.map((tool) => tool.name) : [],
      }
    })
  }

  summary(id: string): ConnectorSummary | undefined {
    return this.list().find((item) => item.id === id)
  }

  auditLog(id: string, limit = 20): ConnectorAuditEntry[] {
    return this.#audit
      .filter((entry) => entry.connector === id)
      .slice(-Math.max(1, limit))
      .reverse()
  }

  /** 凭据只可能在「刚填的入参」或「磁盘」里，绝不回读给前端。 */
  #secretsFor(id: string, provided?: Record<string, string>): Record<string, string> {
    const fromDisk = this.#credentials.get(id) ?? {}
    const merged: Record<string, string> = { ...fromDisk }
    for (const [key, value] of Object.entries(provided ?? {})) {
      const text = String(value ?? '').trim()
      if (text !== '') merged[key] = text
    }
    return merged
  }

  #missingAuth(manifest: ConnectorManifest, secrets: Record<string, string>): string[] {
    return manifest.auth.filter((field) => field.required && !secrets[field.key]).map((field) => field.label)
  }

  async test(id: string, provided?: Record<string, string>): Promise<TestResult> {
    const manifest = findConnector(id)
    if (!manifest) throw new Error('没有这个连接器：' + id)
    const startedAt = this.#now()
    try {
      if (manifest.demo) {
        return { ok: true, account: '演示数据', ms: Math.max(1, this.#now() - startedAt) }
      }
      const secrets = this.#secretsFor(id, provided)
      const missing = this.#missingAuth(manifest, secrets)
      if (missing.length > 0) return { ok: false, error: '还缺：' + missing.join('、'), ms: this.#now() - startedAt }
      const adapter = await createAdapter({ manifest, secrets, fetchImpl: this.#fetchImpl, allowWrite: false })
      try {
        const probe = await adapter.probe()
        return { ok: true, account: probe.account, ms: Math.max(1, this.#now() - startedAt) }
      } finally {
        await adapter.close?.()
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error), ms: Math.max(1, this.#now() - startedAt) }
    }
  }

  async connect(id: string, provided?: Record<string, string>, options: { allowWrite?: boolean } = {}): Promise<ConnectResult> {
    const manifest = findConnector(id)
    if (!manifest) throw new Error('没有这个连接器：' + id)
    if (this.#live.has(id)) this.disconnect(id)

    const allowWrite = options.allowWrite === true
    const secrets = this.#secretsFor(id, provided)
    const missing = this.#missingAuth(manifest, secrets)
    if (missing.length > 0) throw new Error('还缺：' + missing.join('、'))

    let account: string | undefined
    if (!manifest.demo) {
      // 先探测再落盘：连不上就不该在磁盘上留下半连接状态。
      const probeAdapter = await createAdapter({ manifest, secrets, fetchImpl: this.#fetchImpl, allowWrite: false })
      try {
        const probe = await probeAdapter.probe()
        account = probe.account
      } finally {
        await probeAdapter.close?.()
      }
    }

    this.#credentials.save(id, secrets)
    const adapter = await createAdapter({
      manifest,
      secrets,
      allowWrite,
      fetchImpl: this.#fetchImpl,
    })
    const disposers = adapter.tools.map((tool) => this.#register(manifest, tool))
    this.#live.set(id, { adapter, disposers, manifest })
    this.#store.set(id, {
      state: 'connected',
      since: this.#now(),
      lastOkAt: this.#now(),
      account: account ?? (manifest.demo ? '演示数据' : undefined),
      allowWrite,
    })
    return { id, state: 'connected', account, tools: adapter.tools.map((tool) => tool.name), allowWrite }
  }

  disconnect(id: string): { id: string; state: 'idle' } {
    const live = this.#live.get(id)
    if (live) {
      for (const dispose of live.disposers) dispose()
      this.#live.delete(id)
      void live.adapter.close?.()
    }
    this.#credentials.remove(id)
    this.#store.remove(id)
    return { id, state: 'idle' }
  }

  /** 进程退出：只注销工具，**不动磁盘状态**，下次启动还能恢复。 */
  stop(): void {
    for (const [id, live] of this.#live) {
      for (const dispose of live.disposers) dispose()
      void live.adapter.close?.()
      this.#live.delete(id)
    }
  }

  /** 进程启动时把上次连着的连接器恢复出来；失败就转成 error，不阻塞启动。 */
  async restore(): Promise<string[]> {
    const restored: string[] = []
    for (const manifest of CONNECTORS) {
      const record = this.#store.get(manifest.id)
      if (!record || record.state !== 'connected') continue
      if (!manifest.demo && !this.#credentials.has(manifest.id)) {
        this.#store.set(manifest.id, { state: 'error', error: '凭据已丢失，请重新连接', at: this.#now() })
        continue
      }
      try {
        await this.connect(manifest.id, undefined, { allowWrite: record.allowWrite === true })
        restored.push(manifest.id)
      } catch (error) {
        this.#store.set(manifest.id, {
          state: 'error',
          error: error instanceof Error ? error.message : String(error),
          at: this.#now(),
        })
      }
    }
    return restored
  }

  /** 注册一个工具，并套一层审计（调用成功与否都记）。 */
  #register(manifest: ConnectorManifest, tool: ToolDefinition): Disposer {
    const wrapped: ToolDefinition = {
      ...tool,
      dynamic: true,
      execute: async (args, ctx) => {
        const startedAt = this.#now()
        try {
          const result = await tool.execute(args, ctx)
          this.#record({ at: startedAt, connector: manifest.id, tool: tool.name, ok: true, ms: Math.max(1, this.#now() - startedAt) })
          return result
        } catch (error) {
          this.#record({
            at: startedAt,
            connector: manifest.id,
            tool: tool.name,
            ok: false,
            ms: Math.max(1, this.#now() - startedAt),
            error: error instanceof Error ? error.message : String(error),
          })
          throw error
        }
      },
    }
    return this.#tools.register(wrapped)
  }

  #record(entry: ConnectorAuditEntry): void {
    this.#audit.push(entry)
    if (this.#audit.length > 200) this.#audit = this.#audit.slice(-200)
    if (this.#logFile === '') return
    try {
      mkdirSync(dirname(this.#logFile), { recursive: true })
      appendFileSync(this.#logFile, JSON.stringify(entry) + '\n', 'utf8')
    } catch {
      // 审计写不进去不该让工具调用失败。
    }
  }

  #readAudit(): ConnectorAuditEntry[] {
    if (this.#logFile === '' || !existsSync(this.#logFile)) return []
    try {
      return readFileSync(this.#logFile, 'utf8')
        .split('\n')
        .filter((line) => line.trim() !== '')
        .slice(-200)
        .map((line) => JSON.parse(line) as ConnectorAuditEntry)
        .filter((entry) => typeof entry?.tool === 'string')
    } catch {
      return []
    }
  }
}

export type { ConnectorRecord }
