/**
 * Agent vocabulary and the preset registry.
 *
 * DSH splits this in two: `core/agent` owns the `Agent` interface, the live
 * registry (`ctx.agents`) and the `agent/*` events; `preset/agent-preset-registry`
 * owns reusable agent definitions. At DesignBuddy's scale both fit in one
 * service without losing the distinction: **presets are configuration, agents
 * are instances**.
 *
 * The event list is the contract with the client. A UI plugin renders from these
 * events and never calls the loop directly, which is what makes the Host/Client
 * split possible.
 *
 * @module designbuddy/core/agent
 */

import type { Disposer } from '../kernel/index.ts'
import type { RouteKind, ToolCallPart } from './llm.ts'

export interface AgentPreset {
  id: string
  name: string
  /** Short human description, shown in the client's agent picker. */
  role: string
  /** Routing kind resolved by the model router. */
  kind: RouteKind
  /** Persona and task instructions, appended after the shared prompt sections. */
  instructions?: string
  /** Allowed tool names. `undefined` means every registered tool. */
  tools?: string[]
  maxSteps?: number
  model?: string
}

export type AgentEndStatus = 'done' | 'failed'

export type AgentEvent =
  | { type: 'agent/created'; agentId: string; presetId: string; sessionId: string; parentAgentId?: string }
  | { type: 'agent/step'; agentId: string; step: number }
  | { type: 'agent/text'; agentId: string; text: string }
  | { type: 'agent/tool-call'; agentId: string; call: ToolCallPart }
  | {
      type: 'agent/tool-result'
      agentId: string
      name: string
      content: string
      isError: boolean
      durationMs: number
    }
  | { type: 'agent/end'; agentId: string; status: AgentEndStatus; reason?: string; text: string }

export interface AgentRunOptions {
  presetId: string
  sessionId: string
  prompt: string
  signal?: AbortSignal
  /** Set when a manager agent delegated this run. */
  parentAgentId?: string
}

/** The driver seam: DSH's `core/agent-loop` implements exactly this. */
export interface AgentLoop {
  run(options: AgentRunOptions): AsyncIterable<AgentEvent>
}

export class AgentPresetRegistry {
  #presets = new Map<string, AgentPreset>()

  /** Register a preset. A later plugin may override an earlier one; the override
   * is undone on unload, so swapping an expert is a plugin transaction. */
  register(preset: AgentPreset, options: { override?: boolean } = {}): Disposer {
    const existing = this.#presets.get(preset.id)
    if (existing && !options.override) {
      throw new Error(`agent preset "${preset.id}" is already registered`)
    }
    this.#presets.set(preset.id, preset)
    return () => {
      if (this.#presets.get(preset.id) !== preset) return
      if (existing) this.#presets.set(preset.id, existing)
      else this.#presets.delete(preset.id)
    }
  }

  get(id: string): AgentPreset | undefined {
    return this.#presets.get(id)
  }

  require(id: string): AgentPreset {
    const preset = this.#presets.get(id)
    if (!preset) throw new Error(`unknown agent preset "${id}" (available: ${this.list().map((p) => p.id).join(', ')})`)
    return preset
  }

  list(): AgentPreset[] {
    return [...this.#presets.values()]
  }
}
