import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { createMcpAdapter } from '../src/connectors/adapters.ts'
import { McpConnection, createHttpWire, createStdioWire, openMcp } from '../src/connectors/mcp.ts'
import { findConnector } from '../src/connectors/catalog.ts'
import type { ConnectorHub } from '../src/connectors/hub.ts'
import { parseServerTarget } from '../src/connectors/hub.ts'
import type { ToolRegistry } from '../src/core/tools.ts'
import { designBundle } from '../src/boot/profiles.ts'
import { boot, toolCallContext } from './support/app.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ECHO = ['node', join(ROOT, 'tools', 'mcp-echo.mjs')]

/* 一个够用的 MCP 服务器：真握手、真 tools/list、按开关走 JSON 或 SSE。 */
interface FakeMcp {
  url: string
  sessions: string[]
  calls: { name: string; args: Record<string, unknown> }[]
  close(): Promise<void>
}

async function startFakeMcp(options: { sse?: boolean } = {}): Promise<FakeMcp> {
  const sessions: string[] = []
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const SESSION = 'sess-test-1'

  const answer = (method: string, params: Record<string, unknown>) => {
    if (method === 'initialize') {
      return {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'fake-mcp', version: '9.9.9' },
      }
    }
    if (method === 'tools/list') {
      return {
        tools: [
          {
            name: 'echo',
            description: '回显',
            inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
            annotations: { readOnlyHint: true },
          },
          {
            name: 'add_note',
            description: '记笔记',
            inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
            annotations: { readOnlyHint: false },
          },
        ],
      }
    }
    if (method === 'tools/call') {
      const name = String(params.name ?? '')
      calls.push({ name, args: (params.arguments ?? {}) as Record<string, unknown> })
      return { content: [{ type: 'text', text: 'called ' + name }] }
    }
    return {}
  }

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunk = await new Promise<Buffer>((resolve) => {
      const parts: Buffer[] = []
      req.on('data', (part: Buffer) => parts.push(part))
      req.on('end', () => resolve(Buffer.concat(parts)))
    })
    if (req.method === 'DELETE') {
      res.writeHead(204).end()
      return
    }
    const body = chunk.toString('utf8') === '' ? {} : JSON.parse(chunk.toString('utf8'))
    const header = req.headers['mcp-session-id']
    if (typeof header === 'string') sessions.push(header)

    if (body.id === undefined) {
      // 通知：202 无正文
      res.writeHead(202).end()
      return
    }
    const payload = JSON.stringify({ jsonrpc: '2.0', id: body.id, result: answer(body.method, body.params ?? {}) })
    const headers: Record<string, string> = {}
    if (body.method === 'initialize') headers['mcp-session-id'] = SESSION
    if (options.sse) {
      res.writeHead(200, { 'content-type': 'text/event-stream', ...headers })
      res.write(': hello\n\n')
      res.write('data: ' + payload + '\n\n')
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': 'application/json', ...headers })
    res.end(payload)
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    url: 'http://127.0.0.1:' + port + '/mcp',
    sessions,
    calls,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.()
        server.close(() => resolve())
      }),
  }
}

test('stdio：和真子进程握手、列工具、调工具，关掉之后进程真的退出', async () => {
  const handle = await openMcp({ transport: 'stdio', command: ECHO, timeoutMs: 10_000 })
  const { connection, server } = handle
  try {
    assert.equal(server.name, 'designbuddy-echo')
    assert.equal(server.protocolVersion, '2025-06-18')

    const tools = await connection.listTools()
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ['add_note', 'echo', 'now'])
    assert.equal(tools.find((tool) => tool.name === 'echo')?.annotations?.readOnlyHint, true)
    assert.equal(tools.find((tool) => tool.name === 'add_note')?.annotations?.readOnlyHint, false)

    const echoed = await connection.callTool('echo', { text: '你好，MCP' })
    assert.equal(echoed.isError, false)
    assert.equal(echoed.text, '你好，MCP')

    const noted = await connection.callTool('add_note', { text: '第一条' })
    assert.match(noted.text, /已记下第 1 条笔记/)

    // 不存在的工具：服务器回 JSON-RPC 错误，客户端要把它翻成带 code 的错误
    await assert.rejects(() => connection.callTool('nope', {}), /没有这个工具/)
  } finally {
    await connection.close()
  }
  assert.equal(connection.closed, true)
})

test('http：走 Streamable HTTP，session id 从头带到尾', async (t) => {
  const fake = await startFakeMcp()
  t.after(() => fake.close())

  const handle = await openMcp({ transport: 'http', url: fake.url, timeoutMs: 5000 })
  t.after(() => handle.connection.close())

  assert.equal(handle.server.name, 'fake-mcp')
  const tools = await handle.connection.listTools()
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ['add_note', 'echo'])

  const result = await handle.connection.callTool('echo', { text: 'hi' })
  assert.equal(result.text, 'called echo')
  assert.deepEqual(fake.calls, [{ name: 'echo', args: { text: 'hi' } }])
  assert.ok(fake.sessions.includes('sess-test-1'), '后续请求必须带上 initialize 返回的 session id')
})

test('http：服务器用 SSE 回包时也能解析', async (t) => {
  const fake = await startFakeMcp({ sse: true })
  t.after(() => fake.close())

  const connection = new McpConnection({ wire: createHttpWire({ url: fake.url }), timeoutMs: 5000 })
  t.after(() => connection.close())

  const server = await connection.initialize()
  assert.equal(server.name, 'fake-mcp')
  const tools = await connection.listTools()
  assert.equal(tools.length, 2)
})

test('连不上就说清楚连的是谁，而不是一句 fetch failed', async () => {
  const connection = new McpConnection({
    wire: createHttpWire({ url: 'http://127.0.0.1:9/mcp', timeoutMs: 800 }),
    timeoutMs: 800,
  })
  await assert.rejects(() => connection.initialize(), /MCP 连不上|ECONNREFUSED|127\.0\.0\.1:9/)
  await connection.close()
})

test('未知方法回错误码，不静默吞掉', async () => {
  const wire = createStdioWire({ command: ECHO })
  const connection = new McpConnection({ wire, timeoutMs: 5000 })
  try {
    await connection.initialize()
    await assert.rejects(() => connection.request('tools/nope'), /不支持的方法|未知/)
  } finally {
    await connection.close()
  }
})

test('适配器：读工具放行、写工具要授权，参数 schema 原样透传', async (t) => {
  const fake = await startFakeMcp()
  t.after(() => fake.close())
  const manifest = findConnector('tdx')!

  const readOnly = await createMcpAdapter({ manifest, secrets: {}, url: fake.url })
  t.after(() => readOnly.close())
  assert.deepEqual(readOnly.tools.map((tool) => tool.name).sort(), ['tdx.echo'])
  assert.equal(readOnly.tools[0]!.parameters?.properties?.text?.type, 'string')
  assert.equal((await readOnly.probe()).account, 'fake-mcp 9.9.9')

  const withWrite = await createMcpAdapter({ manifest, secrets: {}, url: fake.url, allowWrite: true })
  t.after(() => withWrite.close())
  assert.deepEqual(withWrite.tools.map((tool) => tool.name).sort(), ['tdx.add_note', 'tdx.echo'])
  const note = withWrite.tools.find((tool) => tool.name === 'tdx.add_note')!
  assert.match(note.description, /写操作/)

  const out = await readOnly.tools[0]!.execute({ text: 'x' }, { ...toolCallContext })
  assert.equal(out, 'called echo')
})

test('连接器层：填了服务器地址就连真 MCP，断开后工具注销', async (t) => {
  const fake = await startFakeMcp()
  const app = await boot([designBundle])
  t.after(async () => {
    app.dispose()
    await fake.close()
  })

  const hub = app.ctx.require<ConnectorHub>('connectors')
  const tools = app.ctx.require<ToolRegistry>('tools')

  // tdx 目录里标着「演示」，但用户给了真地址 → 走真接口
  const result = await hub.connect('tdx', {}, { url: fake.url })
  assert.deepEqual(result.tools.sort(), ['tdx.echo'])
  assert.ok(tools.get('tdx.echo'), '工具应该真的注册进注册表')

  const summary = hub.summary('tdx')!
  assert.equal(summary.state, 'connected')
  assert.equal(summary.url, fake.url, '地址要能回填，重连不该再输一遍')
  assert.equal(summary.demo, true, '目录条目本身仍然是演示条目')

  const outcome = await tools.execute('tdx.echo', { text: 'hi' }, toolCallContext)
  assert.equal(outcome.isError, false)
  assert.equal(outcome.content, 'called echo')

  hub.disconnect('tdx')
  assert.equal(tools.get('tdx.echo'), undefined, '断开之后工具必须消失')
  assert.equal(hub.summary('tdx')?.url, fake.url, '断开后要记住上次填的地址，重连不用再输')
})

test('连接器层：地址是错的就给用户一句人话，不会假装连上', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())
  const hub = app.ctx.require<ConnectorHub>('connectors')

  await assert.rejects(() => hub.connect('tdx', {}, { url: 'http://127.0.0.1:9/mcp' }), /MCP 连不上|127\.0\.0\.1:9/)
  assert.equal(hub.summary('tdx')?.state, 'idle')
})

test('stdio: 前缀让用户能在界面上直接连本地 MCP 服务', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())
  const hub = app.ctx.require<ConnectorHub>('connectors')

  const result = await hub.connect('edgeone', {}, { url: 'stdio: node tools/mcp-echo.mjs' })
  assert.deepEqual(result.tools.sort(), ['edgeone.echo', 'edgeone.now'])
  assert.equal(hub.summary('edgeone')?.account, 'designbuddy-echo 0.1.0')

  const outcome = await app.ctx.require<ToolRegistry>('tools').execute('edgeone.echo', { text: '本地' }, toolCallContext)
  assert.equal(outcome.content, '本地')
  hub.disconnect('edgeone')
})

test('parseServerTarget：两种写法拆得干净', () => {
  assert.deepEqual(parseServerTarget('https://mcp.example.com/mcp'), {
    url: 'https://mcp.example.com/mcp',
    command: [],
  })
  assert.deepEqual(parseServerTarget('  stdio: node  tools/mcp-echo.mjs --flag '), {
    url: '',
    command: ['node', 'tools/mcp-echo.mjs', '--flag'],
  })
  assert.deepEqual(parseServerTarget(''), { url: '', command: [] })
  assert.deepEqual(parseServerTarget('STDIO:npx -y some-mcp'), {
    url: '',
    command: ['npx', '-y', 'some-mcp'],
  })
})
