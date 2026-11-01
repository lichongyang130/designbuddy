/**
 * `sessions` core plugin — provides `ctx.get('sessions')`.
 *
 * DSH equivalent: `packages/core/session` (`ctx.sessions`).
 *
 * @module designbuddy/plugins/core-session
 */

import type { Context } from '../kernel/index.ts'
import { SessionService } from '../core/session.ts'

export const name = 'sessions'

export function apply(ctx: Context): void {
  ctx.provide('sessions', new SessionService())
}
