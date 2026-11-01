/**
 * `llm` core plugin — provides `ctx.get('llm')`, the model router.
 *
 * DSH equivalent: `packages/llm/llm` (the seam) plus `llm/llm-retry` (fallback
 * policy). Adapters are mounted by other plugins, so this plugin alone knows no
 * vendor.
 *
 * @module designbuddy/plugins/core-llm
 */

import type { Context } from '../kernel/index.ts'
import { ModelRouter } from '../core/router.ts'

export const name = 'llm'

export interface Config {
  /** Adapter ids tried when a route kind has no explicit policy. */
  defaultChain?: string[]
  logRouting?: boolean
}

export function apply(ctx: Context, config: Config = {}): void {
  const router = new ModelRouter()
  if (config.defaultChain) router.setDefaultChain(config.defaultChain)
  if (config.logRouting) {
    router.setObserver((attempt) => {
      ctx.logger.info(
        `route ${attempt.adapter}${attempt.model ? `/${attempt.model}` : ''} ` +
          `${attempt.ok ? 'ok' : `failed: ${attempt.error}`} in ${attempt.ms}ms`,
      )
    })
  }
  ctx.provide('llm', router)
}
