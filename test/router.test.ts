import test from 'node:test'
import assert from 'node:assert/strict'

import type { LlmAdapter, LlmChunk, LlmRequest } from '../src/core/llm.ts'
import { collectStream, textMessage } from '../src/core/llm.ts'
import { ModelRouter } from '../src/core/router.ts'

function request(kind = 'design'): LlmRequest {
  return { kind, messages: [textMessage('user', 'hi')], tools: [] }
}

function adapter(id: string, behavior: () => AsyncGenerator<LlmChunk>): LlmAdapter {
  return { id, models: ['m1'], stream: behavior }
}

test('falls back to the next candidate when the first fails before any output', async () => {
  const router = new ModelRouter()
  router.register(
    adapter('broken', async function* () {
      throw new Error('provider 503')
    }),
  )
  router.register(
    adapter('healthy', async function* () {
      yield { type: 'text-delta', text: 'hello' }
    }),
  )
  router.setPolicy('design', ['broken', 'healthy'])

  const collected = await collectStream(router.stream(request()))
  assert.equal(collected.text, 'hello')
  assert.deepEqual(
    router.attempts.map((attempt) => [attempt.adapter, attempt.ok]),
    [
      ['broken', false],
      ['healthy', true],
    ],
  )
})

test('never replays after partial output: mid-stream failure propagates', async () => {
  const router = new ModelRouter()
  router.register(
    adapter('partial', async function* () {
      yield { type: 'text-delta', text: 'half' }
      throw new Error('connection reset')
    }),
  )
  router.register(
    adapter('healthy', async function* () {
      yield { type: 'text-delta', text: 'should not run' }
    }),
  )
  router.setPolicy('design', ['partial', 'healthy'])

  await assert.rejects(async () => {
    for await (const _chunk of router.stream(request())) {
      // consume
    }
  }, /connection reset/)

  const last = router.attempts.at(-1)
  assert.equal(last?.adapter, 'partial')
  assert.equal(last?.partial, true)
})

test('all candidates failing reports the chain', async () => {
  const router = new ModelRouter()
  for (const id of ['a', 'b']) {
    router.register(
      adapter(id, async function* () {
        throw new Error(`${id} down`)
      }),
    )
  }
  router.setPolicy('design', ['a', 'b'])

  await assert.rejects(
    async () => {
      for await (const _chunk of router.stream(request())) {
        // consume
      }
    },
    /all llm candidates failed for route "design" \(a -> b\): b down/,
  )
})

test('unknown adapters are filtered from the chain instead of failing', async () => {
  const router = new ModelRouter()
  router.register(
    adapter('real', async function* () {
      yield { type: 'text-delta', text: 'ok' }
    }),
  )
  router.setPolicy('design', ['uninstalled-cloud', 'real'])
  router.setDefaultChain(['uninstalled-cloud', 'real'])

  assert.deepEqual(router.candidatesFor('design'), ['real'])
  assert.deepEqual(router.candidatesFor('unknown-kind'), ['uninstalled-cloud', 'real'].filter((id) => id === 'real'))
})

test('a route kind with no policy uses the default chain', async () => {
  const router = new ModelRouter()
  router.register(
    adapter('a', async function* () {
      yield { type: 'text-delta', text: 'a' }
    }),
  )
  router.setDefaultChain(['a'])

  const collected = await collectStream(router.stream(request('planning')))
  assert.equal(collected.text, 'a')
})

test('with no adapters at all the router fails loudly', async () => {
  const router = new ModelRouter()
  await assert.rejects(async () => {
    for await (const _chunk of router.stream(request())) {
      // consume
    }
  }, /no llm adapter registered/)
})

test('policy and adapter registration are reversible', async () => {
  const router = new ModelRouter()
  const detach = router.register(
    adapter('a', async function* () {
      yield { type: 'text-delta', text: 'a' }
    }),
  )
  const detachPolicy = router.setPolicy('design', ['a'])
  assert.deepEqual(router.candidatesFor('design'), ['a'])

  detachPolicy()
  detach()
  assert.deepEqual(router.adapters(), [])
})
