#!/usr/bin/env node
/**
 * 一个最小的 MCP 服务器（stdio 传输），用来验证连接器那条通道。
 *
 * 为什么仓库里要带这个：`mcp` 适配器最怕「代码写了但从没和真服务器握过手」。
 * 有了它，`npm test` 就能 spawn 一个真进程、走真 JSON-RPC，而不是 mock 掉一切；
 * 你自己想手动试也能直接连：
 *
 *   1. 连接器 → 任意标着「MCP」的条目 → 服务器地址填 `stdio:node tools/mcp-echo.mjs`
 *   2. 或者在代码里 `openMcp({ transport: 'stdio', command: ['node', 'tools/mcp-echo.mjs'] })`
 *
 * 它只实现协议里必须的那几个方法，外加三个工具：
 *   - `echo`（只读）：把 text 原样回来
 *   - `now`（只读）：当前时间
 *   - `add_note`（写）：存一条笔记，用来验证写操作确认
 *
 * 协议版本、能力、分页都按 2025-06-18 的写法来，别在这里偷懒。
 */

import { createInterface } from 'node:readline'

const PROTOCOL_VERSION = '2025-06-18'
const notes = []

const TOOLS = [
  {
    name: 'echo',
    description: '把输入的文本原样返回，用来确认通道是通的',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: '要回显的文本' } },
      required: ['text'],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'now',
    description: '返回当前时间（ISO 8601）',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_note',
    description: '记一条笔记（写操作：会让 Agent 先问你一次）',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: '笔记内容' } },
      required: ['text'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
]

const send = (message) => {
  process.stdout.write(JSON.stringify(message) + '\n')
}

const ok = (id, result) => send({ jsonrpc: '2.0', id, result })
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } })

function callTool(name, args) {
  if (name === 'echo') return { content: [{ type: 'text', text: String(args.text ?? '') }] }
  if (name === 'now') return { content: [{ type: 'text', text: new Date().toISOString() }] }
  if (name === 'add_note') {
    notes.push(String(args.text ?? ''))
    return { content: [{ type: 'text', text: '已记下第 ' + notes.length + ' 条笔记' }] }
  }
  return null
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })
lines.on('line', (line) => {
  const trimmed = line.trim()
  if (trimmed === '') return
  let message
  try {
    message = JSON.parse(trimmed)
  } catch {
    return // 非 JSON 直接忽略，和真服务器一样宽容
  }
  const { id, method, params } = message ?? {}

  if (method === undefined) return // 客户端发来的响应，这个服务器不主动发起请求

  if (method === 'initialize') {
    ok(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'designbuddy-echo', version: '0.1.0' },
      instructions: '这是一个用来验证 MCP 通道的示例服务器。',
    })
    return
  }
  if (method === 'notifications/initialized') return
  if (method === 'ping') {
    ok(id, {})
    return
  }
  if (method === 'tools/list') {
    ok(id, { tools: TOOLS })
    return
  }
  if (method === 'tools/call') {
    const result = callTool(String(params?.name ?? ''), params?.arguments ?? {})
    if (!result) {
      fail(id, -32602, '没有这个工具：' + String(params?.name ?? ''))
      return
    }
    ok(id, result)
    return
  }
  if (id !== undefined) fail(id, -32601, '不支持的方法：' + method)
})

lines.on('close', () => process.exit(0))
