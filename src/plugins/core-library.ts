/**
 * `library` core plugin — provides `ctx.get('library')`.
 *
 * 案例库与主题目录的只读目录。数据直接 import 前端的两个纯数据模块：
 * `apps/web/public/cases.js`（19 套 deck）与 `themes.js`（18 套配色）——
 * 它们没有 DOM 依赖，所以「一处定义、两边使用」，不再各自维护一份。
 *
 * @module designbuddy/plugins/core-library
 */

import type { Context } from '../kernel/index.ts'
import { createLibrary } from '../core/library.ts'
import { CASE_DECKS } from '../../apps/web/public/cases.js'
import { THEMES } from '../../apps/web/public/themes.js'

export const name = 'library'

export function apply(ctx: Context): void {
  const library = createLibrary({
    decks: CASE_DECKS as never,
    themes: THEMES as never,
  })
  ctx.provide('library', library)
  const stats = library.summary()
  ctx.logger.info(`library catalog: ${stats.cases} cases (${stats.docs} docs) · ${stats.themes} themes`)
}
