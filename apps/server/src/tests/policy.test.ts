import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AgentLoopService } from '@designbuddy/agents'
import type { SessionService } from '@designbuddy/session'
import type { ToolsService } from '@designbuddy/tools'
import { PolicyService } from '@designbuddy/policy'
import { bootTestApp, waitFor } from './harness'

function boot() {
  const { ctx, dispose } = bootTestApp()
  return {
    ctx,
    dispose,
    sessions: ctx.get<SessionService>('sessions')!,
    loop: ctx.get<AgentLoopService>('agentLoop')!,
    tools: ctx.get<ToolsService>('tools')!,
    policy: ctx.get<PolicyService>('policy')!,
  }
}

function toolResult(ctx: any, sessionId: string) {
  return ctx
    .get('sessions')
    .get(sessionId)
    .events.map((entry: any) => entry.event)
    .find((event: any) => event.type === 'tool-result')
}

test('a write tool blocks inside the executor until a human approves it', async () => {
  const { ctx, sessions, loop, policy, dispose } = boot()
  assert.equal(policy.mode, 'approve-writes')

  const session = sessions.create({ model: 'mock/designer', agent: 'host' })
  const running = loop.run({ sessionId: session.id, input: '记住：正文对比度至少 7:1' })

  await waitFor(() => policy.pendingRequests().length === 1)
  const [request] = policy.pendingRequests()
  assert.equal(request.tool, 'memory.save')
  assert.equal(request.scope, 'write')

  policy.decide(request.id, true)
  await running

  const result = toolResult(ctx, session.id)
  assert.equal(result.ok, true)
  assert.match(result.result, /已记住/)
  assert.equal(ctx.get('memory').all().some((entry: any) => entry.text.includes('7:1')), true)
  dispose()
})

test('a denied approval reaches the model as a tool error, not a crash', async () => {
  const { ctx, sessions, loop, policy, dispose } = boot()
  const session = sessions.create({ model: 'mock/designer', agent: 'host' })
  const running = loop.run({ sessionId: session.id, input: '记住：导航最多两级' })

  await waitFor(() => policy.pendingRequests().length === 1)
  policy.decide(policy.pendingRequests()[0].id, false)
  const turn = await running

  assert.equal(turn.reason, 'stop')
  const result = toolResult(ctx, session.id)
  assert.equal(result.ok, false)
  assert.match(result.error, /没有批准/)
  assert.equal(ctx.get('memory').all().length, 0)
  dispose()
})

test('session-local tools are allowlisted and never ask for approval', async () => {
  const { ctx, sessions, loop, policy, dispose } = boot()
  const session = sessions.create({ model: 'mock/designer', agent: 'host' })

  // plan.* writes only session state, so the default allowlist covers it.
  const turn = await loop.run({ sessionId: session.id, input: '帮我规划一下步骤' })
  assert.equal(turn.reason, 'stop')
  assert.equal(policy.pendingRequests().length, 0)
  assert.equal(toolResult(ctx, session.id).ok, true)
  assert.equal(ctx.get('plan').get(session.id).length, 4)
  dispose()
})

test('readonly mode denies without queueing an approval', async () => {
  const { ctx, sessions, loop, policy, dispose } = boot()
  policy.setMode('readonly')
  const session = sessions.create({ model: 'mock/designer', agent: 'host' })

  await loop.run({ sessionId: session.id, input: '记住：按钮最小点击区 44px' })
  assert.equal(policy.pendingRequests().length, 0)
  const result = toolResult(ctx, session.id)
  assert.equal(result.ok, false)
  assert.match(result.error, /只读模式/)
  dispose()
})

test('an unanswered approval times out as a denial', async () => {
  const { ctx, tools, dispose } = boot()
  const policy = new PolicyService(ctx, tools, 'approve-writes', 30, [])
  const denial = await policy.guard().before!(
    { id: 'c1', name: 'fs.write', arguments: { path: 'x.md', content: 'y' } },
    { sessionId: 's', agent: 'host', ctx },
  )
  assert.match(String(denial), /没有批准/)
  dispose()
})
