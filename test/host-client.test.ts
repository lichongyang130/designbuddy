import test from 'node:test'
import assert from 'node:assert/strict'

import { designBundle } from '../src/boot/profiles.ts'
import type { SessionService } from '../src/core/session.ts'
import { ClientStore, HostClient } from '../src/sdk/client.ts'
import { HostServer } from '../src/sdk/host.ts'
import type { HostFrame } from '../src/sdk/protocol.ts'
import { createLoopback } from '../src/sdk/protocol.ts'
import { boot } from './support/app.ts'

async function harness(): Promise<{
  client: HostClient
  store: ClientStore
  frames: HostFrame[]
  server: HostServer
  app: Awaited<ReturnType<typeof boot>>
}> {
  const app = await boot([designBundle])
  const { client: clientTransport, host: hostTransport } = createLoopback()
  const server = new HostServer(app.ctx, hostTransport, {
    unmount: (rowId, options) => app.unmount(rowId, options),
    rows: () =>
      app.rows.map((row) => ({
        id: row.id,
        plugin: row.plugin,
        enabled: row.enabled !== false,
        mounted: app.mounted.has(row.id),
      })),
  })
  const client = new HostClient(clientTransport)
  const store = new ClientStore()
  const frames: HostFrame[] = []
  client.onFrame((frame) => {
    frames.push(frame)
    store.apply(frame)
  })
  return { client, store, frames, server, app }
}

test('session RPC round-trips', async (t) => {
  const { client, app } = await harness()
  t.after(() => app.dispose())

  const created = (await client.request('session.create', { title: '首屏改版' })) as { id: string }
  assert.ok(created.id)

  const list = (await client.request('session.list')) as { id: string; title: string }[]
  assert.deepEqual(list.map((entry) => entry.title), ['首屏改版'])
})

test('agent.run streams both durable and live frames, then resolves', async (t) => {
  const { client, frames, app } = await harness()
  t.after(() => app.dispose())

  const created = (await client.request('session.create', { title: 'run' })) as { id: string }
  const result = await client.run({ sessionId: created.id, presetId: 'manager', prompt: '改首屏' })

  assert.equal(result.status, 'done')
  assert.ok(frames.some((frame) => frame.type === 'event'), 'expected durable session frames')
  assert.ok(frames.some((frame) => frame.type === 'agent-event'), 'expected live agent frames')
  assert.ok(
    frames.every((frame) => frame.type !== 'event' || frame.sessionId === created.id),
    'frames must stay scoped to the requested session',
  )
})

test('the client transcript comes from durable events only, so nothing duplicates', async (t) => {
  const { client, store, app } = await harness()
  t.after(() => app.dispose())

  const created = (await client.request('session.create', { title: 'projection' })) as { id: string }
  store.track(created.id)
  await client.run({ sessionId: created.id, presetId: 'manager', prompt: '改首屏' })

  const view = store.get(created.id)
  assert.ok(view)
  const userEntries = view.transcript.filter((entry) => entry.kind === 'user')
  assert.equal(userEntries.length, 1)

  const assistantEntries = view.transcript.filter((entry) => entry.kind === 'assistant')
  assert.ok(assistantEntries.length >= 2, 'multi-step turn should produce several assistant messages')

  // The projection is exactly the durable transcript: one entry per persisted
  // message, no duplication from the live delta stream.
  const sessions = app.ctx.require<SessionService>('sessions')
  const durable = sessions.messages(created.id).filter((message) => message.role !== 'system')
  assert.equal(view.transcript.length, durable.length)
  assert.equal(view.status, 'done')
  assert.equal(view.activity, null)
  assert.ok(view.steps > 0)
})

test('an unknown method answers with rpc.error instead of hanging', async (t) => {
  const { client, app } = await harness()
  t.after(() => app.dispose())

  await assert.rejects(
    () => client.request('nope' as never, {}),
    /unknown method "nope"/,
  )
})

test('tools.list reflects runtime plugin unloads', async (t) => {
  const { client, app } = await harness()
  t.after(() => app.dispose())

  const before = (await client.request('tools.list')) as { name: string }[]
  assert.ok(before.some((tool) => tool.name === 'figma.inspect_frame'))

  await app.unmount('design.figma')
  const after = (await client.request('tools.list')) as { name: string }[]
  assert.equal(after.some((tool) => tool.name === 'figma.inspect_frame'), false)
})

test('router.status exposes attempts for observability', async (t) => {
  const { client, app } = await harness()
  t.after(() => app.dispose())

  const created = (await client.request('session.create', { title: 'route' })) as { id: string }
  await client.run({ sessionId: created.id, presetId: 'manager', prompt: '改首屏' })

  const status = (await client.request('router.status')) as {
    adapters: { id: string }[]
    attempts: { adapter: string; ok: boolean }[]
  }
  assert.deepEqual(status.adapters.map((adapter) => adapter.id).sort(), ['mock-designer', 'mock-planner'])
  assert.ok(status.attempts.length > 0)
  assert.ok(status.attempts.every((attempt) => attempt.ok))
})

test('plugins.unmount refuses to strand a dependent plugin', async (t) => {
  const { client, app } = await harness()
  t.after(() => app.dispose())

  // figma injects designMemory, so a plain unload must be refused with a reason.
  await assert.rejects(() => client.request('plugins.unmount', { rowId: 'design.memory' }), /still required by figma/)
})

test('plugins.unmount cascades when the client asks for it', async (t) => {
  const { client, app } = await harness()
  t.after(() => app.dispose())

  const result = (await client.request('plugins.unmount', {
    rowId: 'design.memory',
    cascade: true,
  })) as { removed: string[] }

  assert.deepEqual(result.removed.sort(), ['design.figma', 'design.memory'])
  const tools = (await client.request('tools.list')) as { name: string }[]
  assert.equal(
    tools.some((tool) => tool.name.startsWith('memory.') || tool.name.startsWith('figma.')),
    false,
  )
})

test('plugins.rows reports the profile with mount state', async (t) => {
  const { client, app } = await harness()
  t.after(() => app.dispose())

  const rows = (await client.request('plugins.rows')) as { id: string; mounted: boolean }[]
  assert.ok(rows.length >= 10)
  assert.equal(rows.find((row) => row.id === 'design.figma')?.mounted, true)

  await app.unmount('design.figma')
  const after = (await client.request('plugins.rows')) as { id: string; mounted: boolean }[]
  assert.equal(after.find((row) => row.id === 'design.figma')?.mounted, false)
})

test('写工具先发审批帧，客户端点了允许才真的执行', async (t) => {
  const { client, frames, app } = await harness()
  t.after(() => app.dispose())

  const hub = app.ctx.require<ConnectorHub>('connectors')
  await hub.connect('notion', undefined, { allowWrite: true })

  const created = (await client.request('session.create', { title: 'approval' })) as { id: string }
  const asked: string[] = []
  const answers: unknown[] = []

  // 客户端在这里扮演「人」：看到卡片就点允许。
  const off = client.onFrame((frame) => {
    if (frame.type !== 'approval.request') return
    asked.push(frame.request.tool + ' | ' + frame.request.detail)
    void client.request('approvals.respond', { id: frame.request.id, approved: true }).then((answer) => {
      answers.push(answer)
    })
  })
  t.after(() => off())

  const result = await client.run({
    sessionId: created.id,
    presetId: 'manager',
    prompt: '@notion.create_page 帮我建一页周报',
  })

  assert.equal(result.status, 'done')
  // 专家分派会再跑一轮子循环，子循环里的写工具同样要问——所以只断言「每次都要问」。
  assert.equal(asked[0], 'notion.create_page | title = 帮我建一页周报')
  assert.ok(asked.length >= 1)
  assert.ok(asked.every((line) => line.startsWith('notion.create_page | ')))
  assert.equal(answers.length, asked.length)
  assert.ok(answers.every((answer) => (answer as { accepted: boolean }).accepted === true))

  const call = frames.find(
    (frame) =>
      frame.type === 'agent-event' &&
      frame.event.type === 'agent/tool-result' &&
      frame.event.name === 'notion.create_page',
  )
  assert.ok(call, '应该有一条 notion.create_page 的工具结果帧')
  const outcome = call.type === 'agent-event' && call.event.type === 'agent/tool-result' ? call.event : null
  assert.equal(outcome?.isError, false, '允许之后工具真的执行了')
  assert.match(String(outcome?.content), /demo/)
})

test('approvals.respond 认不出过期 id 时返回 accepted:false', async (t) => {
  const { client, app } = await harness()
  t.after(() => app.dispose())

  const answer = (await client.request('approvals.respond', { id: 'ap-never-existed', approved: true })) as {
    id: string
    accepted: boolean
  }
  assert.deepEqual(answer, { id: 'ap-never-existed', accepted: false })
})
