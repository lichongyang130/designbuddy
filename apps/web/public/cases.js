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
    folio: true,
    footLeft: 'ARCHIVE 07 · CALDER HARBOR',
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
        k: 'sheet', label: '图签',
        img: '02',
        title: '原状立面',
        block: [['项目', 'MALLOW BUILDING'], ['图号', 'AR-102'], ['比例', '1 : 200'], ['日期', '2026.09.14'], ['绘制', 'ATELIER REDLINE']],
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
    folio: true,
    footLeft: 'MERIDIAN COMPUTE · 2026',
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
        k: 'metric', label: '单柜毛利',
        kicker: 'UNIT MARGIN · 2026 Q3',
        big: '43%',
        label: '单柜毛利 / 行业均值 28%',
        note: '满负荷工况 · 含电费与折旧',
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
        k: 'plate', label: '图版',
        img: '03',
        no: 'PLATE 04',
        cap: '青瓷釉在上午九点的侧光下开片 · 放大 4 倍',
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
  {
    id: 'canopy',
    name: '深林',
    en: 'Deep Canopy',
    by: 'Gamma',
    cat: '演示文稿',
    fmt: 'deck',
    ratio: '16:9',
    date: 20261104,
    kind: '可持续年报',
    category: '报告',
    tags: ['碳汇', '林业', '年报'],
    desc: '深墨绿底上只用一支琥珀金：标题用宽衬线、数字用等宽字、分隔线细到几乎消失，图表靠“空槽 + 半格填充”表达存量的缓慢。配图统一在同一片晨雾里——林冠、年轮、木料、苗圃与河口。适合把一份慢生意的年报，讲得比财报更有分量。',
    bestFor: ['可持续与 ESG 年度报告', '碳资产与林业项目说明', '流域与生态修复提案', '长期主义主题演讲'],
    styles: ['#0F2A24', '#D8A03C', '#6E8F7C'],
    colorway: '深墨绿 · 琥珀金 · 苔绿',
    folio: true,
    footLeft: 'DEEP CANOPY · 2026',
    paper: '#0F2A24',
    ink: '#EDE8D9',
    accent: '#D8A03C',
    second: '#6E8F7C',
    muted: '#94A79B',
    rule: '#2E4A3F',
    body: '#C6D0C6',
    display: 'serif',
    slides: [
      {
        k: 'cover', label: '封面',
        kicker: 'CARBON LEDGER · 2026',
        title: '深林',
        meta: 'DEEP CANOPY · 澜沧流域碳汇账本 · 2026 年度',
        img: '01',
      },
      {
        k: 'toc', label: '目录',
        title: '目录',
        note: '一本关于存量的账',
        items: [
          ['01', '林', '2.4 万公顷'],
          ['02', '账', '年度核证'],
          ['03', '方法', '三条核算口径'],
          ['04', '木材', '副产品'],
          ['05', '流域', '河岸带修复'],
          ['06', '周期', '轮伐与核证'],
        ],
      },
      { k: 'section', label: '章节 01 · 林', num: '01', title: '林', note: '澜沧流域 · 2.4 万公顷 · 2026 年 9 月', img: '04' },
      {
        k: 'stats', label: '关键数字',
        title: '三个数字，是这本账的起点',
        items: [
          ['24,000', '公顷 · 经营林地', '跨三个县，全部有林权证'],
          ['38', '万吨 · 年碳汇量', 'CO₂e，第三方核证'],
          ['27', '年 · 平均轮伐期', '杉木与栎类混交'],
        ],
        note: '核证机构：中环联合 · VCS 体系 · 2026 年核查',
      },
      {
        k: 'split', label: '账本',
        img: '02',
        title: '年轮是账本，\n不是装饰',
        paras: [
          '一棵树把碳写进木质部的方式，和会计把收入写进报表一样：按年、按层、按可追溯的凭证。我们做的只是把这本账读出来。',
          '每片林班都有独立的样地编号，年轮宽度、密度与碳密度一一对应，第三方复核时可以逐圈回溯。',
        ],
        bullets: ['1,240 个固定样地，五年复测一次', '生长量与采伐量分账', '核证报告全文公开'],
      },
      {
        k: 'columns', label: '方法',
        title: '三条核算口径',
        note: 'METHOD',
        cols: [
          { t: '只算增量', d: '存量不计入碳汇，只有当年新增的生物量进入账本，避免把历史积累重复出售。' },
          { t: '扣掉损耗', d: '采伐、火灾、病虫害与运输排放全部扣减，扣减项单列，不做净额合并。' },
          { t: '土壤另账', d: '土壤有机碳以五年为周期实测，与地上部分分开核证，不互相顶替。' },
        ],
      },
      {
        k: 'bars', label: '构成',
        title: '碳汇构成 · 2026',
        items: [['森林生长', 62], ['土壤固碳', 21], ['湿地与河岸', 17]],
        unit: '%',
        max: 70,
        note: '口径：VCS VM0015 · 单位万吨 CO₂e 折算为占比',
      },
      { k: 'fullimg', label: '木材', img: '03', cap: '木材只是副产品 · 每年出材 3.1 万立方米' },
      { k: 'section', label: '章节 02 · 流域', num: '02', title: '流域', note: '澜沧江下游 · 河岸带修复', img: '05' },
      {
        k: 'table', label: '账目',
        title: '项目账目（百万元）',
        head: ['科目', '2025', '2026'],
        rows: [
          ['碳汇收入', '42.6', '58.1'],
          ['木材销售', '31.0', '29.4'],
          ['林下经济', '6.8', '9.2'],
          ['经营与管护', '−28.4', '−31.7'],
        ],
        sum: ['净收益', '52.0', '65.0'],
        note: '口径：合并口径，未审计；碳汇按当年核证量确认',
      },
      {
        k: 'ledger', label: '林班',
        title: '林班明细（前五）',
        head: ['林班', '树种', '面积', '年碳汇'],
        rows: [
          ['A-03', '杉木', '218 公顷', '+12.4%'],
          ['A-07', '栎类', '186 公顷', '+9.8%'],
          ['B-12', '混交', '164 公顷', '+11.1%'],
          ['B-19', '杉木', '142 公顷', '+7.6%'],
          ['C-02', '栎类', '121 公顷', '+13.2%'],
        ],
        note: '同比口径：较 2025 年核证量',
      },
      {
        k: 'timeline', label: '周期',
        title: '轮伐与核证周期',
        items: [
          ['2027', '第二期造林', '补植 1,800 公顷'],
          ['2029', '首次大径材', '间伐 0.9 万立方米'],
          ['2032', '第二个核证期', '五年复测完成'],
          ['2038', '主伐期', '轮伐进入第八年'],
        ],
      },
      {
        k: 'quote', label: '引言',
        text: '树长得慢，账也要算得慢。',
        by: '项目负责人 · 岩温',
      },
      {
        k: 'end', label: '封底',
        title: '谢谢',
        lines: ['DEEP CANOPY · 深林碳汇', 'ledger@deepcanopy.example'],
        mark: 'D',
      },
    ],
  },
  {
    id: 'terracotta',
    name: '陶土',
    en: 'Terracotta Ledger',
    by: 'Gamma',
    cat: '演示文稿',
    fmt: 'deck',
    ratio: '16:9',
    date: 20261103,
    kind: '品牌手册',
    category: '营销材料',
    tags: ['餐饮', '品牌', '门店'],
    desc: '整页铺满陶土橙的品牌手册：奶白衬线字压在暖色底上，强调色是一小块麦黄，分隔线也用同色系的浅一档，画面像一张晒过太阳的桌布。配图全是热的东西——手撕面包、堆叠的陶碗、黄昏的餐厅。适合餐饮、生活方式与门店类提案。',
    bestFor: ['餐饮与生活方式品牌手册', '门店与空间提案', '菜单与产品线规划', '加盟与招商材料'],
    styles: ['#B0532F', '#F2C14E', '#FBEFE2'],
    colorway: '陶土橙 · 麦黄 · 生奶白',
    folio: true,
    footLeft: 'TERRACOTTA · 2026',
    paper: '#B0532F',
    ink: '#FBEFE2',
    accent: '#F2C14E',
    second: '#7B2F1C',
    muted: '#EBC6AF',
    rule: '#C9764E',
    body: '#F7E3D2',
    display: 'serif',
    slides: [
      {
        k: 'cover', label: '封面',
        kicker: 'BRAND BOOK · 2026',
        title: '陶土',
        meta: 'TERRACOTTA LEDGER · 一人食餐桌 · 品牌手册',
        img: '01',
      },
      {
        k: 'toc', label: '目录',
        title: '目录',
        note: '一间只做一张桌子的餐厅',
        items: [
          ['01', '器', '手作陶器'],
          ['02', '一顿饭', '三十八分钟'],
          ['03', '色彩', '三块料'],
          ['04', '规范', '三条硬规矩'],
          ['05', '门店', '四城十二家'],
          ['06', '节奏', '一季两道'],
        ],
      },
      {
        k: 'statement', label: '主张',
        text: '我们不做精致的餐厅，只做一张愿意多坐十分钟的桌子。',
        foot: '品牌手册 · 第一版',
      },
      {
        k: 'split', label: '体验',
        img: '02',
        title: '一顿饭的节奏',
        paras: [
          '面包先上，手撕，不用刀；油碟只放一勺，吃完再添。这个动作决定了整餐的速度，也决定了客人愿不愿意慢下来。',
          '所有热菜都在四分钟内上齐，之后不再打扰——碗盘留在桌上，直到客人自己叠起来。',
        ],
        bullets: ['餐前：面包、油、盐', '主菜：一荤一素一主食', '餐后：一杯不加糖的茶'],
      },
      { k: 'section', label: '章节 01 · 器', num: '01', title: '器', note: '手作陶器 · 每批两百件 · 景德镇', img: '03' },
      {
        k: 'board', label: '色彩',
        img: '05',
        title: '色彩与材质',
        text: '主色就是陶器烧出来的那层橙，不做渐变；麦黄只出现在价格牌和强调字上；底色是生奶白，比纯白暖一档。',
        swatches: [['#B0532F', '陶土 · 主色'], ['#F2C14E', '麦黄 · 强调'], ['#FBEFE2', '生奶白 · 底色'], ['#3A2A22', '炭 · 文字']],
      },
      {
        k: 'menu', label: '菜单',
        title: '一页菜单',
        groups: [
          { h: '常驻 · ALWAYS', items: [['手撕面包 · 橄榄油', '18'], ['炭烤时蔬', '26'], ['番茄冷汤', '22'], ['生火腿 · 无花果', '38'], ['烤茄子 · 芝麻酱', '24'], ['慢炖牛颊', '68']] },
          { h: '季节 · THIS SEASON', items: [['烤无花果 · 里科塔', '32'], ['石榴 · 开心果沙拉', '30'], ['柠檬叶烤鸡', '58'], ['陶罐焖豆', '34'], ['蜂蜜烤桃 · 山羊奶酪', '36'], ['橙皮橄榄油蛋糕', '28']] },
        ],
        note: '价格含税；面包与油可续一次',
      },
      {
        k: 'columns', label: '规范',
        title: '三条硬规矩',
        note: 'RULES',
        cols: [
          { t: '不用刀叉', d: '所有菜都做成可以用手或一把木勺吃完的形状，刀叉只在客人主动索取时提供。' },
          { t: '不摆盘', d: '菜直接从锅里进陶盘，不做立体的摆盘造型，盘沿必须留出可以放勺的位置。' },
          { t: '不打灯', d: '晚六点后关掉顶灯，只留桌上烛光，色温不高于 2400K。' },
        ],
      },
      { k: 'fullimg', label: '门店', img: '04', cap: '门店 · 四城十二家，晚六点后只留烛光' },
      {
        k: 'stats', label: '关键数字',
        title: '今天的样子',
        items: [
          ['12', '家 · 门店', '四城，全部直营'],
          ['38', '分钟 · 用餐时长', '比同类高 11 分钟'],
          ['4', '款 · 常驻主食', '每季换两道'],
        ],
        note: '数据截至 2026 年 10 月，含筹备中门店',
      },
      {
        k: 'table', label: '单店模型',
        title: '单店月度模型（万元）',
        head: ['科目', '金额', '占比'],
        rows: [
          ['食材成本', '18.4', '31%'],
          ['人力', '14.2', '24%'],
          ['租金与折旧', '11.6', '20%'],
          ['能耗与其他', '5.3', '9%'],
          ['门店净利', '9.5', '16%'],
        ],
        sum: ['营业额', '59.0', '100%'],
        note: '口径：成熟店均值，含税；不含总部摊销',
      },
      {
        k: 'timeline', label: '节奏',
        title: '开店节奏',
        items: [
          ['2027 Q1', '成都三店', '写字楼底商'],
          ['2027 Q3', '南京首店', '老城南片区'],
          ['2028 Q1', '中央厨房', '支撑 30 家门店'],
          ['2028 Q4', '20 家', '五城满编'],
        ],
      },
      {
        k: 'end', label: '封底',
        title: '谢谢',
        lines: ['TERRACOTTA LEDGER · 陶土', 'hello@terracotta.example'],
        mark: 'T',
      },
    ],
  },
  {
    id: 'lilac',
    name: '把复杂讲清楚',
    en: 'Clear & Complex',
    by: 'Gamma',
    cat: '演示文稿',
    fmt: 'deck',
    ratio: '16:9',
    date: 20261106,
    kind: '课程讲义',
    category: '课程',
    tags: ['课程', '写作', '讲义'],
    desc: '雾紫底上的课程讲义：无衬线粗标题压在浅紫纸面上，强调色是一支饱和的紫罗兰，其余全部是灰紫的层级；每讲都从一张白纸开始，版式也跟着“先结构、后文字”的顺序走。适合课程招生、讲义、工作坊与内训。',
    bestFor: ['课程招生与课程大纲', '工作坊与内训讲义', '方法论培训材料', '讲座与分享'],
    styles: ['#E7E1F2', '#6B4BE0', '#241C33'],
    colorway: '雾紫 · 紫罗兰 · 墨紫',
    paper: '#E7E1F2',
    ink: '#241C33',
    accent: '#5F3DD8',
    second: '#9C86C9',
    muted: '#7B7191',
    rule: '#D3C8E8',
    body: '#4A4260',
    display: 'sans',
    slides: [
      {
        k: 'cover', label: '封面',
        kicker: 'COURSE · 6 SESSIONS',
        title: '把复杂讲清楚',
        meta: 'CLEAR & COMPLEX · 写给产品与运营的写作课',
        img: '01',
      },
      {
        k: 'toc', label: '课程地图',
        title: '六讲',
        note: '每一讲都带走一个能直接用的东西',
        items: [
          ['01', '先想清楚', '谁在读、要做什么'],
          ['02', '一句话结构', '主张 + 依据 + 动作'],
          ['03', '删掉一半', '从 800 字到 300 字'],
          ['04', '用图表说话', '一张图只讲一件事'],
          ['05', '让人行动', '把结论放最前面'],
          ['06', '复盘', '改写自己的旧文档'],
        ],
      },
      {
        k: 'statement', label: '命题',
        text: '读者不是在读你，他是在找一个不用想就能照做的动作。',
        foot: '开场第一句 · 每一期都从这里开始',
      },
      {
        k: 'columns', label: '目标',
        title: '六讲之后，你会带走三样东西',
        note: 'GOALS',
        cols: [
          { t: '一个结构', d: '拿到任何题目，三分钟内能列出“主张—依据—动作”的骨架，不再从第一句开始憋。' },
          { t: '一套模板', d: '十二个可复用模板：大纲、标题、说明、变更通知、复盘，直接改成自己的。' },
          { t: '一种习惯', d: '写完先删三分之一，再检查每段是否只有一个意思——课上互相改，改到能发为止。' },
        ],
      },
      {
        k: 'split', label: '第一讲',
        img: '02',
        title: '先想清楚，\n再写第一句',
        paras: [
          '大部分难读的文档，问题不在文笔，而在于作者没决定“这段话要让谁做什么”。所以我们第一件事不是写，是填一张只有三格的纸。',
          '课上会给每个人一个真实题目，二十分钟填完三格；填不出来的地方，就是这篇文档未来会被退回的地方。',
        ],
        bullets: ['谁在读：岗位、场景、他关心什么', '要做什么：一个动词，不超过八个字', '凭什么：三个能被验证的依据'],
      },
      {
        k: 'stats', label: '收获',
        title: '课程结束时的三个数字',
        items: [
          ['6', '讲 · 每讲 40 分钟', '线下 + 永久回放'],
          ['12', '个 · 可复用模板', '大纲、标题、说明、复盘'],
          ['30', '人 · 小班', '每期不超过 30 人'],
        ],
        note: '2026 年已开 9 期，结课率 94%',
      },
      {
        k: 'bars', label: '调研',
        title: '学员最常卡住的地方（开课前调研）',
        items: [['不知道写给谁', 48], ['第一句写不出来', 31], ['写完不敢删', 21]],
        unit: '%',
        max: 55,
        note: '样本：2026 年 1–9 月 268 位学员的课前问卷',
      },
      { k: 'fullimg', label: '方法', img: '03', cap: '每讲都从一张白纸开始 · 先画结构，再写字' },
      {
        k: 'work', label: '作业',
        kicker: 'ASSIGNMENT 03',
        title: '第三讲作业',
        steps: ['把上周的文档删掉三分之一，不改内容只删句子', '用一句话重写开头，主语必须是读者', '请两个不熟悉项目的人只读第一段，复述要点'],
        note: '下周一前提交 · 课上互改，只允许问「这句要读者做什么」',
      },
      {
        k: 'split', label: '练习',
        img: '05',
        title: '三张纸，\n改到能发为止',
        paras: [
          '第一张写结构，第二张写全文，第三张只留删改痕迹。第三张纸往往最难看，但它决定了文档能不能在周一早上被读完。',
          '每讲结束前有二十分钟互改：两个人一组，只允许问“这句要读者做什么”，问不出来的句子直接划掉。',
        ],
        bullets: ['结构纸：三格填满才动笔', '全文纸：一次写完，不回改', '删改纸：先删三分之一再读'],
      },
      { k: 'fullimg', label: '课堂', img: '04', cap: '课堂不做单向讲解 · 一半时间在互相改稿' },
      {
        k: 'table', label: '安排',
        title: '六讲安排',
        head: ['讲次', '主题', '当场产出'],
        rows: [
          ['01', '先想清楚', '选题结构纸'],
          ['02', '一句话结构', '主张句 ×3'],
          ['03', '删掉一半', '800 → 300 字'],
          ['04', '用图表说话', '一张说明图'],
          ['05', '让人行动', '结论前置改写'],
          ['06', '复盘', '旧文档重写'],
        ],
        note: '每周一讲，连续六周；缺课可看回放并补交作业',
      },
      {
        k: 'quote', label: '引言',
        text: '写得清楚，是因为想得清楚；反过来也成立。',
        by: '主讲 · 林清',
      },
      {
        k: 'end', label: '封底',
        title: '下一期',
        lines: ['CLEAR & COMPLEX · 六讲写作课', '2027 年 3 月开课 · 报名截止 2 月底'],
        mark: 'L',
      },
    ],
  },
  {
    id: 'acid',
    name: '气泡计划',
    en: 'Bubble Program',
    by: 'Gamma',
    cat: '演示文稿',
    fmt: 'deck',
    ratio: '16:9',
    date: 20261105,
    kind: '发布活动',
    category: '活动',
    tags: ['发布', '活动', '快闪'],
    desc: '整页荧光黄的发布企划：黑体压满版面，电紫和荧光粉只用来切分信息，几乎没有留白；配图全是硬闪光——罐体、手、夜里的现场、一叠丝网印海报。适合新品发布、快闪活动、街头企划与品牌联名。',
    bestFor: ['新品发布与快闪企划', '活动执行方案', '品牌联名与街头营销', '招商与赞助提案'],
    styles: ['#E9F24D', '#5B2BE0', '#161616'],
    colorway: '酸性黄 · 电紫 · 墨黑',
    folio: true,
    footLeft: 'BUBBLE PROGRAM · 2027',
    paper: '#E9F24D',
    ink: '#161616',
    accent: '#4B1FD6',
    second: '#FF3D8A',
    muted: '#4F5518',
    rule: '#C6CF32',
    body: '#26261B',
    display: 'sans',
    imgLine: true,
    slides: [
      {
        k: 'cover', label: '封面',
        kicker: 'LAUNCH · 2027.03',
        title: '气泡计划',
        meta: 'BUBBLE PROGRAM · 新品发布 + 三城快闪 · 执行方案',
        img: '01',
      },
      {
        k: 'toc', label: '目录',
        title: '目录',
        note: '三天，一个可以被记住的现场',
        items: [
          ['01', '产品', '一罐只有一件事'],
          ['02', '场地', '在地面喷漆'],
          ['03', '视觉', '四种颜色打完'],
          ['04', '当天', '从下午到午夜'],
          ['05', '物料', '一张清单'],
          ['06', '传播', '现场自己会发'],
        ],
      },
      {
        k: 'statement', label: '命题',
        text: '把一罐饮料的发布，做成三天里有人愿意排队、愿意拍照、愿意再来的现场。',
        foot: '策略单 · 第一版',
      },
      {
        k: 'ticker', label: '口号',
        text: 'BUBBLE 4℃ 限量 1,200 罐 三城同步',
        big: '三天\n只做一件事',
      },
      {
        k: 'stats', label: '关键数字',
        title: '这场活动的三个硬指标',
        items: [
          ['3', '天 · 快闪', '周五到周日，每天 8 小时'],
          ['1,200', '罐 · 现场', '限量编号，售完不补'],
          ['6', '城 · 同步', '首发六城，同一套物料'],
        ],
        note: '口径：首站上海，其余五城按同一执行手册复制',
      },
      {
        k: 'split', label: '产品',
        img: '02',
        title: '一罐只有\n一件事',
        paras: [
          '零糖、气泡足、冰到 4℃。我们不在包装上讲配方，只在冰柜里讲温度——现场所有罐子都从 4℃ 的冷水槽里拿出来。',
          '罐身不印广告语，只印一个编号：第几罐、哪座城、哪一天。喝完了，罐子可以带走。',
        ],
        bullets: ['4℃ 冷水槽，每两小时换冰', '限量编号，不做补货', '空罐可换下一罐半价'],
      },
      {
        k: 'board', label: '视觉',
        img: '04',
        title: '四种颜色打完',
        text: '酸性黄做底、电紫切块、荧光粉只给“限量”两个字、黑压住所有正文。现场不出现第五种颜色，包括工作人员的服装。',
        swatches: [['#E9F24D', '酸性黄 · 底色'], ['#4B1FD6', '电紫 · 分块'], ['#FF3D8A', '荧光粉 · 限量'], ['#161616', '墨黑 · 正文']],
      },
      { k: 'fullimg', label: '现场', img: '03', cap: '现场只在地面喷漆，不做背板 · 夜里八点后关灯开闪光' },
      {
        k: 'timeline', label: '当天',
        title: '一天的节奏',
        items: [
          ['14:00', '开门', '冷水槽就位，编号开售'],
          ['18:00', '换场', '关灯，只留地灯与闪光'],
          ['21:00', '联名', 'DJ 上场，限量第二波'],
          ['24:00', '清场', '地面喷漆保留三天'],
        ],
      },
      {
        k: 'table', label: '物料',
        title: '物料清单',
        head: ['物料', '数量', '交期'],
        rows: [
          ['喷漆模板', '24 套', '3 周'],
          ['丝网海报', '6,000 张', '4 周'],
          ['冷水槽与冰', '6 组', '现场租赁'],
          ['编号贴纸', '1,200 张', '2 周'],
          ['工作人员服装', '120 件', '5 周'],
        ],
        note: '所有印刷品只用两色，超出两色另计',
      },
      {
        k: 'columns', label: '传播',
        title: '现场自己会发',
        note: 'SPREAD',
        cols: [
          { t: '不请摄影', d: '只提供两台一次成像相机，拍完贴在出口墙上，带走需自己拍。' },
          { t: '不做话题', d: '不设指定话题，只在地面喷一句坐标，剩下的交给来的人。' },
          { t: '留三十天', d: '喷漆保留三十天，撤场后墙面成为第二现场。' },
        ],
      },
      { k: 'fullimg', label: '细节', img: '05', cap: '罐身细节 · 冰镇 4℃ 上桌，水珠是唯一的装饰' },
      {
        k: 'end', label: '封底',
        title: '见',
        lines: ['BUBBLE PROGRAM · 气泡计划', '上海 · 2027.03.19 — 03.21'],
        mark: 'B',
      },
    ],
  },
  {
    id: 'saltwater',
    name: 'Saltwater Transit',
    en: 'BUSINESS PLAN · 2027',
    by: 'Gamma',
    cat: '演示文稿',
    fmt: 'deck',
    ratio: '16:9',
    date: 20261104,
    kind: 'Business plan',
    category: '商业规划',
    tags: ['transit', 'ferry', 'climate', 'operations'],
    desc: 'An electric river ferry business plan in indigo and coral: a left rail of section numbers, serif headlines against mono data rows, and photographic pages that keep the water in frame. Numbers are set as ledgers, not as cards.',
    bestFor: ['Transit and ferry business plans', 'Infrastructure proposals', 'Series A investor decks', 'Operations and network reviews'],
    styles: ['#1B2A5C', '#FF7A59', '#F2F1EA'],
    colorway: 'Indigo · Bone · Coral',
    folio: true,
    footLeft: 'SALTWATER TRANSIT · CONFIDENTIAL',
    paper: '#1B2A5C',
    ink: '#F2F1EA',
    accent: '#FF7A59',
    second: '#8FA6C9',
    muted: '#7C8CB2',
    rule: '#2E4076',
    body: '#DCE2EE',
    display: 'serif',
    slides: [
      {
        k: 'cover', label: 'Cover',
        kicker: 'BUSINESS PLAN · SERIES A',
        title: 'Saltwater Transit',
        meta: 'RIVER CROSSINGS · 2027',
        img: '01',
      },
      {
        k: 'toc', label: 'Contents',
        title: 'Contents',
        note: 'SIX PARTS',
        items: [
          ['01', 'The gap', '26 minutes lost, every morning'],
          ['02', 'The fleet', 'Four vessels, all electric'],
          ['03', 'The network', 'Three routes, 14 piers'],
          ['04', 'Unit economics', 'One boat, one month'],
          ['05', 'The plan', 'Two years to three routes'],
          ['06', 'The ask', '12M for four hulls'],
        ],
      },
      {
        k: 'statement', label: 'Thesis',
        text: 'The river is the fastest road in this city. Nobody ever built a bus for it.',
        foot: 'FOUNDER NOTE · 2026.11',
      },
      {
        k: 'stats', label: 'The commute',
        title: 'The commute today',
        items: [
          ['41', 'min · door to door', 'Bridge, 07:30 departure'],
          ['2', 'crossings · 1.2M people', 'One bridge, one tunnel'],
          ['9%', 'commuters on the water', 'Four piers in the centre'],
        ],
        note: 'Source: city transport survey, 2025',
      },
      { k: 'fullimg', label: 'Harbour', img: '10', cap: 'HARBOUR · 06:40 · TWO CROSSINGS ALREADY RUNNING' },
      { k: 'section', label: 'Part 01', num: '01', title: 'The gap', note: 'WHY THE WATER IS EMPTY', img: '03' },
      {
        k: 'columns', label: 'Diagnosis',
        title: 'Why nobody takes the boat',
        note: 'THREE REASONS',
        cols: [
          { t: 'The timetable is a rumour', d: 'Boats leave every 40 minutes and the last one is at 19:20. Miss it, and the bridge is your only way home.' },
          { t: 'The piers are in the wrong place', d: 'Two of the four piers sit 900 m from the nearest office cluster. The walk eats the time the boat saved.' },
          { t: 'You cannot pay with a phone', d: 'Tickets are paper, sold at one window, cash only before 08:00. The bridge takes a tap.' },
        ],
      },
      {
        k: 'compare', label: 'Before / after',
        title: 'Same trip, two mornings',
        left: {
          h: 'TODAY · BRIDGE',
          rows: [['Door to door', '41 min'], ['Predictability', '+/- 14 min'], ['Cost per trip', '3.20'], ['A seat', 'Standing'], ['Emissions', '1.9 kg']],
        },
        right: {
          h: 'WITH SALTWATER',
          rows: [['Door to door', '19 min'], ['Predictability', '+/- 2 min'], ['Cost per trip', '2.80'], ['A seat', 'Always'], ['Emissions', '0.0 kg']],
        },
        note: 'Northbank to Old Quay, 07:30 departure, weekday average',
      },
      {
        k: 'bars', label: 'Peak times',
        title: 'Morning peak, minutes door to door',
        items: [['Bridge · 07:30', 41], ['Tunnel · 07:30', 37], ['Bus, then bridge', 52], ['Saltwater · 07:30', 19]],
        unit: ' min',
        note: 'Own survey, 240 trips, October 2026',
      },
      { k: 'fullimg', label: 'Night', img: '06', cap: 'LAST CROSSING · 22:40 · THE CITY FROM THE WATER' },
      { k: 'section', label: 'Part 02', num: '02', title: 'The fleet', note: 'FOUR VESSELS · ALL ELECTRIC', img: '02' },
      {
        k: 'split', label: 'Vessel',
        img: '04',
        title: 'A cabin built for\neighteen minutes',
        paras: [
          'Sixteen metres, 84 seats, no car deck. Everything is arranged so a passenger can board, sit down and leave without a queue.',
          'Heating and lighting run off the same battery that drives the hull. A full charge takes 40 minutes at the pier, and we charge while people walk on.',
        ],
        bullets: ['84 passengers · 2 crew', '16 m hull · 6.4 m beam', '40 min charge · 9 h service', 'Silent below 8 knots'],
      },
      {
        k: 'gallery', label: 'Detail',
        title: 'Built for weather, not for show',
        items: [
          { img: '07', cap: 'Mooring · every landing is a 40 second stop' },
          { img: '08', cap: 'Charging · 400 kWh at the pier, no shore crew' },
          { img: '09', cap: 'Terminal · shelter, not a shed' },
        ],
        note: 'NORTHBANK PIER · NOVEMBER 2026',
      },
      {
        k: 'table', label: 'Spec',
        title: 'Fleet specification',
        head: ['Item', 'Value', 'Note'],
        rows: [
          ['Length overall', '16.0 m', '7 mm steel hull'],
          ['Passengers', '84', '16 tables of four'],
          ['Battery', '400 kWh', 'LFP, two packs'],
          ['Range per charge', '62 km', 'Nine hours of service'],
          ['Charge time', '40 min', '400 kW at the pier'],
          ['Service speed', '8 knots', '14 knots top'],
        ],
        sum: ['Crew per vessel', '2', 'One master, one deck'],
        note: 'Class: passenger vessel, sheltered waters',
      },
      {
        k: 'metric', label: 'One number',
        kicker: 'TIME SAVED · NORTHBANK TO OLD QUAY',
        big: '19',
        label: 'minutes back, every one way trip',
        note: 'Against the 07:30 bridge crossing · 2026 survey',
      },
      {
        k: 'statement', label: 'Positioning',
        text: 'We are not selling a boat ride. We are selling the twenty minutes you get back before nine.',
        foot: 'POSITIONING · 2026.10',
      },
      { k: 'fullimg', label: 'Crew', img: '14', cap: '05:55 · BRIEFING · TWO CREW, EIGHTY FOUR PASSENGERS' },
      { k: 'section', label: 'Part 03', num: '03', title: 'The network', note: 'THREE ROUTES · 14 PIERS', img: '05' },
      {
        k: 'timeline', label: 'Plan',
        title: 'Two years to three routes',
        items: [
          ['2027 Q1', 'Two hulls ordered', 'Yard slot held for January'],
          ['2027 Q3', 'Northbank rebuilt', '40 second berth, charging'],
          ['2028 Q1', 'Route A live', 'Six minute headway at peak'],
          ['2028 Q4', 'Three routes', '14 piers, four vessels'],
        ],
      },
      {
        k: 'bars', label: 'Demand',
        title: 'Projected weekday passengers',
        items: [['2028 · Route A', 4800], ['2029 · A and B', 11200], ['2030 · all three', 18600]],
        note: 'Base case: 62% load at peak, 34% off peak',
      },
      {
        k: 'columns', label: 'Routes',
        title: 'Where the boats go',
        note: 'THREE ROUTES',
        cols: [
          { t: 'Route A · 6 min', d: 'Northbank to Old Quay. 2.4 km, two piers, six minute headway at peak.' },
          { t: 'Route B · 14 min', d: 'Old Quay to the shipyard. 5.1 km, four piers, connects to the eastern tram at both ends.' },
          { t: 'Route C · 22 min', d: 'Shipyard to the wetlands. 9.6 km, six piers, weekend heavy, no peak service.' },
        ],
      },
      {
        k: 'gallery', label: 'Crossing',
        title: 'A crossing, minute by minute',
        items: [
          { img: '11', cap: 'Tap in · one card, no queue at the gate' },
          { img: '12', cap: 'Rain · the cabin is the point on a wet Tuesday' },
          { img: '13', cap: 'Bikes · eight per crossing, strapped on deck' },
        ],
        note: 'ROUTE A · 07:30 DEPARTURE',
      },
      {
        k: 'table', label: 'Unit economics',
        title: 'One vessel, one month at full service',
        head: ['Item', 'Amount', 'Share'],
        rows: [
          ['Fares · 84 seats at 62%', '148,000', '100%'],
          ['Energy', '9,400', '6%'],
          ['Crew', '41,000', '28%'],
          ['Maintenance and berth', '16,800', '11%'],
          ['Contribution', '80,800', '55%'],
        ],
        sum: ['Net after overhead', '52,300', '35%'],
        note: '2028 fares, per vessel; excludes ticketing and marketing',
      },
      {
        k: 'split', label: 'Refit',
        img: '15',
        title: 'Every eighteen months,\nthe boat comes out',
        paras: [
          'Hulls are lifted every eighteen months for paint, anodes and a full electrical check. We plan the refit in January, when the fleet runs at 61% of peak capacity.',
          'Two vessels out of four is the limit. The schedule is built so that Route A keeps a six minute headway even during a refit, at the cost of Route C dropping to twenty minutes.',
        ],
        bullets: ['14 days in dock, per hull', 'Scheduled in the low season', 'Route A headway held at 6 min'],
      },
      {
        k: 'stats', label: 'The ask',
        title: 'Series A at a glance',
        items: [
          ['12.0M', 'USD · total round', 'Four hulls and two piers'],
          ['4', 'vessels in the plan', 'Two ordered, two optioned'],
          ['31%', 'year three margin', 'At 18,600 weekday riders'],
        ],
        note: 'Use of funds on the next page',
      },
      {
        k: 'compare', label: 'Fare',
        title: 'Fare against the bridge',
        left: { h: 'BRIDGE + PARKING', rows: [['Single trip', '3.20'], ['Monthly pass', '96.00'], ['Wait, in traffic', '14 min']] },
        right: { h: 'SALTWATER', rows: [['Single trip', '2.80'], ['Monthly pass', '72.00'], ['Wait, on the pier', '2 min']] },
        note: 'Local currency; bridge figure includes the daily parking rate',
      },
      {
        k: 'columns', label: 'Use of funds',
        title: 'Where the 12M goes',
        note: 'USE OF FUNDS',
        cols: [
          { t: '7.2M · Hulls', d: 'Two vessels ordered, two on option. The yard slot is held until March 2027.' },
          { t: '3.1M · Piers', d: 'Two new berths, four charging points, and the Northbank rebuild.' },
          { t: '1.7M · Operations', d: 'Crew training, ticketing, and eighteen months of runway before fares cover the schedule.' },
        ],
      },
      {
        k: 'statement', label: 'Test',
        text: 'If the boat is not faster than the bridge on a wet Tuesday, we have built the wrong boat.',
        foot: 'WHAT WE TEST · EVERY QUARTER',
      },
      {
        k: 'end', label: 'End',
        title: 'Thank you',
        lines: ['SALTWATER TRANSIT · BUSINESS PLAN 2027', 'hello@saltwatertransit.example'],
        mark: 'S',
      },
    ],
  },
  {
    id: 'sugar',
    name: 'Sugar & Salt',
    en: 'ACADEMY · INTAKE 12',
    by: 'Gamma',
    cat: '演示文稿',
    fmt: 'deck',
    ratio: '16:9',
    date: 20261105,
    kind: 'Training deck',
    category: '培训',
    tags: ['bakery', 'training', 'food', 'operations'],
    desc: 'A pastry academy training deck printed on dusty pink: double hairline across the top, serif headlines, dotted rules between rows, and oversized serial numbers for every process step. Reads like a course handout, not a pitch.',
    bestFor: ['Academy and onboarding decks', 'SOP and process training', 'Kitchen and retail operations', 'Cohort and curriculum reviews'],
    styles: ['#F2D3CE', '#8E2F26', '#3A1F1C'],
    colorway: 'Dusty pink · Cocoa · Oxblood',
    folio: true,
    footLeft: 'SUGAR & SALT · ACADEMY',
    paper: '#F2D3CE',
    ink: '#3A1F1C',
    accent: '#8E2F26',
    second: '#C97F72',
    muted: '#A8837C',
    rule: '#DFB3AC',
    body: '#4A2B26',
    display: 'serif',
    slides: [
      {
        k: 'cover', label: 'Cover',
        kicker: 'PASTRY ACADEMY · INTAKE 12',
        title: 'Sugar & Salt',
        meta: 'FOUR WEEKS · TWO OVENS · ONE COUNTER',
        img: '01',
      },
      {
        k: 'toc', label: 'Contents',
        title: 'The course',
        note: 'FOUR PARTS',
        items: [
          ['01', 'Lamination', 'Butter, folds, and the cold'],
          ['02', 'The counter', 'Service, speed, waste'],
          ['03', 'The test', 'What a pass looks like'],
          ['04', 'The numbers', 'Fees, cost, and outcomes'],
        ],
      },
      {
        k: 'statement', label: 'Thesis',
        text: 'A croissant is a hundred small decisions, and most of them are about temperature.',
        foot: 'HEAD OF ACADEMY · 2026.09',
      },
      {
        k: 'stats', label: 'Cohort',
        title: 'Intake twelve, at a glance',
        items: [
          ['12', 'students · each intake', 'Six weeks, four days a week'],
          ['1:6', 'instructor ratio', 'Two chefs on the bench'],
          ['38%', 'finish in a bakery', 'Within six months of the test'],
        ],
        note: 'Cohorts 2019 to 2025, 214 students',
      },
      { k: 'fullimg', label: 'Counter', img: '03', cap: 'COUNTER · 06:10 · BEFORE THE FIRST CUSTOMER' },
      { k: 'section', label: 'Part 01', num: '01', title: 'Lamination', note: 'BUTTER, FOLDS, COLD', img: '02' },
      {
        k: 'columns', label: 'Rules',
        title: 'What decides the crumb',
        note: 'THREE RULES',
        cols: [
          { t: 'The butter block', d: 'Butter and dough must sit at the same temperature, 16°C. Two degrees warmer and the layers weld together in the oven.' },
          { t: 'The rest', d: 'Thirty minutes in the cold between folds. Skip it and the gluten fights back on the next pass, and the block tears.' },
          { t: 'The final proof', d: '26°C and 75% humidity for ninety minutes. Warm and fast gives you a pale shell and a tight crumb.' },
        ],
      },
      { k: 'fullimg', label: 'Bench', img: '08', cap: 'BENCH · 05:50 · FLOUR, SCRAPER, ONE DOUGH' },
      {
        k: 'steps', label: 'Process',
        kicker: 'THE PROCESS',
        title: 'Four folds, ninety minutes',
        items: [
          { n: '01', t: 'Mix and chill', d: 'Dough to 24°C, then 40 minutes in the cold room.' },
          { n: '02', t: 'Butter block', d: 'Pounded to 16°C, same firmness as the dough.' },
          { n: '03', t: 'Four folds', d: 'Single, single, double, single. Rest 30 minutes between each.' },
          { n: '04', t: 'Shape and proof', d: '90 minutes at 26°C, then 18 minutes at 210°C.' },
        ],
        note: 'FULL LAMINATION · 27 LAYERS BEFORE THE FINAL FOLD',
      },
      {
        k: 'split', label: 'Butter',
        img: '07',
        title: 'Butter at sixteen\ndegrees',
        paras: [
          'The block is pounded between parchment until it bends without cracking. Too cold and it shatters inside the dough; too warm and it disappears into it.',
          'We check with a probe, not with a thumb. Every student carries one, and the number goes into the log next to the time.',
        ],
        bullets: ['16C · butter and dough', 'Probe, never a thumb', 'Log the time and the number'],
      },
      {
        k: 'table', label: 'Bake',
        title: 'Bake schedule, one morning',
        head: ['Item', 'In', 'Out'],
        rows: [
          ['Croissant', '05:20', '05:38'],
          ['Pain au chocolat', '05:45', '06:03'],
          ['Cardamom bun', '06:10', '06:26'],
          ['Baguette', '06:30', '06:52'],
          ['Tart shells', '07:00', '07:12'],
        ],
        sum: ['First customer', '06:00', ''],
        note: 'Deck oven at 210°C, steam for the first six minutes',
      },
      {
        k: 'gallery', label: 'Bench',
        title: 'The bench, from five',
        items: [
          { img: '12', cap: '05:10 · two on the bench, nothing said out loud' },
          { img: '14', cap: 'Portioning · one cut, no sawing' },
          { img: '15', cap: 'Tart shells · rings lined, never greased' },
        ],
        note: 'INTAKE 12 · WEEK 2',
      },
      {
        k: 'split', label: 'Crumb',
        img: '04',
        title: 'What we look for\nin the crumb',
        paras: [
          'Cut it warm and the crumb collapses. Cut it cold and the layers read as cardboard. We cut at 22°C, ten minutes out of the oven.',
          'A pass has an open, even honeycomb from edge to centre, no dense ring at the base, and a shell that shatters instead of bending.',
        ],
        bullets: ['Open honeycomb, edge to edge', 'No dense ring at the base', 'Shell shatters, not bends', 'Butter smell, not yeast'],
      },
      { k: 'fullimg', label: 'Street', img: '09', cap: 'STREET · 18:20 · THE ONLY LIGHT LEFT ON' },
      { k: 'section', label: 'Part 02', num: '02', title: 'The counter', note: 'SERVICE, SPEED, WASTE', img: '05' },
      {
        k: 'gallery', label: 'Counter',
        title: 'What leaves the counter',
        items: [
          { img: '06', cap: 'The order we sell most · coffee and a croissant' },
          { img: '10', cap: 'One bag, two hands, flat base' },
          { img: '11', cap: 'Kouign-amann · sold out by eleven' },
        ],
        note: 'COUNTER · WEEK 3',
      },
      {
        k: 'columns', label: 'Service',
        title: 'Three things the counter must do',
        note: 'SERVICE',
        cols: [
          { t: 'Say the time', d: 'Four minutes beats just a moment. Every customer hears a number, even when the number is long.' },
          { t: 'Sell the old first', d: 'The tray closest to the till is the tray that sells. Refill from the back, never the front.' },
          { t: 'One bag, two hands', d: 'Boxes are packed with two hands and a flat base. One hand means a crushed corner at the door.' },
        ],
      },
      {
        k: 'steps', label: 'Opening',
        kicker: 'OPENING',
        title: '05:40 to 07:00',
        items: [
          { n: '05:40', t: 'Ovens on', d: 'Deck to 210°C, steam tank filled, trays lined.' },
          { n: '06:00', t: 'First bake out', d: 'Croissants on the rack, case wiped, float counted.' },
          { n: '06:20', t: 'Case dressed', d: 'Three rows, gaps closed, no tray more than half full.' },
          { n: '07:00', t: 'Doors', d: 'Lights on, music at 45 dB, one person on the floor.' },
        ],
        note: 'EVERY DAY, INCLUDING WEEKENDS',
      },
      {
        k: 'table', label: 'Waste',
        title: 'Waste log, one week',
        head: ['Item', 'Baked', 'Sold'],
        rows: [
          ['Croissant', '420', '391'],
          ['Pain au chocolat', '240', '228'],
          ['Cardamom bun', '180', '162'],
          ['Baguette', '150', '149'],
          ['Tart shells', '96', '96'],
        ],
        sum: ['Total', '1,086', '1,026'],
        note: 'Five day week; 5.5% waste, the target is 4%',
      },
      {
        k: 'metric', label: 'Layers',
        kicker: 'ONE CROISSANT · BEFORE THE FINAL FOLD',
        big: '27',
        label: 'butter layers, and none of them visible',
        note: 'Three folds of three, then the final single',
      },
      {
        k: 'statement', label: 'Counter rule',
        text: 'If the tray is empty at four in the afternoon we baked too little. If it is full, we baked too much.',
        foot: 'COUNTER RULE · 2026',
      },
      {
        k: 'timeline', label: 'Weeks',
        title: 'Four weeks, week by week',
        items: [
          ['WEEK 1', 'Dough and butter', 'Mix, chill, first lamination'],
          ['WEEK 2', 'Shaping', 'Croissant, pain, bun, all by hand'],
          ['WEEK 3', 'The counter', 'Two shifts behind the till'],
          ['WEEK 4', 'Test', 'Blind tasting, timed service'],
        ],
      },
      {
        k: 'bars', label: 'Pass rates',
        title: 'Cohort pass rate, by skill',
        items: [['Lamination', 92], ['Shaping', 88], ['Bake and colour', 81], ['Counter service', 76], ['Waste control', 64]],
        unit: '%',
        note: 'Cohorts 2023 to 2025, 96 students',
      },
      { k: 'fullimg', label: 'Probe', img: '13', cap: 'PROBE · 16.0C · THE NUMBER WE CHECK MOST' },
      {
        k: 'steps', label: 'Exam',
        kicker: 'EXAM',
        title: 'What a pass looks like',
        items: [
          { n: '40%', t: 'Crumb and colour', d: 'Blind cut, judged on honeycomb and shell.' },
          { n: '30%', t: 'Speed', d: 'Twelve croissants shaped in twenty minutes.' },
          { n: '20%', t: 'Service', d: 'One hour on the till, timed and observed.' },
          { n: '10%', t: 'Waste', d: 'The week log has to land under 5%.' },
        ],
        note: 'FAIL ANY OF THE FIRST THREE AND THE WEEK IS REPEATED',
      },
      {
        k: 'stats', label: 'Fees',
        title: 'What a place costs',
        items: [
          ['9,400', 'USD · six week course', 'Tools and ingredients included'],
          ['3', 'days a week in the kitchen', 'Two days on theory'],
          ['12', 'students · one bench', 'Never more than six per instructor'],
        ],
        note: 'Fees for 2027; two scholarships per cohort',
      },
      {
        k: 'table', label: 'Tray cost',
        title: 'Cost of one tray of 24',
        head: ['Item', 'Cost', 'Share'],
        rows: [
          ['Flour and butter', '6.40', '41%'],
          ['Labour', '5.10', '33%'],
          ['Energy', '1.20', '8%'],
          ['Packaging', '0.90', '6%'],
          ['Margin', '1.90', '12%'],
        ],
        sum: ['Sell price', '15.50', '100%'],
        note: 'One tray of croissants, 2027 prices',
      },
      {
        k: 'columns', label: 'Shift',
        title: 'Who does what on shift',
        note: 'THE SHIFT',
        cols: [
          { t: 'Head baker', d: 'Owns the oven and the schedule. Calls every bake time out loud, every tray, all morning.' },
          { t: 'Bench', d: 'Shapes, proofs, and keeps the fridge log. Never leaves a tray unlabelled, never leaves a door open.' },
          { t: 'Counter', d: 'Talks to people, packs, and keeps the case dressed. Owns the waste log and the four o clock call.' },
        ],
      },
      {
        k: 'quote', label: 'Alumna',
        text: 'I came in able to bake at home. I left able to bake forty kilos a day, on time, without shouting.',
        by: 'ALUMNA · COHORT 2024',
      },
      {
        k: 'end', label: 'End',
        title: 'See you at 05:40',
        lines: ['SUGAR & SALT · PASTRY ACADEMY', 'academy@sugarandsalt.example'],
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
    case 'sheet':
      return (
        '<div class="sh">' + imgTag(deck, s.img, 'sd-fill') +
        '<div class="sh-frame"></div>' +
        '<div class="sh-block">' +
        '<div class="sh-title">' + esc(s.title || '') + '</div>' +
        s.block.map(([k, v]) => '<div class="sh-row"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>').join('') +
        '</div></div>'
      )
    case 'metric':
      return (
        '<div class="sd-pad sd-metric">' +
        '<div class="sd-mono">' + esc(s.kicker || '') + '</div>' +
        '<div class="sd-metric-v">' + esc(s.big) + '</div>' +
        '<div class="sd-metric-l">' + esc(s.label) + '</div>' +
        (s.note ? '<div class="sd-mono sd-foot">' + esc(s.note) + '</div>' : '') +
        '</div>'
      )
    case 'plate':
      return (
        '<div class="pl">' +
        '<div class="sd-mono pl-no">' + esc(s.no || '') + '</div>' +
        '<div class="pl-img">' + imgTag(deck, s.img, 'sd-fill') + '</div>' +
        '<div class="pl-cap">' + esc(s.cap || '') + '</div>' +
        '</div>'
      )
    case 'ledger':
      return (
        '<div class="sd-pad sd-ledger">' +
        '<h2 class="sd-h2">' + esc(s.title) + '</h2>' +
        '<div class="lg-head">' + s.head.map((h) => '<span>' + esc(h) + '</span>').join('') + '</div>' +
        s.rows.map((r) => '<div class="lg-row">' + r.map((c, i) => '<span' + (i ? ' class="num"' : '') + '>' + esc(c) + '</span>').join('') + '</div>').join('') +
        (s.note ? '<div class="sd-mono sd-foot">' + esc(s.note) + '</div>' : '') +
        '</div>'
      )
    case 'menu':
      return (
        '<div class="sd-pad sd-menu">' +
        '<h2 class="sd-h2">' + esc(s.title) + '</h2>' +
        '<div class="mn-cols">' + s.groups.map((g) =>
          '<div class="mn-col"><div class="sd-mono mn-h">' + esc(g.h) + '</div>' +
          g.items.map(([n, p]) => '<div class="mn-item"><span class="mn-n">' + esc(n) + '</span><i></i><span class="mn-p">' + esc(p) + '</span></div>').join('') +
          '</div>'
        ).join('') + '</div>' +
        (s.note ? '<div class="sd-mono sd-foot">' + esc(s.note) + '</div>' : '') +
        '</div>'
      )
    case 'work':
      return (
        '<div class="sd-pad sd-work">' +
        '<div class="sd-mono">' + esc(s.kicker || 'ASSIGNMENT') + '</div>' +
        '<h2 class="sd-h2">' + esc(s.title) + '</h2>' +
        '<ol class="wk-list">' + s.steps.map((t) => '<li><span class="wk-box"></span>' + esc(t) + '</li>').join('') + '</ol>' +
        (s.note ? '<div class="wk-note">' + esc(s.note) + '</div>' : '') +
        '</div>'
      )
    case 'ticker':
      return (
        '<div class="tk">' +
        '<div class="tk-band"><div class="tk-run">' + new Array(4).fill(esc(s.text)).join('<span>·</span>') + '</div></div>' +
        '<div class="tk-body"><div class="tk-big">' + esc(s.big || '').replace(/\n/g, '<br>') + '</div></div>' +
        '</div>'
      )
    case 'compare':
      return (
        '<div class="sd-pad sd-comp">' +
        '<h2 class="sd-h2">' + esc(s.title) + '</h2>' +
        '<div class="cmp-cols">' +
        [s.left, s.right].map((c, i) =>
          '<div class="cmp-col' + (i ? ' cmp-col-on' : '') + '">' +
          '<div class="sd-mono cmp-h">' + esc(c.h) + '</div>' +
          c.rows.map(([a, b]) => '<div class="cmp-row"><span>' + esc(a) + '</span><b>' + esc(b) + '</b></div>').join('') +
          '</div>'
        ).join('') +
        '</div>' +
        (s.note ? '<div class="sd-mono sd-foot">' + esc(s.note) + '</div>' : '') +
        '</div>'
      )
    case 'gallery':
      return (
        '<div class="sd-pad sd-gal">' +
        '<h2 class="sd-h2">' + esc(s.title) + '</h2>' +
        '<div class="gal-row">' + s.items.map((it) =>
          '<figure class="gal-fig"><div class="gal-img">' + imgTag(deck, it.img, 'sd-fill') + '</div>' +
          '<figcaption>' + esc(it.cap || '') + '</figcaption></figure>'
        ).join('') + '</div>' +
        (s.note ? '<div class="sd-mono sd-foot">' + esc(s.note) + '</div>' : '') +
        '</div>'
      )
    case 'steps':
      return (
        '<div class="sd-pad sd-steps">' +
        '<div class="sd-cols-head">' + (s.kicker ? '<div class="sd-mono">' + esc(s.kicker) + '</div>' : '') +
        '<h2 class="sd-h2">' + esc(s.title) + '</h2></div>' +
        '<div class="stp-row">' + s.items.map((it) =>
          '<div class="stp"><div class="stp-n">' + esc(it.n) + '</div>' +
          '<div class="stp-t">' + esc(it.t) + '</div>' +
          '<p class="stp-d">' + esc(it.d) + '</p></div>'
        ).join('') + '</div>' +
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

const THEME_VARS = ['paper', 'ink', 'accent', 'second', 'muted', 'rule', 'body']

export function slideTheme(deck) {
  const vars = THEME_VARS.map((k) => '--' + k + ':' + (deck[k] || (k === 'body' ? '#4a463d' : ''))).join(';')
  return vars + ';font-family:' + (deck.display === 'serif'
    ? 'Georgia,"Songti SC","Noto Serif SC",serif'
    : 'ui-sans-serif,system-ui,"PingFang SC",sans-serif')
}

export function slideHTML(deck, s, index) {
  const folio = deck.folio
    ? '<div class="sd-folio"><span>' + esc(deck.footLeft || deck.name) + '</span>' +
      '<span>' + esc(String((index || 0) + 1).padStart(2, '0')) + '</span></div>'
    : ''
  return '<div class="sld k-' + deck.id + (deck.imgLine ? ' sld-line' : '') + '" data-k="' + s.k + '" style="' + slideTheme(deck) + '">' +
    slideInner(deck, s) + folio + '</div>'
}

export function deckSlides(deck) {
  return deck.slides.map((s, i) => ({ s, html: slideHTML(deck, s, i) }))
}
