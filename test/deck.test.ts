import test from 'node:test'
import assert from 'node:assert/strict'

import {
  analyze,
  audit,
  buildDeck,
  deckId,
  outline,
  pagesOf,
  plan,
  repair,
  revise,
  score,
  seeded,
  stream,
  textOfSlide,
} from '../src/core/deck.ts'
import type { DeckEvent, GeneratedDeck } from '../src/core/deck.ts'
import { DeckEngine } from '../src/plugins/deck-engine.ts'
import { designBundle } from '../src/boot/profiles.ts'
import { HostClient } from '../src/sdk/client.ts'
import { HostServer } from '../src/sdk/host.ts'
import { createLoopback } from '../src/sdk/protocol.ts'
import type { HostFrame } from '../src/sdk/protocol.ts'
import { boot } from './support/app.ts'

const PROMPT = '帮我制作一份关于 AI 智能办公产品的商业发布会 PPT，15 页，科技未来感，面向客户和投资人。'

/** 收完一条生成流的全部事件。 */
async function collect(request: Parameters<typeof stream>[0]): Promise<DeckEvent[]> {
  const out: DeckEvent[] = []
  for await (const event of stream({ ...request, paceMs: 0 })) out.push(event)
  return out
}

test('需求分析：主题、用途、受众、页数、风格都从一句话里读出来', () => {
  const brief = analyze({ prompt: PROMPT })
  assert.equal(brief.topic, 'AI 智能办公产品')
  assert.equal(brief.purpose, 'launch', '「商业发布会」优先判断为发布，而不是融资')
  assert.equal(brief.audience, '客户和投资人', '沿用用户原话里的受众')
  assert.equal(brief.pages, 15)
  assert.equal(brief.styleKey, 'dark-tech')
  assert.deepEqual(brief.keys.slice(0, 2), ['AI', '智能办公产品'])
})

test('需求分析：页数被夹在 8–30，没写就用 15', () => {
  assert.equal(analyze({ prompt: '季度汇报' }).pages, 15)
  assert.equal(analyze({ prompt: '季度汇报', pages: 3 }).pages, 8)
  assert.equal(analyze({ prompt: '季度汇报', pages: 99 }).pages, 30)
})

test('需求分析：句子里写的页数优先用，照样夹在 8–30', () => {
  assert.equal(pagesOf('给产品团队做一份季度复盘，10页'), 10, '「10页」以前被当成壳子剥掉，一律出 15 页')
  assert.equal(pagesOf('做一份 8 页的融资路演材料'), 8)
  assert.equal(pagesOf('20 页的季度方案'), 20)
  assert.equal(pagesOf('3 页的短稿'), 8, '低于 8 页抬到 8')
  assert.equal(pagesOf('40 页的年度报告'), 30, '高于 30 页压到 30')
  assert.equal(pagesOf('季度汇报'), 15, '没写页数还是 15')
  assert.equal(pagesOf('10 页', 22), 22, '调用方明确给了页数就以调用方为准')
})

test('需求分析：主题只留名词短语，命令词和格式词都不进主题', () => {
  const cases: [string, string][] = [
    ['给产品团队做一份季度复盘，10页', '季度复盘'],
    ['帮我做一份发布会 PPT', '发布会'],
    ['为新员工写一份产品使用手册', '产品使用手册'],
    ['做一份 8 页的融资路演材料，面向投资人', '融资路演'],
  ]
  for (const [prompt, topic] of cases) assert.equal(analyze({ prompt }).topic, topic, prompt)
  assert.equal(analyze({ prompt: '给产品团队做一份季度复盘，10页' }).audience, '产品团队')
  assert.equal(analyze({ prompt: '为新员工写一份产品使用手册' }).audience, '新员工')
  assert.equal(analyze({ prompt: '帮我做一份发布会 PPT' }).audience, '客户与投资人', '没有受众时退回默认值，不能把「帮我」当受众')
})

test('生成：句子里写 10 页就出 10 页', async () => {
  const events = await collect({ prompt: '给产品团队做一份季度复盘，10页', mode: 'express' })
  const done = events.find((event) => event.type === 'deck/done')
  assert.ok(done && done.type === 'deck/done', '没有 deck/done')
  assert.equal(done.deck.slides.length, 10)
  assert.equal(done.deck.name, '季度复盘', '封面标题是主题本身，不是整句需求')
})

test('大纲：页数对得上，开场固定第一页、行动号召固定最后一页', () => {
  for (const pages of [8, 15, 22, 30]) {
    const brief = analyze({ prompt: PROMPT, pages })
    const items = outline(brief)
    assert.equal(items.length, pages, `${pages} 页`)
    assert.equal(items[0]!.role, 'open')
    assert.equal(items[items.length - 1]!.role, 'cta')
    assert.deepEqual(items.map((item) => item.n), items.map((_, index) => index + 1))
  }
})

test('每一页都有独立的信息价值和版式理由', () => {
  const fromPlan = plan({ prompt: PROMPT })
  for (const item of fromPlan.outline) {
    assert.ok(item.topic.length > 2, `第 ${item.n} 页没主题`)
    assert.ok(item.goal.length > 6, `第 ${item.n} 页没说清目的`)
    assert.ok(item.why.length > 8, `第 ${item.n} 页没说清为什么用这个版式`)
  }
  // 15 页里不能 15 个都一个版式
  assert.ok(new Set(fromPlan.outline.map((item) => item.layout)).size >= 6)
})

test('同一句需求永远生成同一份稿子（可复现）', () => {
  const a = buildDeck(plan({ prompt: PROMPT }))
  const b = buildDeck(plan({ prompt: PROMPT }))
  assert.deepEqual(a.slides, b.slides)
  assert.equal(a.id, b.id)
  assert.match(deckId(analyze({ prompt: PROMPT })), /^gen-[a-z0-9]+$/)
  assert.equal(seeded('abc', 1, 0, 100), seeded('abc', 1, 0, 100))
})

test('15 页：页数、封面封面页、数据页都在，审核零问题', () => {
  const fromPlan = plan({ prompt: PROMPT })
  const deck = buildDeck(fromPlan)
  assert.equal(deck.slides.length, 15)
  assert.equal(deck.slides[0]!.k, 'cover')
  assert.equal(deck.slides[14]!.k, 'end')
  assert.ok(deck.slides.some((slide) => ['stats', 'bars', 'metric', 'table'].includes(slide.k)), '至少一页数据')
  const issues = audit(deck, fromPlan.brief)
  assert.deepEqual(issues, [])
  assert.equal(score(issues), 100)
})

test('审核真的会抓到问题：溢出、太薄、重复、没有数据页', () => {
  const fromPlan = plan({ prompt: PROMPT })
  const deck = buildDeck(fromPlan)
  const broken: GeneratedDeck = {
    ...deck,
    slides: deck.slides.map((slide, index) => {
      if (index === 2) return { ...slide, title: '很长'.repeat(300) } as typeof slide
      if (index === 6) return { k: 'quote', label: '空页', text: '短' } as typeof slide
      // 整页替换（不是 spread）：要测的是「两页几乎一样」，不是「一页字段多」
      if (index === 8) return { k: 'table', label: '重复 A', head: ['科目'], rows: [['同一句话']] } as typeof slide
      if (index === 9) return { k: 'table', label: '重复 B', head: ['科目'], rows: [['同一句话']] } as typeof slide
      return { ...slide, k: index === 1 ? 'columns' : slide.k }
    }),
  }
  const issues = audit(broken, fromPlan.brief)
  const codes = issues.map((issue) => issue.code)
  assert.ok(codes.includes('overflow'), '超长文案要被抓到')
  assert.ok(codes.includes('thin'), '太空的一页要被抓到')
  assert.ok(codes.includes('duplicate'), '几乎一样的两页要被抓到')
  assert.ok(score(issues) < 100)
})

test('修一轮：能修的标记 fixed，分数回升，页数不变', () => {
  const fromPlan = plan({ prompt: PROMPT })
  const deck = buildDeck(fromPlan)
  const broken: GeneratedDeck = {
    ...deck,
    slides: deck.slides.map((slide, index) =>
      index === 2 ? ({ ...slide, title: '很长'.repeat(300) } as typeof slide) : slide,
    ),
  }
  const before = audit(broken, fromPlan.brief)
  assert.ok(before.length > 0)
  const { deck: fixedDeck, issues } = repair(broken, fromPlan.brief)
  assert.equal(fixedDeck.slides.length, 15)
  assert.ok(issues.some((issue) => issue.fixed), '至少修掉一处')
  assert.ok(score(issues) >= score(before), '修完不能更低')
  assert.ok(textOfSlide(fixedDeck.slides[2]!).length < 600, '修完要短下来')
})

test('事件流：计划 → 逐页 → 审核 → 完成，顺序和界面要画的一样', async () => {
  const events = await collect({ prompt: PROMPT })
  const types = events.map((event) => event.type)
  assert.equal(types[0], 'deck/stage')
  assert.ok(types.includes('deck/plan'), '要先给计划')
  assert.ok(types.includes('deck/thinking'), '要有思考摘要')
  const slides = events.filter((event) => event.type === 'deck/slide')
  assert.equal(slides.length, 15, '每一页都要推一次')
  assert.equal(types.indexOf('deck/plan') < types.indexOf('deck/slide'), true)
  assert.equal(types.indexOf('deck/qa') < types.indexOf('deck/done'), true)
  const done = events.at(-1)
  assert.equal(done?.type, 'deck/done')
  if (done?.type === 'deck/done') assert.equal(done.deck.slides.length, 15)
})

test('express 模式跳过资料研究，research 模式有独立的研究阶段', async () => {
  const express = await collect({ prompt: PROMPT, mode: 'express' })
  const research = await collect({ prompt: PROMPT, mode: 'research' })
  const hasResearchStage = (events: DeckEvent[]) =>
    events.some((event) => event.type === 'deck/stage' && event.id === 'research' && event.status === 'done' && /关键词/.test(String(event.detail ?? '')))
  assert.equal(hasResearchStage(express), false)
  assert.equal(hasResearchStage(research), true)
})

test('局部修改：只改点名的页，其他页一个字不动', () => {
  const fromPlan = plan({ prompt: PROMPT })
  const deck = buildDeck(fromPlan)
  const before = JSON.stringify(deck.slides[4])

  const result = revise(deck, fromPlan, '把第 3 页改得更有冲击力')
  assert.deepEqual(result.indexes, [2])
  assert.equal(JSON.stringify(result.deck.slides[3]), JSON.stringify(deck.slides[3]), '第 4 页不该动')
  assert.equal(JSON.stringify(result.deck.slides[4]), before, '第 5 页不该动')

  const chart = revise(deck, fromPlan, '把第 3 页改成流程图')
  assert.equal(chart.deck.slides[2]!.k, 'steps')

  const whole = revise(deck, fromPlan, '整体换成深色科技风')
  assert.equal(whole.indexes.length, deck.slides.length)
  assert.equal(whole.deck.paper, '#0b1220')

  const missed = revise(deck, fromPlan, '再好看一点')
  assert.deepEqual(missed.indexes, [])
  assert.match(missed.summary, /第 3 页/)
})

test('引擎：订阅能收到整条流，结果留在内存里可以再取', async (t) => {
  const engine = new DeckEngine({ paceMs: 0 })
  t.after(() => engine.dispose())

  const seen: string[] = []
  const stop = engine.onEvent((record, event) => {
    seen.push(event.type)
    assert.equal(record.id.length > 0, true)
  })
  const { id } = engine.start({ prompt: PROMPT, mode: 'express' })
  await new Promise((resolve) => setTimeout(resolve, 600))
  stop()

  assert.ok(seen.includes('deck/plan'))
  assert.ok(seen.includes('deck/slide'))
  assert.ok(seen.includes('deck/done'))
  const record = engine.get(id)
  assert.equal(record?.status, 'done')
  assert.equal(record?.deck?.slides.length, 15)

  const revised = engine.revise(id, '第 2 页换成数据')
  assert.ok(revised.indexes.length > 0)
  assert.equal(engine.get(id)?.deck?.slides.length, 15)
})

test('引擎：还没生成完就改会明确报错，而不是改一份空稿', (t) => {
  const engine = new DeckEngine({ paceMs: 5 })
  t.after(() => engine.dispose())
  const { id } = engine.start({ prompt: PROMPT })
  assert.throws(() => engine.revise(id, '第 1 页改一下'), /还没生成完/)
})

test('端到端：RPC 开生成 → deck-event 帧逐页到达 → 计划/完成都对得上', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())
  const { client: clientTransport, host: hostTransport } = createLoopback()
  const server = new HostServer(app.ctx, hostTransport)
  const client = new HostClient(clientTransport)
  const frames: HostFrame[] = []
  client.onFrame((frame) => frames.push(frame))

  const started = (await client.request('deck.start', { prompt: PROMPT, mode: 'express' })) as {
    id: string
    plan: { outline: unknown[]; brief: { topic: string } }
  }
  assert.equal(started.plan.outline.length, 15)
  assert.equal(started.plan.brief.topic, 'AI 智能办公产品')

  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    const done = frames.some((frame) => frame.type === 'deck-event' && frame.event.type === 'deck/done')
    if (done) break
    await new Promise((resolve) => setTimeout(resolve, 40))
  }

  const deckFrames = frames.filter((frame): frame is Extract<HostFrame, { type: 'deck-event' }> => frame.type === 'deck-event')
  assert.equal(deckFrames.filter((frame) => frame.event.type === 'deck/slide').length, 15)
  assert.ok(deckFrames.every((frame) => frame.deckId === started.id))

  const got = (await client.request('deck.get', { id: started.id })) as { status: string; deck: { slides: unknown[] } }
  assert.equal(got.status, 'done')
  assert.equal(got.deck.slides.length, 15)

  const revised = (await client.request('deck.revise', { id: started.id, instruction: '第 6 页改成数据页' })) as {
    indexes: number[]
    summary: string
  }
  assert.deepEqual(revised.indexes, [5])
  assert.match(revised.summary, /第 6 页/)

  server.dispose()
})

test('规划模式：先出计划等人确认，确认后才逐页生成', async (t) => {
  const engine = new DeckEngine({ paceMs: 0 })
  t.after(() => engine.dispose())

  const events: string[] = []
  const stop = engine.onEvent((_record, event) => events.push(event.type))
  const { id } = engine.start({ prompt: PROMPT, mode: 'plan' })
  await new Promise((resolve) => setTimeout(resolve, 200))

  assert.equal(engine.get(id)?.status, 'planned', '规划模式不该自己往下跑')
  assert.ok(events.includes('deck/plan'))
  assert.equal(events.includes('deck/slide'), false, '确认之前不许生成页面')

  engine.build(id)
  await new Promise((resolve) => setTimeout(resolve, 400))
  stop()
  assert.equal(engine.get(id)?.status, 'done')
  assert.equal(events.filter((type) => type === 'deck/slide').length, 15)
})

test('引擎：cancel 之后不再出页，记录停在 cancelled', async (t) => {
  const engine = new DeckEngine({ paceMs: 20 })
  t.after(() => engine.dispose())

  const events: DeckEvent[] = []
  const stop = engine.onEvent((_record, event) => events.push(event))
  const { id } = engine.start({ prompt: PROMPT, mode: 'plan' })
  await new Promise((resolve) => setTimeout(resolve, 260))
  engine.build(id)
  await new Promise((resolve) => setTimeout(resolve, 120))

  assert.equal(engine.cancel(id), true, '跑着的稿子应该能叫停')
  const slidesAtCancel = events.filter((event) => event.type === 'deck/slide').length
  assert.ok(slidesAtCancel < 15, '要在跑完之前叫停，这条测试才有意义')

  await new Promise((resolve) => setTimeout(resolve, 300))
  stop()
  assert.equal(events.filter((event) => event.type === 'deck/slide').length, slidesAtCancel, '叫停之后不该再有页面')
  assert.equal(events.some((event) => event.type === 'deck/done'), false, '叫停不是「假装完成」')
  assert.equal(engine.get(id)?.status, 'cancelled')
  assert.equal(engine.cancel(id), false, '已经停了再叫一次要老实返回 false')
})

test('端到端：deck.cancel 掐断事件流，记录停在 cancelled', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())
  const { client: clientTransport, host: hostTransport } = createLoopback()
  const server = new HostServer(app.ctx, hostTransport)
  const client = new HostClient(clientTransport)
  const frames: HostFrame[] = []
  client.onFrame((frame) => frames.push(frame))

  const started = (await client.request('deck.start', { prompt: PROMPT, mode: 'plan' })) as { id: string }
  // 等计划段真的排完（视觉设计 done），再确认生成——别和规划段抢着跑
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const planned = frames.some((frame) => frame.type === 'deck-event' && frame.event.type === 'deck/stage' &&
      frame.event.id === 'visual' && frame.event.status === 'done')
    if (planned) break
    await new Promise((resolve) => setTimeout(resolve, 30))
  }

  await client.request('deck.build', { id: started.id })
  await new Promise((resolve) => setTimeout(resolve, 150))
  const cancelled = (await client.request('deck.cancel', { id: started.id })) as { cancelled: boolean }
  assert.equal(cancelled.cancelled, true)

  const slides = () => frames.filter((frame) => frame.type === 'deck-event' && frame.event.type === 'deck/slide').length
  const at = slides()
  assert.ok(at > 0 && at < 15, '应该停在中间：已出 ' + at + ' 页')
  await new Promise((resolve) => setTimeout(resolve, 400))
  assert.equal(slides(), at, '叫停之后事件流要停住')

  const got = (await client.request('deck.get', { id: started.id })) as { status: string }
  assert.equal(got.status, 'cancelled')
  server.dispose()
})

test('审核的六类检查：缺主视觉、连着三页一个版式都算问题', () => {
  const fromPlan = plan({ prompt: PROMPT })
  const deck = buildDeck(fromPlan)
  const noArt: GeneratedDeck = {
    ...deck,
    slides: deck.slides.map((slide, index) => (index === 0 ? ({ ...slide, img: undefined } as typeof slide) : slide)),
  }
  assert.ok(audit(noArt, fromPlan.brief).some((issue) => issue.code === 'image'), '封面缺主视觉要报')

  const flat: GeneratedDeck = {
    ...deck,
    slides: deck.slides.map((slide, index) => (index >= 2 && index <= 4 ? { ...slide, k: 'columns' } : slide)),
  }
  assert.ok(audit(flat, fromPlan.brief).some((issue) => issue.code === 'layout'), '连续同版式要报')

  // 缺图能自动补，且补的是本主题的抽象主视觉
  const { deck: fixedDeck, issues } = repair(noArt, fromPlan.brief)
  assert.ok(issues.some((issue) => issue.code === 'image' && issue.fixed))
  assert.match(String((fixedDeck.slides[0] as { img?: string }).img), /^#art:/)
})
