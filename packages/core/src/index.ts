export { Container, Context, Fork, mergeConfig } from './context'
export type { ServiceEntry } from './context'
export { Disposer, EventBus } from './events'
export type { Listener } from './events'
export * from './types'

import { Container } from './context'
import { Context } from './context'

/** Creates a kernel plus its root context. */
export function createApp(): { container: Container; ctx: Context } {
  const container = new Container()
  return { container, ctx: new Context(container, null) }
}
