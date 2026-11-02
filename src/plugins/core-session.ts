/**
 * `sessions` core plugin — provides `ctx.get('sessions')`.
 *
 * DSH equivalent: `packages/core/session` (`ctx.sessions`). The log is persisted
 * as JSONL under `DB_SESSION_DIR`（默认 `.designbuddy/sessions`），启动时把旧
 * 会话回放回内存，因此刷新页面、重启进程都不会丢历史。
 *
 * @module designbuddy/plugins/core-session
 */

import type { Context } from '../kernel/index.ts'
import { SessionService } from '../core/session.ts'
import { createSessionStore } from '../core/session-store.ts'

export const name = 'sessions'

export function apply(ctx: Context): void {
  const dir = process.env.DB_SESSION_DIR
  if (!dir) {
    // 没有指定目录就退化成纯内存：单测与临时脚本不该在仓库里留文件。
    ctx.provide('sessions', new SessionService())
    return
  }

  const store = createSessionStore(dir)
  const sessions = new SessionService({ persister: store })

  let skipped = 0
  for (const jsonl of store.readAll()) {
    const restored = sessions.loadJsonl(jsonl)
    skipped += restored.skipped
  }
  if (skipped > 0) ctx.logger.warn(`session log: skipped ${skipped} corrupt line(s)`)

  ctx.provide('sessions', sessions)
}
