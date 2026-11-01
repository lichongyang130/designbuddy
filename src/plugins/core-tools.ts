/**
 * `tools` core plugin — provides `ctx.get('tools')`.
 *
 * DSH equivalent: `packages/core/tools` (`ctx.tools`).
 *
 * @module designbuddy/plugins/core-tools
 */

import type { Context } from '../kernel/index.ts'
import { ToolRegistry } from '../core/tools.ts'

export const name = 'tools'

export interface Config {
  /** Extra guard labels are not configured here; plugins add guards directly. */
  maxOutputChars?: number
}

export function apply(ctx: Context): void {
  const registry = new ToolRegistry()
  ctx.provide('tools', registry)
  // No cleanup body needed: the effect that registered the service is undone by
  // the kernel. This listener exists only to make the teardown observable.
  ctx.on('dispose', () => ctx.logger.debug('tool registry unloaded'))
}
