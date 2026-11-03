/**
 * Scoped tool registry with a guarded execution pipeline.
 *
 * Mirrors DSH's `core/tools`: a registry that plugins add tools to, plus a
 * pipeline that every call passes through before user code runs. DSH calls this
 * "guarded execution"; the guard order matters, so it is explicit here:
 *
 *   lookup -> validate -> policy guards -> timeout -> execute -> truncate
 *
 * A tool that throws never breaks the loop: it becomes an error result the model
 * can read and recover from. That is the difference between an agent that
 * retries and an agent that dies.
 *
 * @module designbuddy/core/tools
 */

import type { Disposer } from '../kernel/index.ts'
import type { JsonSchema, ValidationIssue } from './schema.ts'
import { validateArgs } from './schema.ts'

export interface ToolCallContext {
  sessionId: string
  agentId: string
  callId: string
  signal?: AbortSignal
}

export type ToolOutput = string | { content: string; isError?: boolean }

export interface ToolDefinition {
  name: string
  description: string
  parameters?: JsonSchema
  timeoutMs?: number
  maxOutputChars?: number
  /**
   * Registered at runtime by an integration the user switched on (a connector),
   * not baked in at boot. Preset allow-lists do not apply to these: the user
   * pressed "connect" and expects the tool to be usable in the very next turn.
   */
  dynamic?: boolean
  execute(args: Record<string, unknown>, ctx: ToolCallContext): Promise<ToolOutput> | ToolOutput
}

export interface ToolOutcome {
  content: string
  isError: boolean
  durationMs: number
  truncated: boolean
  /** Set when the call never reached `execute` (unknown tool, bad args, denied). */
  rejectedAt?: 'lookup' | 'validate' | 'policy' | 'timeout'
}

/**
 * Returns a denial reason to block the call, or `null` to allow it. Guards run in
 * registration order and the first denial wins, so an approval plugin can sit in
 * front of a sandbox plugin.
 */
export type ToolGuard = (
  name: string,
  args: Record<string, unknown>,
  ctx: ToolCallContext,
) => string | null | Promise<string | null>

interface GuardEntry {
  id: number
  guard: ToolGuard
  label: string
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_OUTPUT = 8_000

export class ToolRegistry {
  #tools = new Map<string, ToolDefinition>()
  #guards: GuardEntry[] = []
  #guardSeq = 0

  register(definition: ToolDefinition): Disposer {
    if (this.#tools.has(definition.name)) {
      throw new Error(`tool "${definition.name}" is already registered`)
    }
    this.#tools.set(definition.name, definition)
    return () => {
      if (this.#tools.get(definition.name) === definition) this.#tools.delete(definition.name)
    }
  }

  /** A guard is the policy seam: approvals, sandboxing, rate limits, audit. */
  addGuard(guard: ToolGuard, label = 'guard'): Disposer {
    this.#guardSeq += 1
    const entry: GuardEntry = { id: this.#guardSeq, guard, label }
    this.#guards.push(entry)
    return () => {
      this.#guards = this.#guards.filter((candidate) => candidate.id !== entry.id)
    }
  }

  has(name: string): boolean {
    return this.#tools.has(name)
  }

  get(name: string): ToolDefinition | undefined {
    return this.#tools.get(name)
  }

  list(): ToolDefinition[] {
    return [...this.#tools.values()]
  }

  /**
   * Schemas for the model. `allow` narrows to a preset's toolset, but dynamic
   * tools (connector tools the user just connected) always stay visible.
   */
  schemas(allow?: readonly string[]): JsonSchemaToolSchema[] {
    const allowed = allow ? new Set(allow) : null
    return this.list()
      .filter((tool) => !allowed || tool.dynamic === true || allowed.has(tool.name))
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters ?? { type: 'object', properties: {} },
      }))
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolCallContext,
  ): Promise<ToolOutcome> {
    const startedAt = Date.now()
    const tool = this.#tools.get(name)
    if (!tool) {
      return this.#reject(`unknown tool "${name}"`, startedAt, 'lookup')
    }

    const issues = validateArgs(tool.parameters, args)
    if (issues.length > 0) {
      return this.#reject(
        `invalid arguments for "${name}": ${formatIssues(issues)}`,
        startedAt,
        'validate',
      )
    }

    for (const entry of this.#guards) {
      let reason: string | null
      try {
        reason = await entry.guard(name, args, ctx)
      } catch (error) {
        reason = `guard "${entry.label}" failed: ${errorMessage(error)}`
      }
      if (reason) return this.#reject(reason, startedAt, 'policy')
    }

    const timeoutMs = tool.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const maxChars = tool.maxOutputChars ?? DEFAULT_MAX_OUTPUT
    let raw: ToolOutput
    try {
      raw = await withTimeout(
        Promise.resolve().then(() => tool.execute(args, ctx)),
        timeoutMs,
        ctx.signal,
      )
    } catch (error) {
      const timedOut = error instanceof TimeoutError
      return {
        content: timedOut
          ? `tool "${name}" timed out after ${timeoutMs}ms`
          : `tool "${name}" failed: ${errorMessage(error)}`,
        isError: true,
        durationMs: Date.now() - startedAt,
        truncated: false,
        rejectedAt: timedOut ? 'timeout' : undefined,
      }
    }

    const normalized = typeof raw === 'string' ? { content: raw, isError: false } : raw
    const { text, truncated } = truncate(normalized.content, maxChars)
    return {
      content: text,
      isError: normalized.isError === true,
      durationMs: Date.now() - startedAt,
      truncated,
    }
  }

  #reject(content: string, startedAt: number, rejectedAt: ToolOutcome['rejectedAt']): ToolOutcome {
    return { content, isError: true, durationMs: Date.now() - startedAt, truncated: false, rejectedAt }
  }
}

/** Structural alias so this module does not need to import the llm module. */
export interface JsonSchemaToolSchema {
  name: string
  description: string
  parameters: JsonSchema
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

/** Race a promise against a timeout, cleaning the timer in every branch. */
export function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(new Error('aborted before start'))
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(`timed out after ${ms}ms`)), ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

function truncate(content: string, maxChars: number): { text: string; truncated: boolean } {
  if (content.length <= maxChars) return { text: content, truncated: false }
  const kept = content.slice(0, maxChars)
  return {
    text: `${kept}\n…[truncated ${content.length - maxChars} chars]`,
    truncated: true,
  }
}

function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => (issue.path ? `${issue.path} ${issue.message}` : issue.message)).join('; ')
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
