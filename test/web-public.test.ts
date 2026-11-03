/**
 * Static invariants for the web client.
 *
 * The UI itself needs a browser, but most of what breaks there is data-shaped:
 * a case deck that lost its images, a dictionary row with the wrong number of
 * columns, a control that says 「未接入」. Those are cheap to check from disk, so
 * they run in `npm test` alongside the kernel tests and fail the build.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CASE_DECKS, slideHTML } from '../apps/web/public/cases.js'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = join(here, '..', 'apps', 'web', 'public')
const read = (name: string) => readFileSync(join(publicDir, name), 'utf8')

const indexHtml = read('index.html')
const i18nJs = read('i18n.js')

/** Every `01`..`15` that a deck mentions and that exists on disk. */
function usedImages(deck: (typeof CASE_DECKS)[number]): Set<string> {
  const disk = readdirSync(join(publicDir, 'cases', deck.id))
    .filter((name) => name.endsWith('.jpg'))
    .map((name) => name.slice(0, 2))
  const used = new Set<string>()
  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      if (/^\d{2}$/.test(value) && disk.includes(value)) used.add(value)
      return
    }
    if (Array.isArray(value)) return value.forEach(walk)
    if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(deck.slides)
  return used
}

test('every case deck keeps its agreed page and image budget', () => {
  assert.ok(CASE_DECKS.length >= 16, '案例库至少 16 套')

  for (const deck of CASE_DECKS) {
    const pages = deck.slides.length
    if (deck.fmt === 'doc') {
      assert.ok(pages >= 15 && pages <= 20, `${deck.name}: 文档 ${pages} 页，应为 15–20`)
      assert.equal(usedImages(deck).size, 10, `${deck.name}: 文档应有 10 张配图`)
    } else if (deck.fmt === 'card') {
      assert.ok(pages >= 8 && pages <= 12, `${deck.name}: 轮播 ${pages} 张，应为 8–12`)
      assert.ok(usedImages(deck).size >= 5 && usedImages(deck).size <= 8, `${deck.name}: 轮播应有 5–8 张配图`)
    } else if (deck.fmt === 'site') {
      assert.ok(pages >= 5 && pages <= 8, `${deck.name}: 网站复刻 ${pages} 屏，应为 5–8`)
      assert.ok(usedImages(deck).size <= 8, `${deck.name}: 网站复刻最多 8 张配图`)
    } else if (deck.fmt === 'image') {
      assert.ok(pages >= 4 && pages <= 8, `${deck.name}: 图片 ${pages} 张，应为 4–8`)
      assert.ok(usedImages(deck).size >= 3 && usedImages(deck).size <= 8, `${deck.name}: 图片组应有 3–8 张图`)
    } else if (deck.fmt === 'artifact') {
      assert.ok(pages >= 4 && pages <= 8, `${deck.name}: 实时产物 ${pages} 屏，应为 4–8`)
      assert.ok(usedImages(deck).size <= 3, `${deck.name}: 实时产物最多 3 张配图`)
    } else if (deck.fmt === 'video') {
      assert.ok(pages >= 3 && pages <= 6, `${deck.name}: 视频 ${pages} 帧，应为 3–6`)
      assert.ok(usedImages(deck).size >= 2 && usedImages(deck).size <= 8, `${deck.name}: 视频应有 2–8 张画面`)
    } else if (deck.fmt === 'audio') {
      assert.ok(pages >= 3 && pages <= 6, `${deck.name}: 音频 ${pages} 段，应为 3–6`)
      assert.ok(usedImages(deck).size <= 3, `${deck.name}: 音频最多 3 张配图`)
    } else if (deck.fmt === 'hyper') {
      assert.ok(pages >= 6 && pages <= 10, `${deck.name}: Hyper Frames ${pages} 帧，应为 6–10`)
      assert.ok(usedImages(deck).size >= 3 && usedImages(deck).size <= 8, `${deck.name}: Hyper Frames 应有 3–8 张图`)
    } else {
      assert.ok(pages >= 25 && pages <= 30, `${deck.name}: 演示文稿 ${pages} 页，应为 25–30`)
      assert.equal(usedImages(deck).size, 15, `${deck.name}: 演示文稿应有 15 张配图`)
    }
  }
})

test('幻灯片里不放 <button>：缩略图外壳本身就是按钮', () => {
  /* 画廊缩略图是 <button class="tv-th">，里面再出现 <button> 的话 HTML 解析器
   * 会提前把外壳闭合，后面的节点会跑到 #tvThumbs 里当兄弟节点——画廊看起来
   * 还是一排缩略图，实际 DOM 已经散了。 */
  for (const deck of CASE_DECKS) {
    for (const [i, slide] of deck.slides.entries()) {
      const html = slideHTML(deck as never, slide as never, i)
      assert.ok(!/<button[\s>]/i.test(html), `${deck.name} 第 ${i + 1} 页里有 <button>`)
    }
  }
})

test('every image a deck points at exists on disk', () => {
  const IMAGE_KEYS = new Set(['img', 'a', 'b', 'figure', 'photo'])
  for (const deck of CASE_DECKS) {
    const dir = join(publicDir, 'cases', deck.id)
    assert.ok(existsSync(dir), `${deck.name}: 缺少图片目录 cases/${deck.id}`)
    const files = new Set(readdirSync(dir))
    const walk = (value: unknown, key?: string): void => {
      if (typeof value === 'string') {
        // 只有图片字段才一定指向文件；正文里的 "38" 是数字不是图号。
        if (IMAGE_KEYS.has(key ?? '') && /^\d{2}$/.test(value)) {
          assert.ok(files.has(`${value}.jpg`), `${deck.name}: 缺少 ${value}.jpg`)
        }
        return
      }
      if (Array.isArray(value)) return value.forEach((item) => walk(item, key))
      if (value && typeof value === 'object') {
        for (const [childKey, child] of Object.entries(value)) walk(child, childKey)
      }
    }
    walk(deck.slides)
  }
})

test('每个 deck 都声明了完整的品牌与版式元数据', () => {
  for (const deck of CASE_DECKS) {
    for (const key of ['id', 'name', 'cat', 'fmt', 'ratio', 'desc', 'by', 'slides'] as const) {
      assert.ok(deck[key] !== undefined && deck[key] !== '', `${deck.name}: 缺少 ${key}`)
    }
    assert.equal(deck.by, 'DesignBuddy', `${deck.name}: 出品方应为 DesignBuddy`)
  }
})

test('界面文案里不再出现 WorkBuddy / Gamma 这两个外来品牌', () => {
  const stripComments = (source: string) =>
    source
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')

  for (const [name, source] of [
    ['index.html', stripComments(indexHtml)],
    ['i18n.js', stripComments(i18nJs)],
    ['cases.js', stripComments(read('cases.js'))],
    ['design-preview.html', stripComments(read('design-preview.html'))],
  ] as const) {
    assert.doesNotMatch(source, /WorkBuddy/i, `${name}: 仍出现 WorkBuddy`)
    assert.doesNotMatch(source, /\bgammas?\b/i, `${name}: 仍出现 gamma`)
    assert.doesNotMatch(source, /GAMMA/, `${name}: 仍出现 GAMMA`)
  }
})

test('i18n 词典每一行都是 8 种语言', () => {
  const rows = i18nJs.split('\n').filter((line) => /^ {2}'[^']+':\s*\[.*\],$/.test(line))
  assert.ok(rows.length > 250, `词典行数异常：${rows.length}`)
  for (const row of rows) {
    // 词条里可能既有单引号也有双引号（法语的 d’icônes 之类），两种都要数。
    const columns = row.slice(row.indexOf('[') + 1, row.lastIndexOf(']')).match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g) ?? []
    assert.equal(columns.length, 7, `词条列数不是 7：${row.trim().slice(0, 60)}`)
  }
})

test('没有「未接入」类占位控件', () => {
  const source = read('index.html')
  assert.doesNotMatch(source, /markSoon\(/, 'markSoon 已废弃，不应再被调用')
  assert.doesNotMatch(source, /该设置项尚未接入/, '设置面板不应有未接入兜底')
  const visible = source.replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(visible, />未接入</, '界面上不应出现「未接入」徽标')
})

test('深色主题与窄屏断点都还在', () => {
  assert.match(indexHtml, /html\[data-theme="dark"\]\{/, '缺少深色主题 token')
  assert.match(indexHtml, /html\[data-theme="dark"\] \.tplpage\{/, '缺少深色主题的页面覆盖')
  assert.match(indexHtml, /@media \(max-width:760px\)\{/, '缺少窄屏断点')
  assert.match(indexHtml, /id="sideToggle"/, '窄屏抽屉开关缺失')
})
