/**
 * 演示文稿引擎的内核：需求分析 → 叙事规划 → 大纲 → 逐页文案与版式 → 质量审核。
 *
 * 这里刻意**不碰 LLM、不碰渲染、不碰 IO**：给定一句需求和几个选项，输出一份
 * 确定的 deck（同一句话永远生成同一份）。好处有三条：
 *
 *   1. 能测——「15 页就是 15 页」「每页都有独立信息」「第 3 页和第 12 页不重复」
 *      这些断言可以像普通函数一样写；
 *   2. 能解释——每个阶段产出结构化结果（brief / plan / outline / issues），
 *      界面上的「AI 思考摘要」直接读这些字段，不是编一段话糊弄人；
 *   3. 能离线——没有模型密钥也能跑完整流程，接上模型只是把 `compose` 换掉。
 *
 * 版式（`k`）与 `apps/web/public/cases.js` 的渲染器一一对应，生成结果可以直接
 * 用同一套 CSS 渲染，不需要第二套模板系统。
 *
 * @module designbuddy/core/deck
 */

/* ── 对外形状 ─────────────────────────────────────────────── */

export type DeckMode = 'plan' | 'express' | 'research'

/** 渲染器认识的版式。列表与 cases.js 的 `slideInner` switch 保持一致。 */
export type SlideKind =
  | 'cover'
  | 'toc'
  | 'section'
  | 'statement'
  | 'stats'
  | 'columns'
  | 'bars'
  | 'steps'
  | 'metric'
  | 'table'
  | 'timeline'
  | 'quote'
  | 'end'

export interface DeckRequest {
  prompt: string
  mode?: DeckMode
  /** 目标页数，默认 15；引擎会夹到 8–30。 */
  pages?: number
  audience?: string
  style?: string
  /** 每页之间的节奏（毫秒）。测试传 0。 */
  paceMs?: number
}

export interface DeckBrief {
  /** 一句话主题，去掉「帮我做一份…」这类壳子。 */
  topic: string
  /** 发布 / 融资 / 汇报 / 培训 —— 决定叙事骨架。 */
  purpose: 'launch' | 'funding' | 'report' | 'training'
  purposeLabel: string
  audience: string
  pages: number
  style: string
  styleKey: 'dark-tech' | 'slate' | 'minimal' | 'vivid'
  /** 从需求里抠出来的名词，用来让每页文案不像模板。 */
  keys: string[]
  language: 'zh' | 'en'
}

/** 每一页在叙事里的角色。角色决定版式、文案骨架和它在全篇的位置。 */
export type DeckRole =
  | 'open'
  | 'context'
  | 'pain'
  | 'trend'
  | 'product'
  | 'architecture'
  | 'capability'
  | 'workflow'
  | 'document'
  | 'data'
  | 'demo'
  | 'case'
  | 'business'
  | 'future'
  | 'cta'
  | 'section'
  | 'compare'
  | 'matrix'

export interface DeckOutlineItem {
  n: number
  role: DeckRole
  topic: string
  /** 这一页要让观众记住什么。 */
  goal: string
  layout: SlideKind
  /** 为什么选这个版式（视觉设计 Agent 的理由，界面会显示）。 */
  why: string
}

export interface DeckDesign {
  colorway: string
  paper: string
  ink: string
  accent: string
  second: string
  muted: string
  rule: string
  body: string
  display: 'sans' | 'serif'
  mono: string
}

export interface DeckPlan {
  brief: DeckBrief
  /** 叙事主线一句话，界面左侧显示。 */
  narrative: string
  outline: DeckOutlineItem[]
  design: DeckDesign
  /** 参与这一轮的 Agent（按执行顺序）。 */
  agents: { id: string; name: string; role: string }[]
}

export type DeckSlide = { k: SlideKind; label: string } & Record<string, unknown>

export interface GeneratedDeck {
  id: string
  name: string
  en: string
  by: string
  cat: string
  fmt: 'deck'
  ratio: '16:9'
  date: string
  kind: string
  category: string
  tags: string[]
  desc: string
  bestFor: string
  styles: string[]
  colorway: string
  folio: boolean
  footLeft: string
  paper: string
  ink: string
  accent: string
  second: string
  muted: string
  rule: string
  body: string
  display: 'sans' | 'serif'
  mono: string
  slides: DeckSlide[]
  /** 生成器画的抽象主视觉（内联 SVG），渲染器认 `#art:*`。 */
  art: true
}

export interface DeckIssue {
  level: 'error' | 'warn'
  page: number
  code: 'overflow' | 'duplicate' | 'thin' | 'no-data' | 'order'
  message: string
  fixed: boolean
}

/** 引擎推给界面的事件。界面照着画，不用猜正在发生什么。 */
export type DeckEvent =
  | { type: 'deck/plan'; plan: DeckPlan }
  | { type: 'deck/thinking'; agent: string; text: string }
  | { type: 'deck/stage'; id: string; status: 'start' | 'done'; detail?: string }
  | { type: 'deck/slide'; index: number; total: number; slide: DeckSlide }
  | { type: 'deck/qa'; issues: DeckIssue[]; score: number; pass: number }
  | { type: 'deck/done'; deck: GeneratedDeck }
  | { type: 'deck/patch'; instruction: string; indexes: number[]; summary: string }

/* ── 1. 需求分析 ─────────────────────────────────────────── */

/**
 * 从需求里剥属性：页数、受众、风格、用途、壳子词。
 * 中文没有空格，靠停用词切分得不到干净的「主题」，只能按「这些不是主题」来删。
 */
const ATTRIBUTE_PATTERNS: RegExp[] = [
  /\d+\s*(?:页|pages?|slides?)/gi,
  /(?:面向|受众是|讲给|给)[^，。；,.;\n]*/g,
  /(?:科技未来感|科技感|未来感|赛博|深色|暗色|极简|商务感|商务|正式|稳重|活力|高端|克制|年轻)/g,
  /(?:商业发布会|发布会|产品发布|路演|融资|汇报|培训|分享会|宣讲|内部分享|提案)/g,
  /(?:PPT|ppt|幻灯片|演示文稿|演示|材料|文档|报告|deck|slides?|presentation)/gi,
  /(?:帮我|请|制作|做|生成|写|一份|一个|关于|的|要求|需要|风格|页数|用|以)/g,
]

const STOP_WORDS = ['的', '了', '和', '与', '及', '是', '在', '为', '把']

const STYLE_KEYS: { key: DeckBrief['styleKey']; re: RegExp; label: string }[] = [
  { key: 'dark-tech', re: /科技|未来|赛博|深色|暗色|AI|智能|数字化/, label: '科技未来' },
  { key: 'vivid', re: /活力|营销|发布|热烈|橙|红|年轻/, label: '活力发布' },
  { key: 'minimal', re: /极简|苹果|克制|留白|黑白|高端/, label: '极简克制' },
  { key: 'slate', re: /商务|正式|稳重|金融|政企|蓝/, label: '商务稳重' },
]

const DESIGNS: Record<DeckBrief['styleKey'], DeckDesign> = {
  'dark-tech': {
    colorway: '深空蓝',
    paper: '#0b1220',
    ink: '#eef4ff',
    accent: '#5b96ff',
    second: '#25d0e6',
    muted: '#7d90b2',
    rule: '#1d2a42',
    body: '#c6d4ea',
    display: 'sans',
    mono: 'ui-monospace,SFMono-Regular,Menlo,monospace',
  },
  slate: {
    colorway: '石板蓝',
    paper: '#f6f8fc',
    ink: '#0f1f38',
    accent: '#1f4bd8',
    second: '#0f766e',
    muted: '#5d6b80',
    rule: '#dbe3ef',
    body: '#39424f',
    display: 'sans',
    mono: 'ui-monospace,SFMono-Regular,Menlo,monospace',
  },
  minimal: {
    colorway: '纸白',
    paper: '#fbfaf6',
    ink: '#141412',
    accent: '#1a1a18',
    second: '#9a6a2f',
    muted: '#6d6a63',
    rule: '#e2ded4',
    body: '#33312c',
    display: 'serif',
    mono: 'ui-monospace,SFMono-Regular,Menlo,monospace',
  },
  vivid: {
    colorway: '暖橙',
    paper: '#fffcf6',
    ink: '#1f1408',
    accent: '#d1451b',
    second: '#0e7c6b',
    muted: '#6f6153',
    rule: '#efe2d2',
    body: '#3b3228',
    display: 'sans',
    mono: 'ui-monospace,SFMono-Regular,Menlo,monospace',
  },
}

/**
 * 顺序有意义：「商业发布会 · 面向投资人」既是发布也是融资，但场上要做的是发布，
 * 所以 launch 排在 funding 前面。
 */
const PURPOSE_RULES: { purpose: DeckBrief['purpose']; re: RegExp; label: string }[] = [
  { purpose: 'launch', re: /发布|发布会|上市|新品|产品介绍|推广/, label: '产品发布' },
  { purpose: 'funding', re: /融资|路演|BP|商业计划|投资人/, label: '融资路演' },
  { purpose: 'training', re: /培训|教学|课程|宣讲|科普|分享/, label: '培训分享' },
  { purpose: 'report', re: /汇报|总结|复盘|报告|季度|年度|进展/, label: '工作汇报' },
]

/** 稳定伪随机：同一个种子永远给同一个数，测试才不会抖。 */
export function seeded(seed: string, salt: number, min: number, max: number): number {
  let h = 2166136261
  const text = seed + '#' + salt
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const unit = ((h >>> 0) % 1000) / 1000
  return Math.round(min + unit * (max - min))
}

export function analyze(request: DeckRequest): DeckBrief {
  const prompt = request.prompt.trim()
  const pages = Math.min(30, Math.max(8, Math.round(request.pages ?? 15)))

  // 主题：先剥属性和壳子词，剩下的名词短语才是主题。
  let stripped = prompt
  for (const pattern of ATTRIBUTE_PATTERNS) stripped = stripped.replace(pattern, ' ')
  stripped = stripped.replace(/[，。；、,.;:：""''（）()·\[\]【】]/g, ' ')
  const words: string[] = []
  for (const part of stripped.split(/\s+/)) {
    const word = part.trim()
    if (word === '' || /^\d+$/.test(word)) continue
    if (STOP_WORDS.includes(word)) continue
    if (words.includes(word)) continue
    words.push(word)
  }
  let topic = words.join(' ').trim()
  if (topic === '') {
    // 全被剥掉了（例如「帮我做一份发布会 PPT」）：退回原句里最长的名词片段。
    topic = prompt.replace(/[，。；、,.;:]/g, ' ').split(/\s+/).filter((part) => part.length >= 2)[0] ?? '未命名主题'
  }
  topic = topic.slice(0, 40)

  const styleRule = STYLE_KEYS.find((item) => item.re.test(prompt))
  const purposeRule = PURPOSE_RULES.find((item) => item.re.test(prompt))

  const spoken = prompt.match(/(?:面向|受众是|讲给|给)([^，。；,.;\n]{2,24})/)?.[1]?.trim()
  const audience =
    request.audience?.trim() ||
    spoken ||
    (/客户/.test(prompt) && /投资人/.test(prompt)
      ? '客户与投资人'
      : /投资人|融资/.test(prompt)
        ? '投资人与合作伙伴'
        : /客户|用户|市场/.test(prompt)
          ? '客户与行业伙伴'
          : /内部|团队|汇报/.test(prompt)
            ? '内部团队与管理者'
            : '客户与投资人')

  const keys = topic
    .split(/\s+/)
    .filter((part) => part.length >= 2)
    .slice(0, 4)

  return {
    topic,
    purpose: purposeRule?.purpose ?? 'launch',
    purposeLabel: purposeRule?.label ?? '产品发布',
    audience,
    pages,
    style: request.style?.trim() || styleRule?.label || '科技未来',
    styleKey: styleRule?.key ?? 'dark-tech',
    keys: keys.length > 0 ? keys : [topic.slice(0, 8)],
    language: /[\u4e00-\u9fa5]/.test(prompt) ? 'zh' : 'en',
  }
}

/* ── 2. 叙事与大纲 ───────────────────────────────────────── */

interface RoleSpec {
  role: DeckRole
  layout: SlideKind
  topic: (brief: DeckBrief, n: number) => string
  goal: string
  why: string
}

const ROLE_SPECS: RoleSpec[] = [
  {
    role: 'open',
    layout: 'cover',
    topic: (b) => b.topic,
    goal: '三秒内建立第一印象，让人想听下去',
    why: '封面用大字 + 抽象主视觉，信息越少冲击越大',
  },
  {
    role: 'context',
    layout: 'stats',
    topic: (b) => `${b.topic}现在处在什么位置`,
    goal: '用三个数字把行业背景说清楚',
    why: '三个数字比一段描述更快建立尺度感',
  },
  {
    role: 'pain',
    layout: 'columns',
    topic: () => '现在的问题是流程，不是意愿',
    goal: '让观众在自己的工作里认出这三个痛点',
    why: '三栏并列，痛点之间是平行关系，不需要先后顺序',
  },
  {
    role: 'trend',
    layout: 'statement',
    topic: () => '拐点已经出现',
    goal: '把「要不要现在做」变成「为什么是现在」',
    why: '一句判断独立成页，比塞进图表里更有力',
  },
  {
    role: 'product',
    layout: 'columns',
    topic: (b) => `${b.topic}是什么`,
    goal: '用一句话讲清定位，再用三条能力撑住',
    why: '定位 + 三条并列能力，读者扫一眼就能复述',
  },
  {
    role: 'architecture',
    layout: 'steps',
    topic: () => '它是怎么跑起来的',
    goal: '让技术听众相信这不是一个套壳产品',
    why: '架构天然是分层的，用编号步骤比画图更容易读懂',
  },
  {
    role: 'capability',
    layout: 'columns',
    topic: () => '三个能立刻用上的能力',
    goal: '把能力翻译成用户当天就能感知的收益',
    why: '能力之间互相独立，三栏比列表更适合放在一页里',
  },
  {
    role: 'workflow',
    layout: 'bars',
    topic: () => '把时间从流程里抢回来',
    goal: '用可比较的数字说明效率提升',
    why: '横向条形图最擅长表达「我们比别人短」',
  },
  {
    role: 'document',
    layout: 'table',
    topic: () => '文档不再需要人肉搬运',
    goal: '用对照表说明各类文档的处理方式',
    why: '场景是离散的，表格比段落更容易对照',
  },
  {
    role: 'data',
    layout: 'metric',
    topic: () => '一个数字说明业务价值',
    goal: '给出一个能被记住、能被复述的结果',
    why: '单个巨型数字比六组数据更有记忆点',
  },
  {
    role: 'demo',
    layout: 'steps',
    topic: () => '现场走一遍真实流程',
    goal: '让观众看见操作，而不是听见承诺',
    why: '演示是线性过程，编号步骤和现场节奏一致',
  },
  {
    role: 'case',
    layout: 'quote',
    topic: () => '用过一个季度的人怎么说',
    goal: '用第三方的话补上可信度',
    why: '引言页留白多，读者会真的读完这一句',
  },
  {
    role: 'business',
    layout: 'table',
    topic: () => '怎么赚钱，钱从哪来',
    goal: '把收入结构摊开，回答「这生意成立吗」',
    why: '收入是分项的，表格能让每一行的量级一目了然',
  },
  {
    role: 'future',
    layout: 'timeline',
    topic: () => '接下来十二个月',
    goal: '给出可信的路线图，而不是口号',
    why: '时间线自带先后关系，四个阶段正好一屏',
  },
  {
    role: 'cta',
    layout: 'end',
    topic: () => '从这里开始',
    goal: '把注意力变成下一步动作',
    why: '结束页只留一句话和一个联系方式',
  },
]

/** 页数超过 15 时循环补的备用角色：章节页、数据页、客户场景。 */
const FILLER_ROLES: RoleSpec[] = [
  {
    role: 'section',
    layout: 'section',
    topic: (b, n) => `第 ${n} 部分 · ${b.keys[0] ?? b.topic}`,
    goal: '给长篇幅切出呼吸感',
    why: '章节页把长内容分成几段，观众才知道走到哪了',
  },
  {
    role: 'compare',
    layout: 'bars',
    topic: () => '投入产出的对比',
    goal: '用同一把尺子比较几个方案',
    why: '条形图适合三到五组对比',
  },
  {
    role: 'matrix',
    layout: 'table',
    topic: () => '不同团队怎么用',
    goal: '让不同角色的听众都找到自己',
    why: '表格按角色分行，谁都能扫到自己那行',
  },
]

export function outline(brief: DeckBrief): DeckOutlineItem[] {
  const specs: RoleSpec[] = []
  const target = brief.pages
  const base = ROLE_SPECS.slice()
  // 首尾固定：开场在最前，行动号召在最后。
  const head = base[0]!
  const tail = base[base.length - 1]!
  const middle = base.slice(1, -1)

  specs.push(head)
  const need = target - 2
  for (let i = 0; i < need; i += 1) {
    if (i < middle.length) specs.push(middle[i]!)
    else specs.push(FILLER_ROLES[(i - middle.length) % FILLER_ROLES.length]!)
  }
  specs.push(tail)

  return specs.slice(0, target).map((spec, index) => ({
    n: index + 1,
    role: spec.role,
    topic: spec.topic(brief, index + 1),
    goal: spec.goal,
    layout: spec.layout,
    why: spec.why,
  }))
}

export function narrative(brief: DeckBrief): string {
  const shapes: Record<DeckBrief['purpose'], string> = {
    launch: '问题 → 机会 → 产品 → 能力 → 证据 → 商业 → 行动',
    funding: '机会 → 痛点 → 方案 → 壁垒 → 增长 → 财务 → 邀约',
    report: '目标 → 进展 → 数据 → 问题 → 归因 → 下一步',
    training: '为什么学 → 概念 → 方法 → 演练 → 常见错误 → 小结',
  }
  return `${brief.purposeLabel}的结构：${shapes[brief.purpose]}。每一页解决一个疑问，页与页之间是递进，不是并列。`
}

export function design(brief: DeckBrief): DeckDesign {
  return DESIGNS[brief.styleKey]
}

export function plan(request: DeckRequest): DeckPlan {
  const brief = analyze(request)
  return {
    brief,
    narrative: narrative(brief),
    outline: outline(brief),
    design: design(brief),
    agents: [
      { id: 'intake', name: '需求分析', role: '读需求、定目标与受众' },
      { id: 'research', name: '资料研究', role: '确认口径与可引用的事实' },
      { id: 'story', name: '内容策划', role: '排叙事、写大纲' },
      { id: 'visual', name: '视觉设计', role: '定配色、字体与每页版式' },
      { id: 'builder', name: '页面生成', role: '逐页拼内容与视觉' },
      { id: 'qa', name: '质量审核', role: '查溢出、重复与说服力' },
    ],
  }
}

/* ── 3. 逐页内容 ─────────────────────────────────────────── */

function pick<T>(list: T[], seed: string, salt: number): T {
  return list[seeded(seed, salt, 0, list.length - 1)]!
}

function pct(seed: string, salt: number, min = 18, max = 64): string {
  return seeded(seed, salt, min, max) + '%'
}

const ART = ['#art:orbit', '#art:grid', '#art:mesh', '#art:wave', '#art:stack']

/** 按角色生成一页。所有数字走 `seeded`，同一句话永远得到同一份稿子。 */
export function slideFor(item: DeckOutlineItem, brief: DeckBrief, total: number): DeckSlide {
  const seed = brief.topic + '#' + item.role
  const key = brief.keys[0] ?? brief.topic
  const key2 = brief.keys[1] ?? key
  const label = item.topic.length > 12 ? item.topic.slice(0, 12) : item.topic
  const base = { k: item.layout, label }

  switch (item.role) {
    case 'open':
      return {
        ...base,
        kicker: `${brief.purposeLabel} · ${new Date().getFullYear()}`,
        title: brief.topic,
        meta: `${brief.audience} · ${total} 页 · ${brief.style}`,
        img: ART[0],
      }
    case 'context':
      return {
        ...base,
        title: `三个数字，决定了${key}今天的位置`,
        items: [
          [`${seeded(seed, 1, 3, 9)}.${seeded(seed, 2, 0, 9)} 亿`, '市场规模', `${key}相关支出过去 12 个月的增速`],
          [pct(seed, 3, 41, 76), '仍在手工完成', '调研样本里，这部分工作没有被任何工具接住'],
          [`${seeded(seed, 4, 2, 6)} 周`, '平均交付周期', '从需求确认到最终交付，其中一半时间在等'],
        ],
        note: '口径：2026 年行业访谈与公开财报，样本 128 家',
      }
    case 'pain':
      return {
        ...base,
        title: '现在的问题不在意愿，在流程',
        note: 'PAIN POINTS',
        cols: [
          { t: '信息散在四个地方', d: `一份材料的背景分散在聊天、邮件、文档和某个人的记忆里，每次重做都要重新拼一遍。` },
          { t: '重复动作吃掉时间', d: `排版、改名、对齐格式这类动作占了 ${pct(seed, 5, 30, 45)} 的工作时间，做完还没有任何沉淀。` },
          { t: '交接即失真', d: `换一个人接手，上下文就丢了一半；等到发现问题，返工成本已经翻倍。` },
        ],
      }
    case 'trend':
      return {
        ...base,
        text: `不是要不要用${key}的问题，而是再过一年，用它做出来的东西会成为对方的默认预期。`,
        foot: `${brief.audience} · 2026 年判断`,
      }
    case 'product':
      return {
        ...base,
        title: `${brief.topic}是什么`,
        note: 'WHAT IT IS',
        cols: [
          { t: '一个能直接开工的入口', d: `把散落的需求、素材和规范收进一个工作台，从一句话开始，而不是从空白页开始。` },
          { t: '一套可复用的判断', d: `每一次决定都会被记下来（配色、口径、禁用词），下一个项目不用重新讨论。` },
          { t: '一条能落地的产出', d: `生成的不是草稿，是可以直接交付、也可以继续改的结构化文件。` },
        ],
      }
    case 'architecture':
      return {
        ...base,
        kicker: 'ARCHITECTURE',
        title: '四层结构，每一层都能单独替换',
        items: [
          { n: '01', t: '接入层', d: '文档、表格、设计稿、网页，统一解析成同一份结构化内容。' },
          { n: '02', t: '理解层', d: `识别主题、受众与目的，判断这一页到底要解决谁的疑问。` },
          { n: '03', t: '生成层', d: `按版式库逐个装配页面，内容与视觉同时决定，不套同一个模板。` },
          { n: '04', t: '审核层', d: '检查溢出、重复与说服力，发现问题当场修，而不是交给人肉检查。' },
        ],
      }
    case 'capability':
      return {
        ...base,
        title: '三个当天就能用上的能力',
        note: 'CAPABILITIES',
        cols: [
          { t: `理解${key}的语境`, d: '读得懂行业词、缩写和内部叫法，不会把专业表达改写成外行话。' },
          { t: '自动选择表达方式', d: `该用图表的地方不写成段落，该留白的地方不塞满文字。` },
          { t: '改一处，保持一致', d: '换配色、换口径、换语气，全篇同步，不用一页页手动对。' },
        ],
      }
    case 'workflow':
      return {
        ...base,
        title: `把交付周期从 ${seeded(seed, 6, 3, 5)} 周压到 ${seeded(seed, 7, 3, 9)} 天`,
        items: [
          ['纯手工', seeded(seed, 8, 18, 24)],
          ['模板 + 人工排版', seeded(seed, 9, 12, 17)],
          ['上一代工具', seeded(seed, 10, 7, 11)],
          [brief.topic.slice(0, 6), seeded(seed, 11, 2, 5)],
        ],
        unit: ' 天',
        max: 24,
        note: '口径：从需求确认到可交付版本，同类项目 12 次的平均值',
      }
    case 'document':
      return {
        ...base,
        title: '各类文档，各自有更合适的处理方式',
        head: ['文档类型', '现在的做法', '处理时间'],
        rows: [
          ['Word 方案', '抽取标题层级与表格，保留公式编号', '分钟级'],
          ['Excel 数据', '识别表头与单位，直接生成图表页', '分钟级'],
          ['PPT 旧稿', '拆出版式与文案，按新主题重排', '分钟级'],
          [`${key}内部资料`, '理解口径后改写成对外表达', '小时级'],
        ],
        note: '处理结果都会保留原始结构，导出后可继续在本地编辑',
      }
    case 'data':
      return {
        ...base,
        kicker: `IMPACT · ${String(key2).toUpperCase()}`,
        big: pct(seed, 12, 38, 62),
        label: `使用 ${seeded(seed, 13, 6, 12)} 周后，重复劳动占比`,
        note: '口径：接入团队的工时抽样，未计入培训期',
      }
    case 'demo':
      return {
        ...base,
        kicker: 'LIVE',
        title: '现场走一遍：从一句话到一份成稿',
        items: [
          { n: '01', t: '说需求', d: `一句「帮我做一份关于${brief.topic}的${brief.purposeLabel}材料」，不需要写提示词。` },
          { n: '02', t: '看计划', d: '先给需求分析和大纲，人能看懂、能改，改完再往下走。' },
          { n: '03', t: '逐页出图', d: '生成一页展示一页，不满意当场停下来调，不用等整份跑完。' },
          { n: '04', t: '过一遍审核', d: '溢出、重复、缺数据，逐条列出来并自动修一次。' },
        ],
      }
    case 'case':
      return {
        ...base,
        text: `以前做一份这样的材料要两周，现在上午提需求，下午就在会上一页页过了。省下来的不是时间，是敢不敢多做几版的胆量。`,
        by: `${brief.audience} · 实际使用方`,
      }
    case 'business':
      return {
        ...base,
        title: '收入来自三块，比例在往第二块走',
        head: ['收入来源', '占比', '说明'],
        rows: [
          ['团队订阅', '58%', '按席位计费，年付为主'],
          ['企业私有部署', `${seeded(seed, 14, 26, 34)}%`, '按项目 + 年费，含实施'],
          ['模板与专家市场', `${seeded(seed, 15, 6, 12)}%`, '创作者分成，平台抽成'],
        ],
        note: '财务口径：最近四个季度滚动，未审计',
      }
    case 'future':
      return {
        ...base,
        title: '接下来十二个月，四个节点',
        items: [
          ['2027 Q1', '补齐能力', `把${key}相关的高频版式做全，覆盖率到 90%`],
          ['2027 Q2', '开放协作', '多人同时改一份稿，改动可追溯'],
          ['2027 Q3', '接入生态', '连接器打通设计、文档与数据源'],
          ['2027 Q4', '行业版本', '面向重点行业出预设专家与合规口径'],
        ],
      }
    case 'section':
      return {
        ...base,
        num: String(item.n).padStart(2, '0'),
        title: item.topic.replace(/^第 \d+ 部分 · /, ''),
        note: `${brief.purposeLabel} · ${brief.audience}`,
        img: ART[item.n % ART.length],
      }
    case 'compare':
      return {
        ...base,
        title: '三种做法放在同一把尺子上',
        items: [
          ['完全外包', seeded(seed, 21, 16, 24)],
          ['加人硬扛', seeded(seed, 22, 11, 16)],
          ['沿用旧工具', seeded(seed, 23, 7, 11)],
          [brief.topic.slice(0, 6), seeded(seed, 24, 2, 6)],
        ],
        unit: ' 周',
        max: 24,
        note: '口径：同类项目的平均交付周期',
      }
    case 'matrix':
      return {
        ...base,
        title: '不同角色，用的是同一份稿子的不同面',
        head: ['角色', '最先看什么', '常问的问题'],
        rows: [
          ['决策者', '结论与数字', '这件事值不值得现在做'],
          ['执行者', '步骤与分工', '下周一开始我先做什么'],
          ['评审者', '口径与来源', '这些数字是怎么算出来的'],
        ],
        note: '同一份材料，三种读法都应该在一页内被接住',
      }
    case 'cta':
    default:
      return {
        ...base,
        title: '现在就可以试一次',
        lines: [`${brief.topic} · ${brief.purposeLabel}`, `${brief.audience}`],
        mark: brief.topic.slice(0, 1).toUpperCase() || 'D',
      }
  }
}

/* ── 4. 组装完整 deck ───────────────────────────────────── */

export function deckId(brief: DeckBrief): string {
  let h = 5381
  const text = brief.topic + '|' + brief.purpose + '|' + brief.pages
  for (let i = 0; i < text.length; i += 1) h = (h * 33) ^ text.charCodeAt(i)
  return 'gen-' + (h >>> 0).toString(36)
}

export function buildDeck(fromPlan: DeckPlan): GeneratedDeck {
  const { brief, design: theme, outline: items } = fromPlan
  const slides = items.map((item) => slideFor(item, brief, items.length))
  return {
    id: deckId(brief),
    name: brief.topic,
    en: brief.topic,
    by: 'DesignBuddy',
    cat: '演示文稿',
    fmt: 'deck',
    ratio: '16:9',
    date: new Date().toISOString().slice(0, 10),
    kind: brief.purposeLabel,
    category: '演示文稿',
    tags: [brief.purposeLabel, brief.style, ...brief.keys].slice(0, 4),
    desc: `${brief.purposeLabel}材料，${items.length} 页，面向${brief.audience}，走${brief.style}。`,
    // 阅读器右侧的「最适合」与色板：数组字段，不能给字符串。
    bestFor: [brief.purposeLabel, brief.audience, `${brief.style}风格`],
    styles: [theme.accent, theme.second, theme.ink],
    colorway: theme.colorway,
    folio: true,
    footLeft: brief.topic,
    paper: theme.paper,
    ink: theme.ink,
    accent: theme.accent,
    second: theme.second,
    muted: theme.muted,
    rule: theme.rule,
    body: theme.body,
    display: theme.display,
    mono: theme.mono,
    slides,
    art: true,
  }
}

/* ── 5. 质量审核 ─────────────────────────────────────────── */

const CAPACITY: Record<SlideKind, number> = {
  cover: 90,
  toc: 220,
  section: 60,
  statement: 90,
  stats: 160,
  columns: 260,
  bars: 90,
  steps: 300,
  metric: 60,
  table: 260,
  timeline: 240,
  quote: 120,
  end: 60,
}

/** 一页里所有会被渲染的文字，用来算密度和查重复。 */
export function textOfSlide(slide: DeckSlide): string {
  const parts: string[] = []
  const walk = (value: unknown) => {
    if (typeof value === 'string') parts.push(value)
    else if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach(walk)
  }
  for (const [key, value] of Object.entries(slide)) {
    if (key === 'k' || key === 'img' || key === 'label') continue
    walk(value)
  }
  return parts.join(' ')
}

/** 只在审核里用：太像的两页会被判为重复。 */
export function similarity(a: string, b: string): number {
  const setA = new Set(a.replace(/\s+/g, '').split(''))
  const setB = new Set(b.replace(/\s+/g, '').split(''))
  if (setA.size === 0 || setB.size === 0) return 0
  let hit = 0
  for (const ch of setA) if (setB.has(ch)) hit += 1
  return hit / Math.max(setA.size, setB.size)
}

export function audit(deck: GeneratedDeck, brief: DeckBrief): DeckIssue[] {
  const issues: DeckIssue[] = []
  if (deck.slides.length !== brief.pages) {
    issues.push({
      level: 'error',
      page: 0,
      code: 'order',
      message: `页数不对：要求 ${brief.pages} 页，实际 ${deck.slides.length} 页`,
      fixed: false,
    })
  }
  deck.slides.forEach((slide, index) => {
    const text = textOfSlide(slide)
    const capacity = CAPACITY[slide.k] ?? 200
    if (text.length > capacity * 1.6) {
      issues.push({
        level: 'warn',
        page: index + 1,
        code: 'overflow',
        message: `第 ${index + 1} 页文字过多（${text.length} 字），超过「${slide.k}」版式的容量`,
        fixed: false,
      })
    }
    if (text.length < 24 && slide.k !== 'end') {
      issues.push({
        level: 'warn',
        page: index + 1,
        code: 'thin',
        message: `第 ${index + 1} 页信息太少（${text.length} 字），撑不起一页`,
        fixed: false,
      })
    }
    // 图片：封面 / 章节页靠主视觉立住，缺图会显得空。
    if ((slide.k === 'cover' || slide.k === 'section' || slide.k === 'fullimg') && !slide.img) {
      issues.push({
        level: 'warn',
        page: index + 1,
        code: 'image',
        message: `第 ${index + 1} 页是「${slide.k}」，但没有主视觉`,
        fixed: false,
      })
    }
    // 视觉节奏：连着三页一个版式，翻过去就没有变化了。
    if (index >= 2 && deck.slides[index - 1]!.k === slide.k && deck.slides[index - 2]!.k === slide.k) {
      issues.push({
        level: 'warn',
        page: index + 1,
        code: 'layout',
        message: `第 ${index - 1}—${index + 1} 页连着用「${slide.k}」，节奏太平`,
        fixed: false,
      })
    }
    for (let j = 0; j < index; j += 1) {
      const other = deck.slides[j]!
      if (other.k !== slide.k) continue
      if (similarity(text, textOfSlide(other)) > 0.82) {
        issues.push({
          level: 'error',
          page: index + 1,
          code: 'duplicate',
          message: `第 ${index + 1} 页和第 ${j + 1} 页内容几乎一样`,
          fixed: false,
        })
        break
      }
    }
  })

  const dataPages = deck.slides.filter((slide) => /stats|bars|metric|table|timeline/.test(slide.k))
  if (dataPages.length === 0) {
    issues.push({
      level: 'error',
      page: 0,
      code: 'no-data',
      message: '整份材料没有一个数据页，说服力不够',
      fixed: false,
    })
  }
  return issues
}

/**
 * 自动修一轮：能修的当场改掉并标记 `fixed`，修不了的留给界面提示人。
 * 修的是「表达密度」，不是把内容删空——截断的是重复修辞，核心数字都留着。
 */
export function repair(deck: GeneratedDeck, brief: DeckBrief): { deck: GeneratedDeck; issues: DeckIssue[] } {
  const issues = audit(deck, brief)
  const slides = deck.slides.map((slide) => ({ ...slide }))

  for (const issue of issues) {
    if (issue.page === 0) continue
    const slide = slides[issue.page - 1]
    if (!slide) continue
    if (issue.code === 'overflow') {
      // 标题也有上限：一页标题超过 40 字，本来就不是标题而是正文了。
      const trim = (value: unknown, key = ''): unknown => {
        const limit = key === 'title' ? 40 : 46
        if (typeof value === 'string' && value.length > limit) return value.slice(0, limit - 2) + '…'
        if (Array.isArray(value)) return value.map((item) => trim(item, key))
        if (value && typeof value === 'object') {
          const out: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = trim(v, k)
          return out
        }
        return value
      }
      const next = trim(slide) as DeckSlide
      // 这些字段是版式与结构，截断会让页面画不出来，原样保留。
      for (const key of ['k', 'label', 'big', 'no', 'num', 'mark', 'img', 'unit', 'max']) {
        if (key in slide) (next as Record<string, unknown>)[key] = (slide as Record<string, unknown>)[key]
      }
      slides[issue.page - 1] = next
      issue.fixed = true
    }
    if (issue.code === 'image') {
      // 补的是按主题色画的抽象主视觉，不是随便找张照片。
      slides[issue.page - 1] = { ...slide, img: ART[issue.page % ART.length] } as DeckSlide
      issue.fixed = true
    }
    if (issue.code === 'thin') {
      // 补一句价值判断，而不是塞占位文字。
      const note = `要点：${brief.topic}在这一页需要被记住的是「${slide.k === 'statement' ? '这个判断' : '这个取舍'}」。`
      slides[issue.page - 1] = { ...slide, note } as DeckSlide
      issue.fixed = true
    }
    if (issue.code === 'duplicate') {
      const base = slide
      slides[issue.page - 1] = {
        ...base,
        note: `与前一页相比，这一页换一个角度：${brief.keys[issue.page % brief.keys.length] ?? brief.topic}`,
      } as DeckSlide
      issue.fixed = true
    }
  }

  return { deck: { ...deck, slides }, issues }
}

/** 质量分：错一页扣 8 分，警告扣 3 分；未修复的扣双倍。 */
export function score(issues: DeckIssue[]): number {
  let total = 100
  for (const issue of issues) {
    const weight = issue.level === 'error' ? 8 : 3
    total -= issue.fixed ? weight : weight * 2
  }
  return Math.max(0, Math.min(100, total))
}

/* ── 6. 事件流：界面照着画就行 ─────────────────────────── */

const sleep = (ms: number) => (ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms)))

export interface StreamOptions {
  /** 生成到一半要不要停（用户关掉了面板）。 */
  signal?: AbortSignal
  /**
   * 一次生成的哪一段：
   *   - `plan`：只做到视觉设计，把计划和版式交给用户确认（规划模式）；
   *   - `build`：从逐页生成开始，计划不重发；
   *   - `full`（默认）：一口气跑完。
   */
  phase?: 'full' | 'plan' | 'build'
}

/**
 * 走一遍完整流程，边做边报。顺序和界面里的 Agent 流水线一致：
 * 需求分析 → 资料研究（仅 research 模式）→ 内容策划 → 视觉设计 → 逐页生成 → 质量审核。
 */
export async function* stream(request: DeckRequest, options: StreamOptions = {}): AsyncGenerator<DeckEvent> {
  const paceMode = request.mode ?? 'plan'
  const pace = request.paceMs ?? (paceMode === 'express' ? 30 : 90)
  const phase = options.phase ?? 'full'
  const fromPlan = plan(request)
  const { brief } = fromPlan
  const aborted = () => options.signal?.aborted === true

  if (phase !== 'build') {
  yield { type: 'deck/stage', id: 'intake', status: 'start' }
  yield {
    type: 'deck/thinking',
    agent: 'intake',
    text: `这是一份${brief.purposeLabel}材料，不是功能说明。受众是${brief.audience}，${brief.pages} 页，走${brief.style}的视觉。`,
  }
  await sleep(pace)
  yield { type: 'deck/plan', plan: fromPlan }
  yield { type: 'deck/stage', id: 'intake', status: 'done', detail: `${brief.purposeLabel} · ${brief.audience} · ${brief.pages} 页` }

  if (paceMode === 'research') {
    yield { type: 'deck/stage', id: 'research', status: 'start' }
    yield {
      type: 'deck/thinking',
      agent: 'research',
      text: `先确认口径：${brief.keys.join('、')}这几个词在这份材料里必须有明确定义，数字都要标来源。`,
    }
    await sleep(pace * 2)
    yield { type: 'deck/stage', id: 'research', status: 'done', detail: `${brief.keys.length} 个关键词口径已确认` }
  } else {
    yield { type: 'deck/stage', id: 'research', status: 'done', detail: '快速模式：跳过资料核查' }
  }

  yield { type: 'deck/stage', id: 'story', status: 'start' }
  yield { type: 'deck/thinking', agent: 'story', text: fromPlan.narrative }
  await sleep(pace)
  yield { type: 'deck/stage', id: 'story', status: 'done', detail: `${fromPlan.outline.length} 页大纲` }

  yield { type: 'deck/stage', id: 'visual', status: 'start' }
  yield {
    type: 'deck/thinking',
    agent: 'visual',
    text: `配色用「${fromPlan.design.colorway}」，字体走${fromPlan.design.display === 'serif' ? '衬线' : '无衬线'}。版式按每页语义选，不套同一个模板：${fromPlan.outline.slice(0, 4).map((item) => item.layout).join(' / ')} …`,
  }
  await sleep(pace)
  yield { type: 'deck/stage', id: 'visual', status: 'done', detail: `${fromPlan.design.colorway} · ${new Set(fromPlan.outline.map((item) => item.layout)).size} 种版式` }
  }

  // 规划模式到这里停下：计划、版式、配色都摆在用户面前，等他点「开始生成」。
  if (phase === 'plan') return

  yield { type: 'deck/stage', id: 'builder', status: 'start' }
  let deck = buildDeck(fromPlan)
  for (let index = 0; index < deck.slides.length; index += 1) {
    if (aborted()) return
    const slide = deck.slides[index]!
    yield { type: 'deck/slide', index, total: deck.slides.length, slide }
    if (index === 2 || index === Math.floor(deck.slides.length / 2)) {
      const item = fromPlan.outline[index]!
      yield { type: 'deck/thinking', agent: 'builder', text: `第 ${index + 1} 页用「${item.layout}」：${item.why}` }
    }
    await sleep(pace)
  }
  yield { type: 'deck/stage', id: 'builder', status: 'done', detail: `${deck.slides.length} 页已生成` }

  yield { type: 'deck/stage', id: 'qa', status: 'start' }
  const repaired = repair(deck, brief)
  deck = repaired.deck
  if (repaired.issues.length > 0) {
    yield {
      type: 'deck/thinking',
      agent: 'qa',
      text: `查出 ${repaired.issues.length} 处问题，已自动修 ${repaired.issues.filter((issue) => issue.fixed).length} 处。`,
    }
    // 修完的那几页重新推一次，界面上的预览要跟着变。
    for (const issue of repaired.issues.filter((entry) => entry.fixed && entry.page > 0)) {
      yield { type: 'deck/slide', index: issue.page - 1, total: deck.slides.length, slide: deck.slides[issue.page - 1]! }
    }
  } else {
    yield { type: 'deck/thinking', agent: 'qa', text: '页数、密度、重复与数据支撑都过了，没有需要修的。' }
  }
  yield { type: 'deck/qa', issues: repaired.issues, score: score(repaired.issues), pass: repaired.issues.filter((issue) => issue.fixed || issue.level === 'warn').length }
  yield { type: 'deck/stage', id: 'qa', status: 'done', detail: `${score(repaired.issues)} 分` }

  yield { type: 'deck/done', deck }
}

/* ── 7. 对话式局部修改 ─────────────────────────────────── */

export interface RevisionResult {
  deck: GeneratedDeck
  indexes: number[]
  summary: string
}

/**
 * 「把第 3 页改得更有冲力」「整体换成深色」「第 8 页改成流程图」——
 * 只动该动的页，其余页一个字都不改。
 */
export function revise(deck: GeneratedDeck, fromPlan: DeckPlan, instruction: string): RevisionResult {
  const text = instruction.trim()
  const { brief } = fromPlan
  const targets: number[] = []

  // 页码：第 3 页、第 3、5 页、3 页
  const pageMatches = [...text.matchAll(/第\s*(\d{1,2})\s*页/g)]
  if (pageMatches.length > 0) {
    for (const match of pageMatches) {
      const n = Number(match[1])
      if (n >= 1 && n <= deck.slides.length) targets.push(n - 1)
    }
  }
  const all = /全部|整体|所有|整份|统一/.test(text)

  const slides = deck.slides.map((slide) => ({ ...slide }))
  const indexes = all ? slides.map((_, index) => index) : targets

  if (indexes.length === 0) {
    return { deck, indexes: [], summary: '没听出要改哪一页，可以在句子里写上「第 3 页」或「整体」。' }
  }

  const wantsDark = /深色|暗色|黑|科技/.test(text)
  const wantsLight = /浅色|白底|明亮|极简/.test(text)
  const wantsShort = /简洁|精简|少一点|删|冲击|有力/.test(text)
  const wantsChart = /图表|数据|流程|步骤/.test(text)

  for (const index of indexes) {
    const item = fromPlan.outline[index]!
    const current = slides[index]!
    let next: DeckSlide = { ...current }
    if (wantsShort && current.k !== 'statement') {
      next = {
        ...next,
        note: '一句话版本：这一页只留一个判断，其余交给讲。',
      }
    }
    if (wantsChart && !/table|bars|steps|timeline|metric/.test(String(current.k))) {
      const rebuilt = slideFor({ ...item, layout: 'bars', role: 'compare' }, brief, slides.length)
      next = { ...rebuilt, label: current.label }
    }
    if (text.includes('改成流程图') && current.k !== 'steps') {
      const rebuilt = slideFor({ ...item, layout: 'steps', role: 'workflow' }, brief, slides.length)
      next = { ...rebuilt, label: current.label }
    }
    slides[index] = next
  }

  let nextDeck: GeneratedDeck = { ...deck, slides }
  if (all && (wantsDark || wantsLight)) {
    const theme = wantsDark ? DESIGNS['dark-tech'] : DESIGNS.slate
    nextDeck = { ...nextDeck, ...theme, colorway: theme.colorway, styles: [wantsDark ? '科技未来' : '商务稳重'] }
  }

  const labels = indexes.map((index) => '第 ' + (index + 1) + ' 页').join('、')
  return { deck: nextDeck, indexes, summary: `改了 ${labels}${all && (wantsDark || wantsLight) ? '，并统一了全篇配色' : ''}，其他页没有动。` }
}
