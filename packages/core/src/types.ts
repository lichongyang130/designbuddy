/**
 * Public vocabulary of the DesignBuddy plugin kernel.
 *
 * A plugin is a plain object (or a class instance) with a stable `name`, an
 * optional list of injected service keys, an optional config schema, and an
 * `apply` function that receives a context scoped to the plugin's own
 * lifecycle. Everything the plugin registers — services, event listeners,
 * timers, sub-plugins — is torn down when the plugin is disposed.
 */

import type { Context } from './context'

/** A cleanup callback. Runs at most once, when the owning fork is disposed. */
export type Dispose = () => void

export type ConfigFieldType = 'string' | 'number' | 'boolean' | 'select' | 'textarea'

export interface ConfigFieldOption {
  label: string
  value: string | number
}

/** One editable field of a plugin's configuration, rendered by the Web UI. */
export interface ConfigField {
  key: string
  label: string
  type: ConfigFieldType
  default?: unknown
  options?: ConfigFieldOption[]
  description?: string
  placeholder?: string
}

export type ConfigSchema = ConfigField[]

export type PluginCategory =
  | 'core'
  | 'model'
  | 'agent'
  | 'tool'
  | 'memory'
  | 'interface'
  | 'skill'

export interface PluginMeta {
  /** Human readable name shown in the plugin market. */
  title?: string
  description?: string
  category?: PluginCategory
  author?: string
  tags?: string[]
  /** Sort hint for the UI. */
  order?: number
}

export interface Plugin<S = any> {
  name: string
  version?: string
  meta?: PluginMeta
  /** Service keys that must exist before `apply` runs. */
  inject?: string[]
  /** Config declarations; defaults are merged before `apply`. */
  Config?: ConfigSchema
  apply(ctx: Context, config: S): void | Dispose
}

export type ForkState = 'pending' | 'active' | 'error' | 'disposed'

/** Serializable snapshot of an applied plugin, consumed by the Web UI. */
export interface ForkInfo {
  id: string
  name: string
  title: string
  description: string
  category: PluginCategory
  version: string
  author: string
  tags: string[]
  state: ForkState
  error: string | null
  provides: string[]
  inject: string[]
  missing: string[]
  config: Record<string, unknown>
  configSchema: ConfigSchema
  appliedAt: number | null
  order: number
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: number
  at: number
  level: LogLevel
  source: string
  message: string
}
