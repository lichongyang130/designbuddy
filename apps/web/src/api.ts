import type { AppState, MarketEntry, MemoryEntry, PlanItem, SessionSummary, StoredEvent } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || json.ok === false) {
    throw new Error(json.error ?? `${response.status} ${response.statusText}`)
  }
  return json as T
}

export const api = {
  state: () => request<AppState>('/api/state'),
  market: () => request<{ entries: MarketEntry[] }>('/api/market'),

  createSession: (body: { title?: string; agent?: string; model?: string }) =>
    request<{ session: SessionSummary }>('/api/sessions', { method: 'POST', body: JSON.stringify(body) }),

  session: (id: string) =>
    request<{ session: SessionSummary; events: StoredEvent[]; plan: PlanItem[] }>(`/api/sessions/${id}`),

  deleteSession: (id: string) => request<{ ok: true }>(`/api/sessions/${id}`, { method: 'DELETE' }),

  updateSession: (id: string, body: Record<string, string>) =>
    request<{ session: SessionSummary }>(`/api/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  send: (id: string, body: { text: string; agent?: string; model?: string }) =>
    request<{ ok: true }>(`/api/sessions/${id}/messages`, { method: 'POST', body: JSON.stringify(body) }),

  abort: (id: string) => request<{ ok: true }>(`/api/sessions/${id}/abort`, { method: 'POST' }),

  enablePlugin: (name: string, config?: Record<string, unknown>) =>
    request<{ ok: true }>(`/api/market/${name}/enable`, { method: 'POST', body: JSON.stringify({ config }) }),

  disablePlugin: (name: string) =>
    request<{ ok: true }>(`/api/market/${name}/disable`, { method: 'POST', body: '{}' }),

  configurePlugin: (name: string, config: Record<string, unknown>) =>
    request<{ ok: true }>(`/api/market/${name}/config`, { method: 'POST', body: JSON.stringify({ config }) }),

  memory: () => request<{ entries: MemoryEntry[] }>('/api/memory'),

  addMemory: (body: { text: string; kind?: string; tags?: string[] }) =>
    request<{ entry: MemoryEntry }>('/api/memory', { method: 'POST', body: JSON.stringify(body) }),

  deleteMemory: (id: string) => request<{ ok: true }>(`/api/memory/${id}`, { method: 'DELETE' }),
}

export interface BusEvent {
  event: string
  data: any
  at: number
}

/** Subscribes to the kernel's event bus over SSE. */
export function subscribe(onEvent: (event: BusEvent) => void): () => void {
  const source = new EventSource('/api/events')
  const handler = (message: MessageEvent) => {
    try {
      onEvent(JSON.parse(message.data) as BusEvent)
    } catch {
      /* ignore malformed frames */
    }
  }
  source.addEventListener('bus', handler as EventListener)
  return () => {
    source.removeEventListener('bus', handler as EventListener)
    source.close()
  }
}
