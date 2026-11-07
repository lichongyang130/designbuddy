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
import { translationOf } from '../apps/web/public/i18n.js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BRIEF_MARK, CASE_DECKS, deckPrompt, slideHTML } from '../apps/web/public/cases.js'

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
      assert.ok(deck.socialLong ? pages >= 35 && pages <= 50 : pages >= 3 && pages <= 20, `${deck.name}: 轮播 ${pages} 张，长篇应为 35–50，短篇应为 3–20`)
      assert.ok(usedImages(deck).size >= 15, `${deck.name}: 轮播应有至少 15 张配图`)
    } else if (deck.fmt === 'site') {
      assert.ok(pages >= 25 && pages <= 50, `${deck.name}: 网站复刻 ${pages} 屏，应为 25–50`)
      const imgs = usedImages(deck).size
      assert.ok(imgs >= 15 && imgs <= 20, `${deck.name}: 网站复刻应有 15–20 张配图，现在 ${imgs}`)
    } else if (deck.fmt === 'image') {
      assert.ok(deck.imageSeries ? pages >= 35 && pages <= 50 : pages >= 4 && pages <= 8, `${deck.name}: 长篇图片应为 35–50，原有图片组为 4–8`)
      assert.ok(deck.imageSeries ? usedImages(deck).size >= 15 : usedImages(deck).size >= 3 && usedImages(deck).size <= 8, `${deck.name}: 长篇图片应有至少 15 张实际配图`)
    } else if (deck.fmt === 'artifact') {
      assert.ok(deck.artifactLive ? pages === 36 : pages >= 4 && pages <= 8, `${deck.name}: 新实时产物应为 36 屏，旧案例为 4–8 屏`)
      assert.ok(deck.artifactLive ? usedImages(deck).size >= 15 : usedImages(deck).size <= 3, `${deck.name}: 新实时产物至少 15 张图片，旧案例最多 3 张`)
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

test('模型列表每行的操作都接了真实行为，反馈不被设置窗口盖住', () => {
  const source = read('index.html')

  // 编辑：打开同一个添加/编辑弹窗，并把刷新后的行重新聚焦
  assert.match(source, /openModelDialog\(box, item, rerender\)/)
  assert.match(source, /querySelector\('\[data-act="edit"\]'\)\.click\(\)/)

  // 「复制接入配置」已按需求移除：行里只留编辑 / 测试 / 删除
  assert.doesNotMatch(source, /modelConfigText/)
  assert.doesNotMatch(source, /mdCopy\(/)
  assert.doesNotMatch(source, /\.md-ico/)

  // 删除：行内二次确认 + 真正调用 models.remove
  assert.match(source, /row\.classList\.add\('confirm'\)/)
  assert.match(source, /rpc\('models\.remove'/)
  assert.match(source, /disarm\(true\)/)

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
  assert.match(indexHtml, /<div class="bar">[\s\S]{0,400}id="attachMode"[\s\S]{0,1000}class="modechip"/)
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

test('图片首页按参考截图：参数胶囊、示例指令与「您还可以制作」八卡', () => {
  // 格式胶囊后面紧跟三个参数胶囊，同一行里还有加号与右侧控件
  assert.match(indexHtml, /id=\"modeChipLabel\">演示文稿/)
  assert.match(indexHtml, /class=\"imgopts\" id=\"imgOpts\"[^>]*hidden/)
  for (const id of ['imgRatio', 'imgCount', 'imgRef', 'imgRefFile']) {
    assert.match(indexHtml, new RegExp('id=\"' + id + '\"'), `图片参数缺少 #${id}`)
  }
  // 参数胶囊在格式胶囊之后、发送按钮之前
  const bar = indexHtml.slice(indexHtml.indexOf('<div class="bar">'), indexHtml.indexOf('id="modeSend"'))
  assert.ok(bar.indexOf('class="modechip"') > 0, '.bar 里缺少格式胶囊')
  assert.ok(bar.indexOf('id="imgOpts"') > bar.indexOf('class="modechip"'), '参数胶囊应在格式胶囊右侧')
  // 参考图选择器是本地文件输入，不上传
  assert.match(indexHtml, /<input type="file" id="imgRefFile"[^>]*hidden/)

  // 图片模式的占位文案与预设，四张示例卡来自长提示词池
  assert.ok(indexHtml.includes('描述您想要创建的图像'), '缺少图片模式占位文案')
  assert.match(indexHtml, /PRESET_BOOK\s*=\s*\{[\s\S]*?'图片':\s*\{\s*'给我个惊喜'/, '图片预设首项应为「给我个惊喜」')
  assert.match(indexHtml, /function shuffled\(/, '示例指令应从提示词池随机抽取')
  assert.match(indexHtml, /function withImageParams\(/, '发送时应带上画面比例与数量')

  // 「您还可以制作」在探索画廊之后，八张卡都有标题与三条子项
  const more = indexHtml.slice(indexHtml.indexOf('<div class="mgal"'), indexHtml.indexOf('id="modeMakeMore"'))
  assert.ok(more.length > 0 && more.includes('id="mgGrid"'), '#modeMakeMore 应排在 .mgal 之后')
  assert.match(indexHtml, /const MAKE_MORE\s*=/, '缺少 MAKE_MORE 数据')
  for (const title of ['信息图', '海报', '社交媒体帖子', '图表', '标志', '团队架构', '邀请', '日历与日程']) {
    assert.ok(indexHtml.includes("name: '" + title + "'"), '「您还可以制作」缺少：' + title)
  }
  // 每张卡都能真正切换模式并填入提示词
  assert.match(indexHtml, /function paintMakeMore\(/, '缺少 paintMakeMore()')
  assert.match(indexHtml, /card\.onclick = \(\) => \{[\s\S]{0,200}enterMode\(item\.mode\)/, '点击卡片应进入对应模式')

  // 参考截图里的外来品牌词不能混进图片界面
  assert.doesNotMatch(indexHtml, /WorkBuddy/i)
  assert.doesNotMatch(indexHtml, /gammas/i)
})

test('专家召唤：整页加载页 + 输入框加号右侧的专家胶囊', () => {
  // 整页加载：头像、名称、职责、三步进度与进度条
  assert.match(indexHtml, /<div class="summon" id="summonPage"/)
  for (const id of ['summonFace', 'summonName', 'summonRole', 'summonSteps', 'summonBar']) {
    assert.match(indexHtml, new RegExp('id="' + id + '"'), `召唤加载页缺少 #${id}`)
  }
  assert.match(indexHtml, /const SUMMON_STEPS\s*=\s*\[/, '缺少召唤步骤文案')
  assert.match(indexHtml, /function summonExpert\(preset, faceHint\)/, '缺少 summonExpert()')

  // 三个输入框（普通首页、模式首页、会话）都把专家胶囊放在加号右侧
  const pairs = [
    ['attach', 'xpertChipHome'],
    ['attachMode', 'xpertChip'],
    ['attachChat', 'xpertChipChat'],
  ]
  for (const [attach, chip] of pairs) {
    const at = indexHtml.indexOf('id="' + attach + '"')
    const chipAt = indexHtml.indexOf('id="' + chip + '"')
    assert.ok(at > 0, `缺少 #${attach}`)
    assert.ok(chipAt > at, `#${chip} 应排在 #${attach} 之后（加号右侧）`)
    assert.ok(chipAt - at < 700, `#${chip} 离加号太远，像是换了行`)
  }

  // 样式与「演示文稿」胶囊同一套
  assert.equal((indexHtml.match(/class="mchip xchip"/g) || []).length, 3, '三个输入框的专家胶囊样式应一致')
  assert.match(indexHtml, /\.mchip\.xchip\{/, '缺少专家胶囊样式')

  // 点专家卡片即召唤，胶囊上的 × 结束召唤并还原默认专家
  assert.match(indexHtml, /btn\.onclick = \(\) => summonExpert\(preset, btn\.dataset\.face\)/)
  assert.match(indexHtml, /function endSummon\(/, '缺少 endSummon()')
  assert.match(indexHtml, /state\.presetId = state\.summoned\.prev/, '结束召唤要还原默认专家')
  assert.match(indexHtml, /paintXpertChip\(\)/, '启动时应刷新专家胶囊')
})

test('专家卡片每张都带一个召唤按钮', () => {
  // 卡片本身是可点击容器（div role=button），里面才能放真正的 button，避免按钮套按钮
  assert.match(indexHtml, /btn\.setAttribute\('role', 'button'\)/, '专家卡片应是可点击容器')
  assert.match(indexHtml, /<button type="button" class="ex-summon">/, '每张卡片缺少召唤按钮')
  assert.match(indexHtml, /'<span>' \+\s*\n?\s*\(current && state\.summoned \? '重新召唤' : '召唤'\)/, '召唤按钮文案缺失')

  // 点按钮只触发一次召唤（阻止冒泡到卡片），点卡片与回车同样能召唤
  assert.match(indexHtml, /summon\.onclick = \(event\) => \{\s*event\.stopPropagation\(\)/)
  assert.match(indexHtml, /btn\.onkeydown = \(event\) => \{/)
  assert.match(indexHtml, /btn\.onclick = \(\) => summonExpert\(preset, btn\.dataset\.face\)/)

  // 按钮样式：胶囊 + 主色，默认态与当前专家态都有
  assert.match(indexHtml, /\.ex-summon\{/, '缺少 .ex-summon 样式')
  assert.match(indexHtml, /\.ex-card\.on \.ex-summon\{/, '当前专家的召唤按钮应有选中态')
  assert.match(indexHtml, /\.ex-summon:hover\{/, '召唤按钮缺少悬停反馈')
})

test('专家预设按需重取：有读取中、超时与重试，不会把空态钉死', () => {
  assert.match(indexHtml, /async function loadPresets\(force\)/, '缺少 loadPresets()')
  // 传输是 SSE 帧，帧丢掉时 Promise 不会落地，必须带超时
  assert.match(indexHtml, /Promise\.race\(\[rpc\('presets\.list'\), withTimeout\]\)/, '读取预设缺少超时兜底')
  assert.match(indexHtml, /正在读取专家预设/, '缺少读取中的状态文案')
  assert.match(indexHtml, /专家预设读取失败/, '缺少读取失败的文案')
  assert.match(indexHtml, /class="ex-retry">重新读取</, '失败态要有重新读取按钮')
  assert.match(indexHtml, /empty\.querySelector\('\.ex-retry'\)\.onclick/, '重新读取按钮要真的重新拉取')
  // 打开专家页、切回专家页、后端一次性没给全，都会再取一次
  assert.match(indexHtml, /if \(state\.presets\.length === 0\) void loadPresets\(\)/)
  assert.match(indexHtml, /setTimeout\(\(\) => \{ void loadPresets\(true\) \}, 1200\)/, '启动后应有一次重试')
  // 旧的那句「后端还没有返回专家预设」不能再出现在界面上
  assert.doesNotMatch(indexHtml.replace(/\/\*[\s\S]*?\*\//g, ''), /后端还没有返回专家预设/)
})

test('深色主题与窄屏断点都还在', () => {
  assert.match(indexHtml, /html\[data-theme="dark"\]\{/, '缺少深色主题 token')
  assert.match(indexHtml, /html\[data-theme="dark"\] \.tplpage\{/, '缺少深色主题的页面覆盖')
  assert.match(indexHtml, /@media \(max-width:760px\)\{/, '缺少窄屏断点')
  assert.match(indexHtml, /id="sideToggle"/, '窄屏抽屉开关缺失')
})

test('RPC 带超时：SSE 丢帧不会让控件永远转圈', () => {
  const html = read('index.html')
  assert.match(html, /function rpc\(method, params, timeoutMs\)/)
  assert.match(html, /请求超时（/)
  assert.match(html, /response\.status === 409/)
})

test('模板卡片右下角有「引用」，引用的东西会真的跟着消息发出去', () => {
  const html = read('index.html')
  // 卡片右下角的引用标：三种模板卡（推荐 / 探索 / 画廊）+ 上传卡都绑了
  assert.ok((html.match(/bindRefBadge\(/g) || []).length >= 4, '模板卡都要绑引用')
  assert.match(html, /function refBadge\(deck\)/)
  assert.match(html, /<span class="tpl-ref" role="button"/)
  // 输入框上方的引用卡：三个输入区各一个容器
  for (const id of ['refRowHome', 'refRowMode', 'refRowChat']) {
    assert.ok(html.includes('id="' + id + '"'), id + ' 不存在')
  }
  // 引用不是装饰：发送时拼进消息、发完清空
  assert.match(html, /function consumeRef\(text\)/)
  assert.ok((html.match(/consumeRef\(/g) || []).length >= 4, '三个发送入口都要带上引用')
  assert.match(html, /（引用模板：/)
})

test('设置每个栏目都不会白屏：先铺骨架，画完再撤', () => {
  const html = read('index.html')

  // 骨架组件本身
  assert.match(html, /function spSkeleton\(rows = 3\)/)
  assert.match(html, /\.sp-skel-row\{/)
  assert.match(html, /prefers-reduced-motion[\s\S]{0,120}\.sp-skel-row i\{animation:none/)

  // openPanel：清空之后立刻铺骨架，画完在 finally 里撤掉；万一什么都没画也不留白
  const open = /async function openPanel\(id\) \{[\s\S]*?\n\}/.exec(html)
  assert.ok(open, '缺 openPanel')
  assert.match(open![0], /const skeleton = spSkeleton\(\)/)
  assert.match(open![0], /skeleton\.remove\(\)/)
  assert.match(open![0], /box\.childElementCount <= 1/)
  assert.match(open![0], /暂时没有内容/)

  // 应用管理页是静态壳 + 异步行，也要垫骨架
  assert.match(html, /const shellRows = \$\('spRows'\)/)
  assert.match(html, /if \(shellRows && shellRows\.childElementCount === 0/)

  // 模型面板自己也有占位，但不能和外面的骨架叠两层
  assert.match(html, /!host\.querySelector\(':scope > \.sp-skel'\)/)
})

test('刷新自定义模型列表不先清空面板，删一行不会白屏', () => {
  const html = read('index.html')

  // 内容装在面板自己的壳里，标题（openPanel 放的）不跟着换
  assert.match(html, /let wrap = host\.querySelector\(':scope > \.md-wrap'\)/)
  // 新内容先在离屏节点里拼，拼完一次性替换：中途面板上一直是旧内容
  assert.match(html, /const box = mdNode\('div'\)/)
  assert.match(html, /wrap\.replaceChildren\(\.\.\.box\.childNodes\)/)

  // 刷新路径里不许再「先 innerHTML='' 再等两个 RPC」
  const rerender = /const rerender = async \(editId\) => \{[\s\S]{0,500}?\n  \}/.exec(html)
  assert.ok(rerender, '缺 rerender')
  assert.doesNotMatch(rerender![0], /innerHTML = ''/, '刷新前不能清空面板')

  // 删除成功先把那行摘掉，重建在后台做
  assert.match(html, /row\.remove\(\)/)
  // 数据没到时有占位，不是空白
  assert.match(html, /正在读取自定义模型…/)
})

test('自定义模型每行三个操作：带字的按钮、真的测、删前先确认', () => {
  const html = read('index.html')
  assert.match(html, /function buildModelsPanel/)

  // 三个操作都是 .md-btn（图标 + 文字），不再是三个猜不出含义的灰图标
  assert.match(html, /const makeAction = \(label, icon, act\) =>/)
  assert.match(html, /makeAction\('编辑', MD_PEN, 'edit'\)/)
  assert.match(html, /makeAction\('测试', MD_BOLT, 'test'\)/)
  assert.match(html, /makeAction\('删除', MD_TRASH, 'del'\)/)
  assert.match(html, /btn\.dataset\.act = act/)
  assert.match(html, /\.md-btn span\{display:none\}/, '窄屏要能退化成图标')

  // 测试是真调用 models.test（后端会取本机存的 Key），结果直接挂在行里
  assert.match(html, /rpc\('models\.test', \{\s*id: item\.id,/)
  assert.match(html, /res\.className = 'md-res ' \+ \(ok \? 'ok' : 'err'\) \+ ' on'/)
  // 成功给时延，失败给状态码，全文落在 title 与提示条
  assert.match(html, /\? '✓ ' \+ ms \+ 'ms'/)
  assert.match(html, /: '✕ ' \+ \(result && result\.status \? 'HTTP ' \+ result\.status : '未通过'\)/)
  // 供应商模式的模型没存 baseUrl，按供应商表补齐；补不出来才提示，不拿空地址发请求
  assert.match(html, /const baseUrl = \(item\.baseUrl \|\| \(preset && preset\.baseUrl\) \|\| ''\)\.trim\(\)/)
  assert.match(html, /if \(baseUrl === ''\) \{/)
  assert.match(html, /\.md-res\.ok\{/)
  assert.match(html, /\.md-res\.err\{/)
  assert.match(html, /res\.setAttribute\('aria-live', 'polite'\)/)
  // 连点保护
  assert.match(html, /if \(testing\) return/)
  assert.match(html, /testBtn\.disabled = true/)

  // 删除：先出确认条，三个按钮整组让位；Esc 和取消都能撤回
  assert.match(html, /\.md-item\.confirm \.md-tools\{display:none\}/)
  assert.match(html, /ask\.textContent = tf\('删除「%s」？', item\.name\)/)
  assert.match(html, /if \(event\.key !== 'Escape' \|\| !row\.classList\.contains\('confirm'\)\) return/)
  assert.match(html, /no\.focus\(\{ preventScroll: true \}\)/, '焦点给「取消」，回车不会误删')
  // 旧的整行 arm 文案已经拆掉
  assert.doesNotMatch(html, /md-arm/)
})

test('模板卡片上的「引用」是蓝底白字 + 加号，不是半透明黑条', () => {
  const html = read('index.html')
  const rule = /\.tpl-ref\{([^}]*)\}/.exec(html)
  assert.ok(rule, '缺 .tpl-ref 样式')
  assert.match(rule![1]!, /background:var\(--chip\)/, '引用要蓝底')
  // 硬白：深色主题的 --on-accent 是深色字，用它就不白了
  assert.match(rule![1]!, /color:#fff/, '引用要白字')
  assert.doesNotMatch(rule![1]!, /rgba\(16,20,28/, '旧的半透明黑底要去掉')
  assert.doesNotMatch(html, /\.tpl-ref\.dark/, 'dark 变体已废弃，别再留死规则')
  // 加号在文字前面，且是装饰（aria-hidden），屏幕阅读器只念「引用」
  assert.match(html, /<i class="tpl-plus" aria-hidden="true">\+<\/i>' \+ t\('引用'\)/)
  assert.match(html, /\.tpl-ref \.tpl-plus\{/)

  // 平时藏着，鼠标指到卡片才浮出来；触屏没有 hover，不加这条媒体查询就永远点不到
  assert.match(html, /@media \(hover:hover\)\{/)
  assert.match(html, /\.tpl-ref\{opacity:0;pointer-events:none\}/)
  assert.match(html, /\.tpl:hover \.tpl-ref,\.tpl-card:hover \.tpl-ref,\.mgcard:hover \.tpl-ref,\.tpl-ref:focus-visible\{opacity:1;pointer-events:auto\}/)
})

test('首页只留一条标语：插图去掉，产品名 + 标语不超过 10 个字', () => {
  const html = read('index.html')
  const from = html.indexOf('id="heroHome"')
  const hero = html.slice(from, html.indexOf('id="homeHello"', from))
  assert.ok(from > 0 && hero.length > 0)
  assert.doesNotMatch(hero, /<svg/, '首页 hero 不再放插图')
  assert.doesNotMatch(html, /#heroHome \.art/, '插图的定位样式也要一起删掉')

  // 一行两段：产品名（强调色）+ 标语（正文色）
  const brand = /<span class="hero-brand">([^<]+)<\/span>/.exec(hero)
  const tag = /<span class="hero-tag">([^<]+)<\/span>/.exec(hero)
  assert.ok(brand && tag, 'hero 要有产品名和标语')
  assert.equal(brand![1], 'DesignBuddy')
  assert.ok(tag![1]!.length <= 10, '标语最多 10 个字：' + tag![1])
  assert.match(html, /\.hero h1 \.hero-brand\{color:var\(--accent\)/, '产品名要区别于标语')
  assert.ok(i18nJs.includes("'" + tag![1] + "':"), '标语要进词典，否则切英文会留中文')
})

test('「更多」悬浮菜单三项各占一行，图标不会被别处的同名类顶大', () => {
  const html = read('index.html')
  // 曾经：.mm-ico 在「您还可以制作」的卡片里又定义了一次（38px、无底色），
  // 菜单里那三个 24px 图标被顶成 38px，撑破 36px 的行高，三项糊成一坨。
  const iconDefs = (html.match(/^\s*\.mm-ico\{/gm) || []).length
  assert.equal(iconDefs, 1, '.mm-ico 只能有一处定义，否则后一处会悄悄盖掉前一处')
  assert.match(html, /\.mmcard-ico\{/, '卡片图标要用自己的类名')
  assert.match(html, /querySelector\('\.mmcard-ico'\)/)

  const heightOf = (block: string) => Number((block.match(/height:(\d+)px/) || [])[1] || 0)
  const item = html.match(/\.mm-item\{([^}]*)\}/)
  const icon = html.match(/\.mm-ico\{([^}]*)\}/)
  assert.ok(item && icon)
  assert.ok(heightOf(item![1]!) > heightOf(icon![1]!), '行高要大于图标高度，否则相邻两项会互相压住')

  // 四项都是「图标 + 文字 + 右侧箭头」（含 PPT 编辑器入口），且整块是浮层的一颗菜单
  assert.equal((html.match(/class="mm-item"/g) || []).length, 4)
  assert.equal((html.match(/class="mm-label"/g) || []).length, 4)
  assert.equal((html.match(/mm-go"/g) || []).length, 4)
  assert.match(html, /#moreMenu::before\{/, '贴边浮出的小三角只属于这颗菜单')
})

test('确认大纲之后的生成态：留在工作台，左栏说进度，右栏逐页补进来', () => {
  const html = read('index.html')
  // 不再跳屏：演示文稿逐页生成留在计划工作台里（原来会关掉工作台、跳到旧的生成工作台）
  assert.match(html, /async function psBuildDeck\(\)/)
  assert.doesNotMatch(html, /closePlanStudio\(\)\s*\n\s*await openStudioBuild/, '演示文稿不该再跳走')
  assert.match(html, /await psBuildDeck\(\)/, '「生成」要真的走逐页生成')

  // 左栏：内联「生成」→ 状态行 → 发送键变停止（停止是真的 deck.cancel，不是装饰）
  assert.match(html, /class="ps-run"/)
  assert.match(html, /function psStatusRow\(text\)/)
  assert.match(html, /class="ps-wave"/)
  assert.match(html, /function setStopMode\(on\)/)
  assert.match(html, /classList\.toggle\('stop', on\)/)
  assert.match(html, /rpc\('deck\.cancel'/)
  assert.match(html, /async function psStopBuild\(\)/)

  // 右栏：三列幻灯片墙——空槽位先摆主题，写好的填进去；顶栏正中是进度胶囊
  assert.match(html, /function psPaintPage\(index, slide\)/)
  assert.match(html, /function psGridReset\(\)/)
  assert.match(html, /\.ps-grid\{[^}]*grid-template-columns:repeat\(3/)
  assert.match(html, /\.ps-slot-body\.ghost\{/)
  assert.match(html, /\.ps-slot\.active/, '正在写的那格要描边')
  assert.match(html, /id="psProgress"/)
  assert.match(html, /id="psProgressPct"/)
  assert.match(html, /function psProgress\(show, pct, text\)/)
  assert.match(html, /\.ps-build\.working\{/)
  assert.match(html, /function psDoneDeck\(deck\)/)
  // 顶栏另有一颗「演示」，完成之后才亮
  assert.match(html, /id="psPlay"/)
  assert.match(html, /function psPlay\(on\)/)

  // 顶栏照截图：静态标签 + 分享 + 头像，中间那行副标题不再占位
  assert.match(html, /id="psShare"/)
  assert.doesNotMatch(html, /id="psSub"/, '副标题已按截图去掉')
})

test('外观三项设置在真生效：字号倍率、紧凑密度、等宽字体', () => {
  const html = read('index.html')

  // 字体大小：样式表统一写成 calc(Npx * var(--fs))，「字体大小」只改根节点上的倍率。
  // 之前写的是 documentElement.style.fontSize，可全站字号都是 px，改根字号什么也没动。
  assert.match(html, /--fs:1;/)
  assert.match(html, /style\.setProperty\('--fs'/)
  assert.match(html, /function fontScale\(size\)/)
  assert.doesNotMatch(html, /documentElement\.style\.fontSize = size \+ 'px'\s*\n\s*\/\//)
  const scaled = html.match(/calc\(\d+(?:\.\d+)?px\*var\(--fs,1\)\)/g) || []
  assert.ok(scaled.length > 300, '字号倍率要覆盖主要界面，实际只有 ' + scaled.length + ' 处')

  // 幻灯片画布是 960×540 的固定设计稿（按容器缩放），不能跟着用户字号走
  const canvasLines = html.split('\n').filter((line) => line.includes('.sld'))
  assert.ok(canvasLines.length > 50)
  assert.ok(canvasLines.every((line) => !line.includes('var(--fs')), '幻灯片画布不该吃字号倍率')

  // 界面密度：紧凑档要成规模（原来只有 sp-row / row / thread 三条，看出来像没生效）
  const compact = (html.match(/body\.compact /g) || []).length
  assert.ok(compact >= 25, '紧凑档规则太少，实际 ' + compact)
  assert.match(html, /body\.classList\.toggle\('compact'/)

  // 等宽字体：对话气泡、工具输出、代码块都要覆盖到（中文没等宽字形，西文与数字才看得出来）
  for (const sel of ['body.mono .msg', 'body.mono .msg .body', 'body.mono .tool pre', 'body.mono code']) {
    assert.ok(html.includes(sel), '缺了 ' + sel)
  }
  assert.match(html, /body\.classList\.toggle\('mono'/)

  // 面板里放一块实时预览，三项都能当场看到效果
  assert.match(html, /className = 'sp-preview'/)
  assert.match(html, /const PREVIEW_SAMPLE/)
  // 预览样例是内容不是界面文案，不该进词典；旁边那句说明要进
  assert.ok(!html.includes("textContent = '" + '预览：8GB'))
})

test('引用模板往输入框里填的是完整提示词，不是一句占位', () => {
  // 每套案例都能算出一份完整 brief：类型、页数、配色、逐页结构、内容要求
  for (const deck of CASE_DECKS) {
    const prompt = deckPrompt(deck)
    assert.ok(prompt.includes(BRIEF_MARK), `${deck.name}: 缺少模板口径`)
    assert.ok(prompt.includes(deck.name), `${deck.name}: 没提到模板名`)
    assert.doesNotMatch(prompt, /undefined|\[object/, `${deck.name}: 提示词里漏了字段`)
    assert.equal(prompt.split('\n').filter((line) => /^\d{2,3} /.test(line)).length, deck.slides.length, `${deck.name}: 逐页结构要一页不落`)
    assert.match(prompt, new RegExp('共 ' + deck.slides.length + ' 页'), `${deck.name}: 页数不对`)
    assert.ok(prompt.length >= 200, `${deck.name}: 提示词太短，只有 ${prompt.length} 字`)
  }

  // 界面：点引用 → 填进可见输入框；用户自己写的字不覆盖；发送后清空并复位高度
  assert.match(indexHtml, /fillTemplatePrompt\(deckPrompt\(deck\)\)/)
  assert.match(indexHtml, /function fillTemplatePrompt/)
  assert.match(indexHtml, /function fitPromptBox/)
  assert.match(indexHtml, /function resetPromptBox/)
  assert.ok((indexHtml.match(/resetPromptBox\(/g) || []).length >= 4, '三个发送入口都要复位输入框')
  assert.match(indexHtml, /useTemplate\(deck\)/, '「使用模板」也要用同一份提示词')
  // 正文里已经带着完整 brief 时，不再补一句「引用模板：…」
  assert.match(indexHtml, /if \(lead\.includes\(BRIEF_MARK\)\) return lead/)
})

test('界面里写死的中文文案都在词典里，切英文不会是中文', () => {
  const html = read('index.html')
  const keys = new Set<string>()
  const add = (raw: string) => {
    const key = raw.replace(/\\'/g, "'")
    // 拼出来的半句（以冒号或引号结尾）没法整句匹配，这里只查完整的界面文案
    if (!/[\u4e00-\u9fa5]/.test(key)) return
    if (/[：:」『（(]$/.test(key)) return
    if (/['+?]/.test(key)) return // 拼接片段，不是整句
    if (key.includes('%s')) return
    keys.add(key)
  }
  for (const match of html.matchAll(/\btf?\(\s*'((?:[^'\\]|\\.)*)'/g)) add(match[1]!)
  for (const match of html.matchAll(/\.textContent\s*=\s*'((?:[^'\\]|\\.)*)'/g)) add(match[1]!)
  for (const match of html.matchAll(/<b>([^<>{]+)<\/b>/g)) add(match[1]!)
  for (const match of html.matchAll(/<span>([^<>{]+)<\/span>/g)) add(match[1]!)

  // 账号昵称是内容，不是界面文案（对应节点上标了 data-no-i18n）
  for (const content of ['星W']) keys.delete(content)
  assert.ok(keys.size > 40, '应该扫到不少中文字面量，实际 ' + keys.size)
  const missing = [...keys].filter((key) => translationOf(key, 'en') === key)
  assert.deepEqual(missing, [], '这些文案没有译文：' + missing.join(' / '))

  // 七种目标语言都要有东西，不能空着
  for (const langId of ['en', 'zh-Hant', 'ja', 'ko', 'de', 'fr', 'es']) {
    for (const key of keys) assert.ok(translationOf(key, langId).trim() !== '', key + ' @ ' + langId)
  }
})

test('case interaction listeners are installed during bootstrap after DOM helper initialization', () => {
  const helper = indexHtml.indexOf('const $ = (id) => document.getElementById(id)')
  const wireStart = indexHtml.indexOf('function wireCaseView() {')
  const wireEnd = indexHtml.indexOf('\n}', wireStart)
  const boot = indexHtml.lastIndexOf('\nwireCaseView()')
  assert.ok(helper >= 0 && boot > helper, 'bootstrap must initialize the DOM helper before wiring events')
  const wire = indexHtml.slice(wireStart, wireEnd)
  for (const listener of [
    "$('tvStage').addEventListener('click', handleLegacySiteNavigation)",
    "$('tvStage').addEventListener('keydown', handleLegacySiteNavigation)",
    "$('tvStage').addEventListener('click', handleReplicaControl)",
    "$('tvStage').addEventListener('keydown', handleReplicaControl)",
  ]) {
    assert.ok(wire.includes(listener), `listener should be deferred to wireCaseView: ${listener}`)
    assert.equal(indexHtml.split(listener).length - 1, 1, 'listener must not also be registered at module top level')
  }
})
