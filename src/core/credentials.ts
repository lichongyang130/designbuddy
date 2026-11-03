/**
 * 连接器凭据（`~/.designbuddy/connectors.keys.json`，权限 0600）。
 *
 * 照 `models.keys.json` 已经验证过的做法：密钥单独一个文件、目录权限 600、
 * 对外接口只回 `hasKey()` 不回真值。这样即使把 `connectors.json` 发给同事排错，
 * 也不会带上任何凭据。
 *
 * 为什么不做加密：单机部署下，能读到这个文件的进程同样能读到主密钥文件，
 * 加密只是把「明文」变成「和明文放一起的密文」。真正的边界是文件权限与
 * 「不出后端进程」——凭据不会进 prompt、会话记录、前端内存。要做企业级密钥托管，
 * 换掉这个类的实现即可，上层接口不用动。
 *
 * @module designbuddy/core/credentials
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

type Secrets = Record<string, string>

export class CredentialStore {
  #file: string
  #items: Record<string, Secrets> | null = null

  constructor(options: { file: string }) {
    this.#file = options.file
  }

  get file(): string {
    return this.#file
  }

  has(id: string): boolean {
    const entry = this.#all()[id]
    return Boolean(entry && Object.keys(entry).length > 0)
  }

  /** 只给后端运行时用；任何 RPC 都不许直接返回它。 */
  get(id: string): Secrets | null {
    const entry = this.#all()[id]
    return entry ? Object.assign({}, entry) : null
  }

  save(id: string, secrets: Secrets): void {
    const items = this.#all()
    const cleaned: Secrets = {}
    for (const [key, value] of Object.entries(secrets)) {
      const text = String(value ?? '').trim()
      if (text !== '') cleaned[key] = text
    }
    if (Object.keys(cleaned).length === 0) {
      delete items[id]
    } else {
      items[id] = cleaned
    }
    this.#write(items)
  }

  remove(id: string): void {
    const items = this.#all()
    if (!(id in items)) return
    delete items[id]
    this.#write(items)
  }

  #all(): Record<string, Secrets> {
    if (!this.#items) this.#items = this.#read()
    return this.#items
  }

  #read(): Record<string, Secrets> {
    if (this.#file === '' || !existsSync(this.#file)) return {}
    try {
      const parsed = JSON.parse(readFileSync(this.#file, 'utf8')) as unknown
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, Secrets>) : {}
    } catch {
      return {}
    }
  }

  #write(items: Record<string, Secrets>): void {
    if (this.#file === '') return
    mkdirSync(dirname(this.#file), { recursive: true })
    const tmp = this.#file + '.tmp'
    writeFileSync(tmp, JSON.stringify(items, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
    renameSync(tmp, this.#file)
    try {
      chmodSync(this.#file, 0o600)
    } catch {
      // 非 POSIX 平台没有 0600，忽略。
    }
  }
}
