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

/**
 * 真正被排版引用的配图：只看图片字段，不把价格、年份、编号里的两位数当成图号。
 * 之前这里扫的是“任何两位数字符串”，于是 $17、2019、第 07 行都被算成一张图，
 * 三套演示稿实际只有 11–13 张，却一直显示达标。
 */
const IMAGE_KEYS = ['img', 'img2', 'imgs', 'thumbs', 'images', 'poster', 'cover', 'image', 'photo']
function usedImages(deck: (typeof CASE_DECKS)[number]): Set<string> {
  const disk = readdirSync(join(publicDir, 'cases', deck.id))
    .filter((name) => name.endsWith('.jpg'))
    .map((name) => name.slice(0, 2))
  const used = new Set<string>()
  const take = (value: unknown) => {
    if (typeof value === 'string') {
      if (/^\d{2}$/.test(value) && disk.includes(value)) used.add(value)
      return
    }
    if (Array.isArray(value)) value.forEach(take)
  }
  const walk = (value: unknown, key: string, kind: string): void => {
    // figpair 用 a / b 两格，别的字段里的 a / b 不是图
    if (IMAGE_KEYS.includes(key) || (kind === 'figpair' && (key === 'a' || key === 'b'))) return take(value)
    if (Array.isArray(value)) return value.forEach((item) => walk(item, key, kind))
    if (value && typeof value === 'object') {
      const k = (value as { k?: string }).k || kind
      Object.entries(value).forEach(([key2, v]) => walk(v, key2, k))
    }
  }
  walk(deck.slides, '', '')
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
      assert.ok(pages >= 20 && pages <= 30, `${deck.name}: 网站复刻 ${pages} 屏，应为 20–30`)
      const imgs = usedImages(deck).size
      assert.ok(imgs >= 10 && imgs <= 15, `${deck.name}: 网站复刻应有 10–15 张配图，现在 ${imgs}`)
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

test('every screen of a site recreation answers back', () => {
  const sites = CASE_DECKS.filter((deck) => deck.fmt === 'site')
  assert.ok(sites.length >= 2, '网站复刻至少要有两套')
  for (const deck of sites) {
    for (const [i, slide] of deck.slides.entries()) {
      const html = slideHTML(deck as never, slide as never, i)
      assert.ok(
        /data-nw=|data-bw=/.test(html),
        `${deck.name} 第 ${i + 1} 屏（${(slide as { path?: string }).path || ''}）没有任何可交互控件`
      )
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

test('幻灯片里引用的媒体文件都在，且没有外链', () => {
  /* 视频 / 音频套是真文件：`<video src>` 写错一个字母，播放器只会静静地黑着，
   * 而画廊照常显示海报。所以把每页渲染出来的 src 全抓出来对磁盘。 */
  for (const deck of CASE_DECKS) {
    const dir = join(publicDir, 'cases', deck.id)
    const files = new Set(readdirSync(dir))
    for (const [i, slide] of deck.slides.entries()) {
      const html = slideHTML(deck as never, slide as never, i)
      for (const m of html.matchAll(/src="([^"]+)"/g)) {
        const src = m[1]
        assert.ok(!/^[a-z]+:/i.test(src), `${deck.name} 第 ${i + 1} 页引用外链 ${src}`)
        const name = src.startsWith(`cases/${deck.id}/`) ? src.slice(`cases/${deck.id}/`.length) : null
        assert.ok(name, `${deck.name} 第 ${i + 1} 页的媒体路径不在本套目录里：${src}`)
        assert.ok(files.has(name), `${deck.name} 第 ${i + 1} 页缺少媒体文件 ${src}`)
      }
    }
  }
})

test('封底字标是一位大写字母', () => {
  for (const deck of CASE_DECKS) {
    for (const slide of deck.slides) {
      const mark = (slide as { mark?: string }).mark
      if (mark === undefined) continue
      assert.match(mark, /^[A-Z]$/, `${deck.name}: 封底字标 ${mark} 应为单个大写字母`)
    }
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

test('模型列表每行的三个图标都接了真实行为，反馈不被设置窗口盖住', () => {
  const source = read('index.html')

  // 编辑：打开同一个添加/编辑弹窗，并把刷新后的行重新聚焦
  assert.match(source, /pen\.onclick = \(\) => openModelDialog\(box, item, rerender\)/)

  // 复制：复制接入配置（不含 Key），并在图标上给出对勾反馈
  assert.match(source, /mdCopy\(modelConfigText\(item\)/)
  assert.match(source, /link\.classList\.add\('copied'\)/)

  // 删除：行内二次确认 + 真正调用 models.remove
  assert.match(source, /row\.classList\.add\('confirm'\)/)
  assert.match(source, /rpc\('models\.remove'/)
  assert.match(source, /cancelArm\.onclick/)

  // 提示条必须压在设置窗口（z-index:80）和模型弹窗（120）之上，且不挡点击
  const toast = source.match(/\.toast\{[^}]*\}/)
  assert.ok(toast, '缺少 .toast 规则')
  assert.match(toast[0], /z-index:2\d\d/, '提示条 z-index 需要高于设置窗口')
  assert.match(toast[0], /pointer-events:none/, '提示条不应拦截点击')
})

test('演示文稿首页按参考截图：头图、标题、格式胶囊、示例预设与工作区画廊', () => {
  // 头图是本地的 3D 场景图片（相对路径，沙箱里也能加载）
  assert.match(indexHtml, /src="brand\/present-hero\.jpg"/)
  assert.ok(existsSync(join(publicDir, 'brand', 'present-hero.jpg')), '缺少头图 brand/present-hero.jpg')

  // 标题与格式胶囊：胶囊单独一行，下面才是工具条
  assert.match(indexHtml, /让您的创意焕发生机/)
  assert.match(indexHtml, /class="prompt mode-prompt"/)
  assert.match(indexHtml, /<div class="bar">[\s\S]{0,400}id="attachMode"[\s\S]{0,400}class="modechip"/)
  assert.match(indexHtml, /id="modeChipLabel">演示文稿</)

  // 工具条：加号、设置、图片、档位、语音、发送
  for (const id of ['attachMode', 'modeTune', 'imagePickMode', 'modeModel', 'modeMic', 'modeSend']) {
    assert.match(indexHtml, new RegExp('id="' + id + '"'), `工具条缺少 #${id}`)
  }

  // 示例指令的四个预设与截图一致，右上角可切换
  for (const label of ['进行用户研究并为设计项目创建角色', '向 17 世纪的海盗解释宇宙大爆炸', '个人理财']) {
    assert.ok(indexHtml.includes(label), '示例指令缺少：' + label)
  }
  assert.match(indexHtml, /id="exPresetBtn"/)

  // 浏览模板 / 上传模板 / 工作区-探索
  assert.match(indexHtml, /id="browseTpl"/)
  assert.match(indexHtml, /id="uploadTpl"/)
  assert.match(indexHtml, /accept="\.pptx/)
  assert.match(indexHtml, /id="mgTabWork"/)
  assert.match(indexHtml, /id="mgTabExplore"/)
  assert.match(indexHtml, /id="mgGrid"/)

  // 侧栏抬头与两条真实入口
  assert.match(indexHtml, /id="wsName"/)
  assert.match(indexHtml, /id="recentDecks"/)
  assert.match(indexHtml, /id="sideAll"/)
  assert.match(indexHtml, /id="sideSites"/)

  // 参考截图里的外来品牌词不能出现在界面文案里
  assert.doesNotMatch(indexHtml, /gammas/i)
})

test('深色主题与窄屏断点都还在', () => {
  assert.match(indexHtml, /html\[data-theme="dark"\]\{/, '缺少深色主题 token')
  assert.match(indexHtml, /html\[data-theme="dark"\] \.tplpage\{/, '缺少深色主题的页面覆盖')
  assert.match(indexHtml, /@media \(max-width:760px\)\{/, '缺少窄屏断点')
  assert.match(indexHtml, /id="sideToggle"/, '窄屏抽屉开关缺失')
})
