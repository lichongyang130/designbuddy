import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ToolsService } from '@designbuddy/tools'
import { createApplication } from '../app'

test('unloading a shared service cascades through the real composition', () => {
  const { ctx } = createApplication({ serve: false })
  const container = ctx.container
  const tools = ctx.get<ToolsService>('tools')!

  assert.ok(tools.list().some((tool) => tool.name === 'fs.read'))
  assert.equal(container.find('tool-fs')!.state, 'active')

  container.remove('tools')

  // Every tool plugin depended on `tools`, so all of them are parked, ready to
  // come back — no error state, no restart needed.
  for (const name of ['tool-fs', 'tool-memory', 'tool-plan', 'tool-skill', 'tool-agent']) {
    assert.equal(container.find(name)!.state, 'pending', `${name} should be pending`)
  }
  assert.equal(ctx.get('tools'), undefined)

  ctx.plugin({
    name: 'tools',
    apply: (ctx) => {
      ctx.set('tools', tools)
    },
  })
  assert.equal(container.find('tool-fs')!.state, 'active')
  assert.ok(ctx.get<ToolsService>('tools')!.list().some((tool) => tool.name === 'fs.write'))

  container.stop()
})

test('the agent loop refuses to run two turns on one session', async () => {
  const { ctx } = createApplication({ serve: false })
  const sessions = ctx.get<any>('sessions')
  const loop = ctx.get<any>('agentLoop')
  const session = sessions.create({ model: 'mock/designer', agent: 'host' })

  const first = loop.run({ sessionId: session.id, input: '看看项目里有什么' })
  await assert.rejects(
    () => loop.run({ sessionId: session.id, input: '再来一次' }),
    /already running a turn/,
  )
  await first
  ctx.container.stop()
})
