import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

export interface McpServerConfig {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  /** Tools from this server only read; skip the approval gate. */
  readOnly?: boolean
}

export interface McpTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

interface Pending {
  resolve: (value: any) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const PROTOCOL_VERSION = '2024-11-05'

/**
 * A minimal MCP client over the stdio transport (newline-delimited JSON-RPC 2.0).
 *
 * Hand-rolled on purpose: one dependency-free file is enough to speak the parts
 * of the protocol an agent actually needs — initialize, tools/list, tools/call.
 */
export class McpClient {
  private seq = 0
  private pending = new Map<number, Pending>()
  private buffer = ''
  private closed = false
  private ready: Promise<void>

  private constructor(
    readonly config: McpServerConfig,
    private readonly child: ChildProcessWithoutNullStreams,
  ) {
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => this.onData(chunk))
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      const line = String(chunk).trim()
      if (line) console.error(`[mcp:${config.name}] ${line}`)
    })
    child.on('exit', (code) => this.shutdown(new Error(`mcp server "${config.name}" exited (${code})`)))
    child.on('error', (error) => this.shutdown(error))
    this.ready = this.initialize()
  }

  static async connect(config: McpServerConfig): Promise<McpClient> {
    const child = spawn(config.command, config.args ?? [], {
      cwd: config.cwd,
      env: { ...process.env, ...(config.env ?? {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const client = new McpClient(config, child)
    await client.ready
    return client
  }

  private async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'designbuddy', version: '0.1.0' },
    })
    this.notify('notifications/initialized')
  }

  async listTools(): Promise<McpTool[]> {
    const result = await this.request('tools/list', {})
    return Array.isArray(result?.tools) ? (result.tools as McpTool[]) : []
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
    const result = await this.request('tools/call', { name, arguments: args ?? {} })
    const content = Array.isArray(result?.content) ? result.content : []
    const text = content
      .map((part: any) => {
        if (part?.type === 'text') return String(part.text ?? '')
        return `[${part?.type ?? 'unknown'} content]`
      })
      .join('\n')
    return { text: text || '(empty result)', isError: Boolean(result?.isError) }
  }

  private request(method: string, params: unknown, timeoutMs = 20_000): Promise<any> {
    if (this.closed) return Promise.reject(new Error(`mcp server "${this.config.name}" is closed`))
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`mcp ${method} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.write({ jsonrpc: '2.0', id, method, params })
    })
  }

  private notify(method: string, params?: unknown): void {
    this.write({ jsonrpc: '2.0', method, params })
  }

  private write(message: unknown): void {
    if (this.closed || this.child.killed) return
    this.child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  private onData(chunk: string): void {
    this.buffer += chunk
    let index = this.buffer.indexOf('\n')
    while (index >= 0) {
      const line = this.buffer.slice(0, index).trim()
      this.buffer = this.buffer.slice(index + 1)
      if (line) this.handleLine(line)
      index = this.buffer.indexOf('\n')
    }
  }

  private handleLine(line: string): void {
    let message: any
    try {
      message = JSON.parse(line)
    } catch {
      // Not every server keeps stdout clean; ignore noise instead of dying.
      return
    }
    if (message.id === undefined) return
    const entry = this.pending.get(message.id)
    if (!entry) return
    this.pending.delete(message.id)
    clearTimeout(entry.timer)
    if (message.error) entry.reject(new Error(`${message.error.code ?? ''} ${message.error.message ?? 'mcp error'}`.trim()))
    else entry.resolve(message.result)
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.shutdown(new Error('mcp client closed'))
    await new Promise<void>((resolve) => {
      if (this.child.exitCode !== null) return resolve()
      this.child.once('exit', () => resolve())
      this.child.kill('SIGTERM')
      setTimeout(() => {
        if (this.child.exitCode === null) this.child.kill('SIGKILL')
        resolve()
      }, 1500)
    })
  }

  private shutdown(error: Error): void {
    this.closed = true
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer)
      entry.reject(error)
      this.pending.delete(id)
    }
  }
}
