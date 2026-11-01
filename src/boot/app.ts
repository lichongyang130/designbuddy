/**
 * App assembly: mount rows into a kernel context, and support runtime install.
 *
 * DSH equivalent: `boot/app-boot` (composition) + `boot/plugin-manager` (runtime
 * install/uninstall from the Web UI). The interesting method is `unmount`: the
 * kernel refuses to leave dangling consumers on its own, so the app layer asks
 * `dependentsOf` first and either refuses or cascades.
 *
 * @module designbuddy/boot/app
 */

import type { Context, Disposer, Fiber, Logger } from '../kernel/index.ts'
import { createContext, renderTree } from '../kernel/index.ts'
import type { Bundle, Patch, PluginRow, Profile } from './loader.ts'
import { applyPatches, flatten } from './loader.ts'

export interface PluginModule {
  name?: string
  inject?: readonly string[]
  apply: (ctx: Context, config: any) => void | Disposer | Promise<void | Disposer>
}

export type PluginModules = Record<string, PluginModule>

export interface AppOptions {
  profile: Profile
  modules: PluginModules
  patches?: Patch[]
  logger?: Logger
}

export interface MountedRow {
  row: PluginRow
  fiber: Fiber
}

export class App {
  readonly ctx: Context
  readonly rows: PluginRow[]
  readonly mounted = new Map<string, MountedRow>()
  readonly skipped: { row: PluginRow; reason: string }[] = []

  #modules: PluginModules
  #logger: Logger | undefined

  private constructor(ctx: Context, rows: PluginRow[], modules: PluginModules, logger?: Logger) {
    this.ctx = ctx
    this.rows = rows
    this.#modules = modules
    this.#logger = logger
  }

  static async create(options: AppOptions): Promise<App> {
    const rows = applyPatches(flatten(options.profile), options.patches ?? [])
    const ctx = createContext({ logger: options.logger })
    const app = new App(ctx, rows, options.modules, options.logger)
    for (const row of rows) app.mount(row)
    await ctx.settle()
    return app
  }

  /** Mount one row. Returns null when the module is not installed. */
  mount(row: PluginRow): MountedRow | null {
    const module = this.#modules[row.plugin]
    if (!module) {
      const reason = `plugin module "${row.plugin}" is not installed`
      this.skipped.push({ row, reason })
      this.ctx.logger.error(`${row.id}: ${reason}`)
      return null
    }
    const fiber = this.ctx.plugin(module, row.config)
    const entry: MountedRow = { row, fiber }
    this.mounted.set(row.id, entry)
    return entry
  }

  /**
   * Unload a row.
   *
   * Refuses when another active plugin injects a service this row provides,
   * because the kernel keeps dependents alive and they would hold a stale
   * reference. `cascade: true` unloads those dependents first, in reverse order.
   */
  async unmount(rowId: string, options: { cascade?: boolean } = {}): Promise<string[]> {
    const entry = this.mounted.get(rowId)
    if (!entry) throw new Error(`no mounted row "${rowId}"`)

    const dependents = this.ctx.registry.dependentsOf(entry.fiber)
    if (dependents.length > 0 && !options.cascade) {
      throw new Error(
        `cannot unload "${rowId}": still required by ${dependents.map((fiber) => fiber.label).join(', ')}`,
      )
    }

    const removed: string[] = []
    for (const fiber of dependents) {
      const dependentRow = [...this.mounted.entries()].find(([, candidate]) => candidate.fiber === fiber)
      if (dependentRow) {
        removed.push(dependentRow[0])
        this.mounted.delete(dependentRow[0])
      }
      await fiber.dispose()
    }

    await entry.fiber.dispose()
    this.mounted.delete(rowId)
    removed.push(rowId)
    return removed
  }

  /** Re-run activation for anything left pending (after a manual mount). */
  settle(): Promise<void> {
    return this.ctx.settle()
  }

  tree(): string {
    return renderTree(this.ctx.registry.dumpTree())
  }

  /** The boot tree the way `dsh --dump-config` prints it, including skips. */
  describe(): string {
    const lines = [`profile: ${this.rows.length} rows, ${this.skipped.length} skipped`, this.tree()]
    for (const skip of this.skipped) lines.push(`  ! ${skip.row.id}: ${skip.reason}`)
    return lines.join('\n')
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose()
    this.mounted.clear()
  }
}

export { renderTree }
export type { Bundle, Patch, PluginRow, Profile }
