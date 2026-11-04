/**
 * 本地联调网关：一个**假的** OpenAI 兼容端点，用来在没有外网的机器上验证整条链路。
 *
 * 它不是模型，也不假装是：它把请求里的骨架原样回显（大纲回 sections，文案回 pages），
 * 唯一的作用是让「设置里存模型 → 热挂载 → 真要 JSON → 契约校验 → 贴回版式」这条路
 * 端到端跑起来。你在设置里看到的状态会写「已接入」，因为路由上确实挂了一个真适配器
 * （真发 HTTP、真读 SSE），只是对面这台服务器是规则引擎代答。
 *
 * 用法：
 *   npm run llm:mock                     # 监听 127.0.0.1:5179
 *   设置 → 模型 → 添加：供应商「本地 / Ollama」，地址 http://127.0.0.1:5179/v1，Key 可留空
 *
 * 接真模型时把地址换掉即可，代码路径完全一样。
 *
 * @module designbuddy/tools/llm-gateway
 */

import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { extractJson } from '../src/core/llm-json.ts'

export interface GatewayOptions {
  /** 0 表示随机端口（测试用）。 */
  port?: number
  host?: string
  /** 每块之间的间隔，默认 0；联调时可以调到 15ms 看流式效果。 */
  chunkDelayMs?: number
}

export interface GatewayHandle {
  port: number
  url: string
  close(): Promise<void>
}

interface ChatMessage {
  role?: string
  content?: string
}

/** 大纲：把请求里那份骨架的 sections 原样回显（模型在这里只是在「具体化」骨架）。 */
function answerOutline(user: string): unknown | null {
  const json = extractJson(user)
  if (!json) return null
  try {
    const body = JSON.parse(json) as { title?: string; sections?: { title?: string; points?: unknown[] }[] }
    if (!Array.isArray(body.sections)) return null
    return {
      title: body.title,
      sections: body.sections.map((section, index) => ({
        title: section.title ?? `第 ${index + 1} 段`,
        points: (section.points ?? []).map((point) =>
          typeof point === 'string' ? { text: point } : { text: (point as { text?: string })?.text ?? '…' },
        ),
      })),
    }
  } catch {
    return null
  }
}

/** 逐页文案：把骨架里的 topic / goal 变成标题与要点。 */
function answerPages(user: string): unknown | null {
  const start = user.indexOf('[')
  if (start < 0) return null
  const json = extractJson(user.slice(start))
  if (!json) return null
  try {
    const rows = JSON.parse(json) as { n?: number; topic?: string; goal?: string; layout?: string }[]
    if (!Array.isArray(rows) || rows.length === 0 || typeof rows[0]?.n !== 'number') return null
    return {
      pages: rows.map((row) => ({
        n: row.n,
        title: row.topic ?? `第 ${row.n} 页`,
        lead: row.goal ?? '',
        points: [{ h: row.layout ?? '要点', d: row.goal ?? row.topic ?? '这一页要说的事' }],
      })),
    }
  } catch {
    return null
  }
}

function reply(user: string, system: string): string {
  if (system.includes('内容架构师') || user.includes('"sections"')) {
    const outline = answerOutline(user)
    if (outline) return JSON.stringify(outline)
  }
  if (system.includes('演示的文案') || user.includes('"pages"')) {
    const pages = answerPages(user)
    if (pages) return JSON.stringify(pages)
  }
  return JSON.stringify({ note: '联调网关：这个请求没有可回显的骨架' })
}

function sendSse(res: ServerResponse, text: string, model: string, delayMs: number): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
  const chunks: string[] = []
  const size = 24
  for (let index = 0; index < text.length; index += size) chunks.push(text.slice(index, index + size))
  if (chunks.length === 0) chunks.push('')

  let step = 0
  const tick = (): void => {
    if (step < chunks.length) {
      const payload = { choices: [{ delta: { content: chunks[step] }, finish_reason: null }] }
      res.write(`data: ${JSON.stringify(payload)}\n\n`)
      step += 1
      if (delayMs > 0) setTimeout(tick, delayMs)
      else setImmediate(tick)
      return
    }
    res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: text.length } })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  }
  tick()
}

function handle(req: IncomingMessage, res: ServerResponse, delayMs: number): void {
  if (req.method !== 'POST' || !/\/chat\/completions$/.test(req.url ?? '')) {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: { message: 'only POST /v1/chat/completions is implemented' } }))
    return
  }
  let raw = ''
  req.setEncoding('utf8')
  req.on('data', (piece: string) => {
    raw += piece
  })
  req.on('end', () => {
    let body: { model?: string; messages?: ChatMessage[]; stream?: boolean } = {}
    try {
      body = JSON.parse(raw) as typeof body
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'invalid json' } }))
      return
    }
    const messages = body.messages ?? []
    const system = messages.filter((message) => message.role === 'system').map((message) => message.content ?? '').join('\n')
    const user = messages.filter((message) => message.role === 'user').map((message) => message.content ?? '').join('\n')
    const text = reply(user, system)
    const model = body.model ?? 'local-echo'

    if (body.stream === false) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          id: 'chatcmpl-local',
          model,
          choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: text.length },
        }),
      )
      return
    }
    sendSse(res, text, model, delayMs)
  })
}

export async function startGateway(options: GatewayOptions = {}): Promise<GatewayHandle> {
  const host = options.host ?? '127.0.0.1'
  const delayMs = options.chunkDelayMs ?? 0
  const server: Server = createServer((req, res) => handle(req, res, delayMs))
  await new Promise<void>((resolve) => server.listen(options.port ?? 5179, host, resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : (options.port ?? 5179)
  return {
    port,
    url: `http://${host}:${port}/v1`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
      }),
  }
}

const invokedDirectly = process.argv[1]?.includes('llm-gateway') === true
if (invokedDirectly) {
  const port = Number(process.env.LLM_GATEWAY_PORT ?? 5179)
  const handle = await startGateway({ port, chunkDelayMs: Number(process.env.LLM_GATEWAY_DELAY ?? 8) })
  process.stdout.write(
    [
      `联调网关（不是模型，只回显骨架）→ ${handle.url}`,
      `在 设置 → 模型 里添加：供应商「本地」，接口地址 ${handle.url}，Key 可以留空，模型名随便填（例如 local-echo）。`,
      '接真模型时把接口地址换成 https://api.deepseek.com/v1 这类地址即可，代码路径完全一样。',
      '',
    ].join('\n'),
  )
  const stop = (): void => {
    void handle.close().then(() => process.exit(0))
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}
