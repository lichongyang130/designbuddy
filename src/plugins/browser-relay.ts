/**
 * `browserRelay` 插件 —— 把「用浏览器当出口」这件事提供成 `llmRelay` 服务。
 *
 * 单独做一个插件而不是塞进 `HostServer`，是因为它的生命周期比一条连接长：
 * 一个页面断开时，另一个页面还能继续中转；服务也要能被别的地方（探测、用量）拿到。
 *
 * @module designbuddy/plugins/browser-relay
 */

import type { Context, Disposer } from '../kernel/index.ts'
import { BrowserRelay } from '../core/llm-relay.ts'

export const name = 'browserRelay'

export function apply(ctx: Context): Disposer {
  const relay = new BrowserRelay()
  ctx.provide('llmRelay', relay)
  return () => relay.dispose()
}

export { BrowserRelay }
