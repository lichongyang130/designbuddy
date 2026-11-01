import type { Plugin } from '@designbuddy/core'

export interface MarketEntry {
  plugin: Plugin
  title?: string
  description?: string
  category?: string
  /** Cannot be disabled from the UI (the app would lose its foundation). */
  required?: boolean
  defaultConfig?: Record<string, unknown>
}

export interface StartOptions {
  port: number
  host?: string
  webDir?: string
  market: MarketEntry[]
}
