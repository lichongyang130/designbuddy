/**
 * DesignBuddy Kernel — a compact, dependency-free reimplementation of the
 * plugin model that DeepSeek Harness (DSH) is built on.
 *
 * DSH's `vendor/cordis/src/{context,fiber,registry,events,service}.ts` provides:
 *   - a `Context` that plugins receive,
 *   - a `Fiber` per plugin holding its lifecycle state,
 *   - a service registry consulted by `inject` before a plugin activates,
 *   - reversible effects: every registration unwinds when its plugin unloads.
 *
 * This file keeps those four ideas and drops everything else (proxied service
 * access, schema validation, hot module replacement, isolated realms). The
 * public shape intentionally mirrors DSH so plugin code ports over unchanged:
 *
 *   export const name = 'design-memory'
 *   export const inject = ['tools', 'systemPrompt']
 *   export function apply(ctx, config) { ... }
 *
 * Deliberate differences from DSH, documented rather than hidden:
 *   - services are read with `ctx.get(name)` instead of `ctx.someService`
 *     property access (no Proxy, so stack traces stay readable);
 *   - a service disappearing does not auto-reload its dependents, it only
 *     leaves newly mounted dependents pending (see `Registry#settle`);
 *   - config is passed through untouched: no Schemastery/zod validation.
 *
 * @module designbuddy/kernel
 */

/** A cleanup callback. Every registration in this kernel returns one, or is wrapped in one. */
export type Disposer = () => void

/** Structured plugin form: the shape DSH plugins export from `src/index.ts`. */
export interface PluginObject<C = unknown> {
  /** Plugin name, used by loader diagnostics and the boot tree. */
  name?: string
  /** Service names this plugin requires; it stays `pending` until all exist. */
  inject?: readonly string[]
  /** The plugin body. Return a disposer to unwind work `ctx.effect` cannot express. */
  apply: (ctx: Context, config: C) => void | Disposer | Promise<void | Disposer>
}

/** Functional plugin form: `ctx.plugin((ctx) => { ... })`. */
export type PluginFunction<C = unknown> = (
  ctx: Context,
  config: C,
) => void | Disposer | Promise<void | Disposer>

export type Plugin<C = unknown> = PluginObject<C> | PluginFunction<C>

/** Plugin lifecycle. DSH uses the same three states. */
export type FiberState = 'pending' | 'active' | 'disposed'

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug'

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
}

export type LogSink = (level: Exclude<LogLevel, 'silent'>, scope: string, args: unknown[]) => void

const defaultSink: LogSink = (level, scope, args) => {
  const label = scope ? `[${scope}]` : '[kernel]'
  // eslint-disable-next-line no-console
  console.log(`${label} ${level}:`, ...args)
}

/** Scoped logger. `ctx.logger` is a child logger named after the plugin. */
export class Logger {
  #level: LogLevel
  #scope: string[]
  #sink: LogSink

  constructor(level: LogLevel = 'warn', scope: string[] = [], sink?: LogSink) {
    this.#level = level
    this.#scope = scope
    this.#sink = sink ?? defaultSink
  }

  /** Derive a logger whose messages are prefixed with `name`. */
  child(name: string): Logger {
    return new Logger(this.#level, [...this.#scope, name], this.#sink)
  }

  /** Return a logger at a different level, keeping scope and sink. */
  withLevel(level: LogLevel): Logger {
    return new Logger(level, [...this.#scope], this.#sink)
  }

  get level(): LogLevel {
    return this.#level
  }

  #write(level: Exclude<LogLevel, 'silent'>, args: unknown[]): void {
    if (LEVEL_WEIGHT[level] > LEVEL_WEIGHT[this.#level]) return
    this.#sink(level, this.#scope.join(':'), args)
  }

  error(...args: unknown[]): void {
    this.#write('error', args)
  }

  warn(...args: unknown[]): void {
    this.#write('warn', args)
  }

  info(...args: unknown[]): void {
    this.#write('info', args)
  }

  debug(...args: unknown[]): void {
    this.#write('debug', args)
  }
}

interface ServiceEntry {
  value: unknown
  owner: Fiber | null
}

interface Listener {
  callback: (...args: unknown[]) => unknown
  owner: Fiber | null
}

/** One mounted node of the plugin tree, as printed by `dumpTree()`. */
export interface TreeNode {
  label: string
  state: FiberState
  inject: string[]
  children: TreeNode[]
}

/**
 * Holds the runtime state shared by every plugin: services, event listeners,
 * mounted fibers and the errors raised while activating them.
 *
 * DSH spreads this across `registry.ts` / `service.ts` / `events.ts`; it lives
 * together here because the whole point is that the state is one object that
 * every plugin sees through its `Context`.
 */
export class Registry {
  readonly services = new Map<string, ServiceEntry>()
  readonly fibers = new Set<Fiber>()
  readonly errors: Error[] = []
  logger: Logger

  #listeners = new Map<string, Set<Listener>>()
  #runner: Promise<void> | null = null
  #again = false

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger('warn')
  }

  hasService(name: string): boolean {
    return this.services.has(name)
  }

  getService<T>(name: string): T | undefined {
    return this.services.get(name)?.value as T | undefined
  }

  listenersFor(event: string): Listener[] {
    return [...(this.#listeners.get(event) ?? [])]
  }

  addListener(event: string, listener: Listener): void {
    let set = this.#listeners.get(event)
    if (!set) {
      set = new Set()
      this.#listeners.set(event, set)
    }
    set.add(listener)
  }

  removeListener(event: string, listener: Listener): void {
    const set = this.#listeners.get(event)
    if (!set) return
    set.delete(listener)
    if (set.size === 0) this.#listeners.delete(event)
  }

  /** Broadcast to every listener registered for `event`. Failures are logged, not thrown. */
  async emit(event: string, args: unknown[]): Promise<void> {
    for (const listener of this.listenersFor(event)) {
      try {
        await listener.callback(...args)
      } catch (error) {
        this.logger.error(`listener for "${event}" failed`, error)
      }
    }
  }

  /**
   * Ask the registry to activate every plugin whose `inject` is now satisfied.
   *
   * Re-entrant calls (a plugin mounting another plugin during activation) are
   * coalesced: the outer loop runs again instead of nesting, so boot order stays
   * deterministic and a plugin cannot deadlock the tree.
   */
  requestSettle(): void {
    void this.settle()
  }

  /**
   * Activate every plugin whose `inject` is satisfied, and resolve only once the
   * tree is quiescent.
   *
   * Awaiting this is the difference between "the provider is mounted" and "the
   * provider is mounted and everything downstream has run": callers that skip
   * the await observe half-built trees. Concurrent calls coalesce onto the
   * in-flight run instead of returning early.
   */
  settle(): Promise<void> {
    if (this.#runner) {
      this.#again = true
      return this.#runner.then(() => this.settle())
    }
    const run = this.#run()
    this.#runner = run
    return run.finally(() => {
      this.#runner = null
    })
  }

  async #run(): Promise<void> {
    // Yield once before touching the tree: `#runner` is only published after
    // `#run()` returns its promise, so without this line a plugin calling
    // `provide()` during activation would start a nested run and let its own
    // consumers activate ahead of it.
    await Promise.resolve()
    let guard = 0
    do {
      this.#again = false
      let progressed = true
      while (progressed && guard++ < 500) {
        progressed = false
        for (const fiber of [...this.fibers]) {
          if (fiber.state !== 'pending' || !fiber.depsSatisfied()) continue
          progressed = true
          await fiber.activate()
        }
      }
    } while (this.#again && guard < 500)
    if (guard >= 500) {
      this.errors.push(new Error('plugin activation did not converge after 500 rounds'))
    }
  }

  /** Discard the whole tree, children before parents. */
  async disposeAll(): Promise<void> {
    for (const fiber of [...this.fibers]) {
      if (fiber.parent === null) await fiber.dispose()
    }
    this.fibers.clear()
    this.services.clear()
    this.#listeners.clear()
  }

  dumpTree(): TreeNode[] {
    return [...this.fibers]
      .filter((fiber) => fiber.parent === null)
      .map((fiber) => fiber.snapshot())
  }

  /**
   * Services a fiber currently owns, which is what disappears when it unloads.
   *
   * Needed because the kernel deliberately does not auto-reload dependents: a
   * caller that wants to unload a provider must first ask who is relying on it.
   */
  servicesOwnedBy(fiber: Fiber): string[] {
    return [...this.services.entries()]
      .filter(([, entry]) => entry.owner === fiber)
      .map(([name]) => name)
  }

  /** Active fibers whose `inject` would break if `fiber` unloaded. */
  dependentsOf(fiber: Fiber): Fiber[] {
    const provided = new Set(this.servicesOwnedBy(fiber))
    if (provided.size === 0) return []
    return [...this.fibers].filter(
      (candidate) =>
        candidate !== fiber &&
        candidate.state === 'active' &&
        candidate.inject.some((name) => provided.has(name)),
    )
  }
}

/**
 * The per-plugin lifecycle handle. DSH's `fiber.ts` is the same idea: a state
 * machine plus an effect stack that unwinds in reverse order on disposal.
 */
export class Fiber {
  readonly id: string
  readonly label: string
  readonly ctx: Context
  readonly inject: string[]
  state: FiberState = 'pending'

  #registry: Registry
  // `any` on purpose: a plugin's config type is its own business. Keeping the
  // generic here would make every Fiber invariant in its config type.
  #plugin: PluginObject<any>
  #config: unknown
  #effects: Disposer[] = []
  #children = new Set<Fiber>()
  #parent: Fiber | null
  #resolveReady: (() => void) | null = null
  #ready: Promise<void>

  constructor(options: {
    registry: Registry
    plugin: PluginObject<any>
    config: unknown
    parent: Fiber | null
    id: string
  }) {
    this.#registry = options.registry
    this.#plugin = options.plugin
    this.#config = options.config
    this.#parent = options.parent
    this.id = options.id
    this.label = options.plugin.name ?? 'anonymous'
    this.inject = [...(options.plugin.inject ?? [])]
    this.#ready = new Promise<void>((resolve) => {
      this.#resolveReady = resolve
    })
    this.ctx = new Context(this.#registry, this, this.#registry.logger.child(this.label))
  }

  get parent(): Fiber | null {
    return this.#parent
  }

  /** Resolves when this fiber reaches `active` or `disposed`. */
  get ready(): Promise<void> {
    return this.#ready
  }

  depsSatisfied(): boolean {
    return this.inject.every((name) => this.#registry.hasService(name))
  }

  addEffect(disposer: Disposer): void {
    if (this.state === 'disposed') {
      // Registering after unload is a plugin bug, but never leak the effect.
      this.ctx.logger.warn('effect registered after dispose; unwinding immediately')
      try {
        disposer()
      } catch (error) {
        this.ctx.logger.error('late disposer threw', error)
      }
      return
    }
    this.#effects.push(disposer)
  }

  addChild(child: Fiber): void {
    this.#children.add(child)
  }

  async activate(): Promise<void> {
    if (this.state !== 'pending') return
    // Re-check at activation time, not only at scheduling time: a settle round
    // may have queued this fiber before the service it needs was unregistered.
    if (!this.depsSatisfied()) return
    this.state = 'active'
    let returned: void | Disposer
    try {
      returned = await this.#plugin.apply(this.ctx, this.#config)
    } catch (error) {
      const wrapped = error instanceof Error ? error : new Error(String(error))
      this.#registry.errors.push(wrapped)
      this.ctx.logger.error('plugin failed to apply', wrapped.message)
      await this.dispose()
      this.#settleReady()
      return
    }
    if (typeof returned === 'function') this.#effects.push(returned)
    this.#settleReady()
  }

  async dispose(): Promise<void> {
    if (this.state === 'disposed') return
    const wasActive = this.state === 'active'
    this.state = 'disposed'
    this.#registry.fibers.delete(this)

    // A plugin gets one last chance to observe its own teardown before its
    // effects (including its own listeners) are unwound.
    if (wasActive) await this.ctx.emit('dispose', [])

    for (const child of [...this.#children].reverse()) await child.dispose()
    this.#children.clear()

    const effects = this.#effects.splice(0)
    for (let index = effects.length - 1; index >= 0; index -= 1) {
      try {
        await effects[index]!()
      } catch (error) {
        this.ctx.logger.error('disposer threw', error)
      }
    }

    if (this.#parent) this.#parent.#children.delete(this)
    this.#settleReady()
  }

  snapshot(): TreeNode {
    return {
      label: this.label,
      state: this.state,
      inject: [...this.inject],
      children: [...this.#children].map((child) => child.snapshot()),
    }
  }

  #settleReady(): void {
    this.#resolveReady?.()
    this.#resolveReady = null
  }
}

/**
 * What a plugin receives. Every mutating call is registered as an effect on the
 * owning fiber, so unloading the plugin removes exactly what it added.
 */
export class Context {
  readonly registry: Registry
  readonly fiber: Fiber
  readonly logger: Logger

  constructor(registry: Registry, fiber: Fiber, logger: Logger) {
    this.registry = registry
    this.fiber = fiber
    this.logger = logger
  }

  get state(): FiberState {
    return this.fiber.state
  }

  /** Whether a service is currently registered. `inject` uses the same check. */
  has(name: string): boolean {
    return this.registry.hasService(name)
  }

  get<T = unknown>(name: string): T | undefined {
    return this.registry.getService<T>(name)
  }

  /** Like `get`, but throws when the service is missing. Use inside `apply`. */
  require<T>(name: string): T {
    if (!this.registry.hasService(name)) {
      throw new Error(`service "${name}" is required by plugin "${this.fiber.label}" but is not registered`)
    }
    return this.registry.getService<T>(name) as T
  }

  /**
   * Register a service. Unwinding restores whatever was registered before, so a
   * plugin that shadows another service is reversible.
   */
  provide(name: string, value: unknown): void {
    this.effect(() => {
      const previous = this.registry.services.get(name)
      this.registry.services.set(name, { value, owner: this.fiber })
      this.registry.requestSettle()
      return () => {
        const current = this.registry.services.get(name)
        if (current && current.owner === this.fiber) {
          if (previous) this.registry.services.set(name, previous)
          else this.registry.services.delete(name)
        }
        this.registry.requestSettle()
      }
    })
  }

  /** Replace an existing service value without changing its declared owner. */
  set(name: string, value: unknown): void {
    const entry = this.registry.services.get(name)
    if (!entry) {
      this.provide(name, value)
      return
    }
    this.effect(() => {
      const previous = entry.value
      entry.value = value
      return () => {
        entry.value = previous
      }
    })
  }

  /** Run `setup` now and register its cleanup on this plugin's effect stack. */
  effect(setup: () => Disposer): Disposer {
    const disposer = setup()
    this.fiber.addEffect(disposer)
    return disposer
  }

  /** Listen for an event. The listener is removed when this plugin unloads. */
  on(event: string, callback: (...args: any[]) => unknown): Disposer {
    const listener: Listener = { callback, owner: this.fiber }
    return this.effect(() => {
      this.registry.addListener(event, listener)
      return () => this.registry.removeListener(event, listener)
    })
  }

  /** Fire an event. Listeners run in registration order and are awaited. */
  emit(event: string, ...args: unknown[]): Promise<void> {
    return this.registry.emit(event, args)
  }

  /**
   * Mount a child plugin. It activates as soon as its `inject` is satisfied, and
   * is unloaded automatically when this plugin unloads.
   */
  plugin<C>(plugin: Plugin<C>, config?: C): Fiber {
    const normalized = normalizePlugin(plugin)
    const fiber = new Fiber({
      registry: this.registry,
      plugin: normalized,
      config,
      parent: this.fiber,
      id: `${this.registry.fibers.size + 1}-${normalized.name ?? 'anonymous'}`,
    })
    this.fiber.addChild(fiber)
    this.registry.fibers.add(fiber)
    this.registry.requestSettle()
    return fiber
  }

  /** Await activation of every mountable plugin. */
  settle(): Promise<void> {
    return this.registry.settle()
  }

  /** Unload this plugin and everything it mounted. */
  dispose(): Promise<void> {
    return this.fiber.dispose()
  }
}

/** Accept both plugin forms and normalise to the structured one. */
export function normalizePlugin<C>(plugin: Plugin<C>): PluginObject<C> {
  if (typeof plugin === 'function') {
    const inject = (plugin as PluginFunction<C> & { inject?: readonly string[] }).inject
    return {
      name: plugin.name || 'anonymous',
      inject,
      apply: plugin as PluginObject<C>['apply'],
    }
  }
  if (!plugin || typeof plugin.apply !== 'function') {
    throw new TypeError('invalid plugin: expected a function or an object with apply()')
  }
  return plugin
}

export interface CreateContextOptions {
  logger?: Logger
}

/**
 * Create an empty root context. The root is itself a fiber, so `ctx.plugin()`
 * at the top level is disposed by `ctx.dispose()` just like any child plugin.
 */
export function createContext(options: CreateContextOptions = {}): Context {
  const registry = new Registry(options.logger ?? new Logger('warn'))
  const rootFiber = new Fiber({
    registry,
    plugin: { name: 'root', apply: () => {} },
    config: undefined,
    parent: null,
    id: 'root',
  })
  rootFiber.state = 'active'
  registry.fibers.add(rootFiber)
  return rootFiber.ctx
}

/** Render the boot tree the way `dsh --dump-config` renders a profile. */
export function renderTree(nodes: TreeNode[], indent = ''): string {
  const lines: string[] = []
  nodes.forEach((node, index) => {
    const last = index === nodes.length - 1
    const atRoot = indent === ''
    const branch = atRoot ? '' : last ? '└── ' : '├── '
    const inject = node.inject.length > 0 ? `  (inject: ${node.inject.join(', ')})` : ''
    lines.push(`${indent}${branch}${node.label} [${node.state}]${inject}`)
    const childIndent = atRoot ? `${indent}  ` : `${indent}${last ? '    ' : '│   '}`
    if (node.children.length > 0) lines.push(renderTree(node.children, childIndent))
  })
  return lines.join('\n')
}
