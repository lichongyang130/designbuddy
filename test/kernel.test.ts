import test from 'node:test'
import assert from 'node:assert/strict'

import { createContext, Logger } from '../src/kernel/index.ts'

const silent = () => new Logger('silent')

test('a plugin with an unmet inject stays pending, then activates after the provider', async () => {
  const ctx = createContext({ logger: silent() })
  const order: string[] = []

  const consumer = ctx.plugin({
    name: 'consumer',
    inject: ['svc'],
    apply: () => {
      order.push('consumer')
    },
  })
  assert.equal(consumer.state, 'pending')

  ctx.plugin({
    name: 'provider',
    apply: (c) => {
      c.provide('svc', { value: 1 })
      order.push('provider')
    },
  })

  await ctx.settle()
  assert.deepEqual(order, ['provider', 'consumer'])
  assert.equal(consumer.state, 'active')
})

test('settle() resolves only after downstream plugins have run', async () => {
  const ctx = createContext({ logger: silent() })
  const seen: string[] = []

  ctx.plugin({
    name: 'consumer',
    inject: ['svc'],
    apply: () => {
      seen.push('consumer')
    },
  })
  ctx.plugin({
    name: 'provider',
    apply: (c) => {
      c.provide('svc', 1)
    },
  })

  // The regression this guards: settle() used to return early on re-entry, so
  // callers observed a half-built tree.
  await ctx.settle()
  assert.deepEqual(seen, ['consumer'])
})

test('effects unwind LIFO and a returned disposer runs before them', async () => {
  const ctx = createContext({ logger: silent() })
  const events: string[] = []

  const fiber = ctx.plugin({
    name: 'p',
    apply: (c) => {
      c.effect(() => {
        events.push('e1')
        return () => events.push('e1-')
      })
      c.effect(() => {
        events.push('e2')
        return () => events.push('e2-')
      })
      return () => {
        events.push('returned')
      }
    },
  })

  await ctx.settle()
  await fiber.dispose()
  assert.deepEqual(events, ['e1', 'e2', 'returned', 'e2-', 'e1-'])
})

test('children unload before their parent unwinds its own effects', async () => {
  const ctx = createContext({ logger: silent() })
  const events: string[] = []

  const parent = ctx.plugin({
    name: 'parent',
    apply: (c) => {
      c.effect(() => {
        events.push('parent-setup')
        return () => events.push('parent-cleanup')
      })
      c.plugin({
        name: 'child',
        apply: () => {
          events.push('child-setup')
          return () => events.push('child-cleanup')
        },
      })
    },
  })

  await ctx.settle()
  await parent.dispose()
  assert.deepEqual(events, ['parent-setup', 'child-setup', 'child-cleanup', 'parent-cleanup'])
  assert.equal(ctx.has('nonexistent'), false)
})

test('shadowing a service restores the previous value on unload', async () => {
  const ctx = createContext({ logger: silent() })

  ctx.plugin({ name: 'base', apply: (c) => c.provide('svc', 'base') })
  await ctx.settle()
  assert.equal(ctx.get('svc'), 'base')

  const overlay = ctx.plugin({ name: 'overlay', apply: (c) => c.provide('svc', 'overlay') })
  await ctx.settle()
  assert.equal(ctx.get('svc'), 'overlay')

  await overlay.dispose()
  assert.equal(ctx.get('svc'), 'base')
})

test('a plugin that throws is recorded, disposed, and does not abort the tree', async () => {
  const ctx = createContext({ logger: silent() })
  ctx.plugin({ name: 'healthy', apply: (c) => c.provide('ok', true) })
  const bad = ctx.plugin({
    name: 'bad',
    apply: () => {
      throw new Error('boom')
    },
  })

  await ctx.settle()
  assert.equal(bad.state, 'disposed')
  assert.equal(ctx.get('ok'), true)
  assert.equal(ctx.registry.errors.length, 1)
  assert.match(ctx.registry.errors[0]!.message, /boom/)
})

test('dependentsOf exposes who would break if a provider unloaded', async () => {
  const ctx = createContext({ logger: silent() })
  const provider = ctx.plugin({ name: 'provider', apply: (c) => c.provide('svc', 1) })
  ctx.plugin({ name: 'consumer', inject: ['svc'], apply: () => {} })
  await ctx.settle()

  assert.deepEqual(ctx.registry.servicesOwnedBy(provider), ['svc'])
  assert.deepEqual(
    ctx.registry.dependentsOf(provider).map((fiber) => fiber.label),
    ['consumer'],
  )
})

test('listeners are removed with their plugin', async () => {
  const ctx = createContext({ logger: silent() })
  const seen: string[] = []

  const fiber = ctx.plugin({
    name: 'listener',
    apply: (c) => {
      c.on('tick', () => {
        seen.push('tick')
      })
    },
  })
  await ctx.settle()
  await ctx.emit('tick')
  await fiber.dispose()
  await ctx.emit('tick')

  assert.deepEqual(seen, ['tick'])
})
