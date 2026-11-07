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
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { App } from '../../src/boot/app.ts'
import { applyDefaultDataPaths } from '../../src/boot/paths.ts'
import { defaultModules, desktopProfile } from '../../src/boot/profiles.ts'
import { Logger } from '../../src/kernel/index.ts'
import { writePptx } from '../../src/office/pptx.ts'
import type { PptxDeckInput } from '../../src/office/pptx.ts'
import { writePresentation } from '../../src/core/deck-renderer.ts'
import type { PptPresentation } from '../../src/core/deck-model.ts'
import { generatePptxBuffer } from '../../src/core/ppt-generator.ts'
import type { GeneratePptxInput } from '../../src/core/ppt-generator.ts'
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
// 大纲确认后产出的成品目录，和 core/artifact 落盘用的是同一个（applyDefaultDataPaths 已设好）。
const OUTPUT_DIR = process.env.DB_OUTPUT_DIR ?? join(process.cwd(), '.designbuddy', 'output')
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
  // 大纲确认后的产出：docx / zip 走下载，svg 直接在页面里显示
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
}

async function serveStatic(pathname: string, res: ServerResponse, req?: IncomingMessage): Promise<boolean> {
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
    // Native media controls need byte ranges to seek reliably. Keep the normal
    // static path unchanged for non-media and reject unsatisfiable media ranges.
    if (ext === '.mp4' && req?.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range)
      if (match && (match[1] || match[2])) {
        const suffix = !match[1]
        const start = suffix ? Math.max(0, body.length - Number(match[2])) : Number(match[1])
        const end = suffix ? body.length - 1 : Math.min(body.length - 1, match[2] ? Number(match[2]) : body.length - 1)
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= body.length) {
          res.writeHead(416, { 'Content-Range': `bytes */${body.length}` })
          res.end()
          return true
        }
        res.writeHead(206, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Content-Length': end - start + 1, 'Cache-Control': 'no-store, must-revalidate' })
        res.end(body.subarray(start, end + 1))
        return true
      }
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': body.length,
      ...(ext === '.mp4' ? { 'Accept-Ranges': 'bytes' } : {}),
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

  // 产出的成品：docx 走下载，svg 直接内联（界面要用 <img> 当缩略图）。
  if (req.method === 'GET' && url.pathname.startsWith('/output/')) {
    let rel: string
    try {
      rel = decodeURIComponent(url.pathname.slice('/output/'.length))
    } catch {
      sendJson(res, 400, { error: '路径编码不合法' })
      return
    }
    const safe = normalize(rel).replace(/^(\.\.[/\\])+/, '')
    if (safe === '' || safe.includes('..')) {
      sendJson(res, 400, { error: '路径不合法' })
      return
    }
    try {
      const body = await readFile(join(OUTPUT_DIR, safe))
      const name = safe.slice(safe.lastIndexOf('/') + 1)
      const dot = name.lastIndexOf('.')
      const ext = dot >= 0 ? name.slice(dot).toLowerCase() : ''
      const inline = ext === '.svg' || ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp'
      res.writeHead(200, {
        'Content-Type': MIME[ext] ?? 'application/octet-stream',
        'Content-Length': body.length,
        // 中文文件名用 filename* 才不会被浏览器按 latin1 解码成乱码
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'no-store',
      })
      res.end(body)
      return
    } catch {
      sendJson(res, 404, { error: '没有这个产出：' + safe })
      return
    }
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

  // 导出真 .pptx：把前端场景图（含本地图片自动内嵌）编译成 OOXML 包落盘并返回下载地址
  if (req.method === 'POST' && url.pathname === '/export/pptx') {
    let payload: { filename?: string; deck?: PptxDeckInput }
    try {
      payload = JSON.parse(await readBody(req)) as { filename?: string; deck?: PptxDeckInput }
    } catch {
      sendJson(res, 400, { error: '请求 JSON 格式不合法' })
      return
    }
    if (!payload.deck || !Array.isArray(payload.deck.slides) || payload.deck.slides.length === 0) {
      sendJson(res, 400, { error: '没有可导出的幻灯片页面' })
      return
    }

    // 解析本地静态图（例如 cases/arcade/01.jpg）以便直接打入 ppt/media/
    for (const slide of payload.deck.slides) {
      for (const el of slide.elements ?? []) {
        if (el.type === 'image' && el.src && !el.src.startsWith('data:') && !el.src.startsWith('http')) {
          const cleanRel = el.src.replace(/^\/+/, '')
          if (!cleanRel.includes('..') && /\.(png|jpe?g)$/i.test(cleanRel)) {
            try {
              el.imageBuffer = await readFile(new URL(cleanRel, PUBLIC_DIR))
              el.imageExt = /\.png$/i.test(cleanRel) ? 'png' : 'jpeg'
            } catch {
              /* 找不到本地图时由 writePptx 自动回落占位图形 */
            }
          }
        }
      }
    }

    const buffer = writePptx(payload.deck)
    const rawName = (payload.filename || payload.deck.title || 'presentation')
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
      .replace(/\.pptx$/i, '')
      .trim()
      .slice(0, 60) || 'presentation'
    const fileName = `${rawName}.pptx`
    const savedRel = `pptx-${Date.now().toString(36)}-${fileName}`
    await mkdir(OUTPUT_DIR, { recursive: true })
    await writeFile(join(OUTPUT_DIR, savedRel), buffer)
    sendJson(res, 200, {
      ok: true,
      name: fileName,
      bytes: buffer.length,
      url: `/output/${encodeURIComponent(savedRel)}`,
    })
    return
  }

  // 导出前端编辑器产出的 PptPresentation 模型 → 原生 .pptx
  if (req.method === 'POST' && url.pathname === '/export/pptx-model') {
    let payload: { filename?: string; presentation?: PptPresentation }
    try {
      payload = JSON.parse(await readBody(req)) as { filename?: string; presentation?: PptPresentation }
    } catch {
      sendJson(res, 400, { error: '请求 JSON 格式不合法' })
      return
    }
    if (!payload.presentation || !Array.isArray(payload.presentation.slides) || payload.presentation.slides.length === 0) {
      sendJson(res, 400, { error: '没有可导出的幻灯片' })
      return
    }

    try {
      const buffer = await writePresentation(payload.presentation)
      const rawName = (payload.filename || payload.presentation.title || 'presentation')
        .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
        .replace(/\.pptx$/i, '')
        .trim()
        .slice(0, 60) || 'presentation'
      const fileName = `${rawName}.pptx`
      const savedRel = `pptx-${Date.now().toString(36)}-${fileName}`
      await mkdir(OUTPUT_DIR, { recursive: true })
      await writeFile(join(OUTPUT_DIR, savedRel), buffer)
      sendJson(res, 200, {
        ok: true,
        name: fileName,
        bytes: buffer.length,
        url: `/output/${encodeURIComponent(savedRel)}`,
      })
    } catch (error) {
      sendJson(res, 500, { error: 'PPTX 生成失败：' + String(error) })
    }
    return
  }

  // 文字→商业级 PPT：根据提示词生成 7 页商业模板并导出原生 .pptx
  if (req.method === 'POST' && url.pathname === '/generate/pptx-from-text') {
    let payload: GeneratePptxInput
    try {
      payload = JSON.parse(await readBody(req)) as GeneratePptxInput
    } catch {
      sendJson(res, 400, { error: '请求 JSON 格式不合法' })
      return
    }
    if (!payload.prompt) {
      sendJson(res, 400, { error: '缺少 prompt 参数' })
      return
    }

    try {
      const result = await generatePptxBuffer(payload)
      if (!result.ok) {
        sendJson(res, 500, { error: result.error || 'PPTX 生成失败' })
        return
      }
      const savedRel = `pptx-${Date.now().toString(36)}-${result.name}`
      await mkdir(OUTPUT_DIR, { recursive: true })
      await writeFile(join(OUTPUT_DIR, savedRel), result.buffer!)
      sendJson(res, 200, {
        ok: true,
        name: result.name,
        bytes: result.bytes,
        url: `/output/${encodeURIComponent(savedRel)}`,
        presentation: result.presentation,
      })
    } catch (error) {
      sendJson(res, 500, { error: 'PPTX 生成失败：' + String(error) })
    }
    return
  }

  if (url.pathname === '/health') {
    // presets 数量进健康检查：空着的时候能一眼看出是插件没挂上还是前端没取到
    let presets = 0
    try {
      presets = app.ctx.require<{ list: () => unknown[] }>('agents').list().length
    } catch {
      presets = 0
    }
    // 连接器计数：连上/断开之后一眼能看出来，也方便写验收脚本
    let connectors = { total: 0, connected: 0, tools: 0 }
    try {
      const hub = app.ctx.require<{
        list: () => { id: string; state: string; activeTools: string[] }[]
      }>('connectors')
      const items = hub.list()
      connectors = {
        total: items.length,
        connected: items.filter((item) => item.state === 'connected').length,
        tools: items.reduce((sum, item) => sum + item.activeTools.length, 0),
      }
    } catch {
      connectors = { total: 0, connected: 0, tools: 0 }
    }
    sendJson(res, 200, { ok: true, rows: app.rows.length, presets, clients: connections.size, connectors })
    return
  }

  if (url.pathname === '/favicon.ico') {
    res.writeHead(204).end()
    return
  }

  if (req.method === 'GET' && (await serveStatic(url.pathname, res, req))) return

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
