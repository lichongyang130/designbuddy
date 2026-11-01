import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import type { Context } from '@designbuddy/core'
import type { ToolsService } from '@designbuddy/tools'
import { bootTestApp, waitFor } from './harness'

const FIXTURE = join(__dirname, '..', '..', 'test-fixtures', 'design-mcp-server.js')

async function withServer(ctx: Context, readOnly: boolean): Promise<ToolsService> {
  const tools = ctx.get<ToolsService>('tools')!
  ctx.plugin(
    (await import('@designbuddy/mcp')) as any,
    {
      servers: JSON.stringify([
        { name: 'design', command: process.execPath, args: [FIXTURE], readOnly },
      ]),
    },
  )
  await waitFor(() => tools.list().some((tool) => tool.name.startsWith('mcp__design__')))
  return tools
}

test('an MCP server becomes tools with namespaced names and schemas', async () => {
  const { ctx, dispose } = bootTestApp()
  try {
    const tools = await withServer(ctx, true)
    const tool = tools.get('mcp__design__list_reviews')
    assert.ok(tool, 'mcp tool should be registered')
    assert.equal(tool!.scope, 'read')
    assert.match(tool!.description, /^\[MCP:design\]/)
    assert.deepEqual(Object.keys((tool!.parameters as any).properties), ['limit'])

    const outcome = await tools.execute(
      { id: 'c1', name: 'mcp__design__list_reviews', arguments: { limit: 1 } },
      { sessionId: 's', agent: 'host', ctx },
    )
    assert.equal(outcome.ok, true)
    assert.match(outcome.output, /R-104/)
    assert.doesNotMatch(outcome.output, /R-105/)
  } finally {
    dispose()
  }
})

test('MCP tools respect the policy gate unless the server is readOnly', async () => {
  const { ctx, dispose } = bootTestApp()
  try {
    const tools = await withServer(ctx, false)
    assert.equal(tools.get('mcp__design__list_reviews')!.scope, 'write')

    const policy = ctx.get<any>('policy')
    const running = tools.execute(
      { id: 'c2', name: 'mcp__design__list_reviews', arguments: {} },
      { sessionId: 's', agent: 'host', ctx },
    )
    await waitFor(() => policy.pendingRequests().length === 1)
    assert.equal(policy.pendingRequests()[0].tool, 'mcp__design__list_reviews')
    policy.decide(policy.pendingRequests()[0].id, false)

    const outcome = await running
    assert.equal(outcome.ok, false)
    assert.match(outcome.error!, /没有批准/)
  } finally {
    dispose()
  }
})

test('unloading the mcp plugin removes its tools and stops the child process', async () => {
  const { ctx, dispose } = bootTestApp()
  try {
    const tools = await withServer(ctx, true)
    assert.ok(tools.get('mcp__design__list_reviews'))

    ctx.container.remove('mcp')
    assert.equal(tools.get('mcp__design__list_reviews'), undefined)
    assert.equal(ctx.get('mcp'), undefined)
  } finally {
    dispose()
  }
})

test('a broken MCP server logs and leaves the app running', async () => {
  const { ctx, dispose } = bootTestApp()
  try {
    ctx.plugin((await import('@designbuddy/mcp')) as any, {
      servers: JSON.stringify([{ name: 'broken', command: process.execPath, args: ['-e', 'process.exit(3)'] }]),
    })
    await waitFor(() => ctx.container.logs.some((entry) => /broken.*连接失败/.test(entry.message)))
    const tools = ctx.get<ToolsService>('tools')!
    assert.equal(tools.list().some((tool) => tool.name.startsWith('mcp__broken__')), false)
    assert.ok(ctx.get('agentLoop'), 'the rest of the app is untouched')
  } finally {
    dispose()
  }
})
