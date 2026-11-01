import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp, type Plugin } from '@designbuddy/core'

test('a plugin can provide a service and is torn down on unload', () => {
  const { ctx } = createApp()
  const plugin: Plugin = {
    name: 'demo',
    apply(ctx) {
      ctx.set('demo', { hello: () => 'world' })
      ctx.effect(() => ctx.emit('demo/disposed'))
    },
  }

  let disposed = 0
  ctx.on('demo/disposed', () => disposed++)

  ctx.plugin(plugin)
  assert.equal(ctx.get<any>('demo').hello(), 'world')
  assert.equal(ctx.container.inspect()[0].state, 'active')

  ctx.container.remove('demo')
  assert.equal(ctx.get('demo'), undefined)
  assert.equal(disposed, 1)
})

test('a dependent plugin suspends when its dependency unloads and resumes when it returns', () => {
  const { ctx } = createApp()
  const phases: string[] = []

  ctx.plugin({
    name: 'store',
    apply: (ctx) => {
      ctx.set('store', { value: 42 })
    },
  })

  ctx.plugin({
    name: 'consumer',
    inject: ['store'],
    apply: (ctx) => {
      phases.push(`active:${ctx.get<any>('store').value}`)
    },
  })

  assert.deepEqual(phases, ['active:42'])
  assert.equal(ctx.container.find('consumer')!.state, 'active')

  ctx.container.remove('store')
  assert.equal(ctx.container.find('consumer')!.state, 'pending')

  ctx.plugin({
    name: 'store',
    apply: (ctx) => {
      ctx.set('store', { value: 7 })
    },
  })
  assert.deepEqual(phases, ['active:42', 'active:7'])
})

test('plugin config is merged with schema defaults and can be reloaded', () => {
  const { ctx } = createApp()
  const seen: Array<Record<string, unknown>> = []
  const plugin: Plugin = {
    name: 'configurable',
    Config: [
      { key: 'port', label: 'port', type: 'number', default: 8080 },
      { key: 'mode', label: 'mode', type: 'string', default: 'fast' },
    ],
    apply: (_ctx, config) => {
      seen.push(config)
    },
  }

  ctx.plugin(plugin, { mode: 'careful' })
  assert.deepEqual(seen[0], { port: 8080, mode: 'careful' })

  ctx.plugin(plugin, { port: '9090' })
  assert.deepEqual(seen[1], { port: 9090, mode: 'careful' })
})
