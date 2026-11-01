import type { Context } from '@designbuddy/core'
import type { ToolCall, ToolSchema } from '@designbuddy/llm'

export type ToolScope = 'read' | 'write' | 'danger'

export interface ToolRunContext {
  sessionId: string
  agent: string
  /** The plugin context of the calling agent, so tools can reach services. */
  ctx: Context
  signal?: AbortSignal
}

export interface ToolOutcome {
  ok: boolean
  /** Model-visible text. This is the contract — keep it task-relevant. */
  output: string
  /** Optional structured payload for the UI only. */
  display?: unknown
  error?: string
  durationMs: number
}

export interface Tool {
  name: string
  title: string
  description: string
  /** JSON Schema object describing the arguments. */
  parameters: Record<string, unknown>
  scope?: ToolScope
  handler(args: Record<string, unknown>, run: ToolRunContext): Promise<string | ToolOutcome> | string | ToolOutcome
}

export interface ToolGuard {
  /** Return a string to deny with that reason; return nothing to allow. */
  before?(call: ToolCall, run: ToolRunContext): Promise<string | void> | string | void
  after?(call: ToolCall, outcome: ToolOutcome, run: ToolRunContext): void
}

export interface ToolDescriptor extends ToolSchema {
  title: string
  scope: ToolScope
  owner: string
}
