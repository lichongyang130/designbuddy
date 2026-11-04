/**
 * 大纲先行：先把「要做成什么」摊开给用户看，确认之后再产出。
 *
 * 演示文稿有自己的引擎（`core/deck`：需求分析 → 策划 → 视觉 → 逐页 → 审核），
 * 别的产出类型（文档 / 轮播图 / 图片）没有那么多阶段，但同样需要先定结构：
 * 一份文档先定章节，一组轮播先定几屏，一组图先定拍什么。
 *
 * 这里就是那一步：**纯函数**，同一句需求算出来的大纲永远一样（和 `core/deck`
 * 的 plan 段同一个约定），界面拿到的是可以直接渲染的结构化字段，不用猜。
 *
 * 口径说明（和 deck 一样写在明处）：章节标题与要点是按「产出类型 + 主题 + 受众」
 * 派生的规则模板，不是模型写的文案。接上 `core/llm` 以后，`outlineFor()` 里那几段
 * 模板换成一到两次模型调用即可，返回结构不用动，界面也不用动。
 *
 * @module designbuddy/core/outline
 */

import { audienceOf, subjectOf } from './subject.ts'

export type OutlineKind = 'doc' | 'carousel' | 'image'

export interface OutlinePoint {
  text: string
  /** 小标签，例如「建议」「待补数据」。界面渲染成右侧小徽标。 */
  tag?: string
}

export interface OutlineSection {
  n: number
  title: string
  points: OutlinePoint[]
}

export interface OutlineStep {
  id: string
  label: string
  detail?: string
}

export interface Outline {
  kind: OutlineKind
  /** 中文类型名，界面标题用：文档 / 轮播图 / 图片。 */
  kindLabel: string
  title: string
  /** 计量单位：章 / 屏 / 张。 */
  unit: string
  count: number
  /** 一句话口径，界面左侧第一句。 */
  brief: string
  audience: string
  /** 结构主线，右侧工具栏的副标题。 */
  shape: string
  sections: OutlineSection[]
  /** 左侧对话里智能体要说的话（按顺序逐条出现）。没写东西的时候也有话说。 */
  narration: string[]
  /** 左侧清单，界面按顺序点亮。 */
  steps: OutlineStep[]
  /** 拼进生成提示词的大纲正文，一行一页。 */
  items: string[]
  /** 引擎判定的输出类型，deck 之外的三种都在这里。 */
  spec: string
}

export interface OutlineRequest {
  prompt: string
  kind: string
  count?: number
  style?: string
}

const SHELL_WORDS = [
  '帮我做一份', '帮我写一份', '帮我做', '帮我写', '帮我生成', '请帮我', '请', '帮我',
  '给我做一份', '给我做', '给我写一份', '给我写', '给我生成', '给我',
  '生成一份', '生成一个', '生成', '做一份', '做一个', '做', '写一份', '写一个', '写',
  '制作一份', '制作', '一份', '一个', '关于',
]

const STOP = new Set([
  '一份', '一个', '这个', '那个', '我们', '你们', '他们', '以及', '还有', '内容', '东西',
])

/** 类型 → 中文名 / 单位 / 默认数量 / 上限。 */
const KINDS: Record<OutlineKind, { label: string; unit: string; count: number; max: number }> = {
  doc: { label: '文档', unit: '章', count: 5, max: 12 },
  carousel: { label: '轮播图', unit: '屏', count: 6, max: 12 },
  image: { label: '图片', unit: '张', count: 4, max: 8 },
}

/** 界面上「文档 / 轮播图 / 图片」之外的说法也能进来，统一归到三种之一。 */
export function kindOf(kind: string): OutlineKind {
  if (/轮播|slide\s*show|carousel|九宫格|条漫/i.test(kind)) return 'carousel'
  if (/图|image|photo|banner|海报/i.test(kind)) return 'image'
  return 'doc'
}

function cleanTopic(prompt: string): string {
  let text = prompt.trim()
  for (const word of SHELL_WORDS) {
    if (text.startsWith(word)) text = text.slice(word.length).trim()
  }
  // 「面向新员工的…」「给一款台灯做…」：留下被描述的对象，去掉介词壳。
  text = text.replace(/^(面向|针对|讲给|给)([^，。；,.\n]{2,20}?)(的|听|做|写|出|$)/, '$2 ')
  text = text
    .replace(/\d+\s*(页|张|屏|章|节|个)/g, ' ')
    .replace(/[，。；、,.;:：""''（）()·[\]【】]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim().replace(/^(一|这|那)(款|个|份|组|套|张|批)/, ''))
    .filter((part) =>
      part !== '' &&
      !STOP.has(part) &&
      !/^(一|这|那)(款|个|份|组|套|张|批)$/.test(part) &&
      !/^(做|写|出|要|做一)$/.test(part))
    .join(' ')
    .trim()
  if (text === '') text = prompt.replace(/[，。；、,.;:]/g, ' ').trim()
  return text.slice(0, 28) || '未命名主题'
}

function readCount(prompt: string, kind: OutlineKind, given?: number): number {
  const limit = KINDS[kind]
  if (given && Number.isFinite(given)) return Math.min(limit.max, Math.max(2, Math.round(given)))
  const hit = prompt.match(/(\d+)\s*(页|张|屏|章|节)/)
  if (hit?.[1]) return Math.min(limit.max, Math.max(2, Number(hit[1])))
  return limit.count
}

function readAudience(prompt: string, kind: OutlineKind): string {
  const hit = prompt.match(/(?:面向|针对|讲给|给)([^，。；,.\n]{2,20}?)(?:的|听|做|写|生成|出|看|，|,|。|；|;|$)/)
  const spoken = hit?.[1]?.replace(/^(一|这|那)(款|个|份|组|套|张)/, '').trim()
  if (spoken && spoken.length >= 2 && spoken.length <= 14) return spoken
  if (/投资人|融资/.test(prompt)) return '投资人与管理层'
  if (/客户|甲方|外部/.test(prompt)) return '客户'
  if (/新人|新员工|培训|教学|科普/.test(prompt)) return '第一次接触这个主题的人'
  if (/团队|内部|同事/.test(prompt)) return '团队同事'
  return kind === 'image' ? '看图的受众' : '泛读者'
}

function readTag(prompt: string): '建议' | '待补数据' | '需确认' {
  if (/数据|指标|增长|营收|转化/.test(prompt)) return '待补数据'
  if (/合规|法律|风险|预算|报价/.test(prompt)) return '需确认'
  return '建议'
}

/* ── 三种产出各自的结构模板 ───────────────────────────── */

function docSections(topic: string, audience: string, tag: OutlinePoint['tag']): OutlineSection[] {
  return [
    {
      n: 1,
      title: `为什么要写「${topic}」`,
      points: [
        { text: `${topic}在这份文档里的边界：写清楚什么、不写什么` },
        { text: `读者读完应该能回答的两个问题（受众：${audience}）` },
        { text: '一句话结论放在开篇，不要留到最后一节', tag },
      ],
    },
    {
      n: 2,
      title: '现状与问题',
      points: [
        { text: '三条能观察到的现象，每条一句话，不堆形容词' },
        { text: '把「大家的抱怨」收敛成一个可验证的判断' },
        { text: '现状数据：口径、来源、时间范围各写一行', tag },
      ],
    },
    {
      n: 3,
      title: '做法与取舍',
      points: [
        { text: '主流程三步，每步写清输入、产出、负责人' },
        { text: '明确放弃的选项，以及为什么放弃' },
        { text: '和现状的差异要能被一句话说清' },
      ],
    },
    {
      n: 4,
      title: '怎么验证有效',
      points: [
        { text: '两到三个指标，写清基线与目标值' },
        { text: '谁在什么时候看这份数据，看不对时怎么办', tag },
      ],
    },
    {
      n: 5,
      title: '接下来的计划',
      points: [
        { text: '里程碑 × 时间 × 交付物，一张表说完' },
        { text: '风险清单：最可能崩的三个点与兜底方案' },
      ],
    },
  ]
}

function carouselSections(topic: string, audience: string, tag: OutlinePoint['tag']): OutlineSection[] {
  return [
    {
      n: 1,
      title: `封面：一句话钩住「${topic}」`,
      points: [
        { text: '主标题 ≤ 12 字，副标题补充给谁看' },
        { text: '留一个视觉锚点（数字 / 对比 / 反常识）', tag },
      ],
    },
    {
      n: 2,
      title: '痛点：读者现在的麻烦',
      points: [
        { text: `用受众（${audience}）自己的说法描述问题，不用行业黑话` },
        { text: '一句「你是不是也这样」的代入句' },
      ],
    },
    {
      n: 3,
      title: '方法：三步走',
      points: [
        { text: '一屏一步，每步只讲一个动作' },
        { text: '每步配一个可抄的示例' },
      ],
    },
    {
      n: 4,
      title: '证据：凭什么信你',
      points: [
        { text: '一个数字 + 一个真实场景，不写形容词', tag },
      ],
    },
    {
      n: 5,
      title: '行动：看完做什么',
      points: [
        { text: '一个明确动作（关注 / 收藏 / 试用 / 留言）' },
        { text: '把动作写成「现在就能做」的一句话' },
      ],
    },
  ]
}

function imageSections(topic: string, audience: string): OutlineSection[] {
  return [
    {
      n: 1,
      title: `主视觉：${topic}`,
      points: [
        { text: '主体、镜头、景别各写一行，避免「感觉对了」式的描述' },
        { text: `画面要一眼看出给谁看（${audience}）` },
      ],
    },
    {
      n: 2,
      title: '材质与光线',
      points: [
        { text: '光线方向与色温定下来，整组图保持一致' },
        { text: '材质特写用来补「质感」这一层信息', tag: '建议' },
      ],
    },
    {
      n: 3,
      title: '场景与留白',
      points: [
        { text: '主体占比与留白位置先定，方便后期压字' },
        { text: '同一场景换两个角度，避免一组图长得一样' },
      ],
    },
    {
      n: 4,
      title: '变体：横版 / 竖版 / 方图',
      points: [
        { text: '同一主视觉出三种比例，先切主体再改构图' },
      ],
    },
  ]
}

/* ── 模板之外还该讲什么 ────────────────────────────────
 * 用户要的段数常常比模板多。以前是逮着「做法与取舍」复制成（二）（三）（四）…，
 * 十段文档里有五六段同名，看上去就像生成坏了。这里按类型各备一组「还没讲到」的段落，
 * 先补这些；真不够了才退回（二）轮次。
 */
type ExtraPool = (topic: string, audience: string, tag: OutlinePoint['tag']) => OutlineSection[]

const EXTRA_SECTIONS: Record<OutlineKind, ExtraPool> = {
  doc: (topic, audience, tag) => [
    {
      n: 0,
      title: '背景与范围',
      points: [
        { text: `这件事从哪来：一句话交代「${topic}」的由来` },
        { text: `这份文档覆盖到哪里为止，边界外的内容指向哪份材料（受众：${audience}）` },
      ],
    },
    {
      n: 0,
      title: '关键术语',
      points: [
        { text: '三到五个内部黑话，各写一句人话解释' },
        { text: '同一个词在不同团队里指不同东西时，指名道姓写清楚' },
      ],
    },
    {
      n: 0,
      title: '谁负责什么',
      points: [
        { text: '角色 - 职责 - 交付物，一张三列表就够' },
        { text: '交接点在哪儿，交接时对方需要收到什么', tag },
      ],
    },
    {
      n: 0,
      title: '时间表与里程碑',
      points: [
        { text: '按周排，每个里程碑写清「完成」的判定标准' },
        { text: '哪个节点一旦晚了，后面的排期要跟着改' },
      ],
    },
    {
      n: 0,
      title: '风险与应对',
      points: [
        { text: '最可能出问题的两件事，各写触发条件和应对动作' },
        { text: '需要提前找谁拍板', tag },
      ],
    },
    {
      n: 0,
      title: '常见问题',
      points: [
        { text: '把读者会追问的五个问题先答了，省一轮来回' },
        { text: '答案里不要出现「视情况而定」' },
      ],
    },
    {
      n: 0,
      title: '附录：资料与来源',
      points: [
        { text: '数据出处、访谈对象、参考资料，逐条列出' },
        { text: '外部引用注明日期，方便下次复核' },
      ],
    },
  ],
  carousel: (topic, audience, tag) => [
    {
      n: 0,
      title: '对比：之前 / 之后',
      points: [
        { text: '左右分屏，同一件事的两张照片式画面' },
        { text: '对比要一眼看懂，不靠文字解释' },
      ],
    },
    {
      n: 0,
      title: '细节放大',
      points: [
        { text: '把最重要的一个局部放大，一屏只讲一件事' },
        { text: `受众（${audience}）在这一屏应该「哦」一下` },
      ],
    },
    {
      n: 0,
      title: '用户原话',
      points: [
        { text: '一句真实用户说的话，原样引用，不改写' },
        { text: '引号 + 头像/场景，不加评论' },
      ],
    },
    {
      n: 0,
      title: '数据页：一个数字说话',
      points: [
        { text: '屏幕上只留一个数字，单位和口径写小字' },
        { text: '数字要有出处，别用「提升显著」这种空话', tag },
      ],
    },
    {
      n: 0,
      title: '常见疑问一屏',
      points: [
        { text: '挑最容易被问住的一个问题，正面回答' },
        { text: '答不了的就写「还在验证」，别硬编' },
      ],
    },
    {
      n: 0,
      title: '幕后：怎么做的',
      points: [
        { text: `「${topic}」背后的一两个具体动作，让人相信不是拼出来的` },
        { text: '细节比结论更可信' },
      ],
    },
  ],
  image: (topic, audience) => [
    {
      n: 0,
      title: '特写细节',
      points: [
        { text: `「${topic}」最能说明问题的一处细节，占满画面` },
        { text: '质感靠光，不靠滤镜' },
      ],
    },
    {
      n: 0,
      title: '场景中的人',
      points: [
        { text: `让受众（${audience}）看到自己：真实场景、真实手部动作` },
        { text: '人物不必露脸，避免出戏' },
      ],
    },
    {
      n: 0,
      title: '配色板 / 材质板',
      points: [
        { text: '主色一块、辅色两块，直接给色值' },
        { text: '材质写清是纸、布、金属还是玻璃' },
      ],
    },
    {
      n: 0,
      title: '变体：方图',
      points: [
        { text: '同主视觉切 1:1，留足安全区' },
        { text: '方图适合投放，别直接裁横版' },
      ],
    },
  ],
}

/* ── 主函数 ─────────────────────────────────────────── */

export function outlineFor(request: OutlineRequest): Outline {
  const kind = kindOf(request.kind)
  const spec = KINDS[kind]
  const prompt = String(request.prompt ?? '').trim() || spec.label
  const topic = (subjectOf(prompt) || cleanTopic(prompt)).slice(0, 28)
  const audience = audienceOf(prompt) || readAudience(prompt, kind)
  const count = readCount(prompt, kind, request.count)
  const tag = readTag(prompt)

  const base =
    kind === 'doc'
      ? docSections(topic, audience, tag)
      : kind === 'carousel'
        ? carouselSections(topic, audience, tag)
        : imageSections(topic, audience)

  // 多了先补「还没讲到」的段落（EXTRA_SECTIONS），补完还差才用（二）轮次；少了从后面截。
  // 不从第 1 段开始复制，也不逮着第 3 段复制六遍。
  const need = Math.max(0, count - base.length)
  const list: OutlineSection[] = base.slice()
  const at = Math.max(1, list.length - 2)
  const used = EXTRA_SECTIONS[kind](topic, audience, tag).slice(0, need)
  list.splice(at, 0, ...used)
  const ROUNDS = ['二', '三', '四', '五', '六']
  let round = 1
  while (list.length < Math.max(2, count) && round <= ROUNDS.length) {
    const source = base[Math.min(at, base.length - 1)]!
    const points = source.points.map((point) => ({ ...point }))
    points.push({ text: `换一个角度展开，别和第 ${at + 1} ${spec.unit}重复`, tag: '待确认' })
    list.splice(at + used.length, 0, { n: 0, title: source.title + `（${ROUNDS[round - 1]}）`, points })
    round += 1
  }
  const sections: OutlineSection[] = list.slice(0, Math.max(2, count)).map((section, index) => ({
    n: index + 1,
    title: section.title,
    points: section.points,
  }))

  const shape =
    kind === 'doc'
      ? '背景 → 现状 → 做法 → 验证 → 计划'
      : kind === 'carousel'
        ? '钩子 → 痛点 → 方法 → 证据 → 行动'
        : '主视觉 → 材质 → 场景 → 变体'

  const steps: OutlineStep[] = [
    { id: 'read', label: '读懂需求', detail: `${spec.label} · ${audience}` },
    { id: 'shape', label: '定结构', detail: `${shape}` },
    { id: 'count', label: '排数量与节奏', detail: `${sections.length} ${spec.unit}` },
  ]

  const narration = [
    `我把「${topic}」按${spec.label}来做：${sections.length} ${spec.unit}，受众是${audience}。`,
    `结构按「${shape}」排，每一${spec.unit}解决一个问题，${spec.unit}与${spec.unit}之间是递进。`,
    `大纲写好了，共 ${sections.length} ${spec.unit}。想改哪一${spec.unit}直接在这里说；没问题就点右边「生成」。`,
  ]

  const items = sections.map((section) => {
    const points = section.points.map((point) => point.text).join('；')
    return `${section.n}. ${section.title} —— ${points}`
  })

  return {
    kind,
    kindLabel: spec.label,
    title: topic,
    unit: spec.unit,
    count: sections.length,
    brief: `${spec.label} · ${sections.length} ${spec.unit} · 受众：${audience} · 结构：${shape}`,
    audience,
    shape,
    sections,
    narration,
    steps,
    items,
    spec: request.style ? `${spec.label} · ${request.style}` : spec.label,
  }
}
