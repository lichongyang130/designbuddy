/**
 * `models` core plugin — provides `ctx.get('models')`.
 *
 * 自定义模型清单落到 `DB_MODELS_FILE`（默认 `.designbuddy/models.json`）。
 * 没配环境变量时退回内存态，单测不会在仓库里留文件——和会话、用量同一套约定。
 *
 * @module designbuddy/plugins/core-models
 */

import type { Context } from '../kernel/index.ts'
import { ModelCatalog } from '../core/models.ts'

export const name = 'models'

export function apply(ctx: Context): void {
  const file = process.env.DB_MODELS_FILE
  if (!file) {
    // 进程内临时文件：读写都真实发生，只是不留在仓库里。
    const catalog = new ModelCatalog({ file: '', seed: false })
    ctx.provide('models', catalog)
    return
  }
  const catalog = new ModelCatalog({ file })
  const loaded = catalog.list()
  ctx.logger.info(`custom models: ${loaded.length} row(s) from ${file}`)
  ctx.provide('models', catalog)
}
