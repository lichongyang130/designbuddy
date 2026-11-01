import { createApplication } from './app'

const app = createApplication()

console.log(`
  DesignBuddy — everything is a plugin
  ------------------------------------
  API      http://localhost:${process.env.PORT ?? 5178}/api/state
  Web UI   http://localhost:${process.env.PORT ?? 5178}/
`)

const shutdown = (signal: string) => {
  console.log(`\n[designbuddy] ${signal} — stopping plugins`)
  app.stop()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
