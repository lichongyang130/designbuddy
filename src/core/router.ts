/**
 * AI Model Router — the DesignBuddy name for DSH's `llm` service seam.
 *
 * DSH keeps the provider seam (`llm/llm`) separate from concrete adapters
 * (`llm/llm-deepseek`, `llm/llm-pi-ai`) and puts retry policy in its own plugin
 * (`llm/llm-retry`). This router fuses those three ideas at DesignBuddy's scale:
 *
 *   kind -> ordered candidate chain -> first adapter that produces output wins
 *
 * The rule that matters, and the one most naive routers get wrong: fallback is
 * only legal *before the first chunk reaches the caller*. Once text has been
 * streamed to a UI or written to a session log, replaying on another model would
 * duplicate output, so a mid-stream failure propagates instead.
 *
 * @module designbuddy/core/router
 */

import type { Disposer } from '../kernel/index.ts'
import type { LlmAdapter, LlmChunk, LlmRequest, RouteKind } from './llm.ts'
import { errorMessage } from './tools.ts'

export interface RouteAttempt {
  adapter: string
  model?: string
  ok: boolean
  ms: number
  error?: string
  /** True when the failure happened after output was already emitted. */
  partial?: boolean
}

export interface RoutePolicy {
  kind: RouteKind
  /** Adapter ids in preference order, e.g. ['deepseek-v3', 'pi-ai', 'local-echo']. */
  candidates: string[]
}

export class ModelRouter {
  #adapters = new Map<string, LlmAdapter>()
  #policies = new Map<string, string[]>()
  #defaultChain: string[] = []
  #attempts: RouteAttempt[] = []
  #log: (attempt: RouteAttempt) => void = () => {}

  /** Observe routing decisions (metrics, telemetry, debugging). */
  setObserver(observer: (attempt: RouteAttempt) => void): void {
    this.#log = observer
  }

  register(adapter: LlmAdapter): Disposer {
    if (this.#adapters.has(adapter.id)) {
      throw new Error(`llm adapter "${adapter.id}" is already registered`)
    }
    this.#adapters.set(adapter.id, adapter)
    return () => {
      if (this.#adapters.get(adapter.id) === adapter) this.#adapters.delete(adapter.id)
    }
  }

  /** Set the fallback chain for a routing kind. Later policies win. */
  setPolicy(kind: RouteKind, candidates: readonly string[]): Disposer {
    const previous = this.#policies.get(kind)
    this.#policies.set(kind, [...candidates])
    return () => {
      if (previous) this.#policies.set(kind, previous)
      else this.#policies.delete(kind)
    }
  }

  setDefaultChain(candidates: readonly string[]): void {
    this.#defaultChain = [...candidates]
  }

  adapters(): LlmAdapter[] {
    return [...this.#adapters.values()]
  }

  candidateKinds(): { kind: string; candidates: string[] }[] {
    return [...this.#policies.entries()].map(([kind, candidates]) => ({ kind, candidates }))
  }

  /** Resolve a kind to the concrete chain, dropping adapters that are not mounted. */
  candidatesFor(kind: RouteKind): string[] {
    const configured = this.#policies.get(kind) ?? this.#defaultChain
    const chain = configured.filter((id) => this.#adapters.has(id))
    // Last-resort: if nothing was configured for this kind, try every adapter
    // rather than failing the turn outright.
    if (chain.length === 0) return [...this.#adapters.keys()]
    return chain
  }

  get attempts(): readonly RouteAttempt[] {
    return this.#attempts
  }

  /**
   * Stream a completion, falling back across the candidate chain.
   *
   * `request.model` pins a specific model; otherwise each adapter uses its own
   * default, which is what lets a "design" and a "copy" route share one adapter.
   */
  async *stream(request: LlmRequest): AsyncIterable<LlmChunk> {
    const chain = request.only
      ? request.only.filter((id) => this.#adapters.has(id))
      : this.candidatesFor(request.kind)
    if (chain.length === 0) {
      throw new Error(`no llm adapter registered for route "${request.kind}"`)
    }

    let lastError: unknown = null
    for (const id of chain) {
      const adapter = this.#adapters.get(id)
      if (!adapter) continue
      const model = request.model ?? adapter.models[0]
      const startedAt = Date.now()
      let emitted = false
      try {
        for await (const chunk of adapter.stream({ ...request, model })) {
          emitted = true
          yield chunk
        }
        this.#record({ adapter: id, model, ok: true, ms: Date.now() - startedAt })
        return
      } catch (error) {
        const attempt: RouteAttempt = {
          adapter: id,
          model,
          ok: false,
          ms: Date.now() - startedAt,
          error: errorMessage(error),
          partial: emitted || undefined,
        }
        this.#record(attempt)
        lastError = error
        // Output already reached the caller: replaying would duplicate it.
        if (emitted) throw error
      }
    }
    throw new Error(
      `all llm candidates failed for route "${request.kind}" (${chain.join(' -> ')}): ${errorMessage(lastError)}`,
    )
  }

  #record(attempt: RouteAttempt): void {
    this.#attempts.push(attempt)
    // Keep the buffer bounded: this is telemetry, not a session log.
    if (this.#attempts.length > 200) this.#attempts.shift()
    this.#log(attempt)
  }
}
