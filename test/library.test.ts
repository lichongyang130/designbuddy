/**
 * Library catalog: 案例库与主题目录从前端常量搬进后端之后的行为约定。
 *
 * 这里守的不是「有没有这个函数」，而是三件容易悄悄坏掉的事：目录条数与前端
 * 打包数据一致（否则后端会是另一份「案例库」）、筛选与分组条数对得上、以及
 * 前端真的不再自己找数据（index.html 里不许再出现裸的 CASE_DECKS / THEMES 用法）。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createLibrary } from '../src/core/library.ts'
import { CASE_DECKS } from '../apps/web/public/cases.js'
import { THEMES } from '../apps/web/public/themes.js'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = join(here, '..', 'apps', 'web', 'public')
const library = createLibrary({ decks: CASE_DECKS as never, themes: THEMES as never })

test('library mirrors the bundled catalog instead of inventing its own', () => {
  assert.equal(library.decks().length, CASE_DECKS.length)
  assert.equal(library.themes().length, THEMES.length)

  const summary = library.summary()
  assert.equal(summary.cases, CASE_DECKS.length)
  assert.equal(summary.docs + summary.decks, CASE_DECKS.length)
  assert.equal(summary.themes, THEMES.length)
})

test('cards are a projection: pages and image counts come from the slides', () => {
  const cards = library.cards()
  assert.equal(cards.length, CASE_DECKS.length)

  for (const card of cards) {
    const deck = CASE_DECKS.find((item) => item.id === card.id)
    assert.ok(deck, `${card.id} 必须能反查回 deck`)
    assert.equal(card.pages, deck.slides.length)
    assert.ok(card.images > 0, `${card.id} 应该有配图`)
    assert.ok(!('slides' in card), '卡片不该把 slides 带出去')
  }
})

test('filters compose: format, category and free text', () => {
  const docs = library.list({ fmt: 'doc' })
  assert.ok(docs.length >= 7, '文档至少 7 套')
  assert.ok(docs.every((card) => card.fmt === 'doc'))

  const decks = library.list({ fmt: 'deck' })
  assert.ok(decks.every((card) => card.fmt === 'deck'))

  const cards = library.list({ fmt: 'card' })
  assert.ok(cards.length >= 1, '社交轮播至少 1 套')
  assert.ok(cards.every((card) => card.fmt === 'card'))

  assert.equal(docs.length + decks.length + cards.length, CASE_DECKS.length)

  const proposal = library.list({ cats: ['提案'] })
  assert.ok(proposal.length > 0)
  assert.ok(proposal.every((card) => card.category === '提案' || card.kind === '提案'))

  const byText = library.list({ q: '电梯' })
  assert.equal(byText.length, 1)
  assert.equal(byText[0].id, 'upshaft')

  const byEnglish = library.list({ q: 'harborline' })
  assert.ok(byEnglish.some((card) => card.id === 'harborline'))

  assert.deepEqual(library.list({ q: '没有这套案例' }), [])
})

test('sorting and limit behave', () => {
  const newest = library.list({})
  for (let i = 1; i < newest.length; i += 1) assert.ok(newest[i - 1].date >= newest[i].date)

  const byName = library.list({ sort: 'name' })
  const names = byName.map((card) => card.name)
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')))

  assert.equal(library.list({ limit: 3 }).length, 3)
})

test('facets count what the sidebar needs, and ignore the facet being counted', () => {
  const all = library.facets()
  assert.equal(all.total, CASE_DECKS.length)
  assert.equal(all.formats.reduce((sum, row) => sum + row.count, 0), CASE_DECKS.length)

  const docOnly = library.facets({ fmt: 'doc' })
  assert.equal(docOnly.total, library.list({ fmt: 'doc' }).length)
  const docRow = docOnly.formats.find((row) => row.value === 'doc')
  assert.equal(docRow?.count, docOnly.total)

  /* 勾了分类，格式那一列不该跟着缩水（否则侧栏会自己跳数） */
  const picked = library.list({ cats: ['提案'] })[0]?.category ?? '提案'
  const withCat = library.facets({ cats: [picked] })
  assert.equal(withCat.formats.reduce((sum, row) => sum + row.count, 0), CASE_DECKS.length)

  assert.ok(all.tags.length > 0)
  assert.ok(all.tags.length <= 24)
})

test('get() returns the full deck (slides included) so the viewer can render', () => {
  const deck = library.get('upshaft')
  assert.ok(deck)
  assert.ok(Array.isArray(deck.slides))
  assert.equal(deck.slides.length, 20)
  assert.equal(library.get('nope'), null)
})

test('the client no longer reads the bundled constants directly', () => {
  const html = readFileSync(join(publicDir, 'index.html'), 'utf8')
  const body = html.slice(html.indexOf('<script type="module">'))
  /* 只允许出现在两行 import 里（… as BUNDLED_CASES / BUNDLED_THEMES） */
  const lines = body.split('\n').filter((line) => /\b(CASE_DECKS|THEMES)\b/.test(line))
  assert.ok(lines.length > 0, '应该还能看到 import')
  assert.deepEqual(
    lines.filter((line) => !/^\s*import\s/.test(line)),
    [],
    '渲染代码里不许再直接读 CASE_DECKS / THEMES，统一走 LIB',
  )
  assert.ok(body.includes("rpc('library.catalog'"), '启动时要向后端要目录')
  assert.ok(body.includes("rpc('library.facets'"), '侧栏计数要走后端')
  assert.ok(body.includes("rpc('library.cases'"), '检索要走后端')
  assert.ok(body.includes("rpc('library.themes'"), '配色目录也要走后端')
})
