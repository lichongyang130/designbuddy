import type { Context, PluginMeta } from '@designbuddy/core'
import { HostServer } from './server'
import type { StartOptions } from './types'

export { HostServer } from './server'
export type { MarketEntry, StartOptions } from './types'

export const name = 'host'
export const meta: PluginMeta = {
  title: 'HTTP 服务',
  description: '把内核暴露成 REST + SSE 接口，同时托管 Web UI。它本身也是一个可插拔的插件。',
  category: 'interface',
  tags: ['http', 'sse', 'server'],
  order: 50,
}

export function apply(ctx: Context, config: StartOptions): void {
  const server = new HostServer(ctx, config)
  ctx.set('host', server)

  // Every bus event becomes a browser event: the UI observes the kernel, it
  // does not poll it.
  ctx.on('*', (event: string, ...args: unknown[]) => {
    server.broadcast(event, args.length <= 1 ? args[0] : args)
  })

  ctx.effect(() => server.close())

  void server
    .listen()
    .then(({ port }) => {
      ctx.log('info', `listening on http://localhost:${port}`)
      ctx.emit('host/ready', { port })
    })
    .catch((error) => ctx.log('error', `server failed: ${error.message}`))
}

export default HostServer
