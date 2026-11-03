/**
 * 连接器的目录模型与连接状态。
 *
 * 目录（`src/connectors/catalog.ts`）是**代码**，随版本走；状态（这里）是**用户数据**，
 * 落在 `~/.designbuddy/connectors.json`。两者分开的理由很实际：目录条目会随产品
 * 更新，而「我连过哪几个」是用户自己的事实，不能因为升级被覆盖。
 *
 * 这个文件里只放可公开展示的元信息（状态、账号名、时间），**密钥永远不在这里**。
 * 密钥在 `credentials.ts`，文件名独立、权限 0600，接口只回 `hasKey`。
 *
 * @module designbuddy/core/connectors
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export type ConnectorKind = 'rest' | 'mcp-http' | 'mcp-stdio' | 'local-cli' | 'builtin'

export interface AuthField {
  /** 存进 keys 文件用的键名，例如 `token`。 */
  key: string
  label: string
  type: 'text' | 'password' | 'oauth'
  placeholder?: string
  /** 去哪里申请，直接写给人看。 */
  help?: string
  /** 申请页地址（有就渲染成「去申请」，没有就只留 help 文案，不放假链接）。 */
  docUrl?: string
  required: boolean
}

/** REST 适配器的一条端点：工具名到 HTTP 请求的映射，够用就好，不解析 OpenAPI。 */
export interface RestSpec {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** 支持 `{owner}` 这种占位，从工具入参里取。 */
  path: string
  /** 这些入参走 query string。 */
  query?: string[]
  /** 这些入参走 JSON body。 */
  body?: string[]
}

export interface ConnectorToolSpec {
  /** 工具名后缀，完整名是 `<连接器 id>.<name>`。 */
  name: string
  desc: string
  /** 写操作：默认不注册，需要在连接时显式允许。 */
  write?: boolean
  params?: Record<string, { type: 'string' | 'number' | 'boolean'; desc?: string; required?: boolean }>
  rest?: RestSpec
}

export interface ConnectorEndpoint {
  baseUrl?: string
  /** 认证头的模板，`{token}` 会被替换成凭据值。 */
  headers?: Record<string, string>
  /** 连上之前用来验证凭据的那次请求。 */
  probe?: { path: string; account?: string }
  /** MCP / CLI 的启动方式，P1 用。 */
  command?: string[]
}

export interface ConnectorManifest {
  id: string
  name: string
  desc: string
  vendor: string
  kind: ConnectorKind
  auth: AuthField[]
  /** 连接后需要哪些权限，详情页原样展示。 */
  scopes?: string[]
  tools: ConnectorToolSpec[]
  endpoint?: ConnectorEndpoint
  /** 没有真实后端的目录项：连上后返回演示数据，界面必须标注。 */
  demo?: boolean
  /** 演示 / 未支持时给用户的一句解释。 */
  note?: string
}

export interface ConnectorRecord {
  state: 'connected' | 'error'
  since?: number
  lastOkAt?: number
  account?: string
  error?: string
  at?: number
  /** 连接时是否允许了写操作。 */
  allowWrite?: boolean
}

/**
 * 连接状态文件。用临时文件 + rename 落盘，避免写到一半断电留下半截 JSON。
 */
export class ConnectorStore {
  #file: string
  #items: Record<string, ConnectorRecord> | null = null

  constructor(options: { file: string }) {
    this.#file = options.file
  }

  get file(): string {
    return this.#file
  }

  all(): Record<string, ConnectorRecord> {
    if (!this.#items) this.#items = this.#read()
    return this.#items
  }

  get(id: string): ConnectorRecord | undefined {
    return this.all()[id]
  }

  set(id: string, record: ConnectorRecord): ConnectorRecord {
    const items = this.all()
    items[id] = record
    this.#write(items)
    return record
  }

  remove(id: string): void {
    const items = this.all()
    if (!(id in items)) return
    delete items[id]
    this.#write(items)
  }

  #read(): Record<string, ConnectorRecord> {
    if (this.#file === '' || !existsSync(this.#file)) return {}
    try {
      const parsed = JSON.parse(readFileSync(this.#file, 'utf8')) as unknown
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, ConnectorRecord>) : {}
    } catch {
      // 坏文件不该让整个设置页起不来：当作没连过任何连接器。
      return {}
    }
  }

  #write(items: Record<string, ConnectorRecord>): void {
    if (this.#file === '') return
    mkdirSync(dirname(this.#file), { recursive: true })
    const tmp = this.#file + '.tmp'
    writeFileSync(tmp, JSON.stringify(items, null, 2) + '\n', 'utf8')
    renameSync(tmp, this.#file)
  }
}
