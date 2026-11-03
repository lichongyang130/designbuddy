/**
 * Library catalog — 案例库与主题目录的查询层。
 *
 * 案例（19 套 deck / 文档）和主题（18 套配色）原先都是前端常量：搜索、筛选项、
 * 每个分类的条数全在浏览器里现算。这套东西一旦要扩展（加案例、按标签检索、
 * 服务端推荐）就无处下手，所以把它们变成后端的只读目录：
 *
 *   facets()  → 侧栏要的分组与条数（格式 / 分类 / 体裁 / 标签）
 *   list()    → 列表卡片（投影，不含 slides，省一半体积）
 *   get()     → 单个 deck 全量（详情页、文档查看器用）
 *   themes()  → 主题预设
 *
 * 数据本身仍以 `apps/web/public/cases.js` / `themes.js` 为唯一来源——它们是纯
 * 数据模块，没有 DOM 依赖，前后端都直接 import，不做第二份拷贝。
 *
 * @module designbuddy/core/library
 */

export interface DeckLike {
  id: string
  name: string
  en?: string
  by?: string
  cat?: string
  fmt?: string
  ratio?: string
  date?: number
  kind?: string
  category?: string
  tags?: string[]
  desc?: string
  bestFor?: string[]
  styles?: string[]
  colorway?: string
  paper?: string
  accent?: string
  slides?: unknown[]
  [key: string]: unknown
}

export interface ThemeLike {
  name: string
  stage: string
  slide: string
  ink: string
  body: string
  link: string
}

export interface LibraryCard {
  id: string
  name: string
  en: string
  by: string
  fmt: string
  cat: string
  kind: string
  category: string
  tags: string[]
  desc: string
  date: number
  pages: number
  images: number
  styles: string[]
  colorway: string
  paper: string
  accent: string
}

export interface LibraryQuery {
  q?: string
  fmt?: string
  cats?: string[]
  sort?: 'date' | 'name'
  limit?: number
}

export interface FacetRow {
  value: string
  count: number
}

export interface LibraryFacets {
  total: number
  formats: FacetRow[]
  categories: FacetRow[]
  kinds: FacetRow[]
  tags: FacetRow[]
}

const FMT_LABELS: Record<string, string> = {
  deck: '演示文稿',
  doc: '文档',
  card: '社交轮播卡片',
  site: '网站复刻',
  image: '图片',
  artifact: '实时产物',
  video: '视频',
  audio: '音频',
  hyper: 'Hyper Frames',
}

/** 一套 deck 里被 `img` / `a` / `b` / `figure` / `photo` 引用到的图片编号。 */
function countImages(deck: DeckLike): number {
  const seen = new Set<string>()
  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      if (/^\d{2}$/.test(value)) seen.add(value)
      return
    }
    if (Array.isArray(value)) return value.forEach(walk)
    if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(deck.slides ?? [])
  return seen.size
}

function card(deck: DeckLike): LibraryCard {
  return {
    id: deck.id,
    name: deck.name,
    en: deck.en ?? '',
    by: deck.by ?? '',
    fmt: deck.fmt ?? 'deck',
    cat: deck.cat ?? '',
    kind: deck.kind ?? '',
    category: deck.category ?? '',
    tags: Array.isArray(deck.tags) ? deck.tags : [],
    desc: deck.desc ?? '',
    date: Number(deck.date ?? 0),
    pages: Array.isArray(deck.slides) ? deck.slides.length : 0,
    images: countImages(deck),
    styles: Array.isArray(deck.styles) ? deck.styles : [],
    colorway: deck.colorway ?? '',
    paper: deck.paper ?? '',
    accent: deck.accent ?? '',
  }
}

function byCount(rows: FacetRow[]): FacetRow[] {
  return rows.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'zh-Hans-CN'))
}

function tally(values: string[]): FacetRow[] {
  const map = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    map.set(value, (map.get(value) ?? 0) + 1)
  }
  return byCount([...map].map(([value, count]) => ({ value, count })))
}

export interface LibraryOptions {
  decks: DeckLike[]
  themes: ThemeLike[]
}

export function createLibrary({ decks, themes }: LibraryOptions) {
  const index = new Map(decks.map((deck) => [deck.id, deck]))

  function matches(deck: DeckLike, query: LibraryQuery): boolean {
    const fmt = String(query.fmt ?? 'all')
    if (fmt !== 'all' && (deck.fmt ?? 'deck') !== fmt) return false
    const cats = query.cats ?? []
    if (cats.length > 0 && !(cats.includes(deck.category ?? '') || cats.includes(deck.kind ?? ''))) return false
    const q = String(query.q ?? '').trim().toLowerCase()
    if (q === '') return true
    const haystack = [
      deck.name,
      deck.en,
      deck.by,
      deck.kind,
      deck.category,
      deck.desc,
      ...(deck.tags ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  }

  return {
    /** 全部 deck（含 slides）——前端启动时拉一次，用于渲染封面与详情。 */
    decks(): DeckLike[] {
      return decks
    },

    cards(): LibraryCard[] {
      return decks.map(card)
    },

    list(query: LibraryQuery = {}): LibraryCard[] {
      const hits = decks.filter((deck) => matches(deck, query)).map(card)
      if (query.sort === 'name') hits.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
      else hits.sort((a, b) => b.date - a.date)
      return typeof query.limit === 'number' && query.limit > 0 ? hits.slice(0, query.limit) : hits
    },

    get(id: string): DeckLike | null {
      return index.get(String(id)) ?? null
    },

    facets(query: LibraryQuery = {}): LibraryFacets {
      /* 分组条数按「不含该维度的其它条件」统计，勾了分类也不会让格式那一列跳变 */
      const base = decks.filter((deck) => matches(deck, { ...query, cats: [], fmt: 'all' }))
      const forFormats = base
      const forCats = decks.filter((deck) => matches(deck, { ...query, cats: [] }))
      return {
        total: decks.filter((deck) => matches(deck, query)).length,
        formats: byCount(
          Object.keys(FMT_LABELS)
            .map((value) => ({ value, count: forFormats.filter((deck) => (deck.fmt ?? 'deck') === value).length }))
            .filter((row) => row.count > 0),
        ),
        categories: tally(forCats.map((deck) => deck.category ?? '')),
        kinds: tally(forCats.map((deck) => deck.kind ?? '')),
        tags: tally(decks.filter((deck) => matches(deck, query)).flatMap((deck) => deck.tags ?? [])).slice(0, 24),
      }
    },

    themes(): ThemeLike[] {
      return themes
    },

    summary() {
      return {
        cases: decks.length,
        docs: decks.filter((deck) => deck.fmt === 'doc').length,
        decks: decks.filter((deck) => (deck.fmt ?? 'deck') !== 'doc').length,
        themes: themes.length,
      }
    },
  }
}

export type Library = ReturnType<typeof createLibrary>
