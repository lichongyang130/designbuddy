#!/usr/bin/env node
/**
 * Browser preview server — zero dependencies, no build step.
 *
 * Transport choice: Server-Sent Events for host→client and `POST /send` for
 * client→host. A WebSocket would be tidier, but implementing RFC 6455 by hand
 * would put far more code in the transport than in the thing being demonstrated.
 * SSE also makes the split visible: the page is a pure frame consumer, exactly
 * like `apps/client/main.ts` over stdio.
 *
 * Endpoints:
 *   GET  /            the page
 *   GET  /events?id=  host→client frame stream (one HostServer per connection)
 *   POST /send?id=    client→host frames
 *   GET  /health      liveness + row/client counts
 */

import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { App } from '../../src/boot/app.ts'
import { applyDefaultDataPaths } from '../../src/boot/paths.ts'
import { defaultModules, desktopProfile } from '../../src/boot/profiles.ts'
import { Logger } from '../../src/kernel/index.ts'
import { HostServer } from '../../src/sdk/host.ts'
import type { ClientFrame, HostFrame, Transport } from '../../src/sdk/protocol.ts'

const START_PORT = Number(process.env.PORT ?? 5178)
const BIND = process.env.HOST ?? '127.0.0.1'
const PING_MS = 15_000

const logger = new Logger(process.env.DSH_DEBUG ? 'debug' : 'warn')
// 预览与桌面版共用同一份数据目录：会话与用量都落在 .designbuddy/。
applyDefaultDataPaths()
const app = await App.create({ profile: desktopProfile, modules: defaultModules, logger })

const PUBLIC_DIR = new URL('./public/', import.meta.url)
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

async function serveStatic(pathname: string, res: ServerResponse): Promise<boolean> {
  let rel: string
  try {
    rel = decodeURIComponent(pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''))
  } catch {
    return false
  }
  if (rel === '' || rel.includes('..')) return false
  const dot = rel.lastIndexOf('.')
  const ext = dot >= 0 ? rel.slice(dot).toLowerCase() : ''
  try {
    // 每次请求都重读：页面与演示数据没有指纹文件名，缓存会导致改完看不到
    const body = await readFile(new URL(rel, PUBLIC_DIR))
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate',
    })
    res.end(body)
    return true
  } catch {
    return false
  }
}

interface Connection {
  send: (frame: HostFrame) => void
  deliver: (frame: ClientFrame) => void
  close: () => void
}

const connections = new Map<string, Connection>()

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function openStream(req: IncomingMessage, res: ServerResponse, id: string): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(': connected\n\n')

  const handlers = new Set<(frame: ClientFrame) => void>()
  const transport: Transport = {
    send(frame) {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(frame)}\n\n`)
    },
    onFrame(handler) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
  }

  // Unloading is an app-layer decision (it may need to cascade), so the host
  // gets it as a command rather than reaching for the row table itself.
  const host = new HostServer(app.ctx, transport, {
    unmount: (rowId, options) => app.unmount(rowId, options),
    rows: () =>
      app.rows.map((row) => ({
        id: row.id,
        plugin: row.plugin,
        enabled: row.enabled !== false,
        mounted: app.mounted.has(row.id),
      })),
  })

  const ping = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n')
  }, PING_MS)

  const close = () => {
    clearInterval(ping)
    host.dispose()
    connections.delete(id)
    logger.debug(`sse ${id} closed (${connections.size} left)`)
  }

  connections.set(id, {
    send: transport.send,
    deliver: (frame) => {
      for (const handler of [...handlers]) handler(frame)
    },
    close,
  })
  req.on('close', close)
  logger.debug(`sse ${id} opened (${connections.size} total)`)
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    if (await serveStatic('/', res)) return
  }

  if (req.method === 'GET' && url.pathname === '/events') {
    openStream(req, res, url.searchParams.get('id') ?? randomUUID())
    return
  }

  if (req.method === 'POST' && url.pathname === '/send') {
    const connection = connections.get(url.searchParams.get('id') ?? '')
    if (!connection) {
      sendJson(res, 409, { error: 'no such stream; open /events first' })
      return
    }
    let frame: ClientFrame
    try {
      frame = JSON.parse(await readBody(req)) as ClientFrame
    } catch {
      sendJson(res, 400, { error: 'invalid json frame' })
      return
    }
    connection.deliver(frame)
    res.writeHead(204).end()
    return
  }

  if (url.pathname === '/health') {
    sendJson(res, 200, { ok: true, rows: app.rows.length, clients: connections.size })
    return
  }

  if (url.pathname === '/favicon.ico') {
    res.writeHead(204).end()
    return
  }

  if (req.method === 'GET' && (await serveStatic(url.pathname, res))) return

  sendJson(res, 404, { error: 'not found' })
}

const server = createServer((req, res) => {
  void route(req, res).catch((error: unknown) => {
    logger.error('request failed', error)
    if (!res.headersSent) sendJson(res, 500, { error: String(error) })
    else res.end()
  })
})

async function listen(port: number, attempt = 0): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && attempt < 10) {
        server.off('error', onError)
        resolve(listen(port + 1, attempt + 1))
        return
      }
      reject(error)
    }
    server.once('error', onError)
    server.listen(port, BIND, () => {
      server.off('error', onError)
      resolve(port)
    })
  })
}

const port = await listen(START_PORT)
console.log(`DesignBuddy preview → http://${BIND}:${port}/`)
console.log(`plugins: ${app.rows.length} rows, ${app.skipped.length} skipped`)

let closing = false
const shutdown = async () => {
  if (closing) return
  closing = true
  for (const connection of connections.values()) connection.close()
  server.close()
  await app.dispose()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
