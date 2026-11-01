import type { Context } from '@designbuddy/core'
import { LlmService } from './service'

export * from './types'
export { LlmService } from './service'
export type { RoutedModel } from './service'

export const name = 'llm'

export function apply(ctx: Context): void {
  ctx.set('llm', new LlmService(ctx))
}

export default LlmService
