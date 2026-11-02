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
    category: '提案',
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
  {
    id: 'meridian',
    name: '赤道算力',
    en: 'Meridian Compute',
    by: 'Gamma',
    cat: '演示文稿',
    fmt: 'deck',
    ratio: '16:9',
    date: 20261029,
    kind: '融资路演',
    category: '融资演讲稿',
    tags: ['算力', '路演', '能源'],
    desc: '深石墨底的融资路演：近黑画布上只有琥珀金一种亮色，标题用紧排的现代无衬线，数据行以等宽字对齐；配图是高反差的机房冷通道、晶圆微距与园区夜景航拍，图表用细金线和空槽表达“还剩多少余量”。适合把一桩重资产的基建生意，讲成一条可以按时交付的曲线。',
    bestFor: ['A 轮 / B 轮融资路演', '基建与能源项目立项', '企业年度战略沟通', '技术尽调与客户答疑'],
    styles: ['#101114', '#d8a04a', '#6f7a72'],
    colorway: '石墨 · 琥珀金 · 松灰',
    paper: '#101114',
    ink: '#f3f0e8',
    accent: '#d8a04a',
    second: '#6f7a72',
    muted: '#918d84',
    rule: '#34373d',
    body: '#cdc8bc',
    display: 'sans',
    slides: [
      {
        k: 'cover', label: '封面',
        kicker: 'INVESTOR DECK · 2026',
        title: '赤道算力',
        meta: 'MERIDIAN COMPUTE · SERIES B · NOV 2026 · 保密',
        img: '01',
      },
      {
        k: 'toc', label: '目录',
        title: '目录',
        note: '一份把交付写进合同的商业计划',
        items: [
          ['01', '现场', '赤道园区'],
          ['02', '问题', '为什么贵'],
          ['03', '方案', '电力、液冷、调度'],
          ['04', '单位经济', '单机柜月度模型'],
          ['05', '收入', '客户结构与合约'],
          ['06', '里程碑', '2027–2029'],
        ],
      },
      { k: 'section', label: '章节 01 · 现场', num: '01', title: '现场', note: 'EQUATOR CAMPUS · 2026 年 10 月航拍', img: '04' },
      {
        k: 'statement', label: '命题',
        text: '算力不缺，缺的是把每一块卡按时、按功率、按温度交付出去的能力。',
        foot: '内部复盘 · 2026.10',
      },
      {
        k: 'stats', label: '关键数字',
        title: '三个数字定义我们现在的位置',
        items: [
          ['38 MW', '在运容量', '赤道一期 + 二期，全部自持'],
          ['92%', '上架率', '签约客户已交付机柜占比'],
          ['9 周', '平均交付周期', '行业平均 22 周'],
        ],
        note: '数据截至 2026 年 10 月，含在运与在建',
      },
      {
        k: 'split', label: '模式',
        img: '03',
        title: '从「卖机柜」\n到「卖交付」',
        paras: [
          '客户真正买的不是 42U 的空间，而是一块卡从到场到跑满训练任务之间的那段确定性：电什么时候到、水什么时候通、温度曲线稳不稳。',
          '我们把这段过程拆成可计量的工序，并把它写进合同：交付节点、功率上限、PUE 上限，任何一项不达标都进赔偿条款。',
        ],
        bullets: ['电力：双路市电 + 自发气电，N+1', '制冷：冷板液冷，单柜 80kW', '调度：排产落到分钟级'],
      },
      {
        k: 'columns', label: '方案',
        title: '三条护城河',
        note: 'MOAT',
        cols: [
          { t: '电力', d: '园区自带 62MW 变电站与气电备份，电价锁到 2032 年，容量本身就是稀缺资源。' },
          { t: '液冷', d: '冷板式液冷从一期就按 80kW/柜 设计，改造零成本，交付即满功率。' },
          { t: '调度', d: '自研调度栈把训练任务的排产、迁移和容错做成产品，客户不必自己拼。' },
        ],
      },
      {
        k: 'bars', label: '交付',
        title: '交付周期：把不确定性压到 9 周',
        items: [['行业平均', 22], ['传统 IDC', 16], ['上一代自建', 12], ['赤道算力', 9]],
        unit: ' 周',
        max: 24,
        note: '口径：签约到上架完成；2026 年已交付 214 个机柜',
      },
      { k: 'fullimg', label: '技术', img: '05', cap: '自研调度栈 · 每一块卡的排产落到分钟' },
      { k: 'section', label: '章节 02 · 数字', num: '02', title: '数字', note: 'UNIT ECONOMICS · 2026 Q3', img: '06' },
      {
        k: 'table', label: '单位经济',
        title: '单机柜月度模型（80kW 液冷柜）',
        head: ['科目', '金额（元）', '占比'],
        rows: [
          ['电力与制冷', '38,400', '46%'],
          ['设备折旧', '21,000', '25%'],
          ['运维人力', '8,200', '10%'],
          ['网络与带宽', '6,300', '8%'],
          ['毛利', '9,100', '11%'],
        ],
        sum: ['合计', '83,000', '100%'],
        note: '口径：满负荷工况，含税；折旧按 5 年直线',
      },
      {
        k: 'split', label: '产品',
        img: '02',
        title: '硬件只是入口',
        paras: [
          '同一块卡，在别人手里是库存，在我们手里是排产表上的一行：温度、功耗、任务时长、故障率都可查。',
          '客户拿到的除了机柜，还有一套可回放的运行台账——这是续约时最贵的那部分。',
        ],
        bullets: ['按任务计费的 GPU 池', '故障 15 分钟内迁移', '月度运行台账与对账单'],
      },
      {
        k: 'timeline', label: '里程碑',
        title: '2027 – 2029',
        items: [
          ['2027 Q1', '二期封顶', '新增 24MW，液冷满配'],
          ['2027 Q4', '调度 2.0', '跨园区任务迁移上线'],
          ['2028 Q2', '三期选址', '锁定西南水电富集区'],
          ['2029', '60MW 在运', '单园区毛利转正'],
        ],
      },
      {
        k: 'end', label: '封底',
        title: '谢谢',
        lines: ['MERIDIAN COMPUTE · 赤道算力', 'ir@meridian-compute.example'],
        mark: 'M',
      },
    ],
  },
  {
    id: 'stillwater',
    name: '静水',
    en: 'Soft Current',
    by: 'Gamma',
    cat: '演示文稿',
    fmt: 'deck',
    ratio: '16:9',
    date: 20261026,
    kind: '品牌提案',
    category: '提案',
    tags: ['品牌', '零售', '提案'],
    desc: '一份慢下来的品牌提案：奶油纸底、窄衬线标题、大块留白，青瓷绿是唯一的强调色；配图统一在同一束晨光里——陶器、倒水的手、釉面开片、无字包装与空店。整套东西只做一件事：把手感讲成可以被量产的规范。',
    bestFor: ['品牌视觉与语词提案', '产品线与包装提案', '生活方式零售招商', '工作室作品集'],
    styles: ['#f7f4ec', '#5f7a63', '#232620'],
    colorway: '生纸白 · 青瓷绿 · 墨',
    paper: '#f7f4ec',
    ink: '#232620',
    accent: '#5f7a63',
    second: '#b98d68',
    muted: '#8b8779',
    rule: '#ded6c4',
    body: '#4c4a3f',
    display: 'serif',
    slides: [
      {
        k: 'cover', label: '封面',
        kicker: 'BRAND PROPOSAL · WINTER 2026',
        title: '静水',
        meta: 'SOFT CURRENT · 器物与日常 · 品牌提案',
        img: '01',
      },
      {
        k: 'toc', label: '目录',
        title: '目录',
        note: '把手感写成规范',
        items: [
          ['01', '工艺', '十二道工序'],
          ['02', '主张', '一段不需要解释的时间'],
          ['03', '手感', '先摸到，再听到'],
          ['04', '色彩与材质', '一种绿，四块料'],
          ['05', '包装', '无字标签'],
          ['06', '门店', '一间留白的房间'],
        ],
      },
      { k: 'section', label: '章节 01 · 工艺', num: '01', title: '工艺', note: 'STILLWATER STUDIO · 景德镇 · 2026', img: '06' },
      {
        k: 'statement', label: '主张',
        text: '我们卖的不是水，是一天里唯一一段不需要解释的时间。',
        foot: '品牌主张 · 第一稿',
      },
      {
        k: 'split', label: '手感',
        img: '02',
        title: '手感先于说法',
        paras: [
          '倒水这个动作，决定了整个品牌的语气：手要稳、水要细、声音要低。所有视觉决策都从这三秒倒推回去。',
          '所以我们不拍产品大片，只拍手、水、光和器物之间的缝。',
        ],
        bullets: ['一张图只讲一个动作', '不用摆拍的光，只用上午九点的光', '器物永远半入画'],
      },
      {
        k: 'board', label: '色彩',
        img: '03',
        title: '色彩与材质',
        text: '主色只取青瓷釉在光下最亮的那一格；底色是生纸白，不用纯白；陶土棕只出现在触点上，墨色承担全部文字。',
        swatches: [['#7d9484', '青瓷绿 · 主色'], ['#f0e9d8', '生纸白 · 底色'], ['#b98d68', '陶土棕 · 触点'], ['#232620', '墨 · 文字']],
      },
      {
        k: 'columns', label: '原则',
        title: '三条视觉原则',
        note: 'PRINCIPLES',
        cols: [
          { t: '留白大过内容', d: '单页只放一个信息，边距不小于版心的三分之一，宁可少一张图。' },
          { t: '只用一种绿', d: '任何场景都只有一个绿，深浅靠光，不靠调色板堆叠。' },
          { t: '让器物自己说话', d: '不加描边、不加投影、不加装饰线，器物边缘就是版面结构。' },
        ],
      },
      { k: 'fullimg', label: '包装', img: '04', cap: '包装系统 · 无字标签，只留一道绿' },
      {
        k: 'split', label: '门店',
        img: '05',
        title: '门店是一间\n留白的房间',
        paras: [
          '不用货架，用三个不同高度的台子；不写字，用一片布幔把上午的光切成条。',
          '客人进门先听到水声，再看到器物——顺序不能反过来。',
        ],
        bullets: ['每店只陈列 12 件', '灯光色温 3000K', '试水台常设'],
      },
      {
        k: 'stats', label: '进展',
        title: '我们已经在的地方',
        items: [
          ['12 道', '每件器物的工序', '从拉坯到开片，全部手工'],
          ['68%', '九十天复购率', '2026 上半年直营渠道'],
          ['3 城', '已开与在筹备', '上海、杭州、成都'],
        ],
        note: '数据来源：2026 上半年经营月报',
      },
      {
        k: 'table', label: '排期',
        title: '交付排期',
        head: ['阶段', '时间', '交付物'],
        rows: [
          ['识别定稿', '第 1–3 周', '标志、字标、辅助图形'],
          ['包装打样', '第 4–8 周', '外盒、瓶器、手提袋'],
          ['门店方案', '第 9–12 周', '空间图纸与软装清单'],
          ['品牌手册', '第 13–16 周', '视觉规范与语词手册'],
        ],
        note: '含两轮修改，超出按周计费',
      },
      {
        k: 'timeline', label: '节奏',
        title: '上市节奏',
        items: [
          ['2026.12', '首店试营业', '上海安福路 38㎡'],
          ['2027.03', '春季系列', '两款新釉色'],
          ['2027.06', '杭州二店', '与茶室联营'],
          ['2027.09', '线上开售', '官网与小程序'],
        ],
      },
      {
        k: 'end', label: '封底',
        title: '谢谢',
        lines: ['SOFT CURRENT · 静水', 'studio@softcurrent.example'],
        mark: 'S',
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
    case 'bars': {
      const max = s.max || Math.max.apply(null, s.items.map((it) => it[1]))
      return (
        '<div class="sd-pad sd-bars">' +
        (s.title ? '<h2 class="sd-h2">' + esc(s.title) + '</h2>' : '') +
        '<div class="sd-bars-list">' + s.items.map(([k, v], i) =>
          '<div class="sd-bars-row' + (i === s.items.length - 1 ? ' on' : '') + '">' +
          '<span class="sd-bars-k">' + esc(k) + '</span>' +
          '<span class="sd-bars-track"><i class="sd-bars-fill" style="width:' + Math.round((v / max) * 100) + '%"></i></span>' +
          '<span class="sd-bars-v">' + esc(v) + (s.unit || '') + '</span></div>'
        ).join('') + '</div>' +
        (s.note ? '<div class="sd-mono sd-foot">' + esc(s.note) + '</div>' : '') +
        '</div>'
      )
    }
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

const THEME_VARS = ['paper', 'ink', 'accent', 'second', 'muted', 'rule', 'body']

export function slideTheme(deck) {
  const vars = THEME_VARS.map((k) => '--' + k + ':' + (deck[k] || (k === 'body' ? '#4a463d' : ''))).join(';')
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
