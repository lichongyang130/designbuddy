/**
 * MCP（Model Context Protocol）客户端：JSON-RPC 2.0 的两条传输，一份语义。
 *
 * 目录里 33 个 `mcp-http` + 6 个 `local-cli` 条目共用这一条通道：
 *
 *   initialize → notifications/initialized → tools/list → tools/call
 *
 * 传输只在最底下不同，上面全部一样，所以 `McpConnection` 只认一个 `McpWire`：
 *
 *   - `http`：POST 一条 JSON-RPC，响应可能是 `application/json`，也可能是
 *     `text/event-stream`（Streamable HTTP）。`Mcp-Session-Id` 原样带回。
 *   - `stdio`：`spawn` 子进程，一行一条消息。stderr 收着，出错时拼进理由里。
 *
 * 三条硬规则：
 *   1. **握手必须先做**——没 `initialize` 就 `tools/list`，很多服务器直接断开；
 *   2. **超时一律报错，不静默重试**——工具调用重试可能把「创建」执行两遍；
 *   3. **关闭要真的关**——stdio 子进程 `SIGTERM` 之后等 `exit`，否则连断开了
 *      进程还挂着，用户以为已经停了。
 *
 * @module designbuddy/connectors/mcp
 */

import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'

import type { JsonSchema } from '../core/schema.ts'

export const PROTOCOL_VERSION = '2025-06-18'
export const CLIENT_INFO = { name: 'designbuddy', version: '0.1.0' }

/** 服务器 `tools/list` 返回的一条工具。 */
export interface McpToolInfo {
  name: string
  description?: string
  inputSchema?: JsonSchema
  annotations?: {
    readOnlyHint?: boolean
    destructiveHint?: boolean
    idempotentHint?: boolean
  }
}

export interface McpServerInfo {
  name?: string
  version?: string
  protocolVersion?: string
  instructions?: string
  tools: McpToolInfo[]
}

/**
 * 最底层的收发口。实现只要保证「发出去的会被对面收到」和「收到的按条回调」。
 */
export interface McpWire {
  /** 发一条消息（通知也算）。同步接口：内部自己处理异步失败。 */
  send(message: Record<string, unknown>): void
  onMessage(handler: (message: Record<string, unknown>) => void): void
  onError(handler: (error: Error) => void): void
  close(): Promise<void>
  /** 出错时告诉用户「连的是谁」，例如 `https://mcp.notion.com/mcp`。 */
  describe(): string
}

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export interface McpConnectionOptions {
  wire: McpWire
  timeoutMs?: number
}

/** JSON-RPC 错误长这样：`{ code, message, data }`。翻成人话时把 code 留着。 */
export class McpError extends Error {
  readonly code: number
  constructor(code: number, message: string) {
    super(message)
    this.name = 'McpError'
    this.code = code
  }
}

export class McpConnection {
  #wire: McpWire
  #seq = 0
  #pending = new Map<number | string, Pending>()
  #timeoutMs: number
  #closed = false
  #serverInfo: McpServerInfo | null = null
  #notifications: ((method: string, params: unknown) => void)[] = []

  constructor(options: McpConnectionOptions) {
    this.#wire = options.wire
    this.#timeoutMs = options.timeoutMs ?? 20_000
    this.#wire.onMessage((message) => this.#receive(message))
    this.#wire.onError((error) => this.#fail(error))
  }

  get serverInfo(): McpServerInfo | null {
    return this.#serverInfo
  }

  get closed(): boolean {
    return this.#closed
  }

  /** 服务器主动发来的通知（`notifications/tools/list_changed` 之类）。 */
  onNotification(handler: (method: string, params: unknown) => void): () => void {
    this.#notifications.push(handler)
    return () => {
      this.#notifications = this.#notifications.filter((item) => item !== handler)
    }
  }

  /**
   * 握手。服务器回哪个协议版本就用哪个——它可能比我们老，硬要新的会直接被拒。
   */
  async initialize(): Promise<McpServerInfo> {
    const result = (await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO,
    })) as Record<string, unknown> | undefined

    const info: McpServerInfo = {
      name: typeof result?.serverInfo === 'object' && result.serverInfo ? String((result.serverInfo as Record<string, unknown>).name ?? '') : undefined,
      version: typeof result?.serverInfo === 'object' && result.serverInfo ? String((result.serverInfo as Record<string, unknown>).version ?? '') : undefined,
      protocolVersion: typeof result?.protocolVersion === 'string' ? result.protocolVersion : undefined,
      instructions: typeof result?.instructions === 'string' ? result.instructions : undefined,
      tools: [],
    }
    // 握手之后必须补这条通知，否则部分服务器认为会话还没就绪。
    this.notify('notifications/initialized')
    this.#serverInfo = info
    return info
  }

  /** 列出全部工具；服务器分页时按 cursor 一路取完。 */
  async listTools(): Promise<McpToolInfo[]> {
    const out: McpToolInfo[] = []
    let cursor: string | undefined
    for (let page = 0; page < 20; page += 1) {
      const params: Record<string, unknown> = {}
      if (cursor) params.cursor = cursor
      const result = (await this.request('tools/list', params)) as Record<string, unknown> | undefined
      const tools = Array.isArray(result?.tools) ? (result.tools as McpToolInfo[]) : []
      for (const tool of tools) {
        if (tool && typeof tool.name === 'string') out.push(tool)
      }
      const next = result?.nextCursor
      if (typeof next !== 'string' || next === '') break
      cursor = next
    }
    if (this.#serverInfo) this.#serverInfo.tools = out
    return out
  }

  /** 调用一个工具，结果拍平成一段文本（`content` 里可能混着图片，这里只取文本）。 */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<{ text: string; isError: boolean }> {
    const result = (await this.request('tools/call', { name, arguments: args })) as Record<string, unknown> | undefined
    const blocks = Array.isArray(result?.content) ? (result.content as Record<string, unknown>[]) : []
    const parts: string[] = []
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue
      const type = String(block.type ?? '')
      if (type === 'text' && typeof block.text === 'string') parts.push(block.text)
      else if (type === 'resource' && block.resource) parts.push(JSON.stringify(block.resource))
      else if (type !== '') parts.push('[' + type + ']')
    }
    if (parts.length === 0 && result && typeof result === 'object') {
      // 没有 content 数组的服务器（少见）：把 structuredContent / 整个结果给出去。
      const structured = (result as Record<string, unknown>).structuredContent
      parts.push(JSON.stringify(structured ?? result, null, 2))
    }
    return { text: parts.join('\n'), isError: result?.isError === true }
  }

  request(method: string, params?: unknown): Promise<unknown> {
    if (this.#closed) return Promise.reject(new Error('MCP 连接已关闭'))
    this.#seq += 1
    const id = this.#seq
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id)
        reject(new Error(`MCP 请求超时（${this.#timeoutMs}ms）：${method} @ ${this.#wire.describe()}`))
      }, this.#timeoutMs)
      this.#pending.set(id, { resolve, reject, timer })
      this.#send({ jsonrpc: '2.0', id, method, params: params ?? {} })
    })
  }

  notify(method: string, params?: unknown): void {
    if (this.#closed) return
    this.#send({ jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) })
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    this.#fail(new Error('MCP 连接已关闭'))
    await this.#wire.close()
  }

  #send(message: Record<string, unknown>): void {
    try {
      this.#wire.send(message)
    } catch (error) {
      this.#fail(error instanceof Error ? error : new Error(String(error)))
    }
  }

  #receive(message: Record<string, unknown>): void {
    if (!message || typeof message !== 'object') return
    // 服务器发来的请求（ping / sampling）：回一条「不支持」，别让它一直等。
    if (typeof message.method === 'string' && message.id !== undefined) {
      this.#send({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32601, message: 'designbuddy 不支持服务端发起的该方法：' + message.method },
      })
      return
    }
    if (typeof message.method === 'string') {
      for (const handler of [...this.#notifications]) {
        try {
          handler(message.method, message.params)
        } catch {
          /* 订阅方自己的错误不该影响协议层 */
        }
      }
      return
    }
    const id = message.id
    if (typeof id !== 'number' && typeof id !== 'string') return
    const pending = this.#pending.get(id)
    if (!pending) return
    this.#pending.delete(id)
    clearTimeout(pending.timer)
    const error = message.error as { code?: number; message?: string } | undefined
    if (error) {
      pending.reject(new McpError(Number(error.code ?? -32000), String(error.message ?? '未知错误')))
      return
    }
    pending.resolve(message.result)
  }

  #fail(error: Error): void {
    for (const [id, pending] of [...this.#pending]) {
      clearTimeout(pending.timer)
      this.#pending.delete(id)
      pending.reject(error)
    }
  }
}

/* ── 传输 1：Streamable HTTP ─────────────────────────────── */

export interface HttpWireOptions {
  url: string
  headers?: Record<string, string>
  /** 注入点：测试用；默认全局 fetch。 */
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/**
 * Streamable HTTP：一条 POST 发出去，回来的可能是 JSON，也可能是一段 SSE。
 * `initialize` 的响应头里带 `Mcp-Session-Id`，之后每个请求都要原样带回。
 */
export function createHttpWire(options: HttpWireOptions): McpWire {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 20_000
  let sessionId = ''
  let closed = false
  const handlers: ((message: Record<string, unknown>) => void)[] = []
  const errorHandlers: ((error: Error) => void)[] = []
  let active: AbortController | null = null

  const emit = (message: Record<string, unknown>) => {
    for (const handler of [...handlers]) handler(message)
  }
  const fail = (error: Error) => {
    for (const handler of [...errorHandlers]) handler(error)
  }

  const post = async (body: Record<string, unknown>): Promise<void> => {
    if (closed) throw new Error('MCP 连接已关闭')
    const controller = new AbortController()
    active = controller
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(options.headers ?? {}),
      }
      if (sessionId !== '') headers['mcp-session-id'] = sessionId
      if (body.method === 'initialize') {
        // 有些服务器要求显式声明期望的协议版本。
        headers['mcp-protocol-version'] = PROTOCOL_VERSION
      }
      response = await fetchImpl(options.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (error) {
      clearTimeout(timer)
      active = null
      const name = error instanceof Error ? error.name : ''
      if (name === 'AbortError') throw new Error('MCP 请求超时（' + timeoutMs + 'ms）：' + options.url)
      throw new Error('MCP 连不上：' + (error instanceof Error ? error.message : String(error)) + '（' + options.url + '）')
    }
    clearTimeout(timer)
    active = null

    const returned = response.headers.get('mcp-session-id')
    if (returned) sessionId = returned

    if (response.status === 202 || response.status === 204) return
    if (!response.ok) {
      let detail = ''
      try {
        detail = (await response.text()).slice(0, 300)
      } catch {
        /* 状态码已经说明问题 */
      }
      throw new Error('MCP 服务器返回 ' + response.status + (detail ? '：' + detail : ''))
    }

    const type = response.headers.get('content-type') ?? ''
    if (type.includes('text/event-stream')) {
      await readSse(response, emit)
      return
    }
    const text = await response.text()
    if (text.trim() === '') return
    // 少数服务器不加 content-type，仍然回 JSON。
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload !== '' && payload !== '[DONE]') parseInto(payload, emit)
    }
    if (!text.trimStart().startsWith('data:')) parseInto(text, emit)
  }

  return {
    send(message) {
      void post(message).catch((error) => fail(error instanceof Error ? error : new Error(String(error))))
    },
    onMessage(handler) {
      handlers.push(handler)
    },
    onError(handler) {
      errorHandlers.push(handler)
    },
    async close() {
      closed = true
      active?.abort()
      active = null
      // 尽力通知服务器结束会话；失败也无所谓，连接本来就要断了。
      if (sessionId !== '') {
        try {
          await fetchImpl(options.url, {
            method: 'DELETE',
            headers: { 'mcp-session-id': sessionId },
            signal: AbortSignal.timeout(2000),
          })
        } catch {
          /* 服务器不支持 DELETE 是常态 */
        }
      }
    },
    describe: () => options.url,
  }
}

function parseInto(payload: string, emit: (message: Record<string, unknown>) => void): void {
  try {
    const parsed = JSON.parse(payload) as unknown
    if (Array.isArray(parsed)) {
      for (const item of parsed) if (item && typeof item === 'object') emit(item as Record<string, unknown>)
      return
    }
    if (parsed && typeof parsed === 'object') emit(parsed as Record<string, unknown>)
  } catch {
    /* 不是 JSON 的行（注释、心跳）直接忽略 */
  }
}

async function readSse(response: Response, emit: (message: Record<string, unknown>) => void): Promise<void> {
  const body = response.body
  if (!body) return
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let cut = buffer.indexOf('\n')
    while (cut >= 0) {
      const line = buffer.slice(0, cut).replace(/\r$/, '')
      buffer = buffer.slice(cut + 1)
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim()
        if (payload !== '' && payload !== '[DONE]') parseInto(payload, emit)
      }
      cut = buffer.indexOf('\n')
    }
  }
}

/* ── 传输 2：stdio ───────────────────────────────────────── */

export interface StdioWireOptions {
  command: string[]
  env?: Record<string, string>
  cwd?: string
  /** 子进程退出时把 stderr 留下，报错时能说清是为什么。 */
  onExit?: (code: number | null, stderr: string) => void
}

export function createStdioWire(options: StdioWireOptions): McpWire {
  const [file, ...args] = options.command
  if (!file) throw new Error('MCP 启动命令是空的')
  let child: ChildProcess
  try {
    child = spawn(file, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
    })
  } catch (error) {
    throw new Error('MCP 子进程启动失败：' + (error instanceof Error ? error.message : String(error)))
  }

  const handlers: ((message: Record<string, unknown>) => void)[] = []
  const errorHandlers: ((error: Error) => void)[] = []
  let stderr = ''
  let closed = false
  const exited = new Promise<void>((resolve) => {
    child.once('exit', (code) => {
      closed = true
      for (const handler of [...errorHandlers]) {
        handler(new Error('MCP 子进程已退出' + (code === null ? '' : '（code ' + code + '）') + (stderr ? '：' + stderr.slice(-400) : '')))
      }
      options.onExit?.(code, stderr)
      resolve()
    })
  })
  child.once('error', (error) => {
    for (const handler of [...errorHandlers]) handler(new Error('MCP 子进程出错：' + error.message))
  })

  child.stderr?.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString('utf8')).slice(-4000)
  })

  let buffer = ''
  child.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8')
    let index = buffer.indexOf('\n')
    while (index >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line !== '') {
        try {
          const parsed = JSON.parse(line) as unknown
          if (parsed && typeof parsed === 'object') {
            for (const handler of [...handlers]) handler(parsed as Record<string, unknown>)
          }
        } catch {
          /* 非 JSON 的 stdout（日志）忽略，不打断协议 */
        }
      }
      index = buffer.indexOf('\n')
    }
  })

  return {
    send(message) {
      if (closed || !child.stdin || child.stdin.destroyed) throw new Error('MCP 子进程已经关闭')
      child.stdin.write(JSON.stringify(message) + '\n')
    },
    onMessage(handler) {
      handlers.push(handler)
    },
    onError(handler) {
      errorHandlers.push(handler)
    },
    async close() {
      if (closed) {
        await exited
        return
      }
      closed = true
      child.stdin?.end()
      child.kill('SIGTERM')
      // 3 秒不走就硬杀，别让「断开」变成「留一个僵尸」。
      const killer = setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL')
      }, 3000)
      killer.unref?.()
      await exited
      clearTimeout(killer)
    },
    describe: () => options.command.join(' '),
  }
}

/* ── 一键：开一条已握手的连接 ───────────────────────────── */

export interface OpenMcpOptions {
  transport: 'http' | 'stdio'
  url?: string
  command?: string[]
  headers?: Record<string, string>
  env?: Record<string, string>
  cwd?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export interface McpHandle {
  connection: McpConnection
  server: McpServerInfo
}

export async function openMcp(options: OpenMcpOptions): Promise<McpHandle> {
  const wire =
    options.transport === 'http'
      ? createHttpWire({
          url: options.url ?? '',
          headers: options.headers,
          fetchImpl: options.fetchImpl,
          timeoutMs: options.timeoutMs,
        })
      : createStdioWire({ command: options.command ?? [], env: options.env, cwd: options.cwd })
  const connection = new McpConnection({ wire, timeoutMs: options.timeoutMs })
  try {
    const server = await connection.initialize()
    return { connection, server }
  } catch (error) {
    await connection.close()
    throw error
  }
}
