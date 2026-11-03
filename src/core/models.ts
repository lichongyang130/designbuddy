/**
 * 自定义模型清单（`~/.designbuddy/models.json`）。
 *
 * 设置里的「模型」页只做一件事：把用户自己填的模型配置真实写进这个文件，
 * 再原样读回来。没有隐藏的后端表，也没有「看起来保存了」的内存态——
 * 删掉文件，列表就空；改一行，文件里的那一行也跟着改。
 *
 * 文件里存的是**配置意图**，不是「已接入」：是否真的能调用，取决于有没有装
 * 对应的适配器插件（`router.status` 里能看到）。所以这里不写 connected 字段，
 * 由界面层拿模型 id 去和适配器对一遍。
 *
 * @module designbuddy/core/models
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface CustomModel {
  /** 稳定 id，界面上的编辑 / 删除都按它来。 */
  id: string
  /** 展示名，可以和 model 不同（例如「免费的 kimi」）。 */
  name: string
  /** 传给供应商的真实模型名。 */
  model: string
  /** 供应商 / 网关，例如 deepseek、openai、自建。 */
  provider: string
  /** 兼容 OpenAI 协议的 base URL，可留空表示跟随环境变量。 */
  baseUrl?: string
  /** 读取密钥的环境变量名，密钥本身不落盘。 */
  apiKeyEnv?: string
  createdAt: number
  updatedAt: number
}

export interface CustomModelInput {
  id?: string
  name?: string
  model?: string
  provider?: string
  baseUrl?: string
  apiKeyEnv?: string
}

const SEED: Omit<CustomModel, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Agents-A1', model: 'Agents-A1', provider: '自建' },
  { name: 'auto', model: 'auto', provider: '网关' },
  { name: 'deepseek-v4.1-flash', model: 'deepseek-v4.1-flash', provider: 'deepseek', apiKeyEnv: 'DEEPSEEK_API_KEY' },
  { name: 'deepseek-v4.1-flash-1017', model: 'deepseek-v4.1-flash-1017', provider: 'deepseek', apiKeyEnv: 'DEEPSEEK_API_KEY' },
  { name: 'free/gpt-6-luna', model: 'free/gpt-6-luna', provider: '网关' },
  { name: 'free/kimi-k3', model: 'free/kimi-k3', provider: '网关' },
]

function slug(text: string): string {
  const base = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return base === '' ? 'model' : base
}

function sanitize(raw: unknown): CustomModel | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const model = typeof item.model === 'string' ? item.model.trim() : ''
  const name = typeof item.name === 'string' && item.name.trim() !== '' ? item.name.trim() : model
  if (model === '') return null
  const now = Date.now()
  return {
    id: typeof item.id === 'string' && item.id !== '' ? item.id : slug(model),
    name,
    model,
    provider: typeof item.provider === 'string' && item.provider !== '' ? item.provider : '自建',
    baseUrl: typeof item.baseUrl === 'string' && item.baseUrl !== '' ? item.baseUrl : undefined,
    apiKeyEnv: typeof item.apiKeyEnv === 'string' && item.apiKeyEnv !== '' ? item.apiKeyEnv : undefined,
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : now,
  }
}

export interface ModelCatalogOptions {
  file: string
  /** 首次创建文件时写入示例清单；测试里关掉，免得在仓库里留文件。 */
  seed?: boolean
}

export class ModelCatalog {
  #file: string
  #seed: boolean
  #items: CustomModel[] | null = null
  #error: string | null = null

  constructor(options: ModelCatalogOptions) {
    this.#file = options.file
    this.#seed = options.seed !== false
  }

  get file(): string {
    return this.#file
  }

  /** 文件路径的展示形式：home 目录缩成 `~`。 */
  displayPath(): string {
    const home = process.env.HOME || ''
    return home !== '' && this.#file.startsWith(home) ? '~' + this.#file.slice(home.length) : this.#file
  }

  list(): CustomModel[] {
    if (this.#items) return this.#items.slice()
    this.#items = this.#read()
    return this.#items.slice()
  }

  lastError(): string | null {
    return this.#error
  }

  save(input: CustomModelInput): CustomModel {
    const model = (input.model ?? '').trim()
    if (model === '') throw new Error('模型名不能为空')
    const items = this.list()
    const id = (input.id ?? '').trim()
    const existing = id === '' ? undefined : items.find((item) => item.id === id)
    const now = Date.now()

    if (existing) {
      existing.name = (input.name ?? existing.name).trim() || existing.name
      existing.model = model
      existing.provider = (input.provider ?? existing.provider).trim() || existing.provider
      existing.baseUrl = input.baseUrl === undefined ? existing.baseUrl : (input.baseUrl.trim() || undefined)
      existing.apiKeyEnv = input.apiKeyEnv === undefined ? existing.apiKeyEnv : (input.apiKeyEnv.trim() || undefined)
      existing.updatedAt = now
      this.#write(items)
      return existing
    }

    let nextId = id !== '' ? id : slug(model)
    let n = 2
    while (items.some((item) => item.id === nextId)) nextId = slug(model) + '-' + n++
    const created: CustomModel = {
      id: nextId,
      name: (input.name ?? '').trim() || model,
      model,
      provider: (input.provider ?? '').trim() || '自建',
      baseUrl: (input.baseUrl ?? '').trim() || undefined,
      apiKeyEnv: (input.apiKeyEnv ?? '').trim() || undefined,
      createdAt: now,
      updatedAt: now,
    }
    items.push(created)
    this.#write(items)
    return created
  }

  remove(id: string): boolean {
    const items = this.list()
    const next = items.filter((item) => item.id !== id)
    if (next.length === items.length) return false
    this.#write(next)
    return true
  }

  #read(): CustomModel[] {
    this.#error = null
    let text: string
    try {
      text = readFileSync(this.#file, 'utf8')
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        this.#error = error instanceof Error ? error.message : String(error)
        return []
      }
      const seeded = this.#seed ? this.#seedItems() : []
      if (seeded.length > 0) this.#write(seeded)
      return seeded
    }

    try {
      const parsed = JSON.parse(text) as unknown
      const rows = Array.isArray(parsed) ? parsed : (parsed as { models?: unknown }).models
      if (!Array.isArray(rows)) throw new Error('models.json 应该是数组，或者带 models 数组的对象')
      return rows.map(sanitize).filter((item): item is CustomModel => item !== null)
    } catch (error) {
      this.#error = error instanceof Error ? error.message : String(error)
      return []
    }
  }

  #seedItems(): CustomModel[] {
    const now = Date.now()
    return SEED.map((item, index) => ({
      ...item,
      id: slug(item.model),
      createdAt: now,
      updatedAt: now - (SEED.length - index),
    }))
  }

  #write(items: CustomModel[]): void {
    if (this.#file === '') { this.#items = items.slice(); return }
    const body = JSON.stringify({ version: 1, models: items }, null, 2) + '\n'
    mkdirSync(dirname(this.#file), { recursive: true })
    const tmp = this.#file + '.tmp'
    writeFileSync(tmp, body, 'utf8')
    renameSync(tmp, this.#file)
    this.#items = items.slice()
    this.#error = null
  }
}
