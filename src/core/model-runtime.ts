/**
 * 把「设置里存的模型」翻译成「路由上挂着谁」。
 *
 * 这里是 P0 的全部关键逻辑，并且刻意做成**纯函数 + 一个很薄的挂载层**：
 * `planMounts()` 只算「该挂哪些适配器、链的顺序是什么、哪些条目为什么跳过了」，
 * 于是「没填地址」「没配 Key」这些判断可以像普通函数一样测，不用起 HTTP 服务。
 *
 * 顺序口径（用户能预期的那个）：
 *   最新编辑的模型排最前 → 环境变量配的那个 → `mock`（永远在链尾兜底）。
 * 换句话说：**真模型优先，但任何情况下都还有一条退路**。
 *
 * @module designbuddy/core/model-runtime
 */

import type { CustomModel } from './models.ts'

export interface MountEntry {
  /** catalog 里的 id。 */
  id: string
  /** 路由上的适配器 id：`user:<id>`，界面据此显示「已接入」。 */
  adapterId: string
  name: string
  model: string
  baseUrl: string
  apiKey: string
  /** `browser` = 请求交给用户浏览器代发（服务端出不了网时）。 */
  transport?: 'browser'
}

export interface SkippedEntry {
  id: string
  name: string
  /** 为什么没挂上，界面原样显示。 */
  reason: string
}

export interface MountPlan {
  mounts: MountEntry[]
  skipped: SkippedEntry[]
  /** 每次 sync 的指纹：一样就不用重新挂，避免重复 register 抛错。 */
  signature: string
}

export interface PlanInput {
  models: CustomModel[]
  /** catalog 里存过的 Key（只在这里用，不进日志、不进前端）。 */
  keyOf: (id: string) => string | undefined
  /** 读环境变量，测试里可以注入。 */
  envOf?: (name: string) => string | undefined
}

/** 常见供应商的默认地址：用户只填 Key 和模型名也能用。 */
export const PROVIDER_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1',
  openai: 'https://api.openai.com/v1',
  kimi: 'https://api.moonshot.cn/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  智谱: 'https://open.bigmodel.cn/api/paas/v4',
  ollama: 'http://127.0.0.1:11434/v1',
  lmstudio: 'http://127.0.0.1:1234/v1',
}

/** 本地推理服务通常不校验 Key，给一个占位值让请求头合法。 */
const LOCAL_PROVIDERS = new Set(['ollama', 'lmstudio', 'vllm', 'local'])

export function adapterIdOf(modelId: string): string {
  return 'user:' + modelId
}

/**
 * 一个条目能不能挂：
 *   - 地址：条目自己填的 → 环境变量 `DB_LLM_BASE_URL` → 供应商默认值；
 *   - Key：catalog 里存的 → `apiKeyEnv` 指向的环境变量 → 同一个地址下的 `DB_LLM_API_KEY`；
 *   - 本地推理服务允许没有 Key。
 */
export function planMounts(input: PlanInput): MountPlan {
  const env = input.envOf ?? ((name: string) => process.env[name])
  const envBase = (env('DB_LLM_BASE_URL') ?? '').trim()
  const envKey = (env('DB_LLM_API_KEY') ?? '').trim()
  const mounts: MountEntry[] = []
  const skipped: SkippedEntry[] = []

  const ordered = [...input.models].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  for (const model of ordered) {
    const providerKey = (model.provider ?? '').trim().toLowerCase()
    const baseUrl = (
      (model.baseUrl ?? '').trim() ||
      envBase ||
      PROVIDER_BASE_URLS[providerKey] ||
      ''
    ).replace(/\/+$/, '')
    const local = LOCAL_PROVIDERS.has(providerKey) || /^https?:\/\/(127\.0\.0\.1|localhost)/.test(baseUrl)
    const fromEnvName = model.apiKeyEnv ? (env(model.apiKeyEnv) ?? '').trim() : ''
    // 浏览器直连：Key 存在用户浏览器里，服务端只留一个占位符（请求头由浏览器补）。
    const browser = model.transport === 'browser'
    const apiKey = browser
      ? (input.keyOf(model.id) || 'browser')
      : (input.keyOf(model.id) ?? (fromEnvName || (local ? 'local' : envKey)))

    if (baseUrl === '') {
      skipped.push({ id: model.id, name: model.name, reason: '没填接口地址（OpenAI 兼容的 base URL）' })
      continue
    }
    if (apiKey === '') {
      skipped.push({ id: model.id, name: model.name, reason: model.apiKeyEnv ? `环境变量 ${model.apiKeyEnv} 里没有 Key` : '没有 Key' })
      continue
    }
    mounts.push({
      id: model.id,
      adapterId: adapterIdOf(model.id),
      name: model.name,
      model: model.model,
      baseUrl,
      apiKey,
      transport: browser ? 'browser' : undefined,
    })
  }

  return {
    mounts,
    skipped,
    // 指纹里有跳过的条目：否则「新存了一个挂不上的模型」会被误判成「清单没变」，
    // 界面上就永远显示不出它为什么挂不上。
    signature: JSON.stringify({
      mounts: mounts.map((mount) => [mount.adapterId, mount.model, mount.baseUrl, mount.apiKey.length, mount.transport ?? '']),
      skipped: skipped.map((entry) => [entry.id, entry.reason]),
    }),
  }
}

/**
 * 候选链：用户挂的（按顺序）→ 环境变量那个适配器 → mock 兜底。
 * 兜底顺序沿用 `mock-llm` 原来的分工（planning 用 planner、design 用 designer），
 * 这样即使降级，行为也和有模型之前完全一样。
 */
export function chainFor(plan: MountPlan, kind = 'planning', extra: readonly string[] = ['openai']): string[] {
  const mock = kind === 'design' ? ['mock-designer', 'mock-planner'] : ['mock-planner', 'mock-designer']
  return [...plan.mounts.map((mount) => mount.adapterId), ...extra, ...mock]
}
