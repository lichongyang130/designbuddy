import type { Context } from '@designbuddy/core'
import { ToolsService } from './service'

export * from './types'
export { ToolsService } from './service'

export const name = 'tools'

export function apply(ctx: Context): void {
  ctx.set('tools', new ToolsService(ctx))
}

export default ToolsService
