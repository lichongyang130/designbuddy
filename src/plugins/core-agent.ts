/**
 * `agents` core plugin — provides the preset registry.
 *
 * DSH equivalent: `packages/core/agent` (`ctx.agents`) plus
 * `preset/agent-preset-registry`. Presets are configuration; instances are
 * created per run by the agent loop.
 *
 * @module designbuddy/plugins/core-agent
 */

import type { Context } from '../kernel/index.ts'
import { AgentPresetRegistry } from '../core/agent.ts'

export const name = 'agents'

export function apply(ctx: Context): void {
  const registry = new AgentPresetRegistry()

  // A deliberately boring default. Product plugins override or extend it.
  registry.register({
    id: 'default',
    name: '通用助手',
    role: '处理未指定专家的普通请求',
    kind: 'design',
    maxSteps: 4,
  })

  ctx.provide('agents', registry)
}
