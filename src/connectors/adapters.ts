/**
 * 适配器：把一个连接器目录条目变成一组可调用的工具。
 *
 * 每种 `kind` 一个实现，输出统一是 `ToolDefinition[]`——上层（ConnectorHub）
 * 只管注册与注销，不需要知道对面是 REST、MCP 还是本地进程。这也是后面接
 * `mcp-stdio` 时唯一要新增的地方。
 *
 * 当前落地两种：
 *   - `rest`：按 manifest 里的端点表发 HTTP（GitHub 走这条）
 *   - `demo`：没有真实后端的目录项，返回结构化演示数据，且**每条结果都带标注**
 *
 * @module designbuddy/connectors/adapters
 */

import type { ConnectorManifest, ConnectorToolSpec } from '../core/connectors.ts'
import type { JsonSchema } from '../core/schema.ts'
import type { ToolDefinition } from '../core/tools.ts'
import { DEMO_NOTE } from './catalog.ts'

export interface AdapterRuntime {
  tools: ToolDefinition[]
  /** 验证凭据并取回账号名，供详情页显示。 */
  probe(): Promise<{ account?: string }>
  close(): Promise<void> | void
}

export interface AdapterOptions {
  manifest: ConnectorManifest
  secrets: Record<string, string>
  /** 是否注册写操作工具；默认 false。 */
  allowWrite?: boolean
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const DEFAULT_TIMEOUT = 15_000

function schemaOf(spec: ConnectorToolSpec): JsonSchema {
  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []
  for (const [name, field] of Object.entries(spec.params ?? {})) {
    properties[name] = { type: field.type, description: field.desc }
    if (field.required) required.push(name)
  }
  return { type: 'object', properties, required }
}

function fullName(manifest: ConnectorManifest, spec: ConnectorToolSpec): string {
  return manifest.id + '.' + spec.name
}

/* ── REST ─────────────────────────────────────────────────── */

function fillPath(path: string, args: Record<string, unknown>): string {
  return path.replace(/\{(\w+)\}/g, (_, key: string) => encodeURIComponent(String(args[key] ?? '')))
}

/** 把 fetch 抛的底层错误翻成人话：用户看到的是「连不上哪台机器」，不是 `fetch failed`。 */
function describeNetworkError(error: unknown, host: string, timeoutMs: number): string {
  const name = error instanceof Error ? error.name : ''
  if (name === 'TimeoutError' || name === 'AbortError') return '请求超时（' + timeoutMs + 'ms 没有响应）：' + host
  const cause = (error as { cause?: { code?: string; message?: string } } | undefined)?.cause
  const code = cause?.code ?? cause?.message ?? ''
  const known: Record<string, string> = {
    ENOTFOUND: '域名解析失败',
    EAI_AGAIN: 'DNS 暂时不可用',
    ECONNREFUSED: '对方拒绝连接',
    ECONNRESET: '连接被重置',
    ETIMEDOUT: '连接超时',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'TLS 证书校验失败（本机代理或企业证书拦截）',
    SELF_SIGNED_CERT_IN_CHAIN: 'TLS 证书链不受信任',
    CERT_HAS_EXPIRED: 'TLS 证书已过期',
  }
  const reason = known[code] ?? (cause?.message || (error instanceof Error ? error.message : String(error)))
  return '网络请求失败：' + reason + '（' + host + '）' + (code && known[code] ? ' · ' + code : '')
}

async function readError(response: Response): Promise<string> {
  let detail = ''
  try {
    const text = await response.text()
    detail = text.slice(0, 300)
  } catch {
    /* 读不到就用状态码说话 */
  }
  if (response.status === 401) return '凭据无效或已过期（401）'
  if (response.status === 403) return '权限不足或触发限流（403）' + (detail ? '：' + detail : '')
  if (response.status === 404) return '资源不存在或没有访问权限（404）'
  if (response.status === 429) return '请求过于频繁，被限流（429）'
  return `HTTP ${response.status}` + (detail ? '：' + detail : '')
}

function createRestAdapter(options: AdapterOptions): AdapterRuntime {
  const { manifest, secrets } = options
  const endpoint = manifest.endpoint ?? {}
  const baseUrl = (endpoint.baseUrl ?? '').replace(/\/+$/, '')
  if (baseUrl === '') throw new Error(manifest.name + ' 缺少接口地址配置')
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT

  const headers = (): Record<string, string> => {
    const out: Record<string, string> = { 'content-type': 'application/json' }
    for (const [key, value] of Object.entries(endpoint.headers ?? {})) {
      out[key] = value.replace(/\{(\w+)\}/g, (_, name: string) => secrets[name] ?? '')
    }
    return out
  }

  const request = async (method: string, path: string, init: { query?: Record<string, unknown>; body?: unknown } = {}): Promise<unknown> => {
    const url = new URL(baseUrl + path)
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value === undefined || value === null || value === '') continue
      url.searchParams.set(key, String(value))
    }
    let response: Response
    try {
      response = await fetchImpl(url, {
        method,
        headers: headers(),
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new Error(describeNetworkError(error, url.host, timeoutMs))
    }
    if (!response.ok) throw new Error(await readError(response))
    const text = await response.text()
    if (text.trim() === '') return { ok: true, status: response.status }
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text.slice(0, 2000)
    }
  }

  const tools: ToolDefinition[] = []
  for (const spec of manifest.tools) {
    if (spec.write && options.allowWrite !== true) continue
    if (!spec.rest) continue
    const rest = spec.rest
    tools.push({
      name: fullName(manifest, spec),
      description: spec.desc + (spec.write ? '（写操作）' : ''),
      parameters: schemaOf(spec),
      timeoutMs,
      execute: async (args) => {
        const query: Record<string, unknown> = {}
        for (const key of rest.query ?? []) query[key] = args[key]
        const body: Record<string, unknown> = {}
        for (const key of rest.body ?? []) {
          if (args[key] !== undefined && args[key] !== '') body[key] = args[key]
        }
        const result = await request(rest.method, fillPath(rest.path, args), {
          query,
          body: rest.method === 'GET' ? undefined : body,
        })
        return JSON.stringify(result, null, 2)
      },
    })
  }

  return {
    tools,
    probe: async () => {
      const probe = endpoint.probe
      if (!probe) {
        // 没声明探测端点时，用第一条读工具能跑通来证明凭据可用。
        const first = tools.find((item) => !manifest.tools.find((spec) => fullName(manifest, spec) === item.name)?.write)
        if (!first) return {}
        return {}
      }
      const data = (await request('GET', probe.path)) as Record<string, unknown>
      const account = probe.account ? data?.[probe.account] : undefined
      return { account: account === undefined ? undefined : String(account) }
    },
    close: () => undefined,
  }
}

/* ── 演示 ─────────────────────────────────────────────────── */

/** 按工具名给一份像样的样例，别把演示数据写成 `{}`。 */
function demoResult(manifest: ConnectorManifest, spec: ConnectorToolSpec, args: Record<string, unknown>): unknown {
  const base = {
    connector: manifest.id,
    tool: spec.name,
    demo: true,
    note: DEMO_NOTE,
    args,
  }
  const name = spec.name

  if (/^(quote|daily|kline)$/.test(name)) {
    const symbol = String(args.symbol ?? '000001')
    return { ...base, result: { symbol, price: 12.84, change: 0.031, open: 12.5, high: 13.02, low: 12.4, volume: 128_400 } }
  }
  if (/^(financials|credit_report)$/.test(name)) {
    return { ...base, result: { revenue: '4.2 亿', yoy: 0.118, margin: 0.263, debtRatio: 0.41, ratingHint: '稳健' } }
  }
  if (/^(company|company_search|shareholders)$/.test(name)) {
    return {
      ...base,
      result: {
        name: String(args.name ?? args.query ?? '示例科技（北京）有限公司'),
        creditCode: '91110108MA01TEST01',
        founded: '2016-04-12',
        capital: '1000 万人民币',
        shareholders: [{ name: '示例控股', percent: 0.62 }, { name: '员工持股平台', percent: 0.18 }],
      },
    }
  }
  if (/^(risk|risk_events|anr_list)$/.test(name)) {
    return { ...base, result: { level: '低', events: [{ type: '经营异常提示', at: '2025-08-11', status: '已移出' }] } }
  }
  if (/^(search|search_kb|search_law|news_search|search_poi)$/.test(name)) {
    return {
      ...base,
      result: {
        query: String(args.query ?? args.keyword ?? ''),
        hits: [
          { title: '示例结果一：与问题最相关的一条', score: 0.93 },
          { title: '示例结果二：补充背景', score: 0.78 },
          { title: '示例结果三：反例与边界情况', score: 0.61 },
        ],
      },
    }
  }
  if (/^list_|^watchlist$|^crash_overview$/.test(name)) {
    return {
      ...base,
      result: {
        total: 3,
        items: [
          { id: 'item-1', title: '示例条目一', updatedAt: '2026-10-28' },
          { id: 'item-2', title: '示例条目二', updatedAt: '2026-10-30' },
          { id: 'item-3', title: '示例条目三', updatedAt: '2026-11-02' },
        ],
      },
    }
  }
  if (/^(geocode)$/.test(name)) {
    return { ...base, result: { address: String(args.address ?? ''), location: { lat: 39.9087, lng: 116.3975 }, level: '门址' } }
  }
  if (/^(create|send|submit|reply|deploy|add_tag|share_link)/.test(name)) {
    return { ...base, result: { ok: true, id: 'demo-' + spec.name + '-1', createdAt: '2026-11-03T10:00:00+08:00' } }
  }
  return { ...base, result: { ok: true } }
}

function createDemoAdapter(options: AdapterOptions): AdapterRuntime {
  const { manifest } = options
  const tools: ToolDefinition[] = []
  for (const spec of manifest.tools) {
    if (spec.write && options.allowWrite !== true) continue
    tools.push({
      name: fullName(manifest, spec),
      description: spec.desc + (spec.write ? '（写操作）' : '') + ' · 演示数据',
      parameters: schemaOf(spec),
      execute: async (args) => JSON.stringify(demoResult(manifest, spec, args), null, 2),
    })
  }
  return { tools, probe: async () => ({ account: '演示数据' }), close: () => undefined }
}

/* ── 入口 ─────────────────────────────────────────────────── */

export async function createAdapter(options: AdapterOptions): Promise<AdapterRuntime> {
  const { manifest } = options
  if (manifest.demo) return createDemoAdapter(options)
  if (manifest.kind === 'rest') return createRestAdapter(options)
  throw new Error(manifest.name + ' 还没有对应的运行时适配器（' + manifest.kind + '）')
}
