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
import { estimateTokens } from '../core/usage.ts'
import { errorMessage } from '../core/tools.ts'
import type { ToolRegistry } from '../core/tools.ts'
import type { ClientFrame, HostFrame, Transport } from './protocol.ts'

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

  constructor(ctx: Context, transport: Transport, commands: HostCommands = {}) {
    this.#ctx = ctx
    this.#transport = transport
    this.#commands = commands
    this.#detach = transport.onFrame((frame: ClientFrame | HostFrame) => {
      if (isClientFrame(frame)) void this.#dispatch(frame)
    })
  }

  dispose(): void {
    this.#detach()
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
        return {
          adapters: router.adapters().map((adapter) => ({ id: adapter.id, models: adapter.models })),
          policies: router.candidateKinds(),
          attempts: router.attempts,
        }
      }
      case 'models.list': {
        const catalog = this.#ctx.require<ModelCatalog>('models')
        return { file: catalog.displayPath(), error: catalog.lastError(), models: catalog.list() }
      }
      case 'models.save': {
        const catalog = this.#ctx.require<ModelCatalog>('models')
        return catalog.save((params.model ?? params) as CustomModelInput)
      }
      case 'models.remove': {
        const catalog = this.#ctx.require<ModelCatalog>('models')
        return { removed: catalog.remove(String(params.id ?? '')) }
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
