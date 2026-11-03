/**
 * 默认落盘位置。
 *
 * 两个入口（`apps/host/main.ts` 与 `apps/web/server.ts`）都会自己 `App.create`，
 * 所以默认路径不能只写在其中一个里——那样「预览里能看到用量、打包后天皇上看不到」
 * 这种差异会一直藏着。放这里，两个入口各调一次。
 *
 * @module designbuddy/boot/paths
 */

import { join } from 'node:path'

export function applyDefaultDataPaths(cwd = process.cwd()): void {
  process.env.DB_SESSION_DIR ??= join(cwd, '.designbuddy', 'sessions')
  process.env.DB_USAGE_FILE ??= join(cwd, '.designbuddy', 'usage.jsonl')
  process.env.DB_MODELS_FILE ??= join(cwd, '.designbuddy', 'models.json')
}
