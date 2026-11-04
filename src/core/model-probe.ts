/**
 * 「测试连接」：真发一次请求，不是转圈动画。
 *
 * 落点是最小化的 OpenAI 兼容调用：`POST <endpoint>`，一条 ping 消息、`max_tokens: 1`、
 * 8 秒超时。成功就是 2xx，失败就把状态码或网络错误原样带回去——界面照实显示，
 * 断网、DNS 不通、Key 无效、模型名写错，四种失败给出的文案不一样。
 *
 * @module designbuddy/core/model-probe
 */

export interface ProbeInput {
  baseUrl: string
  apiKey?: string
  model?: string
  timeoutMs?: number
  /** 浏览器直连时传中转的 fetch：探测和真实调用走同一条路，测通了就是真通了。 */
  fetchImpl?: typeof fetch
}

export interface ProbeResult {
  ok: boolean
  status?: number
  ms: number
  message: string
  /** 实际请求的地址，方便排查「少写了一段路径」。 */
  endpoint: string
}

/** 允许用户只填到域名或 /v1：缺什么补什么，别让人对着 404 猜。 */
export function normalizeEndpoint(raw: string): string {
  const text = raw.trim().replace(/\s+/g, '')
  if (text === '') return ''
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return ''
  }
  const path = url.pathname.replace(/\/+$/, '')
  if (/\/chat\/completions$/.test(path)) return url.toString()
  if (path === '' || path === '/') return url.origin + '/v1/chat/completions'
  if (/\/v\d+$/.test(path)) return url.origin + path + '/chat/completions'
  return url.toString()
}

export async function probeModel(input: ProbeInput): Promise<ProbeResult> {
  const endpoint = normalizeEndpoint(input.baseUrl)
  const started = Date.now()
  if (endpoint === '') {
    return { ok: false, ms: 0, message: '接口地址不是合法的 URL', endpoint: '' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 8000)
  try {
    const doFetch = input.fetchImpl ?? fetch
    const response = await doFetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(input.apiKey ? { authorization: 'Bearer ' + input.apiKey } : {}),
      },
      body: JSON.stringify({
        model: input.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: controller.signal,
    })
    const ms = Date.now() - started
    if (response.ok) {
      return { ok: true, status: response.status, ms, message: '连接成功（HTTP ' + response.status + '）', endpoint }
    }
    const text = await response.text().catch(() => '')
    const detail = text.replace(/\s+/g, ' ').trim().slice(0, 180)
    return {
      ok: false,
      status: response.status,
      ms,
      message: 'HTTP ' + response.status + (detail ? '：' + detail : ''),
      endpoint,
    }
  } catch (error) {
    const ms = Date.now() - started
    const name = error instanceof Error ? error.name : ''
    const raw = error instanceof Error ? error.message : String(error)
    const message = name === 'AbortError' || name === 'TimeoutError'
      ? '请求超时（8 秒），地址或网络不通'
      : '网络错误：' + raw
    return { ok: false, ms, message, endpoint }
  } finally {
    clearTimeout(timer)
  }
}
