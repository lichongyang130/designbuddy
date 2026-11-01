import test from 'node:test'
import assert from 'node:assert/strict'

import type { AgentEvent, AgentLoop } from '../src/core/agent.ts'
import { AgentPresetRegistry } from '../src/core/agent.ts'
import type { SessionService } from '../src/core/session.ts'
import type { ToolRegistry } from '../src/core/tools.ts'
import { designBundle } from '../src/boot/profiles.ts'
import { boot } from './support/app.ts'

async function drain(loop: AgentLoop, options: Parameters<AgentLoop['run']>[0]): Promise<AgentEvent[]> {
  const events: AgentEvent[] = []
  for await (const event of loop.run(options)) events.push(event)
  return events
}

test('a manager turn runs tools, delegates to an expert, and ends clean', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())

  const sessions = app.ctx.require<SessionService>('sessions')
  const loop = app.ctx.require<AgentLoop>('agentLoop')
  const session = sessions.create({ title: 'manager' })

  const events = await drain(loop, {
    sessionId: session.id,
    presetId: 'manager',
    prompt: '首屏改版：主色偏暗、标题层级不够，帮我定方案',
  })

  const end = events.at(-1)
  assert.equal(end?.type, 'agent/end')
  assert.equal(end?.type === 'agent/end' && end.status, 'done')

  const toolCalls = events.filter((event) => event.type === 'agent/tool-call')
  assert.ok(toolCalls.length >= 4, `expected the full tool chain, saw ${toolCalls.length}`)
  assert.ok(
    events.some((event) => event.type === 'agent/tool-call' && event.call.name === 'expert.consult'),
    'manager should delegate',
  )

  // Durable facts, not just live events.
  const types = sessions.events(session.id).map((event) => event.type)
  assert.ok(types.includes('tool/call'))
  assert.ok(types.includes('tool/result'))
  assert.ok(types.includes('agent/end'))

  // The expert ran in a forked session so the manager transcript stays clean.
  assert.equal(sessions.list().length, 2)
  const child = sessions.list().find((candidate) => candidate.id !== session.id)
  assert.match(child!.title, /视觉设计专家/)
})

test('an expert only sees the tools its preset allows', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())

  const presets = app.ctx.require<AgentPresetRegistry>('agents')
  const visual = presets.require('visual')
  assert.deepEqual(visual.tools, ['figma.inspect_frame'])

  const tools = app.ctx.require<ToolRegistry>('tools')
  assert.deepEqual(
    tools.schemas(visual.tools).map((schema) => schema.name),
    ['figma.inspect_frame'],
  )

  // Therefore an expert cannot recurse into another expert.
  const sessions = app.ctx.require<SessionService>('sessions')
  const loop = app.ctx.require<AgentLoop>('agentLoop')
  const session = sessions.create({ title: 'visual' })
  const events = await drain(loop, { sessionId: session.id, presetId: 'visual', prompt: '配色建议' })
  assert.equal(
    events.some((event) => event.type === 'agent/tool-call' && event.call.name === 'expert.consult'),
    false,
  )
})

test('the loop reports failure when it exhausts maxSteps', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())

  const presets = app.ctx.require<AgentPresetRegistry>('agents')
  presets.register({ id: 'impatient', name: '急躁', role: 'test', kind: 'design', tools: ['memory.recall'], maxSteps: 1 })

  const sessions = app.ctx.require<SessionService>('sessions')
  const loop = app.ctx.require<AgentLoop>('agentLoop')
  const session = sessions.create({ title: 'maxsteps' })

  const events = await drain(loop, { sessionId: session.id, presetId: 'impatient', prompt: '查一下主色' })
  const end = events.at(-1)
  assert.equal(end?.type === 'agent/end' && end.status, 'failed')
  assert.match(end?.type === 'agent/end' ? (end.reason ?? '') : '', /max steps/)
})

test('an already-aborted signal ends the turn without calling the model', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())

  const sessions = app.ctx.require<SessionService>('sessions')
  const loop = app.ctx.require<AgentLoop>('agentLoop')
  const session = sessions.create({ title: 'abort' })
  const controller = new AbortController()
  controller.abort()

  const events = await drain(loop, {
    sessionId: session.id,
    presetId: 'manager',
    prompt: '随便问问',
    signal: controller.signal,
  })
  const end = events.at(-1)
  assert.equal(end?.type === 'agent/end' && end.status, 'failed')
  assert.equal(end?.type === 'agent/end' && end.reason, 'aborted')
})

test('an unknown preset fails with the available list', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())

  const sessions = app.ctx.require<SessionService>('sessions')
  const loop = app.ctx.require<AgentLoop>('agentLoop')
  const session = sessions.create({ title: 'unknown' })

  await assert.rejects(
    () => drain(loop, { sessionId: session.id, presetId: 'ghost', prompt: 'hi' }),
    /unknown agent preset "ghost"/,
  )
})

test('the system prompt only describes what is mounted', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())

  const prompt = await app.ctx.require<import('../src/core/prompt.ts').SystemPromptService>('systemPrompt').build(app.ctx)
  assert.match(prompt, /设计记忆/)
  assert.match(prompt, /品牌主色 #1F6FEB/)

  await app.unmount('design.memory', { cascade: true })
  const after = await app.ctx.require<import('../src/core/prompt.ts').SystemPromptService>('systemPrompt').build(app.ctx)
  assert.doesNotMatch(after, /设计记忆/)
})
