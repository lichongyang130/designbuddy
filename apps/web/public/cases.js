// 模版案例库（演示文稿）
// 每个案例 = 一套 16:9 演示文稿，10–15 个界面（页），至少 5 张本地配图。
// 配图放在 public/cases/<id>/<nn>.jpg，全部本地文件，不引用任何外链。
//
// 页面类型（k）：
//   cover 封面 / toc 目录 / section 章节页 / statement 命题 / stats 数字
//   split 图文 / columns 三栏 / fullimg 整版图 / board 材料板
//   timeline 工期 / table 表格 / quote 引言 / end 封底
//
// 新增一套案例：往 CASE_DECKS 里加一个对象，slides 按上面的 k 拼 10–15 条即可，
// 渲染层不用改；主题色走 paper / ink / accent / second / muted / rule 六个变量。

export const CASE_DECKS = [
  {
    id: 'arcade',
    name: '拱廊再生',
    en: 'Rebuilding the Past',
    by: 'Gamma',
    cat: '演示文稿',
    fmt: 'deck',
    ratio: '16:9',
    date: 20261102,
    kind: '建筑旧改提案',
    tags: ['建筑', '城市更新', '提案'],
    desc: '一份建筑期刊式的旧改提案：暖白纸上，高瘦的朱红衬线标题与等宽小字并置，细红分隔线和编号表格充当制图网格；两色丝网印刷插图——珊瑚红的脚手架结构对着石板蓝的粗网点砖楼，边缘逐渐散成印点。，适合提案、竞赛和工作室汇报。',
    bestFor: ['建筑与空间改造提案', '城市更新与保护案例研究', '设计与竞赛汇报', '工作室课程讲义'],
    styles: ['#f6f1e4', '#a8342a', '#31507e'],
    colorway: '沙纸 · 朱砂 · 石板蓝',
    paper: '#f6f1e4',
    ink: '#24211c',
    accent: '#a8342a',
    second: '#31507e',
    muted: '#7d7566',
    rule: '#cfc4ac',
    display: 'serif',
    mono: true,
    slides: [
      {
        k: 'cover', label: '封面',
        kicker: 'CASE 07 · 城市更新',
        title: '拱廊再生',
        meta: 'THE MALLOW BUILDING SALVAGE PROPOSAL · CALDER HARBOR · NOV 2026',
        img: '01',
      },
      {
        k: 'toc', label: '目录',
        title: '目录',
        note: '一份关于留下什么的提案',
        items: [
          ['01', '现场', '港区与这栋楼'],
          ['02', '问题', '空置从哪来'],
          ['03', '策略', '保留、插入、打开'],
          ['04', '图纸', '原状与新建'],
          ['05', '材料', '砖、钢与再生骨料'],
          ['06', '造价与工期', '1.9 亿，24 个月'],
        ],
      },
      {
        k: 'section', label: '章节 01 · 现场',
        num: '01', title: '现场', note: 'CALDER HARBOR · 2026 年 10 月勘查',
        img: '04',
      },
      {
        k: 'statement', label: '命题',
        text: '这栋楼不是不能修，而是没有人愿意把它的空置当成设计的起点。',
        foot: '现状勘查笔记 · 2026.10.18',
      },
      {
        k: 'stats', label: '关键数字',
        title: '三个数字决定了这次改造的边界',
        items: [
          ['1928', '建成年代', '钢筋混凝土框架，装饰艺术风格'],
          ['43%', '当前空置率', '三至六层连续 11 个月无租约'],
          ['1.9 亿', '改造预算上限', '含结构与机电更新'],
        ],
        note: '数据来源：港区资产管理年报（2026 Q2）与现场测绘',
      },
      {
        k: 'split', label: '现状',
        img: '03',
        title: '一部分可以拆走，\n一部分必须留下',
        paras: [
          '外立面三段式构图、铜制雨水口和首层拱廊是受保护的要素，任何方案都必须原样保留并做结构修补。',
          '三至六层的加建隔墙为 1980 年代二次装修，可以整层清空，为新的中庭和竖向交通腾出空间。',
        ],
        bullets: ['保留：首层拱廊、铜制细部、砖砌腰线', '拆除：隔墙、吊顶、后加电梯井', '新增：钢骨中庭、屋顶采光棚'],
      },
      {
        k: 'columns', label: '策略',
        title: '三条策略',
        note: 'STRATEGY',
        cols: [
          { t: '保留外壳', d: '砖墙与结构框架做修补而非替换，外立面只在首层开口，其余维持原状轮廓。' },
          { t: '插入钢骨', d: '在中庭位置插入一套独立的钢骨体系，承托新楼板与楼梯，与原结构脱开。' },
          { t: '打开首层', d: '拆除后加隔墙，让拱廊重新贯通到街面，首层向广场完全打开。' },
        ],
      },
      {
        k: 'fullimg', label: '图纸',
        img: '02',
        cap: '原状立面测绘图 · 1:200 · 2026.09 现场复核',
      },
      {
        k: 'board', label: '材料',
        title: '材料与色板',
        text: '新建部分只用三种材料：耐候钢、再生骨料混凝土、与原砖墙同窑复烧的补配砖。旧与新用颜色区分，不做仿旧。',
        img: '06',
        swatches: [['#a8342a', '朱砂红 · 耐候钢'], ['#31507e', '石板蓝 · 铜锈'], ['#b9a487', '旧砖 · 补配'], ['#efe7d4', '石灰浆']],
      },
      {
        k: 'timeline', label: '工期',
        title: '24 个月，四个阶段',
        items: [
          ['2027 Q1', '拆解', '清空后加隔墙，结构检测'],
          ['2027 Q2–Q3', '加固', '砖墙灌浆、钢骨中庭吊装'],
          ['2027 Q4', '封顶', '屋顶采光棚与机电主管'],
          ['2028 Q1–Q2', '收尾', '首层拱廊打开，广场铺装'],
        ],
      },
      {
        k: 'table', label: '造价',
        title: '造价拆分',
        head: ['科目', '占比', '金额（万元）'],
        rows: [
          ['结构加固与拆解', '38%', '7,220'],
          ['外立面修补', '19%', '3,610'],
          ['钢骨中庭与屋面', '24%', '4,560'],
          ['机电与消防', '13%', '2,470'],
          ['广场与景观', '6%', '1,140'],
        ],
        sum: ['合计', '100%', '19,000'],
        note: '口径：含税建安造价，不含设计与前期费用',
      },
      {
        k: 'fullimg', label: '效果',
        img: '05',
        cap: '改造后首层透视 · 拱廊重新向广场打开',
      },
      {
        k: 'end', label: '封底',
        title: '谢谢',
        lines: ['ATELIER REDLINE · 建筑与城市更新', 'hello@atelier-redline.studio'],
        mark: 'G',
      },
    ],
  },
]

/* ── 渲染 ─────────────────────────────────────────────
   固定 960×540 画布，外层用容器宽度换算缩放，卡片 / 大图 / 缩略图共用同一套。 */

function esc(text) {
  return String(text == null ? '' : text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))
}

function imgTag(deck, n, cls) {
  if (!n) return ''
  return '<img class="sd-img ' + (cls || '') + '" src="cases/' + deck.id + '/' + n + '.jpg" alt="" loading="lazy" />'
}

function bulletList(items) {
  return '<ul class="sd-ul">' + items.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>'
}

export function slideInner(deck, s) {
  const paras = (list) => '<div class="sd-paras">' + list.map((p) => '<p>' + esc(p) + '</p>').join('') + '</div>'
  switch (s.k) {
    case 'cover':
      return (
        '<div class="sd-cover">' +
        '<div class="sd-cover-top">' +
        (s.kicker ? '<div class="sd-kicker">' + esc(s.kicker) + '</div>' : '') +
        '<h1 class="sd-h1">' + esc(s.title) + '</h1>' +
        '<div class="sd-hair"></div>' +
        (s.meta ? '<div class="sd-mono sd-cover-meta">' + esc(s.meta) + '</div>' : '') +
        '</div>' + imgTag(deck, s.img, 'sd-cover-img') + '</div>'
      )
    case 'toc':
      return (
        '<div class="sd-pad sd-toc">' +
        '<div class="sd-toc-head"><div class="sd-mono">CONTENTS</div><h2 class="sd-h2">' + esc(s.title) + '</h2>' +
        (s.note ? '<div class="sd-note">' + esc(s.note) + '</div>' : '') + '</div>' +
        '<ol class="sd-toc-list">' + s.items.map(([n, t, d]) =>
          '<li><span class="sd-num">' + esc(n) + '</span><span class="sd-toc-t">' + esc(t) + '</span><span class="sd-toc-d">' + esc(d) + '</span></li>'
        ).join('') + '</ol></div>'
      )
    case 'section':
      return (
        '<div class="sd-section">' + imgTag(deck, s.img, 'sd-fill') +
        '<div class="sd-shade"></div>' +
        '<div class="sd-section-in">' +
        (s.num ? '<div class="sd-bignum">' + esc(s.num) + '</div>' : '') +
        '<h2 class="sd-h2 light">' + esc(s.title) + '</h2>' +
        (s.note ? '<div class="sd-mono light">' + esc(s.note) + '</div>' : '') +
        '</div></div>'
      )
    case 'statement':
      return (
        '<div class="sd-pad sd-statement">' +
        '<div class="sd-quote-mark">“</div>' +
        '<p class="sd-quote">' + esc(s.text) + '</p>' +
        (s.foot ? '<div class="sd-mono sd-foot">' + esc(s.foot) + '</div>' : '') +
        '</div>'
      )
    case 'stats':
      return (
        '<div class="sd-pad sd-stats">' +
        (s.title ? '<h2 class="sd-h3">' + esc(s.title) + '</h2>' : '') +
        '<div class="sd-stat-row">' + s.items.map(([v, t, d]) =>
          '<div class="sd-stat"><div class="sd-stat-v">' + esc(v) + '</div><div class="sd-stat-t">' + esc(t) + '</div>' +
          (d ? '<div class="sd-stat-d">' + esc(d) + '</div>' : '') + '</div>'
        ).join('') + '</div>' +
        (s.note ? '<div class="sd-mono sd-foot">' + esc(s.note) + '</div>' : '') +
        '</div>'
      )
    case 'split':
      return (
        '<div class="sd-split">' +
        '<div class="sd-split-media">' + imgTag(deck, s.img, 'sd-fill') + '</div>' +
        '<div class="sd-split-body">' +
        '<h2 class="sd-h2">' + esc(s.title).replace(/\n/g, '<br>') + '</h2>' +
        paras(s.paras || []) +
        (s.bullets ? bulletList(s.bullets) : '') +
        '</div></div>'
      )
    case 'columns':
      return (
        '<div class="sd-pad sd-columns">' +
        '<div class="sd-cols-head">' + (s.note ? '<div class="sd-mono">' + esc(s.note) + '</div>' : '') +
        '<h2 class="sd-h2">' + esc(s.title) + '</h2></div>' +
        '<div class="sd-col-row">' + s.cols.map((c, i) =>
          '<div class="sd-col"><div class="sd-mono sd-col-i">0' + (i + 1) + '</div>' +
          '<div class="sd-col-t">' + esc(c.t) + '</div><p class="sd-col-d">' + esc(c.d) + '</p></div>'
        ).join('') + '</div></div>'
      )
    case 'fullimg':
      return (
        '<div class="sd-full">' + imgTag(deck, s.img, 'sd-fill') +
        (s.cap ? '<div class="sd-full-cap"><span class="sd-mono">' + esc(s.cap) + '</span></div>' : '') +
        '</div>'
      )
    case 'board':
      return (
        '<div class="sd-pad sd-board">' +
        '<div class="sd-board-media">' + imgTag(deck, s.img, 'sd-fill') + '</div>' +
        '<div class="sd-board-body">' +
        '<h2 class="sd-h2">' + esc(s.title) + '</h2>' +
        '<p class="sd-body">' + esc(s.text) + '</p>' +
        '<div class="sd-sw-row">' + (s.swatches || []).map(([c, n]) =>
          '<div class="sd-sw"><i style="background:' + esc(c) + '"></i><span>' + esc(n) + '</span></div>'
        ).join('') + '</div></div></div>'
      )
    case 'timeline':
      return (
        '<div class="sd-pad sd-tl">' +
        '<h2 class="sd-h2">' + esc(s.title) + '</h2>' +
        '<div class="sd-tl-row">' + s.items.map(([w, t, d]) =>
          '<div class="sd-tl-item"><div class="sd-tl-w">' + esc(w) + '</div>' +
          '<div class="sd-tl-dot"></div><div class="sd-tl-t">' + esc(t) + '</div>' +
          '<p class="sd-tl-d">' + esc(d) + '</p></div>'
        ).join('') + '</div></div>'
      )
    case 'table':
      return (
        '<div class="sd-pad sd-table">' +
        '<h2 class="sd-h2">' + esc(s.title) + '</h2>' +
        '<table><thead><tr>' + s.head.map((h) => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
        s.rows.map((r) => '<tr>' + r.map((c, i) => '<td' + (i ? ' class="num"' : '') + '>' + esc(c) + '</td>').join('') + '</tr>').join('') +
        '</tbody>' + (s.sum ? '<tfoot><tr>' + s.sum.map((c, i) => '<td' + (i ? ' class="num"' : '') + '>' + esc(c) + '</td>').join('') + '</tr></tfoot>' : '') +
        '</table>' +
        (s.note ? '<div class="sd-mono sd-foot">' + esc(s.note) + '</div>' : '') +
        '</div>'
      )
    case 'quote':
      return (
        '<div class="sd-pad sd-statement">' +
        '<p class="sd-quote">' + esc(s.text) + '</p>' +
        (s.by ? '<div class="sd-mono sd-foot">' + esc(s.by) + '</div>' : '') +
        '</div>'
      )
    case 'end':
      return (
        '<div class="sd-pad sd-end">' +
        '<div class="sd-end-mark">' + esc(s.mark || 'G') + '</div>' +
        '<h2 class="sd-h1 sd-end-t">' + esc(s.title) + '</h2>' +
        '<div class="sd-hair"></div>' +
        '<div class="sd-mono sd-end-lines">' + s.lines.map((l) => '<div>' + esc(l) + '</div>').join('') + '</div>' +
        '</div>'
      )
    default:
      return '<div class="sd-pad"><h2 class="sd-h2">' + esc(s.title || '') + '</h2></div>'
  }
}

const THEME_VARS = ['paper', 'ink', 'accent', 'second', 'muted', 'rule']

export function slideTheme(deck) {
  const vars = THEME_VARS.map((k) => '--' + k + ':' + deck[k]).join(';')
  return vars + ';font-family:' + (deck.display === 'serif'
    ? 'Georgia,"Songti SC","Noto Serif SC",serif'
    : 'ui-sans-serif,system-ui,"PingFang SC",sans-serif')
}

export function slideHTML(deck, s) {
  return '<div class="sld" data-k="' + s.k + '" style="' + slideTheme(deck) + '">' + slideInner(deck, s) + '</div>'
}

export function deckSlides(deck) {
  return deck.slides.map((s) => ({ s, html: slideHTML(deck, s) }))
}
