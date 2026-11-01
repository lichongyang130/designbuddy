import type { Dispose } from './types'

export type Listener = (...args: any[]) => void

/**
 * A tiny event bus. `app/event` namespaces every emission and every listener
 * with a scope name, which is what makes the kernel observable from the
 * outside (the Web UI subscribes to the same bus the plugins talk on).
 */
export class EventBus {
  private map = new Map<string, Set<Listener>>()

  on(event: string, listener: Listener): () => void {
    let set = this.map.get(event)
    if (!set) {
      set = new Set()
      this.map.set(event, set)
    }
    set.add(listener)
    return () => this.off(event, listener)
  }

  off(event: string, listener: Listener): void {
    this.map.get(event)?.delete(listener)
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.map.get(event)
    if (set) {
      for (const listener of [...set]) {
        try {
          listener(...args)
        } catch (error) {
          console.error(`[designbuddy] listener for "${event}" threw`, error)
        }
      }
    }
    const wildcard = this.map.get('*')
    if (wildcard) {
      for (const listener of [...wildcard]) {
        try {
          listener(event, ...args)
        } catch (error) {
          console.error(`[designbuddy] wildcard listener threw`, error)
        }
      }
    }
  }

  listenerCount(event: string): number {
    return this.map.get(event)?.size ?? 0
  }
}

/** Collects cleanup callbacks and runs them once, newest first. */
export class Disposer {
  private fns: Dispose[] = []
  private done = false

  add(fn: Dispose): void {
    if (this.done) {
      safeRun(fn)
      return
    }
    this.fns.push(fn)
  }

  get size(): number {
    return this.fns.length
  }

  dispose(): void {
    if (this.done) return
    this.done = true
    for (const fn of this.fns.reverse()) safeRun(fn)
    this.fns = []
  }
}

function safeRun(fn: Dispose): void {
  try {
    fn()
  } catch (error) {
    console.error('[designbuddy] dispose hook threw', error)
  }
}

