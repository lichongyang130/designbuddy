import { resolve } from 'node:path'
import { createApp, type Context, type Plugin } from '@designbuddy/core'
import * as hostPlugin from '@designbuddy/host'
import { HostServer } from '@designbuddy/host'
import { market } from './registry'

export interface BootOptions {
  port?: number
  webDir?: string
  /** Load the HTTP host (tests skip it). */
  serve?: boolean
}

export interface App {
  ctx: Context
  market: typeof market
  /** The server instance, once the host plugin is applied. */
  server: () => HostServer | undefined
  loadAll: () => void
  stop: () => void
}

/**
 * Builds the application from the plugin market. Used by `main.ts` and by the
 * tests, which is the point: the tested composition is the shipped one.
 */
export function createApplication(options: BootOptions = {}): App {
  const { ctx } = createApp()
  const entries = market

  const loadAll = () => {
    for (const entry of entries) {
      if (entry.required) ctx.plugin(entry.plugin as Plugin, entry.defaultConfig ?? {})
    }
    // Optional capabilities start enabled: the product should be complete on
    // first run, and the market is where people *remove* things.
    for (const entry of entries) {
      if (entry.required) continue
      if (entry.plugin.name === 'provider-openai' && !hasApiKey()) {
        ctx.container.log('info', 'provider-openai', 'no API key found — kept unloaded, demo model is active')
        continue
      }
      ctx.plugin(entry.plugin as Plugin, entry.defaultConfig ?? {})
    }
  }

  loadAll()

  if (options.serve !== false) {
    ctx.plugin(hostPlugin as unknown as Plugin, {
      port: options.port ?? Number(process.env.PORT ?? 5178),
      host: '0.0.0.0',
      webDir: options.webDir ?? resolve(__dirname, '../../web/dist'),
      market: entries,
    })
  }

  return {
    ctx,
    market: entries,
    server: () => ctx.get<HostServer>('host'),
    loadAll,
    stop: () => ctx.container.stop(),
  }
}

function hasApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY)
}
