import type { IncomingMessage, ServerResponse } from 'node:http'

export type Params = Record<string, string>

export interface RequestContext {
  req: IncomingMessage
  res: ServerResponse
  params: Params
  url: URL
}

export type Handler = (ctx: RequestContext) => Promise<void> | void

interface Route {
  method: string
  regex: RegExp
  keys: string[]
  handler: Handler
}

/** A 60-line router: enough for a local agent API, no framework needed. */
export class Router {
  private routes: Route[] = []

  add(method: string, pattern: string, handler: Handler): this {
    const keys: string[] = []
    const source = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, (char) => (char === '*' ? '.*' : `\\${char}`))
      .replace(/:(\w+)/g, (_, key) => {
        keys.push(key)
        return '([^/]+)'
      })
    this.routes.push({ method, regex: new RegExp(`^${source}$`), keys, handler })
    return this
  }

  get(pattern: string, handler: Handler) {
    return this.add('GET', pattern, handler)
  }
  post(pattern: string, handler: Handler) {
    return this.add('POST', pattern, handler)
  }
  patch(pattern: string, handler: Handler) {
    return this.add('PATCH', pattern, handler)
  }
  delete(pattern: string, handler: Handler) {
    return this.add('DELETE', pattern, handler)
  }

  match(method: string, pathname: string): { route: Route; params: Params } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue
      const match = route.regex.exec(pathname)
      if (!match) continue
      const params: Params = {}
      route.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(match[index + 1])
      })
      return { route, params }
    }
    return null
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(payload)
}

export function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { ok: false, error: message })
}

export async function readJson<T = Record<string, unknown>>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > 2_000_000) throw new Error('request body too large')
    chunks.push(chunk as Buffer)
  }
  if (!chunks.length) return {} as T
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {} as T
  return JSON.parse(raw) as T
}
