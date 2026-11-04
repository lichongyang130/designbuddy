/**
 * 浏览器中转：服务端出不了网时，让用户自己的浏览器替它发这一次请求。
 *
 * 这些用例守住三件事：
 *   1. 帧里**没有** authorization——Key 不经过服务端；
 *   2. 整条链路（适配器 → 中转 → 「浏览器」→ 真 HTTP → 回传 → SSE 解析）能通；
 *   3. 页面没开、超时、回话对不上号时，都给出人话而不是挂住。
 *
 * @module designbuddy/test/llm-relay
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { BrowserRelay } from '../src/core/llm-relay.ts'
import type { RelayAskFrame } from '../src/core/llm-relay.ts'
import { OpenAiAdapter } from '../src/plugins/openai-llm.ts'
import { planMounts } from '../src/core/model-runtime.ts'
import { startGateway } from '../tools/llm-gateway.ts'

test('中转：页面没连上时立刻报错，并告诉用户该怎么办', async () => {
  const relay = new BrowserRelay()
  await assert.rejects(() => relay.fetch('https://api.example.com/v1/chat/completions', { method: 'POST' }), /没有页面连着/)
  assert.equal(relay.stats().online, false)
})

test('中转：请求头里不会带 authorization，回话能拼出 Response', async () => {
  const relay = new BrowserRelay()
  const seen: RelayAskFrame[] = []
  const off = relay.attach({
    send: (frame) => {
      const ask = frame as unknown as RelayAskFrame
      seen.push(ask)
      // 「浏览器」下一拍回话
      queueMicrotask(() => relay.reply({ id: ask.id, status: 200, body: 'pong' }))
    },
  })

  const response = await relay.fetch('https://api.example.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer sk-should-not-travel' },
    body: '{"a":1}',
  })

  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'pong')
  assert.equal(seen.length, 1)
  assert.equal(seen[0]!.headers.authorization, undefined, 'Key 不能跟着帧走到服务端')
  assert.equal(seen[0]!.headers['content-type'], 'application/json')
  assert.equal(seen[0]!.body, '{"a":1}')
  assert.deepEqual(relay.stats(), { online: true, calls: 1, failures: 0, lastError: '' })

  off()
  assert.equal(relay.stats().online, false, '连接关掉就不能再当中转')
})

test('中转：超时、乱回话、浏览器报错，都有明确的下场', async () => {
  const relay = new BrowserRelay({ timeoutMs: 30 })
  relay.attach({ send: () => {} })
  await assert.rejects(() => relay.fetch('https://api.example.com/v1/chat/completions'), /没有回话/)
  assert.match(relay.stats().lastError, /没有回话/)
  assert.equal(relay.reply({ id: 'relay-does-not-exist', status: 200, body: '' }), false, '对不上号的回话要被拒掉')

  const relay2 = new BrowserRelay()
  relay2.attach({
    send: (frame) => {
      const ask = frame as unknown as RelayAskFrame
      queueMicrotask(() => relay2.reply({ id: ask.id, error: '浏览器直连被拦住了（最常见的是这个接口没开 CORS）' }))
    },
  })
  await assert.rejects(() => relay2.fetch('https://api.example.com/v1/chat/completions'), /没开 CORS/)
})

test('中转：适配器 → 中转 → 浏览器 → 真 HTTP，整条链路能拿到模型输出', async (t) => {
  const gateway = await startGateway({ port: 0, chunkDelayMs: 0 })
  t.after(() => gateway.close())

  const relay = new BrowserRelay()
  relay.attach({
    // 测试里用真 fetch 冒充浏览器：真实浏览器也是在页面里 fetch 一下再回话。
    send: (frame) => {
      const ask = frame as unknown as RelayAskFrame
      void (async () => {
        try {
          const response = await fetch(ask.url, {
            method: ask.method,
            headers: { ...ask.headers, authorization: 'Bearer local' },
            body: ask.body,
          })
          relay.reply({
            id: ask.id,
            status: response.status,
            body: await response.text(),
            headers: { 'content-type': response.headers.get('content-type') ?? '' },
          })
        } catch (error) {
          relay.reply({ id: ask.id, error: error instanceof Error ? error.message : String(error) })
        }
      })()
    },
  })

  const adapter = new OpenAiAdapter({
    id: 'user:relayed',
    baseUrl: gateway.url,
    apiKey: 'browser',
    models: ['local-echo'],
    fetchImpl: (input, init) => relay.fetch(String(input), init),
  })

  let text = ''
  for await (const chunk of adapter.stream({
    model: 'local-echo',
    messages: [{ id: 'm1', role: 'user', content: [{ type: 'text', text: '你好' }], at: Date.now() }],
    tools: [],
  })) {
    if (chunk.type === 'text-delta') text += chunk.text
  }
  assert.ok(text.length > 0, '中转回来的 SSE 要被解析成文本，否则中转等于没通')
  assert.equal(relay.stats().calls, 1)
})

test('挂载计划：标了浏览器直连的模型，没有服务端 Key 也能挂上', () => {
  const plan = planMounts({
    models: [
      {
        id: 'relay-deepseek',
        name: 'deepseek 直连',
        model: 'deepseek-chat',
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        transport: 'browser',
        createdAt: 1,
        updatedAt: 2,
      },
    ],
    keyOf: () => undefined,
    envOf: () => undefined,
  })
  assert.equal(plan.mounts.length, 1)
  assert.equal(plan.mounts[0]!.transport, 'browser')
  assert.equal(plan.mounts[0]!.apiKey, 'browser')
  assert.equal(plan.skipped.length, 0)
})
