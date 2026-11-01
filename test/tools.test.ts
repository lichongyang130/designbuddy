import test from 'node:test'
import assert from 'node:assert/strict'

import { ToolRegistry } from '../src/core/tools.ts'
import type { JsonSchema } from '../src/core/schema.ts'
import { toolCallContext } from './support/app.ts'

const schema: JsonSchema = {
  type: 'object',
  properties: {
    frameId: { type: 'string' },
    depth: { type: 'integer' },
  },
  required: ['frameId'],
}

test('unknown tool is rejected before any user code runs', async () => {
  const tools = new ToolRegistry()
  const outcome = await tools.execute('nope', {}, toolCallContext)
  assert.equal(outcome.isError, true)
  assert.equal(outcome.rejectedAt, 'lookup')
})

test('missing required arguments are reported without calling execute', async () => {
  const tools = new ToolRegistry()
  let called = false
  tools.register({
    name: 'frame',
    description: 'read a frame',
    parameters: schema,
    execute: () => {
      called = true
      return 'ok'
    },
  })

  const outcome = await tools.execute('frame', {}, toolCallContext)
  assert.equal(called, false)
  assert.equal(outcome.isError, true)
  assert.equal(outcome.rejectedAt, 'validate')
  assert.match(outcome.content, /frameId is required/)
})

test('wrong argument type is rejected', async () => {
  const tools = new ToolRegistry()
  tools.register({
    name: 'frame',
    description: 'read a frame',
    parameters: schema,
    execute: () => 'ok',
  })

  const outcome = await tools.execute('frame', { frameId: 'a', depth: 1.5 }, toolCallContext)
  assert.equal(outcome.rejectedAt, 'validate')
  assert.match(outcome.content, /expected integer/)
})

test('a guard can deny a call and the reason reaches the model', async () => {
  const tools = new ToolRegistry()
  let executed = false
  tools.register({
    name: 'write',
    description: 'writes files',
    execute: () => {
      executed = true
      return 'written'
    },
  })
  const detach = tools.addGuard((name) => (name === 'write' ? '当前会话只读，禁止写入' : null), 'readonly')

  const denied = await tools.execute('write', {}, toolCallContext)
  assert.equal(executed, false)
  assert.equal(denied.rejectedAt, 'policy')
  assert.match(denied.content, /只读/)

  detach()
  const allowed = await tools.execute('write', {}, toolCallContext)
  assert.equal(allowed.isError, false)
  assert.equal(executed, true)
})

test('a guard that throws becomes a denial, not a crash', async () => {
  const tools = new ToolRegistry()
  tools.register({ name: 'x', description: 'x', execute: () => 'ok' })
  tools.addGuard(() => {
    throw new Error('guard exploded')
  }, 'broken')

  const outcome = await tools.execute('x', {}, toolCallContext)
  assert.equal(outcome.rejectedAt, 'policy')
  assert.match(outcome.content, /guard exploded/)
})

test('a slow tool times out and the loop keeps going', async () => {
  const tools = new ToolRegistry()
  tools.register({
    name: 'slow',
    description: 'slow',
    timeoutMs: 10,
    execute: () => new Promise((resolve) => setTimeout(() => resolve('late'), 100)),
  })

  const outcome = await tools.execute('slow', {}, toolCallContext)
  assert.equal(outcome.isError, true)
  assert.equal(outcome.rejectedAt, 'timeout')
})

test('a throwing tool becomes an error result the model can read', async () => {
  const tools = new ToolRegistry()
  tools.register({
    name: 'boom',
    description: 'boom',
    execute: () => {
      throw new Error('network down')
    },
  })

  const outcome = await tools.execute('boom', {}, toolCallContext)
  assert.equal(outcome.isError, true)
  assert.match(outcome.content, /network down/)
  assert.equal(outcome.rejectedAt, undefined)
})

test('long output is truncated and marked', async () => {
  const tools = new ToolRegistry()
  tools.register({
    name: 'verbose',
    description: 'verbose',
    maxOutputChars: 20,
    execute: () => 'x'.repeat(100),
  })

  const outcome = await tools.execute('verbose', {}, toolCallContext)
  assert.equal(outcome.truncated, true)
  assert.match(outcome.content, /truncated 80 chars/)
})

test('schemas() narrows to a preset toolset', () => {
  const tools = new ToolRegistry()
  tools.register({ name: 'a', description: 'a', execute: () => '' })
  tools.register({ name: 'b', description: 'b', execute: () => '' })

  assert.deepEqual(
    tools.schemas(['a']).map((schema) => schema.name),
    ['a'],
  )
  assert.deepEqual(
    tools.schemas().map((schema) => schema.name).sort(),
    ['a', 'b'],
  )
})

test('duplicate registration and unregistration are symmetric', () => {
  const tools = new ToolRegistry()
  const detach = tools.register({ name: 'a', description: 'a', execute: () => '' })
  assert.throws(() => tools.register({ name: 'a', description: 'a', execute: () => '' }), /already registered/)
  detach()
  assert.equal(tools.has('a'), false)
})
