/**
 * `agentLoop` core plugin — provides `ctx.get('agentLoop')`.
 *
 * DSH equivalent: `packages/core/agent-loop` (`ctx.agentLoop`). Note the
 * `inject`: the loop waits until every service it drives is mounted, which is
 * exactly how DSH keeps the driver replaceable without a boot-order table.
 *
 * @module designbuddy/plugins/core-agent-loop
 */

import type { Context } from '../kernel/index.ts'
import { DefaultAgentLoop } from '../core/agent-loop.ts'

export const name = 'agentLoop'

export const inject = ['sessions', 'tools', 'llm', 'systemPrompt', 'agents']

export function apply(ctx: Context): void {
  ctx.provide('agentLoop', new DefaultAgentLoop(ctx))
}
