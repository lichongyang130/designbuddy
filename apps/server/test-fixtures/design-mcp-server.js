#!/usr/bin/env node
/**
 * A tiny MCP server used by the tests (and handy for demos):
 * it exposes one read tool that returns canned design review data.
 *
 * Speaks newline-delimited JSON-RPC 2.0 over stdio, the same transport the
 * real MCP servers use, so the client under test talks to a real process.
 */
const readline = require('node:readline')

const TOOLS = [
  {
    name: 'list_reviews',
    description: '列出最近的界面评审记录',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: '返回条数' } },
    },
  },
]

const REVIEWS = [
  { id: 'R-104', screen: 'checkout/地址填写', verdict: 'blur 后错误提示不持久', at: '2026-10-28' },
  { id: 'R-105', screen: 'settings/权限', verdict: '危险操作缺少二次确认', at: '2026-10-30' },
  { id: 'R-106', screen: 'onboarding/首次引导', verdict: '跳过按钮不可见', at: '2026-10-31' },
]

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

const rl = readline.createInterface({ input: process.stdin })

rl.on('line', (line) => {
  const text = line.trim()
  if (!text) return
  let message
  try {
    message = JSON.parse(text)
  } catch {
    return
  }
  if (message.id === undefined) return // notification

  const reply = (result) => send({ jsonrpc: '2.0', id: message.id, result })
  const fail = (code, msg) => send({ jsonrpc: '2.0', id: message.id, error: { code, message: msg } })

  switch (message.method) {
    case 'initialize':
      return reply({
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'design-fixture', version: '0.1.0' },
      })
    case 'tools/list':
      return reply({ tools: TOOLS })
    case 'tools/call': {
      const { name, arguments: args = {} } = message.params ?? {}
      if (name !== 'list_reviews') return fail(-32601, `unknown tool ${name}`)
      const limit = Number(args.limit ?? REVIEWS.length)
      return reply({
        content: [{ type: 'text', text: JSON.stringify(REVIEWS.slice(0, limit), null, 2) }],
      })
    }
    default:
      return fail(-32601, `unknown method ${message.method}`)
  }
})

rl.on('close', () => process.exit(0))
