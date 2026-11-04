/**
 * Host side of the split: owns the kernel, answers RPC, forwards two streams.
 *
 * DSH equivalent: `packages/host/webserver` + `packages/api/*-controller` +
 * `sdk/server`. The important property, and the reason this file never imports a
 * UI: **execution lives here, presentation lives in the client**. Swapping the
 * client from React to a terminal changes nothing in this process.
 *
 * Two streams, because DSH distinguishes them and so should you:
 *   - `event` frames carry durable session facts (already appended to the log);
 *   - `agent-event` frames carry live activity that may never be persisted.
 *
 * @module designbuddy/sdk/host
 */

import type { Context, Disposer } from '../kernel/index.ts'
import type { AgentLoop } from '../core/agent.ts'
import { AgentPresetRegistry } from '../core/agent.ts'
import { ModelRouter } from '../core/router.ts'
import type { SessionService } from '../core/session.ts'
import type { UsageService } from '../core/usage.ts'
import type { Library } from '../core/library.ts'
import type { CustomModelInput, ModelCatalog } from '../core/models.ts'
import { probeModel } from '../core/model-probe.ts'
import type { ConnectorHub } from '../connectors/hub.ts'
import type { ApprovalBroker } from '../core/approvals.ts'
import type { DeckEngine } from '../plugins/deck-engine.ts'
import type { DeckRecord } from '../plugins/deck-engine.ts'
import { estimateTokens } from '../core/usage.ts'
import { errorMessage } from '../core/tools.ts'
import { outlineWithLlm } from '../core/outline-llm.ts'
import { JsonClient, hasLiveAdapter } from '../core/llm-json.ts'
import type { ModelRuntime } from '../plugins/model-runtime.ts'
import { createArtifact } from '../core/artifact.ts'
import type { ToolRegistry } from '../core/tools.ts'
import type { ClientFrame, HostFrame, Transport } from './protocol.ts'
import type { BrowserRelay, RelayReplyInput } from '../core/llm-relay.ts'

/**
 * App-layer actions the host is allowed to invoke.
 *
 * Injected instead of imported so `sdk/host.ts` stays free of `boot/app.ts`:
 * an embedded SDK host may legitimately not support unloading at all.
 */
export interface HostCommands {
  unmount?(rowId: string, options: { cascade?: boolean }): Promise<string[]>
  /** The profile's rows, for a plugin manager UI. */
  rows?(): { id: string; plugin: string; enabled?: boolean; mounted: boolean }[]
}

/** Structural view of the design-memory service, to avoid importing a plugin here. */
export interface DesignMemoryLike {
  list(): { id: string; topic: string; content: string; at: number }[]
  save(topic: string, content: string): unknown
}

export class HostServer {
  #ctx: Context
  #transport: Transport
  #commands: HostCommands
  #detach: Disposer
  /** 每份稿子的 deck-event 订阅：生成结束或被叫停时都要撤，别留下只听不用的监昕器。 */
  #deckOffs = new Map<string, () => void>()
  /** 模型返回的大纲按「类型 + 需求 + 段数」缓存，同一句需求连点两次不重复花钱。 */
  #outlineCache = new Map<string, string>()
  /** 这条连接作为浏览器中转的登记凭证：关连接时必须撤掉，否则请求会发给死人。 */
  #relayOff: Disposer | null = null

  constructor(ctx: Context, transport: Transport, commands: HostCommands = {}) {
    this.#ctx = ctx
    this.#transport = transport
    this.#commands = commands
    this.#detach = transport.onFrame((frame: ClientFrame | HostFrame) => {
      if (isClientFrame(frame)) void this.#dispatch(frame)
    })
    const relay = this.#relay()
    if (relay) this.#relayOff = relay.attach({ send: (frame) => transport.send(frame) })
  }

  dispose(): void {
    this.#relayOff?.()
    this.#relayOff = null
    this.#detach()
  }

  #relay(): BrowserRelay | null {
    return this.#ctx.has('llmRelay') ? this.#ctx.require<BrowserRelay>('llmRelay') : null
  }

  /** 设置页保存/删除之后把适配器对齐一次；没装 runtime 插件时安静跳过。 */
  #syncModels(): ReturnType<ModelRuntime['sync']> | null {
    if (!this.#ctx.has('modelRuntime')) return null
    const runtime = this.#ctx.require<ModelRuntime>('modelRuntime')
    return runtime.sync()
  }

  #modelRuntime(): ModelRuntime | null {
    return this.#ctx.has('modelRuntime') ? this.#ctx.require<ModelRuntime>('modelRuntime') : null
  }

  /** 模型调用记账：谁、多少 token、多久、成没成。设置里的用量就是这些数字。 */
  #account(kind: string, model: string, input: number | undefined, output: number | undefined, ms: number, status: string): void {
    if (!this.#ctx.has('usage')) return
    this.#ctx.require<UsageService>('usage').record({
      at: Date.now(),
      sessionId: kind,
      presetId: kind,
      model,
      inputTokens: input ?? 0,
      outputTokens: output ?? 0,
      ms,
      status,
    })
  }

  #jsonClient(): JsonClient {
    const router = this.#ctx.require<ModelRouter>('llm')
    return new JsonClient({ router })
  }

  async #dispatch(frame: ClientFrame): Promise<void> {
    const reply = (out: HostFrame) => this.#transport.send(out)
    try {
      const result = await this.#handle(frame, reply)
      if (result !== SKIP_RESULT) reply({ type: 'rpc.result', id: frame.id, result })
    } catch (error) {
      reply({ type: 'rpc.error', id: frame.id, message: errorMessage(error) })
    }
  }

  async #handle(frame: ClientFrame, reply: (out: HostFrame) => void): Promise<unknown> {
    const params = frame.params ?? {}
    switch (frame.method) {
      case 'session.create': {
        const sessions = this.#ctx.require<SessionService>('sessions')
        const session = sessions.create({ title: String(params.title ?? '未命名会话') })
        return { id: session.id, title: session.title }
      }
      case 'session.list': {
        const sessions = this.#ctx.require<SessionService>('sessions')
        return sessions.list().map((session) => ({
          id: session.id,
          title: session.title,
          messages: session.messages.length,
          events: session.events.length,
        }))
      }
      case 'session.events': {
        const sessions = this.#ctx.require<SessionService>('sessions')
        return sessions.events(String(params.sessionId))
      }
      case 'tools.list': {
        const tools = this.#ctx.require<ToolRegistry>('tools')
        return tools.list().map((tool) => ({ name: tool.name, description: tool.description }))
      }
      case 'presets.list': {
        const presets = this.#ctx.require<AgentPresetRegistry>('agents')
        return presets.list().map((preset) => ({
          id: preset.id,
          name: preset.name,
          role: preset.role,
          kind: preset.kind,
          tools: preset.tools ?? null,
          maxSteps: preset.maxSteps ?? null,
        }))
      }
      case 'memory.list': {
        if (!this.#ctx.has('designMemory')) throw new Error('design memory plugin is not mounted')
        return this.#ctx.require<DesignMemoryLike>('designMemory').list()
      }
      case 'memory.save': {
        if (!this.#ctx.has('designMemory')) throw new Error('design memory plugin is not mounted')
        return this.#ctx.require<DesignMemoryLike>('designMemory').save(
          String(params.topic ?? ''),
          String(params.content ?? ''),
        )
      }
      case 'session.export': {
        const sessions = this.#ctx.require<SessionService>('sessions')
        return sessions.toJsonl(String(params.sessionId ?? ''))
      }
      case 'plugins.tree':
        return this.#ctx.registry.dumpTree()
      case 'plugins.rows': {
        if (!this.#commands.rows) throw new Error('plugins.rows is not supported by this host')
        return this.#commands.rows()
      }
      case 'plugins.unmount': {
        // The host owns a context, not the row table: unloading is an app-layer
        // decision (it may need to cascade), so it is injected rather than
        // reached for. A host without the command says so instead of guessing.
        if (!this.#commands.unmount) {
          throw new Error('plugins.unmount is not supported by this host')
        }
        const removed = await this.#commands.unmount(String(params.rowId), {
          cascade: params.cascade === true,
        })
        return { removed }
      }
      case 'router.status': {
        const router = this.#ctx.require<ModelRouter>('llm')
        const runtime = this.#modelRuntime()
        return {
          adapters: router.adapters().map((adapter) => ({ id: adapter.id, models: adapter.models })),
          policies: router.candidateKinds(),
          attempts: router.attempts,
          /** 链上有没有真模型：界面用这个显示「已接入 / 规则模板」，不靠模型名猜。 */
          live: hasLiveAdapter(router, 'planning'),
          models: runtime ? runtime.status() : null,
          /** 浏览器中转：在线与否决定「浏览器直连」的条目能不能用。 */
          relay: this.#relay()?.stats() ?? null,
        }
      }
      case 'connectors.list': {
        const hub = this.#ctx.require<ConnectorHub>('connectors')
        return { items: hub.list() }
      }
      case 'connectors.test': {
        const hub = this.#ctx.require<ConnectorHub>('connectors')
        return hub.test(
          String(params.id ?? ''),
          (params.secrets ?? {}) as Record<string, string>,
          { url: typeof params.url === 'string' ? params.url : undefined },
        )
      }
      case 'connectors.connect': {
        const hub = this.#ctx.require<ConnectorHub>('connectors')
        return hub.connect(
          String(params.id ?? ''),
          (params.secrets ?? {}) as Record<string, string>,
          {
            allowWrite: params.allowWrite === true,
            url: typeof params.url === 'string' ? params.url : undefined,
          },
        )
      }
      case 'connectors.disconnect': {
        const hub = this.#ctx.require<ConnectorHub>('connectors')
        return hub.disconnect(String(params.id ?? ''))
      }
      case 'connectors.log': {
        const hub = this.#ctx.require<ConnectorHub>('connectors')
        return { items: hub.auditLog(String(params.id ?? ''), Number(params.limit ?? 20)) }
      }
      case 'models.list': {
        const catalog = this.#ctx.require<ModelCatalog>('models')
        return { file: catalog.displayPath(), error: catalog.lastError(), models: catalog.list() }
      }
      case 'models.save': {
        const catalog = this.#ctx.require<ModelCatalog>('models')
        const saved = catalog.save((params.model ?? params) as CustomModelInput)
        // 保存即生效：立刻把新条目挂到路由上，不用重启。
        const status = this.#syncModels()
        const mounted = status ? status.mounted.some((item) => item.id === saved.id) : false
        return {
          ...saved,
          mounted,
          reason: status?.skipped.find((item) => item.id === saved.id)?.reason,
        }
      }
      case 'models.test': {
        const catalog = this.#ctx.require<ModelCatalog>('models')
        const id = typeof params.id === 'string' ? params.id : ''
        const stored = id === '' ? undefined : catalog.key(id)
        const browser = params.transport === 'browser'
        const relay = this.#relay()
        if (browser && !relay) {
          return { ok: false, ms: 0, endpoint: String(params.baseUrl ?? ''), message: '浏览器中转没装上，改用服务端直连试试' }
        }
        return probeModel({
          baseUrl: String(params.baseUrl ?? ''),
          // 浏览器直连：Key 由浏览器补，这里不能把自己那份当成真的发出去。
          apiKey: browser ? undefined : (typeof params.apiKey === 'string' && params.apiKey !== '' ? params.apiKey : stored),
          model: typeof params.model === 'string' ? params.model : undefined,
          fetchImpl: browser && relay ? (input, init) => relay.fetch(String(input), init) : undefined,
        })
      }
      case 'llm.reply': {
        const relay = this.#relay()
        if (!relay) return { ok: false, reason: '浏览器中转没装上' }
        const accepted = relay.reply({
          id: String(params.id ?? ''),
          status: Number(params.status ?? 0),
          body: typeof params.body === 'string' ? params.body : '',
          headers: (params.headers ?? {}) as Record<string, string>,
          error: typeof params.error === 'string' && params.error !== '' ? params.error : undefined,
        })
        return { ok: accepted }
      }
      case 'models.remove': {
        const catalog = this.#ctx.require<ModelCatalog>('models')
        const removed = catalog.remove(String(params.id ?? ''))
        this.#syncModels()
        return { removed }
      }
      case 'library.cases': {
        const library = this.#ctx.require<Library>('library')
        return library.list({
          q: typeof params.q === 'string' ? params.q : '',
          fmt: typeof params.fmt === 'string' ? params.fmt : 'all',
          cats: Array.isArray(params.cats) ? (params.cats as string[]) : [],
          sort: params.sort === 'name' ? 'name' : 'date',
          limit: Number(params.limit ?? 0),
        })
      }
      case 'library.catalog': {
        const library = this.#ctx.require<Library>('library')
        return library.decks()
      }
      case 'library.case': {
        const library = this.#ctx.require<Library>('library')
        const deck = library.get(String(params.id ?? ''))
        if (!deck) throw new Error(`unknown case: ${String(params.id ?? '')}`)
        return deck
      }
      case 'library.facets': {
        const library = this.#ctx.require<Library>('library')
        return library.facets({
          q: typeof params.q === 'string' ? params.q : '',
          fmt: typeof params.fmt === 'string' ? params.fmt : 'all',
          cats: Array.isArray(params.cats) ? (params.cats as string[]) : [],
        })
      }
      case 'library.themes': {
        const library = this.#ctx.require<Library>('library')
        return library.themes()
      }
      case 'library.summary': {
        const library = this.#ctx.require<Library>('library')
        return library.summary()
      }
      case 'usage.summary': {
        const usage = this.#ctx.require<UsageService>('usage')
        return usage.summary()
      }
      case 'usage.recent': {
        const usage = this.#ctx.require<UsageService>('usage')
        return usage.summary().recent.slice(0, Number(params.limit ?? 8))
      }
      case 'office.run': {
        const tools = this.#ctx.require<ToolRegistry>('tools')
        const toolName = String(params.tool ?? '')
        const toolArgs = (params.args ?? {}) as Record<string, unknown>
        return tools.execute(toolName, toolArgs, {
          sessionId: 'office',
          agentId: 'office',
          callId: `office-${Date.now()}`,
        })
      }
      case 'deck.start': {
        const decks = this.#ctx.require<DeckEngine>('decks')
        const started = decks.start({
          prompt: String(params.prompt ?? ''),
          mode: (params.mode === 'express' || params.mode === 'research' || params.mode === 'plan' ? params.mode : 'plan'),
          pages: Number(params.pages ?? 0) || undefined,
          audience: typeof params.audience === 'string' ? params.audience : undefined,
          style: typeof params.style === 'string' ? params.style : undefined,
        })
        // 订阅只活这一份稿子：跑完就撤掉，不给长连接留订阅泄漏。
        // 记在 #deckOffs 里，deck.build 沿用同一条订阅——否则事件会被两份订阅各回一次，
        // 界面上同一页、同一个步骤会重复出现。
        let off: (() => void) | undefined
        off = decks.onEvent((record: DeckRecord, event) => {
          if (record.id !== started.id) return
          reply({ type: 'deck-event', deckId: record.id, event })
          if (event.type === 'deck/done') {
            off?.()
            this.#deckOffs.delete(record.id)
          }
        })
        this.#deckOffs.set(started.id, off!)
        return { id: started.id, plan: started.plan }
      }
      case 'deck.build': {
        const decks = this.#ctx.require<DeckEngine>('decks')
        const id = String(params.id ?? '')
        // 确认计划之后继续跑：deck.start 那条订阅还活着就沿用它，
        // 只有换了一个客户端来确认时才补订一条（同一份稿子绝不订两次）。
        if (!this.#deckOffs.has(id)) {
          let off: (() => void) | undefined
          off = decks.onEvent((record: DeckRecord, event) => {
            if (record.id !== id) return
            reply({ type: 'deck-event', deckId: record.id, event })
            if (event.type === 'deck/done') {
              off?.()
              this.#deckOffs.delete(id)
            }
          })
          this.#deckOffs.set(id, off!)
        }
        return decks.build(id)
      }
      case 'deck.cancel': {
        // 逐页生成可以被叫停：引擎里本来就有 cancel()（关面板时会 abort），
        // 这里把它接到 RPC 上，界面上的「停止」才是真的停止，而不是假装。
        const decks = this.#ctx.require<DeckEngine>('decks')
        const id = String(params.id ?? '')
        const cancelled = decks.cancel(id)
        // 被叫停不会有 deck/done，订阅得在这里撤，否则监听器会一直挂在引擎上。
        this.#deckOffs.get(id)?.()
        this.#deckOffs.delete(id)
        return { id, cancelled }
      }
      case 'deck.revise': {
        const decks = this.#ctx.require<DeckEngine>('decks')
        const result = decks.revise(String(params.id ?? ''), String(params.instruction ?? ''))
        return { id: result.id, indexes: result.indexes, summary: result.summary, deck: result.deck }
      }
      case 'plan.outline': {
        // 大纲先行：文档 / 轮播图 / 图片没有自己的生成引擎，但同样要先定结构。
        // 有模型时由模型把骨架具体化，失败自动回落规则模板，并把「用的是谁」带回去。
        const request = {
          prompt: String(params.prompt ?? ''),
          kind: String(params.kind ?? '文档'),
          count: Number(params.count ?? 0) || undefined,
          style: typeof params.style === 'string' ? params.style : undefined,
        }
        this.#syncModels()
        const answer = await outlineWithLlm(request, {
          client: this.#jsonClient(),
          cache: this.#outlineCache,
          cacheKey: `${request.kind}|${request.count ?? ''}|${request.prompt}`,
        })
        if (answer.model) {
          this.#account('outline', answer.model, answer.inputTokens, answer.outputTokens, answer.ms, answer.source === 'llm' ? 'ok' : 'fallback')
        }
        if (this.#outlineCache.size > 40) {
          const oldest = this.#outlineCache.keys().next().value
          if (oldest !== undefined) this.#outlineCache.delete(oldest)
        }
        return {
          ...answer.outline,
          source: answer.source,
          model: answer.model,
          ms: answer.ms,
          reason: answer.reason,
        }
      }
      case 'create.artifact': {
        // 大纲确认之后的真产出：docx / svg / zip 落盘，返回可下载的相对地址。
        return createArtifact({
          prompt: String(params.prompt ?? ''),
          kind: String(params.kind ?? '文档'),
          count: Number(params.count ?? 0) || undefined,
        })
      }
      case 'deck.get': {
        const decks = this.#ctx.require<DeckEngine>('decks')
        const record = decks.get(String(params.id ?? ''))
        if (!record) throw new Error('找不到这份演示文稿：' + String(params.id ?? ''))
        return { id: record.id, status: record.status, plan: record.plan, deck: record.deck, error: record.error }
      }
      case 'approvals.respond': {
        // 没有审批插件（headless profile）时直接说清楚，而不是假装点了没反应。
        const approvals = this.#ctx.get<ApprovalBroker>('approvals')
        if (!approvals) throw new Error('当前部署没有启用写操作确认')
        const id = String(params.id ?? '')
        const accepted = approvals.respond(id, params.approved === true, typeof params.reason === 'string' ? params.reason : undefined)
        // false 不是错误：卡片可能已经因为超时/回车/重复点击失效了，客户端清掉即可。
        return { id, accepted }
      }
      case 'agent.run': {
        const sessionId = String(params.sessionId)
        const presetId = String(params.presetId ?? 'default')
        const prompt = String(params.prompt ?? '')
        const loop = this.#ctx.require<AgentLoop>('agentLoop')
        const sessions = this.#ctx.require<SessionService>('sessions')
        const usage = this.#ctx.require<UsageService>('usage')

        // 免费额度是本机真实生效的门槛：用完了当天就不再开跑，而不是跑完再提示。
        const gate = usage.canRun()
        if (!gate.ok) {
          throw new Error(
            `今天的免费额度已用完（${gate.quota.limit} tokens），明天 0 点恢复；本地运行不扣费，但请先清空用量或调高 DB_USAGE_DAILY_TOKENS。`,
          )
        }

        // Durable facts are forwarded as they land, including the ones the loop
        // writes between steps, so a client can rebuild the transcript after a
        // reconnect instead of trusting a delta stream.
        const unsubscribe = sessions.subscribe(sessionId, (event) => {
          reply({ type: 'event', sessionId, event })
        })

        // Write tools park here. The listener lives only for the length of this
        // run: a client that goes away mid-turn leaves no stale subscriber, and
        // a run that ends unhooks the card so it cannot be answered later.
        const approvals = this.#ctx.get<ApprovalBroker>('approvals')
        const detachApprovals = approvals?.onRequest((request) => {
          reply({ type: 'approval.request', sessionId, request })
        })

        try {
          let final: { status: string; text: string } = { status: 'failed', text: '' }
          const startedAt = Date.now()
          let output = ''
          for await (const event of loop.run({ sessionId, presetId, prompt })) {
            reply({ type: 'agent-event', sessionId, event })
            if (event.type === 'agent/end') final = { status: event.status, text: event.text }
            if (event.type === 'agent/text') output += event.text
          }
          const router = this.#ctx.require<ModelRouter>('llm')
          usage.record({
            at: Date.now(),
            sessionId,
            presetId,
            model: router.adapters()[0]?.id ?? 'unknown',
            inputTokens: estimateTokens(prompt),
            outputTokens: final.text ? estimateTokens(final.text) : estimateTokens(output),
            ms: Date.now() - startedAt,
            status: final.status,
          })
          return final
        } finally {
          unsubscribe()
          detachApprovals?.()
          // 运行结束（成功、失败、中止）都不该留一张没人能点、还占着守卫的卡片。
          approvals?.cancelSession(sessionId, '这一轮已经结束，写操作没有执行')
        }
      }
      default:
        throw new Error(`unknown method "${String((frame as ClientFrame).method)}"`)
    }
  }
}

const SKIP_RESULT = Symbol('skip')

function isClientFrame(frame: unknown): frame is ClientFrame {
  return typeof frame === 'object' && frame !== null && 'method' in frame
}
