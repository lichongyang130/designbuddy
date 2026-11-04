import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { JsonCallError, JsonClient, extractJson, hasLiveAdapter } from '../src/core/llm-json.ts'
import type { LlmChunk, LlmRequest } from '../src/core/llm.ts'
import { ModelRouter } from '../src/core/router.ts'
import { chainFor, planMounts } from '../src/core/model-runtime.ts'
import type { CustomModel } from '../src/core/models.ts'
import { outlineWithLlm, parseSections } from '../src/core/outline-llm.ts'
import { outlineFor } from '../src/core/outline.ts'
import { applyCopy, buildDeck, plan, stream } from '../src/core/deck.ts'
import { copyFor } from '../src/core/deck-copy.ts'
import { HostServer } from '../src/sdk/host.ts'
import { HostClient } from '../src/sdk/client.ts'
import { createLoopback } from '../src/sdk/protocol.ts'
import { boot } from './support/app.ts'
import { startGateway } from '../tools/llm-gateway.ts'
import { OpenAiAdapter } from '../src/plugins/openai-llm.ts'

/* ── 假适配器：不联网，但走完整的 router 路径 ─────────────── */

class ScriptedAdapter {
  readonly id: string
  readonly models: readonly string[]
  #script: string[] | (() => never)
  calls = 0

  constructor(script: string[] | (() => never), id = 'fake') {
    this.id = id
    this.models = ['fake-1']
    this.#script = script
  }

  async *stream(_request: LlmRequest): AsyncIterable<LlmChunk> {
    const index = Math.min(this.calls, (this.#script as string[]).length - 1)
    this.calls += 1
    if (typeof this.#script === 'function') (this.#script as () => never)()
    const text = (this.#script as string[])[index] ?? ''
    yield { type: 'text-delta', text }
    yield { type: 'usage', inputTokens: 12, outputTokens: 34 }
  }
}

function routerWith(adapter: { id: string; models: readonly string[]; stream(request: LlmRequest): AsyncIterable<LlmChunk> }, kind = 'planning'): ModelRouter {
  const router = new ModelRouter()
  router.register(adapter as never)
  router.setPolicy(kind, [adapter.id])
  return router
}

/* ── 1. 从脏文本里抠 JSON ─────────────────────────────── */

test('llm-json: 围栏、前后解释、字符串里的括号都能正确抠出来', () => {
  assert.equal(extractJson('```json\n{"a":1}\n```'), '{"a":1}')
  assert.equal(extractJson('好的，结果如下：{"a":{"b":"含 } 括号"}} 希望有帮助'), '{"a":{"b":"含 } 括号"}}')
  assert.equal(extractJson('[1,2,3]'), '[1,2,3]')
  assert.equal(extractJson('没有 JSON'), null)
})

/* ── 2. 模型挂载计划（P0 的纯逻辑） ─────────────────────── */

function model(overrides: Partial<CustomModel> & { id: string }): CustomModel {
  return {
    name: overrides.id,
    model: overrides.id,
    provider: '自建',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as CustomModel
}

test('model-runtime: 有地址有 Key 才挂，缺什么说清为什么', () => {
  const plan = planMounts({
    models: [
      model({ id: 'ok', baseUrl: 'https://api.test/v1', updatedAt: 3 }),
      model({ id: 'deepseek', provider: 'deepseek', updatedAt: 2 }),
      model({ id: 'nokey', baseUrl: 'https://api.test/v1', updatedAt: 1 }),
      model({ id: 'noaddr', provider: '未知供应商' }),
      model({ id: 'local', provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1' }),
    ],
    keyOf: (id) => (id === 'ok' ? 'sk-ok' : id === 'deepseek' ? 'sk-deep' : undefined),
    envOf: () => undefined,
  })

  assert.deepEqual(plan.mounts.map((entry) => entry.adapterId), ['user:ok', 'user:deepseek', 'user:local'], '按最近编辑排序')
  assert.equal(plan.mounts[1]!.baseUrl, 'https://api.deepseek.com/v1', '只填供应商就补默认地址')
  assert.equal(plan.mounts[2]!.apiKey, 'local', '本地推理服务允许没有 Key')
  const reasons = Object.fromEntries(plan.skipped.map((entry) => [entry.id, entry.reason]))
  assert.match(reasons.nokey!, /没有 Key/)
  assert.match(reasons.noaddr!, /接口地址/)
})

test('model-runtime: 环境变量里的 Key 能顶替条目自己的，链尾永远留着 mock', () => {
  const plan = planMounts({
    models: [model({ id: 'm', provider: 'deepseek', apiKeyEnv: 'MY_KEY' })],
    keyOf: () => undefined,
    envOf: (name) => (name === 'MY_KEY' ? 'sk-env' : undefined),
  })
  assert.equal(plan.mounts.length, 1)
  assert.equal(plan.mounts[0]!.apiKey, 'sk-env')
  assert.deepEqual(chainFor(plan, 'copy'), ['user:m', 'openai', 'mock-planner', 'mock-designer'])
  assert.deepEqual(chainFor(plan, 'design').slice(-2), ['mock-designer', 'mock-planner'])
})

/* ── 3. JsonClient：解析、重试、超时 ──────────────────── */

test('llm-json: 围栏里的 JSON 能解析；第一批坏、第二批好时只多打一次', async () => {
  const adapter = new ScriptedAdapter(['这不是 JSON', '```json\n{"ok":true}\n```'])
  const client = new JsonClient({ router: routerWith(adapter) })
  const result = await client.run({
    kind: 'planning',
    system: 'sys',
    user: 'user',
    parse: (raw) => {
      const body = raw as { ok?: boolean }
      if (body.ok !== true) throw new Error('缺 ok')
      return body.ok
    },
  })
  assert.equal(result.value, true)
  assert.equal(result.calls, 2, '一次坏一次好，总共两次')
  assert.equal(adapter.calls, 2)
})

test('llm-json: 一直给不出合规 JSON 就抛错，并带上原因', async () => {
  const client = new JsonClient({ router: routerWith(new ScriptedAdapter(['{}'])) })
  await assert.rejects(
    () =>
      client.run({
        kind: 'planning',
        system: 'sys',
        user: 'user',
        parse: () => {
          throw new Error('段数不对')
        },
      }),
    (error: unknown) => error instanceof JsonCallError && /段数不对/.test(error.reason),
  )
})

test('llm-json: 超时会中止并说清秒数，不会一直挂着', async () => {
  const hanging = {
    id: 'hang',
    models: ['hang-1'],
    async *stream(request: LlmRequest): AsyncIterable<LlmChunk> {
      await new Promise((_resolve, reject) => {
        request.signal?.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
      yield { type: 'text-delta', text: '' }
    },
  }
  const client = new JsonClient({ router: routerWith(hanging) })
  await assert.rejects(
    () => client.run({ kind: 'planning', system: 's', user: 'u', timeoutMs: 60, retries: 0, parse: (raw) => raw }),
    (error: unknown) => error instanceof JsonCallError && /超时/.test(error.reason),
  )
})

test('llm-json: 链上只有 mock 时不装作有模型，直接说没配', async () => {
  const router = new ModelRouter()
  router.register({ id: 'mock-planner', models: ['m'], async *stream() { yield { type: 'text-delta', text: '{}' } } } as never)
  router.setPolicy('planning', ['mock-planner'])
  const client = new JsonClient({ router })
  await assert.rejects(
    () => client.run({ kind: 'planning', system: 's', user: 'u', parse: (raw) => raw }),
    (error: unknown) => error instanceof JsonCallError && /还没有可用的模型/.test(error.reason),
  )
})

test('llm-json: 真适配器失败时把它的原因带出来，而不是含糊的「没有返回 JSON」', async () => {
  const broken = {
    id: 'user:x',
    models: ['x'],
    async *stream(): AsyncIterable<LlmChunk> {
      throw new Error('fetch failed: getaddrinfo ENOTFOUND api.example.com')
    },
  }
  const router = new ModelRouter()
  router.register(broken as never)
  router.register({ id: 'mock-planner', models: ['m'], async *stream() { yield { type: 'text-delta', text: '{}' } } } as never)
  router.setPolicy('planning', ['user:x', 'mock-planner'])
  const client = new JsonClient({ router })
  assert.deepEqual(client.liveChain('planning'), ['user:x'], 'mock 不进结构化请求的候选')
  await assert.rejects(
    () => client.run({ kind: 'planning', system: 's', user: 'u', retries: 0, parse: (raw) => raw }),
    (error: unknown) => error instanceof JsonCallError && /user:x: .*ENOTFOUND/.test(error.reason),
  )
})

test('llm-json: mock 适配器不算「接入了模型」', () => {
  const router = new ModelRouter()
  router.register({ id: 'mock-planner', models: ['m'], async *stream() {} } as never)
  router.setPolicy('planning', ['mock-planner'])
  assert.equal(hasLiveAdapter(router, 'planning'), false)
  assert.equal(hasLiveAdapter(router, 'copy'), false)
})

/* ── 4. 大纲：模型优先，不合契约必回落 ─────────────────── */

const SECTIONS = (count: number) =>
  JSON.stringify({
    title: '手机选购指南',
    sections: Array.from({ length: count }, (_, index) => ({
      title: `第 ${index + 1} 段：真的要说的那件事`,
      points: [{ text: '至少 8GB 内存、256GB 存储起步', tag: '建议' }, { text: '数据来源待补' }],
    })),
  })

test('outline-llm: 模型给的段数与要求一致时采用，并标 source=llm', async () => {
  const client = new JsonClient({ router: routerWith(new ScriptedAdapter([SECTIONS(6)])) })
  const answer = await outlineWithLlm({ prompt: '手机选购指南', kind: '文档', count: 6 }, { client })
  assert.equal(answer.source, 'llm')
  assert.equal(answer.outline.sections.length, 6)
  assert.equal(answer.outline.sections[0]!.title, '第 1 段：真的要说的那件事')
  assert.equal(answer.outline.title, '手机选购指南')
  assert.deepEqual(answer.outline.sections.map((section) => section.n), [1, 2, 3, 4, 5, 6], '编号重排')
  assert.equal(answer.outline.items.length, 6, '注入提示词的行数跟着变')
  assert.ok(answer.outline.narration[0]!.includes('6 章'), '旁白里的数量与段数一致')
})

test('outline-llm: 段数不对就不采用，回落规则模板并给出原因', async () => {
  const client = new JsonClient({ router: routerWith(new ScriptedAdapter([SECTIONS(3)])) })
  const answer = await outlineWithLlm({ prompt: '手机选购指南', kind: '文档', count: 6 }, { client })
  assert.equal(answer.source, 'rules')
  assert.match(answer.reason!, /段数/)
  assert.deepEqual(answer.outline, outlineFor({ prompt: '手机选购指南', kind: '文档', count: 6 }), '回落的就是规则模板本身')
})

test('outline-llm: 没模型时直接给规则模板，不报错也不转圈', async () => {
  const answer = await outlineWithLlm({ prompt: '季度复盘', kind: '文档' }, { client: null })
  assert.equal(answer.source, 'rules')
  assert.ok(answer.outline.sections.length > 0)
})

test('outline-llm: 契约校验拒绝空标题、超量要点和非法 tag', () => {
  assert.throws(() => parseSections({ sections: [{ title: '', points: ['x'] }] }, 1), /标题/)
  assert.throws(
    () => parseSections({ sections: [{ title: 'ok', points: ['1', '2', '3', '4', '5'] }] }, 1),
    /要点应为/,
  )
  const parsed = parseSections({ sections: [{ title: 'ok', points: [{ text: 'a', tag: '不存在的标签' }] }] }, 1)
  assert.equal(parsed.sections[0]!.points[0]!.tag, undefined, '非法 tag 丢弃，不塞进界面')
})

/* ── 5. 逐页文案：贴回骨架、容量兜底 ───────────────────── */

test('deck-copy: 文案贴到骨架上，撑爆版式就整页退回模板', () => {
  const fromPlan = plan({ prompt: '给产品团队做一份季度复盘，10页', pages: 10 })
  const deck = buildDeck(fromPlan)
  const slide = deck.slides.find((item) => Array.isArray(item.cols))
  assert.ok(slide, '需要一个三栏版式来测')

  const ok = applyCopy(slide, {
    n: 1,
    title: '模型写的标题',
    points: [{ h: '模型小标题', d: '模型写的正文，具体到可以直接上屏。' }],
  })
  assert.equal(ok.applied, true)
  assert.equal(ok.slide.title, '模型写的标题')
  assert.equal((ok.slide.cols as { t: string }[])[0]!.t, '模型小标题')

  const tooLong = applyCopy(slide, {
    n: 1,
    points: Array.from({ length: 3 }, () => ({ d: '很长的一段话'.repeat(30) })),
  })
  assert.equal(tooLong.applied, false, '超容量不硬塞')
  assert.equal(tooLong.slide, slide)
})

test('deck-copy: 模型写好的文案进生成流，事件上带着 copySource', async () => {
  const fromPlan = plan({ prompt: '给产品团队做一份季度复盘，8页', pages: 8 })
  const copy = new Map([[2, { n: 2, title: '模型写的第二页', points: [{ h: '小标题', d: '正文' }] }]])
  const events = []
  for await (const event of stream({ prompt: '给产品团队做一份季度复盘，8页', pages: 8, paceMs: 0 }, { copy, copySource: 'llm' })) {
    events.push(event)
  }
  const slides = events.filter((event) => event.type === 'deck/slide')
  assert.equal(slides.length, 8)
  assert.equal(slides[1]!.copySource, 'llm')
  assert.equal(slides[0]!.copySource, 'rules', '模型没写到的页面标 rules，不冒名')
  assert.ok(String((slides[1]!.slide as { title?: string }).title ?? '').includes('模型写的第二页'))
  assert.equal(fromPlan.outline.length, 8)
})

test('deck-copy: 一批失败只丢那一批，其它页照用', async () => {
  const fromPlan = plan({ prompt: '季度复盘', pages: 12 })
  const good = (n: number) => JSON.stringify({ pages: [{ n, title: '第 ' + n + ' 页', points: [{ d: '正文' }] }] })
  // 12 页按 5 页一批：第 1 批成功，第 2 批连坏两次（重试也救不回），第 3 批照用
  const scripted = new ScriptedAdapter([good(1), '这不是 JSON', '这不是 JSON', good(11)])
  const client = new JsonClient({ router: routerWith(scripted, 'copy'), timeoutMs: 500 })
  const answer = await copyFor(client, fromPlan, { batch: 5 })
  assert.equal(answer.source, 'llm')
  assert.ok(answer.pages.has(1), '第一批成功')
  assert.ok(!answer.pages.has(2), '第二批失败，整批丢掉')
  assert.ok(answer.pages.has(11), '第三批照用')
  assert.match(answer.reason!, /JSON|约定/, '失败原因要带回来')
})

test('联调网关：真 HTTP + 真 SSE 走完整条路（不需要外网）', async (t) => {
  const gateway = await startGateway({ port: 0 })
  t.after(() => gateway.close())
  const router = new ModelRouter()
  router.register(new OpenAiAdapter({ id: 'user:gw', baseUrl: gateway.url, apiKey: 'local', models: ['local-echo'] }))
  router.setPolicy('planning', ['user:gw', 'mock-planner'])
  const client = new JsonClient({ router, timeoutMs: 5000 })

  const answer = await outlineWithLlm({ prompt: '手机选购指南', kind: '文档', count: 6 }, { client })
  assert.equal(answer.source, 'llm', '网关回的是合规 JSON，应当采用')
  assert.equal(answer.outline.sections.length, 6)
  assert.equal(answer.model, 'local-echo')
  assert.ok(answer.ms >= 0)
})

/* ── 6. 端到端：设置里存一个模型 → 立刻挂上；错地址不炸 ── */

async function hostHarness(): Promise<{
  client: HostClient
  app: Awaited<ReturnType<typeof boot>>
}> {
  const app = await boot([])
  const { client: clientTransport, host: hostTransport } = createLoopback()
  new HostServer(app.ctx, hostTransport)
  return { client: new HostClient(clientTransport), app }
}

test('接入：设置里保存模型后立刻成为候选，删掉立刻撤销', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'db-models-'))
  process.env.DB_MODELS_FILE = join(dir, 'models.json')
  t.after(() => {
    delete process.env.DB_MODELS_FILE
  })
  const { client, app } = await hostHarness()
  t.after(() => app.dispose())

  const before = (await client.request('router.status')) as { live: boolean; adapters: { id: string }[] }
  assert.equal(before.live, false, '默认只有 mock，不能算已接入')

  const saved = (await client.request('models.save', {
    model: {
      model: 'deepseek-chat',
      name: '我的 DeepSeek',
      provider: 'deepseek',
      baseUrl: 'http://127.0.0.1:9/v1',
      apiKey: 'sk-test',
    },
  })) as { id: string; mounted: boolean }
  assert.equal(saved.mounted, true, '保存即挂载')

  const status = (await client.request('router.status')) as {
    live: boolean
    adapters: { id: string }[]
    policies: { kind: string; candidates: string[] }[]
    models: { mounted: { adapterId: string }[] } | null
  }
  assert.ok(status.adapters.some((adapter) => adapter.id === 'user:' + saved.id), '适配器真的挂上了')
  assert.equal(status.live, true)
  const planning = status.policies.find((policy) => policy.kind === 'planning')!
  assert.equal(planning.candidates[0], 'user:' + saved.id, '首选就是这个模型')
  assert.ok(planning.candidates.includes('mock-planner'), '链尾还有兜底')
  assert.ok(status.models && status.models.mounted.length === 1)

  // 地址是故意写死的死端口：调用一定失败，但大纲必须照样出来。
  const outline = (await client.request('plan.outline', { prompt: '给产品团队做一份季度复盘，10章', kind: '文档' })) as {
    source: string
    reason?: string
    count: number
    sections: unknown[]
  }
  assert.equal(outline.source, 'rules', '连不上就降级')
  assert.ok(outline.reason, '要说清为什么降级')
  assert.equal(outline.sections.length, outline.count)
  assert.equal(outline.count, 10)

  const removed = (await client.request('models.remove', { id: saved.id })) as { removed: boolean }
  assert.equal(removed.removed, true)
  const after = (await client.request('router.status')) as { live: boolean; adapters: { id: string }[] }
  assert.equal(after.live, false, '删掉之后退回 mock')
  assert.ok(!after.adapters.some((adapter) => adapter.id === 'user:' + saved.id))
})

test('接入：只填了模型名没填地址的条目不会挂上，并说清原因', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'db-models-'))
  process.env.DB_MODELS_FILE = join(dir, 'models.json')
  t.after(() => {
    delete process.env.DB_MODELS_FILE
  })
  const { client, app } = await hostHarness()
  t.after(() => app.dispose())

  const saved = (await client.request('models.save', {
    model: { model: 'my-model', name: '没填地址的', provider: '自建' },
  })) as { mounted: boolean; reason?: string }
  assert.equal(saved.mounted, false)
  assert.match(saved.reason!, /接口地址/)
})
