import test from 'node:test'
import assert from 'node:assert/strict'

import { applyPatches, flatten } from '../src/boot/loader.ts'
import type { Profile } from '../src/boot/loader.ts'
import { coreBundle, designBundle } from '../src/boot/profiles.ts'
import type { AgentPresetRegistry } from '../src/core/agent.ts'
import type { SystemPromptService } from '../src/core/prompt.ts'
import type { DesignMemoryService } from '../src/plugins/design-memory.ts'
import type { ToolRegistry } from '../src/core/tools.ts'
import { boot } from './support/app.ts'

test('design-memory contributes a service, a prompt section and two tools', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())

  const memory = app.ctx.get<DesignMemoryService>('designMemory')
  assert.ok(memory, 'service should be registered')
  assert.equal(memory.list().length >= 2, true, 'seeded decisions should be present')

  const tools = app.ctx.require<ToolRegistry>('tools')
  assert.deepEqual(
    tools
      .list()
      .map((tool) => tool.name)
      .filter((name) => name.startsWith('memory.'))
      .sort(),
    ['memory.recall', 'memory.save'],
  )

  const prompt = await app.ctx.require<SystemPromptService>('systemPrompt').build(app.ctx)
  assert.match(prompt, /设计记忆/)
})

test('unloading design-memory removes every trace of it', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())

  // figma injects designMemory, so a plain unload must be refused.
  await assert.rejects(() => app.unmount('design.memory'), /still required by figma/)

  await app.unmount('design.memory', { cascade: true })
  assert.equal(app.ctx.has('designMemory'), false)

  const tools = app.ctx.require<ToolRegistry>('tools')
  assert.equal(
    tools.list().some((tool) => tool.name.startsWith('memory.')),
    false,
  )

  const prompt = await app.ctx.require<SystemPromptService>('systemPrompt').build(app.ctx)
  assert.doesNotMatch(prompt, /设计记忆/)
})

test('reinstalling a plugin restores its registrations', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())

  await app.unmount('design.figma')
  const tools = app.ctx.require<ToolRegistry>('tools')
  assert.equal(tools.has('figma.inspect_frame'), false)

  const row = app.rows.find((candidate) => candidate.id === 'design.figma')!
  app.mount(row)
  await app.settle()
  assert.equal(tools.has('figma.inspect_frame'), true)
})

test('a preset override is undone when the overriding plugin unloads', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())

  const presets = app.ctx.require<AgentPresetRegistry>('agents')
  const original = presets.require('manager')
  assert.equal(original.maxSteps, 8)

  const overlay = app.ctx.plugin({
    name: 'manager-override',
    inject: ['agents'],
    apply: (ctx) => {
      const registry = ctx.require<AgentPresetRegistry>('agents')
      ctx.effect(() =>
        registry.register(
          { ...original, name: '设计经理（实验版）', maxSteps: 3 },
          { override: true },
        ),
      )
    },
  })
  await app.settle()
  assert.equal(presets.require('manager').maxSteps, 3)

  await overlay.dispose()
  assert.equal(presets.require('manager').maxSteps, 8)
  assert.equal(presets.require('manager').name, '设计经理')
})

test('profile patches replace config and can insert rows', () => {
  const profile: Profile = { name: 'test', bundles: [coreBundle] }
  const rows = flatten(profile)
  assert.ok(rows.length > 0)

  const patched = applyPatches(rows, [
    { id: 'core.tools', config: { maxOutputChars: 100 } },
    { id: 'extra.model', plugin: 'mock-llm', config: { plan: [] } },
  ])

  assert.deepEqual(
    patched.find((row) => row.id === 'core.tools')?.config,
    { maxOutputChars: 100 },
  )
  assert.ok(patched.some((row) => row.id === 'extra.model'))
})

test('a patch that targets nothing and inserts nothing is a boot error', () => {
  assert.throws(() => applyPatches([], [{ id: 'ghost' }]), /does not declare a plugin/)
})

test('disabled rows are dropped before mounting', () => {
  const profile: Profile = {
    name: 'test',
    bundles: [
      {
        name: 'b',
        rows: [
          { id: 'a', plugin: 'core-tools' },
          { id: 'b', plugin: 'core-llm', enabled: false },
        ],
      },
    ],
  }
  assert.deepEqual(
    flatten(profile).map((row) => row.id),
    ['a'],
  )
})

test('a missing plugin module is reported, not fatal', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())

  const mounted = app.mount({ id: 'ghost.row', plugin: 'not-installed' })
  assert.equal(mounted, null)
  assert.equal(app.skipped.length, 1)
  assert.match(app.skipped[0]!.reason, /not installed/)
})
