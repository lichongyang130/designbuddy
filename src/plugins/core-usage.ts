/**
 * `usage` core plugin — provides `ctx.get('usage')`.
 *
 * 计量与免费额度：每次 agent 运行一条记录，默认每天 20 万 tokens。落盘是一个
 * JSONL（`DB_USAGE_FILE`），没配就退化成纯内存——单测和其它脚本不该在仓库里
 * 留下文件，这和会话落盘是同一套约定。
 *
 * @module designbuddy/plugins/core-usage
 */

import type { Context } from '../kernel/index.ts'
import { DEFAULT_DAILY_TOKENS, UsageService } from '../core/usage.ts'
import { createUsageStore } from '../core/usage-store.ts'

export const name = 'usage'

export function apply(ctx: Context): void {
  const limit = Number(process.env.DB_USAGE_DAILY_TOKENS ?? DEFAULT_DAILY_TOKENS)
  const file = process.env.DB_USAGE_FILE

  if (!file) {
    ctx.provide('usage', new UsageService({ dailyTokenLimit: limit }))
    return
  }

  const store = createUsageStore(file)
  const usage = new UsageService({ persister: store, dailyTokenLimit: limit })
  const restored = store.readAll()
  usage.hydrate(restored)
  if (restored.length > 0) {
    ctx.logger.info(`usage ledger: ${restored.length} run(s) replayed from ${file}`)
  }
  ctx.provide('usage', usage)
}
