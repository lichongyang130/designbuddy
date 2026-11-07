/**
 * 真实数据源模块（阶段 1 扩展）。
 *
 * 解决“当前数据来自确定性伪随机生成，并非经过核实的真实数据”的问题。
 *
 * 提供：
 *   - `fetchGitHubRepoStats(owner, repo)`：从 GitHub API 获取仓库星标、fork、问题数等真实数据
 *   - `fetchGitHubTrending(language?)`：从 GitHub API 获取热门仓库（按 stars 排序）
 *   - `DataSource` 抽象接口：方便后续接入更多数据源（统计、财经、行业数据等）
 *
 * 网络受限于 sandbox 出站白名单，当前仅走 `api.github.com`（在允许列表内）。
 * 所有请求都带 User-Agent 头，遵循 GitHub API 使用规范。
 *
 * @module designbuddy/core/data-source
 */

export type DataSourceKind = 'github-repo' | 'github-trending' | 'github-search'

export interface DataSourceOptions {
  kind: DataSourceKind
  owner?: string
  repo?: string
  language?: string
  perPage?: number
  page?: number
}

export interface RepoStats {
  name: string
  fullName: string
  stars: number
  forks: number
  watchers: number
  openIssues: number
  description?: string
  language?: string
  updatedAt: string
  htmlUrl: string
}

export interface TrendingRepo {
  name: string
  fullName: string
  stars: number
  forks: number
  description?: string
  language?: string
  htmlUrl: string
}

export interface DataResult {
  kind: DataSourceKind
  fetchedAt: string
  source: string
  data: RepoStats[] | TrendingRepo[]
}

/** GitHub API 响应形状（只取需要的字段，避免依赖完整类型） */
interface GitHubRepoResponse {
  name: string
  full_name: string
  stargazers_count: number
  forks_count: number
  watchers_count: number
  open_issues_count: number
  description?: string | null
  language?: string | null
  updated_at: string
  html_url: string
}

interface GitHubSearchResponse {
  total_count: number
  items: GitHubRepoResponse[]
}

/** 从 GitHub API 获取单个仓库的真实统计数据。 */
export async function fetchGitHubRepoStats(
  owner: string,
  repo: string,
): Promise<RepoStats> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
  const text = await fetchWithUA(url)
  const raw = JSON.parse(text) as GitHubRepoResponse
  return {
    name: raw.name,
    fullName: raw.full_name,
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    watchers: raw.watchers_count,
    openIssues: raw.open_issues_count,
    description: raw.description ?? undefined,
    language: raw.language ?? undefined,
    updatedAt: raw.updated_at,
    htmlUrl: raw.html_url,
  }
}

/** 从 GitHub API 获取热门仓库列表（按 stars 排序）。 */
export async function fetchGitHubTrending(options: {
  language?: string
  perPage?: number
  page?: number
} = {}): Promise<TrendingRepo[]> {
  const { language, perPage = 10, page = 1 } = options
  const q = language ? `language:${language} sort:stars` : `sort:stars`
  const url =
    `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}` +
    `&per_page=${perPage}&page=${page}`
  const text = await fetchWithUA(url)
  const raw = JSON.parse(text) as GitHubSearchResponse
  return raw.items.map((item) => ({
    name: item.name,
    fullName: item.full_name,
    stars: item.stargazers_count,
    forks: item.forks_count,
    description: item.description ?? undefined,
    language: item.language ?? undefined,
    htmlUrl: item.html_url,
  }))
}

/** 把真实数据转成 PPT 图表/数据版式可用的条目。 */
export function repoStatsToChartData(stats: RepoStats[]): {
  categories: string[]
  series: { name: string; values: number[] }[]
} {
  return {
    categories: stats.map((s) => s.name),
    series: [
      { name: 'Stars', values: stats.map((s) => s.stars) },
      { name: 'Forks', values: stats.map((s) => s.forks) },
      { name: 'Issues', values: stats.map((s) => s.openIssues) },
    ],
  }
}

/** 把真实数据转成 PPT 统计卡片可用的条目。 */
export function repoStatsToStatsCards(stats: RepoStats[]): {
  title: string
  value: string
  label: string
}[] {
  if (stats.length === 0) return []
  const latest = stats[0]
  return [
    { title: '总星标', value: String(stats.reduce((s, r) => s + r.stars, 0)), label: `${stats.length} 个仓库` },
    { title: '总 Fork', value: String(stats.reduce((s, r) => s + r.forks, 0)), label: '累计分叉' },
    { title: '开放 Issue', value: String(stats.reduce((s, r) => s + r.openIssues, 0)), label: '待处理问题' },
    { title: '最新更新', value: latest.name, label: latest.updatedAt.slice(0, 10) },
  ]
}

async function fetchWithUA(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'DesignBuddy/1.0 (data-source)',
      Accept: 'application/vnd.github+json',
    },
  })
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${res.statusText} for ${url}`)
  }
  return res.text()
}
