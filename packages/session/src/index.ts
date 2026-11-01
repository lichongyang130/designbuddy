import type { Context, ConfigSchema } from '@designbuddy/core'
import { SessionService } from './service'

export * from './types'
export { SessionService } from './service'
export type { SessionSummary, CreateSessionOptions } from './service'

export const name = 'sessions'

export const Config: ConfigSchema = [
  {
    key: 'dir',
    label: '事件日志目录',
    type: 'string',
    default: '.data/sessions',
    description: '会话的 append-only 事件日志保存位置，留空则只保存在内存中。',
  },
]

export function apply(ctx: Context, config: { dir?: string }): void {
  ctx.set('sessions', new SessionService(ctx, config.dir || null))
}

export default SessionService
