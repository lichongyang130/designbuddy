import { Disposer, EventBus } from './events'
import type {
  ConfigSchema,
  Dispose,
  ForkInfo,
  ForkState,
  LogEntry,
  LogLevel,
  Plugin,
  PluginCategory,
} from './types'

export interface ServiceEntry {
  value: unknown
  owner: string | null
  providedAt: number
}

/** A single applied plugin instance. */
export class Fork {
  readonly id: string
  readonly plugin: Plugin
  readonly parent: Fork | null
  readonly inject: string[]
  readonly hidden: boolean
  raw: Record<string, unknown>
  config: Record<string, unknown>
  state: ForkState = 'pending'
  error: string | null = null
  appliedAt: number | null = null
  disposer = new Disposer()
  provides: string[] = []

  ctx: Context

  constructor(
    readonly container: Container,
    plugin: Plugin,
    raw: Record<string, unknown>,
    parent: Fork | null,
    id: string,
  ) {
    this.plugin = plugin
    this.parent = parent
    this.raw = raw
    this.config = mergeConfig(plugin.Config, raw)
    this.inject = plugin.inject ?? []
    this.hidden = plugin.name.includes('~')
    this.id = id
    this.ctx = new Context(container, this)
  }

  get name(): string {
    return this.plugin.name
  }

  info(): ForkInfo {
    const meta = this.plugin.meta ?? {}
    return {
      id: this.id,
      name: this.plugin.name,
      title: meta.title ?? this.plugin.name,
      description: meta.description ?? '',
      category: (meta.category ?? 'core') as PluginCategory,
      version: this.plugin.version ?? '0.1.0',
      author: meta.author ?? 'DesignBuddy',
      tags: meta.tags ?? [],
      state: this.state,
      error: this.error,
      provides: [...this.provides],
      inject: [...this.inject],
      missing: this.container.missingDeps(this),
      config: { ...this.config },
      configSchema: (this.plugin.Config ?? []) as ConfigSchema,
      appliedAt: this.appliedAt,
      order: meta.order ?? 100,
    }
  }
}

/**
 * Owns the service store, the plugin registry and the dependency graph.
 *
 * The container never types a service: keys are strings and every consumer
 * casts at the boundary, exactly like Cordis. That is what lets a new
 * capability ship as a package that merely `inject`s a key.
 */
export class Container {
  readonly services = new Map<string, ServiceEntry[]>()
  readonly forks = new Map<string, Fork>()
  readonly pluginsByName = new Map<string, Plugin>()
  readonly bus = new EventBus()
  readonly logs: LogEntry[] = []
  readonly rootDisposer = new Disposer()

  private seq = 0
  private logSeq = 0
  private evaluating = false
  private dirty = false

  nextId(prefix: string): string {
    return `${prefix}-${(++this.seq).toString(36)}`
  }

  // ---------------------------------------------------------------- services

  entries(name: string): ServiceEntry[] {
    return this.services.get(name) ?? []
  }

  get<T>(name: string): T | undefined {
    const list = this.services.get(name)
    return list && list.length ? (list[list.length - 1].value as T) : undefined
  }

  has(name: string): boolean {
    const list = this.services.get(name)
    return !!list && list.length > 0
  }

  /** All currently provided service keys. */
  keys(): string[] {
    return [...this.services.keys()].sort()
  }

  setService(name: string, value: unknown, owner: string | null): void {
    const list = this.services.get(name) ?? []
    list.push({ value, owner, providedAt: Date.now() })
    this.services.set(name, list)
    this.emit('service/set', name, owner)
    this.evaluate()
  }

  /** Drops every service registered by one owner (used on unload). */
  removeServices(owner: string): void {
    let changed = false
    for (const [name, list] of this.services) {
      const kept = list.filter((entry) => entry.owner !== owner)
      if (kept.length !== list.length) {
        changed = true
        if (kept.length) this.services.set(name, kept)
        else this.services.delete(name)
      }
    }
    if (changed) {
      this.emit('service/remove', owner)
      this.evaluate()
    }
  }

  missingDeps(fork: Fork): string[] {
    return fork.inject.filter((key) => !this.has(key))
  }

  // ------------------------------------------------------------------ plugins

  apply(plugin: Plugin, config: Record<string, unknown> = {}, parent: Fork | null = null): Fork {
    this.pluginsByName.set(plugin.name, plugin)
    const existing = this.find(plugin.name)
    if (existing) {
      existing.raw = { ...existing.raw, ...config }
      existing.config = mergeConfig(plugin.Config, existing.raw)
      this.restart(existing)
      return existing
    }
    const fork = new Fork(this, plugin, { ...config }, parent, this.nextId(plugin.name))
    this.forks.set(fork.id, fork)
    this.log('info', plugin.name, `loaded (${fork.inject.length ? `inject: ${fork.inject.join(', ')}` : 'no deps'})`)
    this.evaluate()
    this.emit('fork/change', fork.info())
    return fork
  }

  find(name: string): Fork | undefined {
    for (const fork of this.forks.values()) {
      if (fork.name === name) return fork
    }
    return undefined
  }

  /** Unloads a plugin and every plugin that injected one of its services. */
  remove(name: string): boolean {
    const fork = this.find(name)
    if (!fork) return false
    this.disposeFork(fork)
    this.log('info', name, 'unloaded')
    return true
  }

  restart(fork: Fork): void {
    this.suspend(fork)
    this.log('info', fork.name, 'reloading with new config')
    this.evaluate()
  }

  private disposeFork(fork: Fork): void {
    for (const child of [...this.forks.values()]) {
      if (child.parent === fork) this.disposeFork(child)
    }
    fork.state = 'disposed'
    this.suspend(fork)
    this.forks.delete(fork.id)
    this.emit('fork/change', { ...fork.info(), state: 'disposed' as ForkState })
  }

  private suspend(fork: Fork): void {
    if (fork.appliedAt !== null || fork.state === 'error') {
      fork.disposer.dispose()
    }
    fork.disposer = new Disposer()
    // The state is settled *before* services are released: releasing runs
    // evaluate(), which must not see this fork as active (suspend it twice) or
    // as pending (reactivate what is being torn down).
    if (fork.state !== 'disposed') fork.state = 'pending'
    fork.provides = []
    fork.appliedAt = null
    this.removeServices(fork.id)
    this.emit('fork/change', fork.info())
  }

  private activate(fork: Fork): void {
    fork.state = 'active'
    fork.error = null
    fork.disposer = new Disposer()
    fork.ctx = new Context(this, fork)
    try {
      const result = fork.plugin.apply(fork.ctx, fork.config)
      if (typeof result === 'function') fork.disposer.add(result)
      fork.appliedAt = Date.now()
      this.emit('fork/ready', fork.info())
    } catch (error) {
      fork.state = 'error'
      fork.error = error instanceof Error ? error.message : String(error)
      fork.disposer.dispose()
      this.removeServices(fork.id)
      fork.provides = []
      this.log('error', fork.name, `failed to apply: ${fork.error}`)
    }
    this.emit('fork/change', fork.info())
  }

  /**
   * Reconciles the dependency graph: suspend forks whose injections vanished,
   * activate pending forks whose injections arrived, until stable.
   */
  evaluate(): void {
    if (this.evaluating) {
      this.dirty = true
      return
    }
    this.evaluating = true
    try {
      let rounds = 0
      do {
        this.dirty = false
        for (const fork of [...this.forks.values()]) {
          if (fork.state === 'active' && this.missingDeps(fork).length > 0) {
            this.log('warn', fork.name, `suspended — missing ${this.missingDeps(fork).join(', ')}`)
            this.suspend(fork)
          }
        }
        for (const fork of [...this.forks.values()]) {
          if (fork.state === 'pending' && this.missingDeps(fork).length === 0) {
            this.activate(fork)
          }
        }
      } while (this.dirty && ++rounds < 25)
    } finally {
      this.evaluating = false
    }
  }

  // ------------------------------------------------------------------ inspect

  inspect(options: { includeInternal?: boolean } = {}): ForkInfo[] {
    return [...this.forks.values()]
      .filter((fork) => options.includeInternal || !fork.hidden)
      .map((fork) => fork.info())
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  }

  // --------------------------------------------------------------------- logs

  log(level: LogLevel, source: string, message: string): void {
    const entry: LogEntry = { id: ++this.logSeq, at: Date.now(), level, source, message }
    this.logs.push(entry)
    if (this.logs.length > 400) this.logs.splice(0, this.logs.length - 400)
    this.emit('log/append', entry)
  }

  emit(event: string, ...args: unknown[]): void {
    this.bus.emit(event, ...args)
  }

  /** Stops every plugin, newest first. Used by tests and shutdown. */
  stop(): void {
    const forks = [...this.forks.values()].sort(
      (a, b) => (a.appliedAt ?? 0) - (b.appliedAt ?? 0),
    )
    for (const fork of forks.reverse()) {
      if (this.forks.has(fork.id)) this.disposeFork(fork)
    }
    this.rootDisposer.dispose()
  }
}

/**
 * The handle every plugin receives. It is bound to one fork: registrations made
 * through it belong to that fork and disappear with it.
 */
export class Context {
  constructor(
    readonly container: Container,
    readonly fork: Fork | null = null,
  ) {}

  // ---------------------------------------------------------------- services

  get<T = any>(name: string): T | undefined {
    return this.container.get<T>(name)
  }

  has(name: string): boolean {
    return this.container.has(name)
  }

  /** Declares and registers a service in one call. */
  set<T>(name: string, value: T): T {
    this.container.setService(name, value, this.fork?.id ?? null)
    if (this.fork && !this.fork.provides.includes(name)) this.fork.provides.push(name)
    return value
  }

  /** Late-binding form: `const config = ctx.provide('introspect'); config.set(...)`. */
  provide<T>(name: string): { set: (value: T) => T } {
    return { set: (value: T) => this.set(name, value) }
  }

  /** Registers a cleanup hook for this fork. */
  effect(cleanup: Dispose): void {
    if (this.fork) this.fork.disposer.add(cleanup)
    else this.container.rootDisposer.add(cleanup)
  }

  // ------------------------------------------------------------------ events

  on(event: string, listener: (...args: any[]) => void): () => void {
    const off = this.container.bus.on(event, listener)
    this.effect(off)
    return off
  }

  emit(event: string, ...args: unknown[]): void {
    this.container.emit(event, ...args)
  }

  get bus(): EventBus {
    return this.container.bus
  }

  // ----------------------------------------------------------------- plugins

  /** Loads a child plugin. It is disposed with its parent. */
  plugin(plugin: Plugin, config: Record<string, unknown> = {}): Fork {
    return this.container.apply(plugin, config, this.fork)
  }

  /**
   * Runs `callback` in a child scope that exists only while every dependency is
   * available. This is how optional capabilities compose.
   */
  inject(deps: string[], callback: (ctx: Context) => void | Dispose): Fork {
    const parent = this.fork?.name ?? 'root'
    return this.container.apply(
      {
        name: `${parent}~inject:${deps.join('+')}`,
        inject: deps,
        apply: (ctx) => callback(ctx),
      },
      {},
      this.fork,
    )
  }

  log(level: LogLevel, message: string): void {
    this.container.log(level, this.fork?.name ?? 'root', message)
  }

  // ------------------------------------------------------------------ inspect

  inspect(): ForkInfo[] {
    return this.container.inspect()
  }

  keys(): string[] {
    return this.container.keys()
  }
}

/** Applies config-schema defaults, then the caller's values. */
export function mergeConfig(
  schema: ConfigSchema | undefined,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  for (const field of schema ?? []) {
    if (field.default !== undefined) merged[field.key] = field.default
  }
  for (const [key, value] of Object.entries(values)) {
    const field = schema?.find((item) => item.key === key)
    if (field) merged[key] = coerce(field.type, value)
    else merged[key] = value
  }
  return merged
}

function coerce(type: ConfigSchema[number]['type'], value: unknown): unknown {
  if (value === null || value === undefined || value === '') return value
  if (type === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }
  if (type === 'boolean') {
    if (typeof value === 'string') return value !== 'false' && value !== '0'
    return Boolean(value)
  }
  return value
}
