import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { extname, join, resolve } from 'node:path'
import type { Context } from '@designbuddy/core'
import type { LlmService } from '@designbuddy/llm'
import type { SessionService } from '@designbuddy/session'
import type { ToolsService } from '@designbuddy/tools'
import type { SystemPromptService } from '@designbuddy/system-prompt'
import type { AgentLoopService, AgentService } from '@designbuddy/agents'
import type { PolicyMode, PolicyService } from '@designbuddy/policy'
import { Router, readJson, sendError, sendJson } from './router'
import type { MarketEntry, StartOptions } from './types'

/**
 * The Host is the transport, not the brain.
 *
 * It reads every service lazily through `ctx.get(...)` instead of injecting
 * them, so unloading a capability turns one endpoint into a 503 while the rest
 * of the app — and this server — keep running.
 */
export class HostServer {
  private router = new Router()
  private server: Server | null = null
  private clients = new Set<import('node:http').ServerResponse>()

  constructor(
    private readonly ctx: Context,
    private readonly options: StartOptions,
  ) {
    this.routes()
  }

  // ------------------------------------------------------------------ wiring

  private sessions() {
    return this.ctx.get<SessionService>('sessions')
  }
  private llm() {
    return this.ctx.get<LlmService>('llm')
  }
  private tools() {
    return this.ctx.get<ToolsService>('tools')
  }
  private agents() {
    return this.ctx.get<AgentService>('agents')
  }
  private loop() {
    return this.ctx.get<AgentLoopService>('agentLoop')
  }
  private prompt() {
    return this.ctx.get<SystemPromptService>('systemPrompt')
  }
  private policy() {
    return this.ctx.get<PolicyService>('policy')
  }

  private routes(): void {
    this.router
      .get('/api/health', ({ res }) => sendJson(res, 200, { ok: true, uptime: process.uptime() }))
      .get('/api/state', ({ res }) => sendJson(res, 200, this.state()))

      // ------------------------------------------------------------- market
      .get('/api/market', ({ res }) => sendJson(res, 200, { ok: true, entries: this.market() }))
      .post('/api/market/:name/enable', async ({ req, res, params }) => {
        const entry = this.findEntry(params.name)
        if (!entry) return sendError(res, 404, `unknown plugin ${params.name}`)
        const body = await readJson<{ config?: Record<string, unknown> }>(req)
        try {
          this.ctx.plugin(entry.plugin, body.config ?? entry.defaultConfig ?? {})
          const fork = this.ctx.container.find(entry.plugin.name)
          sendJson(res, 200, { ok: true, plugin: fork?.info() ?? null })
        } catch (error) {
          sendError(res, 400, (error as Error).message)
        }
      })
      .post('/api/market/:name/disable', ({ res, params }) => {
        const entry = this.findEntry(params.name)
        if (!entry) return sendError(res, 404, `unknown plugin ${params.name}`)
        this.ctx.container.remove(entry.plugin.name)
        sendJson(res, 200, { ok: true })
      })
      .post('/api/market/:name/config', async ({ req, res, params }) => {
        const entry = this.findEntry(params.name)
        if (!entry) return sendError(res, 404, `unknown plugin ${params.name}`)
        const body = await readJson<{ config?: Record<string, unknown> }>(req)
        this.ctx.plugin(entry.plugin, body.config ?? {})
        sendJson(res, 200, { ok: true, plugin: this.ctx.container.find(entry.plugin.name)?.info() ?? null })
      })

      // ----------------------------------------------------------- sessions
      .get('/api/sessions', ({ res }) => {
        const sessions = this.sessions()
        sendJson(res, 200, { ok: true, sessions: sessions?.list() ?? [] })
      })
      .post('/api/sessions', async ({ req, res }) => {
        const sessions = this.sessions()
        if (!sessions) return sendError(res, 503, 'sessions plugin is not loaded')
        const body = await readJson<{ title?: string; agent?: string; model?: string }>(req)
        const agent = this.agents()?.resolve(body.agent)
        const session = sessions.create({
          title: body.title,
          agent: agent?.name ?? 'host',
          model: body.model || this.llm()?.defaultModel() || 'mock/designer',
        })
        sendJson(res, 200, { ok: true, session: sessions.summary(session) })
      })
      .get('/api/sessions/:id', ({ res, params }) => {
        const sessions = this.sessions()
        const session = sessions?.get(params.id)
        if (!sessions || !session) return sendError(res, 404, 'session not found')
        sendJson(res, 200, {
          ok: true,
          session: sessions.summary(session),
          events: session.events,
          plan: this.ctx.get<any>('plan')?.get(session.id) ?? [],
        })
      })
      .patch('/api/sessions/:id', async ({ req, res, params }) => {
        const sessions = this.sessions()
        if (!sessions?.get(params.id)) return sendError(res, 404, 'session not found')
        const body = await readJson<Record<string, string>>(req)
        const session = sessions.update(params.id, {
          title: body.title,
          model: body.model,
          agent: body.agent,
        })
        sendJson(res, 200, { ok: true, session: sessions.summary(session) })
      })
      .delete('/api/sessions/:id', ({ res, params }) => {
        const sessions = this.sessions()
        if (!sessions?.delete(params.id)) return sendError(res, 404, 'session not found')
        sendJson(res, 200, { ok: true })
      })
      .post('/api/sessions/:id/messages', async ({ req, res, params }) => {
        const sessions = this.sessions()
        const loop = this.loop()
        if (!sessions?.get(params.id)) return sendError(res, 404, 'session not found')
        if (!loop) return sendError(res, 503, 'agents plugin is not loaded')
        const body = await readJson<{ text?: string; agent?: string; model?: string }>(req)
        const text = (body.text ?? '').trim()
        if (!text) return sendError(res, 400, 'text is required')
        if (loop.isRunning(params.id)) return sendError(res, 409, 'this session is already generating')
        void loop
          .run({ sessionId: params.id, input: text, agent: body.agent, model: body.model })
          .catch((error) => this.ctx.log('error', `run failed: ${(error as Error).message}`))
        sendJson(res, 202, { ok: true })
      })
      .post('/api/sessions/:id/abort', ({ res, params }) => {
        const aborted = this.loop()?.abort(params.id) ?? false
        sendJson(res, 200, { ok: true, aborted })
      })

      // ------------------------------------------------------------- memory
      .get('/api/memory', ({ res }) => {
        const memory = this.ctx.get<any>('memory')
        if (!memory) return sendError(res, 503, 'memory plugin is not loaded')
        sendJson(res, 200, { ok: true, entries: memory.all() })
      })
      .post('/api/memory', async ({ req, res }) => {
        const memory = this.ctx.get<any>('memory')
        if (!memory) return sendError(res, 503, 'memory plugin is not loaded')
        const body = await readJson<{ text?: string; kind?: string; tags?: string[] }>(req)
        if (!body.text) return sendError(res, 400, 'text is required')
        sendJson(res, 200, { ok: true, entry: memory.add(body) })
      })
      .delete('/api/memory/:id', ({ res, params }) => {
        const memory = this.ctx.get<any>('memory')
        if (!memory?.remove(params.id)) return sendError(res, 404, 'entry not found')
        sendJson(res, 200, { ok: true })
      })

      // ----------------------------------------------------- policy / approvals
      .get('/api/policy', ({ res }) => {
        const policy = this.policy()
        if (!policy) return sendError(res, 503, 'policy plugin is not loaded')
        sendJson(res, 200, {
          ok: true,
          mode: policy.mode,
          allow: policy.allowList,
          pending: policy.pendingRequests(),
          history: policy.list().filter((request) => request.status !== 'pending').slice(0, 12),
        })
      })
      .post('/api/policy/mode', async ({ req, res }) => {
        const policy = this.policy()
        if (!policy) return sendError(res, 503, 'policy plugin is not loaded')
        const body = await readJson<{ mode?: PolicyMode }>(req)
        if (!body.mode) return sendError(res, 400, 'mode is required')
        policy.setMode(body.mode)
        sendJson(res, 200, { ok: true, mode: policy.mode })
      })
      .post('/api/approvals/:id', async ({ req, res, params }) => {
        const policy = this.policy()
        if (!policy) return sendError(res, 503, 'policy plugin is not loaded')
        const body = await readJson<{ allow?: boolean }>(req)
        const decided = policy.decide(params.id, body.allow !== false)
        if (!decided) return sendError(res, 404, 'approval not found (already decided or timed out)')
        sendJson(res, 200, { ok: true })
      })

      // ---------------------------------------------------------- workspace
      .get('/api/workspace/files', ({ res, url }) => {
        const workspace = this.ctx.get<any>('workspace')
        if (!workspace) return sendError(res, 503, 'workspace plugin is not loaded')
        try {
          const files = workspace.list(url.searchParams.get('path') ?? '.', {
            recursive: url.searchParams.get('recursive') === '1',
          })
          sendJson(res, 200, { ok: true, root: workspace.root, files })
        } catch (error) {
          sendError(res, 400, (error as Error).message)
        }
      })
      .get('/api/workspace/file', ({ res, url }) => {
        const workspace = this.ctx.get<any>('workspace')
        if (!workspace) return sendError(res, 503, 'workspace plugin is not loaded')
        try {
          const path = url.searchParams.get('path') ?? ''
          sendJson(res, 200, { ok: true, path, content: workspace.read(path) })
        } catch (error) {
          sendError(res, 400, (error as Error).message)
        }
      })

      // --------------------------------------------------------------- sse
      .get('/api/events', ({ req, res }) => {
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        })
        res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`)
        this.clients.add(res)
        const ping = setInterval(() => res.write(': ping\n\n'), 20_000)
        req.on('close', () => {
          clearInterval(ping)
          this.clients.delete(res)
        })
      })
  }

  private state() {
    const container = this.ctx.container
    const sessions = this.sessions()
    return {
      ok: true,
      services: container.keys(),
      plugins: container.inspect(),
      internalForks: container.inspect({ includeInternal: true }).length - container.inspect().length,
      models: this.llm()?.models() ?? [],
      defaultModel: this.llm()?.defaultModel() ?? null,
      experts: this.agents()?.list() ?? [],
      tools: this.tools()?.list() ?? [],
      sessions: sessions?.list() ?? [],
      memory: this.ctx.get<any>('memory')?.all() ?? [],
      skills: this.ctx.get<any>('skills')?.list() ?? [],
      promptSections: this.prompt()?.ids() ?? [],
      policy: this.policy()
        ? {
            mode: this.policy()!.mode,
            allow: this.policy()!.allowList,
            pending: this.policy()!.pendingRequests(),
          }
        : null,
      logs: container.logs.slice(-120),
      workspaceRoot: this.ctx.get<any>('workspace')?.root ?? null,
    }
  }

  private market() {
    const container = this.ctx.container
    return this.options.market.map((entry: MarketEntry) => {
      const fork = container.find(entry.plugin.name)
      const meta = entry.plugin.meta ?? {}
      return {
        name: entry.plugin.name,
        title: entry.title ?? meta.title ?? entry.plugin.name,
        description: entry.description ?? meta.description ?? '',
        category: entry.category ?? meta.category ?? 'core',
        tags: meta.tags ?? [],
        version: entry.plugin.version ?? '0.1.0',
        author: meta.author ?? 'DesignBuddy',
        order: meta.order ?? 100,
        configSchema: entry.plugin.Config ?? [],
        required: entry.required ?? false,
        state: fork?.state ?? 'unloaded',
        error: fork?.error ?? null,
        config: fork?.config ?? entry.defaultConfig ?? {},
        provides: fork?.provides ?? [],
        missing: fork ? container.missingDeps(fork) : entry.plugin.inject ?? [],
      }
    })
  }

  private findEntry(name: string): MarketEntry | undefined {
    return this.options.market.find((entry) => entry.plugin.name === name)
  }

  // ----------------------------------------------------------------- server

  listen(): Promise<{ port: number }> {
    return new Promise((resolvePromise, reject) => {
      const server = createServer(async (req, res) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
        const matched = this.router.match(req.method ?? 'GET', url.pathname)
        if (matched) {
          try {
            await matched.route.handler({ req, res, params: matched.params, url })
          } catch (error) {
            this.ctx.log('error', `api ${url.pathname} failed: ${(error as Error).message}`)
            if (!res.headersSent) sendError(res, 500, (error as Error).message)
            else res.end()
          }
          return
        }
        if (url.pathname.startsWith('/api/')) {
          sendError(res, 404, 'not found')
          return
        }
        this.serveStatic(url.pathname, res)
      })

      server.on('error', reject)
      server.listen(this.options.port, this.options.host ?? '0.0.0.0', () => {
        const address = server.address()
        const port = typeof address === 'object' && address ? address.port : this.options.port
        this.server = server
        resolvePromise({ port })
      })
    })
  }

  /** Pushes one bus event to every connected browser. */
  broadcast(event: string, data: unknown): void {
    const payload = `event: bus\ndata: ${JSON.stringify({ event, data, at: Date.now() })}\n\n`
    for (const client of this.clients) {
      client.write(payload)
    }
  }

  close(): void {
    for (const client of this.clients) client.end()
    this.clients.clear()
    this.server?.close()
    this.server = null
  }

  private serveStatic(pathname: string, res: import('node:http').ServerResponse): void {
    const webDir = this.options.webDir
    if (!webDir || !existsSync(webDir)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('DesignBuddy Web UI 尚未构建：运行 npm run build:web')
      return
    }
    const safe = resolve(join(webDir, pathname === '/' ? 'index.html' : pathname))
    const target = safe.startsWith(resolve(webDir)) && existsSync(safe) && statSync(safe).isFile()
      ? safe
      : join(webDir, 'index.html')
    res.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' })
    createReadStream(target).pipe(res)
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}
