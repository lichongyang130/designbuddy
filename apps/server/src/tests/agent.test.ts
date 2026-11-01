import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Plugin } from '@designbuddy/core'
import type { AgentLoopService, AgentService } from '@designbuddy/agents'
import type { SessionService } from '@designbuddy/session'
import type { SystemPromptService } from '@designbuddy/system-prompt'
import type { ToolsService } from '@designbuddy/tools'
import { createApplication } from '../app'

function boot() {
  const app = createApplication({ serve: false })
  const ctx = app.ctx
  return {
    app,
    ctx,
    sessions: ctx.get<SessionService>('sessions')!,
    agents: ctx.get<AgentService>('agents')!,
    loop: ctx.get<AgentLoopService>('agentLoop')!,
    prompt: ctx.get<SystemPromptService>('systemPrompt')!,
    tools: ctx.get<ToolsService>('tools')!,
  }
}

test('the loop records a full turn: user, tool call, tool result, assistant', async () => {
  const { ctx, sessions, loop } = boot()
  const session = sessions.create({ model: 'mock/designer', agent: 'host' })

  const result = await loop.run({ sessionId: session.id, input: '帮我规划一下首页改版的步骤' })
  assert.equal(result.reason, 'stop')
  assert.ok(result.steps >= 1)

  const types = sessions.get(session.id)!.events.map((entry) => entry.event.type)
  assert.deepEqual(types, ['turn-start', 'user', 'tool-call', 'tool-result', 'assistant', 'turn-end'])

  const toolResult = sessions
    .get(session.id)!
    .events.map((entry) => entry.event)
    .find((event) => event.type === 'tool-result') as any
  assert.equal(toolResult.ok, true)
  assert.match(toolResult.result, /计划已更新/)

  // The plan tool wrote live state, not just a message.
  const plan = ctx.get<any>('plan')
  assert.equal(plan.get(session.id).length, 4)
  ctx.container.stop()
})

test('an expert allowlist hides tools from the model', async () => {
  const { ctx, sessions, loop } = boot()
  const session = sessions.create({ model: 'mock/designer', agent: 'critic' })
  await loop.run({ sessionId: session.id, input: '帮我把计划写出来' })

  const calls = sessions
    .get(session.id)!
    .events.map((entry) => entry.event)
    .filter((event) => event.type === 'tool-call') as any[]
  assert.equal(calls.length, 0, 'critic cannot call plan.write')
  ctx.container.stop()
})

test('memory entries reach the prompt through a plugin-contributed section', async () => {
  const { ctx, prompt } = boot()
  const memory = ctx.get<any>('memory')
  memory.add({ text: '移动端首屏只允许一个主要行动', kind: 'constraint', tags: ['mobile'] })

  const text = await prompt.assemble({ sessionId: 's', agent: 'host', input: '移动端首屏怎么改？' })
  assert.match(text, /移动端首屏只允许一个主要行动/)
  assert.equal(prompt.ids().includes('memory'), true)

  // Unloading memory removes both the data and its prompt section.
  ctx.container.remove('memory')
  const after = await prompt.assemble({ sessionId: 's', agent: 'host', input: '移动端首屏怎么改？' })
  assert.doesNotMatch(after, /移动端首屏只允许一个主要行动/)
  ctx.container.stop()
})

test('tool guards are enforced in the executor, not the prompt', async () => {
  const { ctx, loop, sessions } = boot()
  ctx.plugin({
    name: 'read-only-guard',
    inject: ['tools'],
    apply: (ctx) => {
      ctx.get<ToolsService>('tools')!.use({
        before: (call) => (call.name === 'plan.write' ? 'demo is read-only' : undefined),
      })
    },
  } as Plugin)

  const session = sessions.create({ model: 'mock/designer', agent: 'host' })
  await loop.run({ sessionId: session.id, input: '帮我规划步骤' })

  const result = sessions
    .get(session.id)!
    .events.map((entry) => entry.event)
    .find((event) => event.type === 'tool-result') as any
  assert.equal(result.ok, false)
  assert.match(result.error, /read-only/)
  ctx.container.stop()
})
