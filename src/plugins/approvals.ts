/**
 * `approvals` 插件 —— 把 `ApprovalBroker` 挂到工具注册表的守卫链上。
 *
 * 为什么是守卫：`ToolRegistry.addGuard` 本来就是「调用之前的政策缝」，拒绝时工具
 * 根本不会进 `execute`，模型收到的是一条明确的拒绝理由。放这里还有两个好处——
 * 审批和连接器解耦（以后内置的危险工具也能拦），以及守卫顺序天然可读。
 *
 * 拦谁：**已连接连接器的写工具**（目录里 `write: true` 的那些，全名
 * `连接器.工具`）。读工具不问，否则每查一次仓库都弹一张卡，用户会先把功能关掉。
 *
 * 默认拒绝：没有审批通道（终端、批处理、没人看界面）就拒绝，不默默放行。
 * 等太久也拒绝，理由里写清楚等了几秒。
 *
 * @module designbuddy/plugins/approvals
 */

import type { Context, Disposer } from '../kernel/index.ts'
import type { ToolCallContext, ToolRegistry } from '../core/tools.ts'
import { ApprovalBroker } from '../core/approvals.ts'
import { CONNECTORS } from '../connectors/catalog.ts'
import type { ConnectorHub } from '../connectors/hub.ts'

export const name = 'approvals'

export const inject = ['tools']

/** 写工具全名表：`连接器.工具` → 人话标题。目录是静态的，进程内算一次就够。 */
const WRITE_TOOLS = new Map<string, { connector: string; name: string; title: string }>()
for (const manifest of CONNECTORS) {
  for (const spec of manifest.tools) {
    if (!spec.write) continue
    WRITE_TOOLS.set(manifest.id + '.' + spec.name, {
      connector: manifest.id,
      name: manifest.name,
      title: manifest.name + ' · ' + spec.desc,
    })
  }
}

/** 参数摘要：一行说清「这次要改什么」，长值截断，空参数就说没有。 */
export function describeArgs(args: Record<string, unknown>, max = 160): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null || value === '') continue
    let text = typeof value === 'string' ? value : JSON.stringify(value)
    text = text.replace(/\s+/g, ' ').trim()
    if (text.length > 60) text = text.slice(0, 60) + '…'
    parts.push(key + ' = ' + text)
  }
  const joined = parts.join('，')
  if (joined === '') return '没有额外参数'
  return joined.length > max ? joined.slice(0, max) + '…' : joined
}

export function apply(ctx: Context): Disposer {
  const tools = ctx.require<ToolRegistry>('tools')
  const timeoutMs = Number(process.env.DB_APPROVAL_TIMEOUT_MS ?? '')
  const broker = new ApprovalBroker({
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined,
  })
  ctx.provide('approvals', broker)

  const detach = tools.addGuard(async (toolName, args, call: ToolCallContext) => {
    const entry = WRITE_TOOLS.get(toolName)
    if (!entry) return null
    // 连接器详情页里「允许写操作」没开时工具根本不会注册；能走到这里就是开着的。
    const hub = ctx.get<ConnectorHub>('connectors')
    if (hub && hub.writeToolOf(toolName) === undefined) return null

    const answer = await broker.request({
      sessionId: call.sessionId,
      tool: toolName,
      title: entry.title,
      detail: describeArgs(args),
      args,
      signal: call.signal,
    })
    return answer.approved ? null : answer.reason ?? '这次写操作没有被确认'
  }, 'approvals')

  ctx.logger.info(
    `approvals: ${WRITE_TOOLS.size} 个写工具需要逐次确认，等待上限 ${Math.round(broker.timeoutMs / 1000)} 秒`,
  )

  return () => {
    detach()
    broker.dispose()
  }
}
