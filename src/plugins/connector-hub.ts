/**
 * `connectors` 插件 —— 提供 `ctx.get('connectors')`。
 *
 * 落盘位置由 `DB_CONNECTORS_FILE` 决定（默认 `.designbuddy/connectors.json`），
 * 旁边的两个文件由它派生：
 *   - `connectors.keys.json` 凭据，权限 0600，只有这里会碰
 *   - `connectors.log.jsonl` 调用审计
 * 没配环境变量就退回内存态，单测不会在仓库里留文件——和会话、用量同一套约定。
 *
 * 启动时会把上次连着的连接器恢复出来（凭据丢了就转成 error 状态，不阻塞启动）。
 *
 * @module designbuddy/plugins/connector-hub
 */

import { dirname, join } from 'node:path'

import type { Context, Disposer } from '../kernel/index.ts'
import { ConnectorStore } from '../core/connectors.ts'
import { CredentialStore } from '../core/credentials.ts'
import type { ToolRegistry } from '../core/tools.ts'
import { ConnectorHub } from '../connectors/hub.ts'
import { CONNECTORS } from '../connectors/catalog.ts'

export const name = 'connectors'

export const inject = ['tools']

export async function apply(ctx: Context): Promise<Disposer> {
  const tools = ctx.require<ToolRegistry>('tools')
  const file = process.env.DB_CONNECTORS_FILE ?? ''
  const dir = file === '' ? '' : dirname(file)
  const hub = new ConnectorHub({
    store: new ConnectorStore({ file }),
    credentials: new CredentialStore({ file: dir === '' ? '' : join(dir, 'connectors.keys.json') }),
    tools,
    logFile: dir === '' ? '' : join(dir, 'connectors.log.jsonl'),
  })
  ctx.provide('connectors', hub)

  const restored = await hub.restore()
  ctx.logger.info(`connectors: ${CONNECTORS.length} in catalog, ${restored.length} restored`)

  return () => hub.stop()
}
