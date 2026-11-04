import test from 'node:test'
import assert from 'node:assert/strict'

import { JsonClient } from '../src/core/llm-json.ts'
import type { LlmChunk, LlmRequest } from '../src/core/llm.ts'
import { ModelRouter } from '../src/core/router.ts'
import { parsePlan, planWithLlm } from '../src/core/deck-plan-llm.ts'
import { parseIssues, reviewWithLlm } from '../src/core/deck-review.ts'
import { plan, stream } from '../src/core/deck.ts'
import type { DeckEvent } from '../src/core/deck.ts'
import { DeckEngine } from '../src/plugins/deck-engine.ts'
import { OpenAiAdapter } from '../src/plugins/openai-llm.ts'
import { startGateway } from '../tools/llm-gateway.ts'
import type { UsageService } from '../src/core/usage.ts'
import { HostServer } from '../src/sdk/host.ts'
import { HostClient } from '../src/sdk/client.ts'
import { createLoopback } from '../src/sdk/protocol.ts'
import { boot } from './support/app.ts'

const PROMPT = '给产品团队做一份季度复盘，8页'

class Scripted {
  readonly id = 'fake'
  readonly models = ['fake-1']
  calls = 0
  #script: string[]

  constructor(script: string[]) {
    this.#script = script
  }

  async *stream(_request: LlmRequest): AsyncIterable<LlmChunk> {
    const text = this.#script[Math.min(this.calls, this.#script.length - 1)] ?? ''
    this.calls += 1
    yield { type: 'text-delta', text }
    yield { type: 'usage', inputTokens: 40, outputTokens: 80 }
  }
}

function clientWith(script: string[]): JsonClient {
  const router = new ModelRouter()
  router.register(new Scripted(script) as never)
  router.setPolicy('planning', ['fake'])
  router.setPolicy('copy', ['fake'])
  return new JsonClient({ router, timeoutMs: 1000 })
}

function pagesFor(count: number, prefix = '模型写的第'): string {
  return JSON.stringify({
    narrative: '目标 → 进展 → 数据 → 问题 → 下一步',
    pages: Array.from({ length: count }, (_, index) => ({
      n: index + 1,
      topic: `${prefix}${index + 1}页`,
      goal: `让受众明白第 ${index + 1} 件事`,
    })),
  })
}

/* ── 1. 大纲：模型只改「讲什么」，版式和角色不动 ─────────── */

test('deck 大纲：模型改 topic / goal / narrative，角色与版式原样保留', async () => {
  const base = plan({ prompt: PROMPT })
  const answer = await planWithLlm({ prompt: PROMPT }, clientWith([pagesFor(base.outline.length)]))
  assert.equal(answer.source, 'llm')
  assert.equal(answer.plan.outline.length, base.outline.length, '页数不变')
  assert.deepEqual(
    answer.plan.outline.map((item) => item.layout),
    base.outline.map((item) => item.layout),
    '版式是规则定的，模型不许动',
  )
  assert.deepEqual(
    answer.plan.outline.map((item) => item.role),
    base.outline.map((item) => item.role),
  )
  assert.equal(answer.plan.outline[0]!.topic, '模型写的第1页')
  assert.ok(answer.plan.narrative.includes('目标'), '叙事主线用模型那句')
  assert.equal(answer.plan.brief.topic, base.brief.topic, '需求分析还是规则算的')
})

test('deck 大纲：页数对不上就整份退回规则，并带回原因', async () => {
  const base = plan({ prompt: PROMPT })
  const answer = await planWithLlm({ prompt: PROMPT }, clientWith([pagesFor(base.outline.length + 2)]))
  assert.equal(answer.source, 'rules')
  assert.match(answer.reason!, /页数/)
  assert.deepEqual(answer.plan, base)
})

test('deck 大纲：没有模型时就是规则那一份，不多花一次调用', async () => {
  const base = plan({ prompt: PROMPT })
  const answer = await planWithLlm({ prompt: PROMPT }, null)
  assert.equal(answer.source, 'rules')
  assert.equal(answer.calls, undefined)
  assert.deepEqual(answer.plan, base)
})

test('deck 大纲：契约拦住重复编号、越界编号和超长 topic', () => {
  assert.throws(
    () => parsePlan({ pages: [{ n: 1, topic: 'a', goal: 'b' }, { n: 1, topic: 'c', goal: 'd' }] }, 2),
    /重复/,
  )
  assert.throws(
    () => parsePlan({ pages: [{ n: 1, topic: 'a', goal: 'b' }, { n: 3, topic: 'c', goal: 'd' }] }, 2),
    /越界/,
  )
  assert.throws(() => parsePlan({ pages: [{ n: 1, topic: '一'.repeat(30), goal: 'b' }] }, 1), /过长/)
})

/* ── 2. 生成照着「确认过的那份计划」走 ───────────────────── */

test('deck 生成：传入的计划就是逐页生成用的那份，不会被重新算掉', async () => {
  const base = plan({ prompt: PROMPT })
  const custom = {
    ...base,
    outline: base.outline.map((item) => ({ ...item, topic: '改过的第' + item.n + '页' })),
  }
  const events: DeckEvent[] = []
  for await (const event of stream({ prompt: PROMPT, paceMs: 0 }, { plan: custom, planSource: 'llm' })) {
    events.push(event)
  }
  const planEvent = events.find((event) => event.type === 'deck/plan')
  assert.ok(planEvent && planEvent.type === 'deck/plan')
  assert.equal(planEvent.upgraded, true, '模型改过的大纲要标出来，界面据此允许覆盖一次')
  assert.equal(planEvent.plan.outline[0]!.topic, '改过的第1页')
  const slides = events.filter((event) => event.type === 'deck/slide')
  assert.equal(slides.length, base.outline.length)
})

/* ── 3. 引擎：大纲升级 + 文案 + 记账 ─────────────────────── */

test('deck 引擎：先出模型大纲，再逐页出片；两次调用都记进用量', async (t) => {
  const gateway = await startGateway({ port: 0 })
  t.after(() => gateway.close())
  const router = new ModelRouter()
  router.register(new OpenAiAdapter({ id: 'user:gw', baseUrl: gateway.url, apiKey: 'local', models: ['local-echo'] }))
  router.setPolicy('planning', ['user:gw'])
  router.setPolicy('copy', ['user:gw'])
  const client = new JsonClient({ router, timeoutMs: 5000 })

  const recorded: { model: string; status: string }[] = []
  const engine = new DeckEngine({
    paceMs: 0,
    planUpgrade: (request) => planWithLlm(request, client),
    copy: (fromPlan) => import('../src/core/deck-copy.ts').then(({ copyFor }) => copyFor(client, fromPlan)),
    onCopy: (_id, answer) => recorded.push({ model: answer.model ?? '?', status: answer.source }),
  })
  t.after(() => engine.dispose())

  const events: DeckEvent[] = []
  engine.onEvent((_record, event) => events.push(event))
  const { id, plan: started } = engine.start({ prompt: PROMPT, mode: 'plan' })
  await new Promise((resolve) => setTimeout(resolve, 300))
  engine.build(id)
  await new Promise((resolve) => setTimeout(resolve, 800))

  const planEvents = events.filter((event) => event.type === 'deck/plan')
  assert.ok(planEvents.length >= 1)
  const upgraded = planEvents[planEvents.length - 1]!
  assert.equal(upgraded.type === 'deck/plan' && upgraded.upgraded, true, '大纲应该是模型改过的那版')
  const slides = events.filter((event) => event.type === 'deck/slide')
  assert.equal(slides.length, started.outline.length)
  assert.ok(slides.every((slide) => slide.type === 'deck/slide' && slide.copySource === 'llm'))
  assert.equal(recorded.length, 1, '文案这一步要报一次来源')
  assert.equal(recorded[0]!.status, 'llm')
})

/* ── 3b. 主观审核：只挑问题，绝不采信编出来的数字 ────────── */

test('deck 审核：模型编的数字、越界页、超长话术一律丢掉', () => {
  const allowed = new Set(['12'])
  const issues = parseIssues(
    {
      issues: [
        { page: 2, message: '这一页的主张看不出要做什么' },
        { page: 3, message: '转化率下降了 30%' },
        { page: 99, message: '第 99 页有问题' },
        { page: 4, message: '一'.repeat(80) },
        { page: 2, message: '这一页的主张看不出要做什么' },
      ],
    },
    8,
    allowed,
  )
  assert.deepEqual(issues.map((issue) => issue.page), [2], '只留下有依据、指得到页、说得完的那条')
  assert.equal(issues[0]!.level, 'warn')
})

test('deck 审核：模型提的问题并进 deck/qa，规则项还在', async () => {
  const base = plan({ prompt: PROMPT })
  const events: DeckEvent[] = []
  for await (const event of stream(
    { prompt: PROMPT, paceMs: 0 },
    {
      review: async () => [{ level: 'warn', page: 2, code: 'thin', message: '第 2 页和第 3 页在说同一件事', fixed: false }],
    },
  )) {
    events.push(event)
  }
  const qa = events.find((event) => event.type === 'deck/qa')
  assert.ok(qa && qa.type === 'deck/qa')
  assert.ok(qa.issues.some((issue) => issue.message.includes('说同一件事')), '模型那条要在')
  const slides = events.filter((event) => event.type === 'deck/slide')
  assert.equal(slides.length, base.outline.length, '审核不影响出片')
})

test('deck 审核：模型给不出合规 JSON 就当没提过，出片不受影响', async () => {
  const client = clientWith(['这不是 JSON'])
  const base = plan({ prompt: PROMPT })
  const deck = (await import('../src/core/deck.ts')).buildDeck(base)
  const answer = await reviewWithLlm(base, deck, client)
  assert.equal(answer.source, 'rules')
  assert.deepEqual(answer.issues, [])
  assert.ok(answer.reason)
})

/* ── 4. 用量：模型调用真的进了账 ─────────────────────────── */

test('用量：大纲由模型写时，usage 里按模型记了一次', async (t) => {
  const gateway = await startGateway({ port: 0 })
  t.after(() => gateway.close())
  const app = await boot([])
  // 先让运行时对齐一次（它会把策略改成 catalog 里的链），再挂测试用的网关：
  // 反过来的话，sync 会把刚设好的策略覆盖掉。
  if (app.ctx.has('modelRuntime')) app.ctx.require<{ sync(force?: boolean): unknown }>('modelRuntime').sync(true)
  const router = app.ctx.require<ModelRouter>('llm')
  router.register(new OpenAiAdapter({ id: 'user:gw', baseUrl: gateway.url, apiKey: 'local', models: ['local-echo'] }))
  router.setPolicy('planning', ['user:gw'])
  const { client: clientTransport, host: hostTransport } = createLoopback()
  new HostServer(app.ctx, hostTransport)
  const client = new HostClient(clientTransport)
  t.after(() => app.dispose())

  const outline = (await client.request('plan.outline', { prompt: '手机选购指南', kind: '文档' })) as {
    source: string
    model?: string
  }
  assert.equal(outline.source, 'llm', '网关在，应该走模型')
  assert.equal(outline.model, 'local-echo')

  const usage = app.ctx.require<UsageService>('usage').summary()
  const row = usage.models.find((entry) => entry.model === 'local-echo')
  assert.ok(row, '用量里应该有这个模型')
  assert.ok(row.runs >= 1)
  assert.ok(row.tokens > 0, 'token 数要能算出来')
})
