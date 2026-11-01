import { useCallback, useEffect, useRef, useState } from 'react'
import { api, subscribe } from './api'
import { Sidebar } from './components/Sidebar'
import { Timeline } from './components/Timeline'
import { Inspector, type InspectorTab } from './components/Inspector'
import type { AppState, LogEntry, MarketEntry, PlanItem, SessionSummary, StoredEvent } from './types'

const PROMPT_HINTS = [
  '看看项目里有什么，给我一个现状判断',
  '帮我拆解这个需求的执行步骤',
  '评审一下现有的设计方向',
  '记住：移动端首屏只保留一个主要行动',
]

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [market, setMarket] = useState<MarketEntry[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [events, setEvents] = useState<StoredEvent[]>([])
  const [plan, setPlan] = useState<PlanItem[]>([])
  const [live, setLive] = useState('')
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'tools'>('idle')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [tab, setTab] = useState<InspectorTab>('plugins')
  const [agent, setAgent] = useState('host')
  const [model, setModel] = useState('')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  const activeRef = useRef<string | null>(null)
  const refreshTimer = useRef<number | null>(null)

  useEffect(() => {
    activeRef.current = activeId
  }, [activeId])

  const load = useCallback(async () => {
    try {
      const [next, marketResponse] = await Promise.all([api.state(), api.market()])
      setState(next)
      setMarket([...marketResponse.entries].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)))
      setSessions(next.sessions)
      setLogs(next.logs)
      setModel((current) => current || next.defaultModel || '')
      setAgent((current) => (next.experts.some((expert) => expert.name === current) ? current : next.experts[0]?.name ?? 'host'))
    } catch (cause) {
      setError((cause as Error).message)
    }
  }, [])

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) return
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null
      void load()
    }, 320)
  }, [load])

  const openSession = useCallback(async (id: string) => {
    setActiveId(id)
    activeRef.current = id
    setLive('')
    setPhase('idle')
    try {
      const detail = await api.session(id)
      const summary = detail.session
      setEvents(detail.events)
      setPlan(detail.plan)
      setAgent(summary.agent)
      setModel(summary.model)
      setSessions((current) => current.map((item) => (item.id === id ? summary : item)))
    } catch (cause) {
      setError((cause as Error).message)
    }
  }, [])

  // Boot + live kernel events.
  useEffect(() => {
    void load()
    const unsubscribe = subscribe(({ event, data }) => {
      switch (event) {
        case 'session/append': {
          if (data?.sessionId !== activeRef.current) {
            scheduleRefresh()
            return
          }
          const stored = data.stored as StoredEvent
          setEvents((current) => {
            if (current.some((item) => item.seq === stored.seq)) return current
            const next = [...current, stored]
            const id = activeRef.current
            if (id && stored.event.type === 'turn-end') {
              setSessions((list) =>
                list.map((item) => (item.id === id ? { ...item, eventCount: next.length, updatedAt: stored.at } : item)),
              )
            }
            return next
          })
          if (stored.event.type === 'assistant' || stored.event.type === 'turn-end') setLive('')
          break
        }
        case 'agent/delta': {
          if (data?.sessionId !== activeRef.current) return
          setLive((current) => current + data.text)
          break
        }
        case 'agent/state': {
          if (data?.sessionId !== activeRef.current) return
          setPhase(data.phase === 'idle' ? 'idle' : data.phase)
          break
        }
        case 'plan/changed': {
          if (data?.sessionId === activeRef.current) setPlan(data.plan)
          break
        }
        case 'log/append': {
          setLogs((current) => [...current.slice(-160), data as LogEntry])
          break
        }
        case 'fork/change':
        case 'fork/ready':
        case 'service/set':
        case 'service/remove':
        case 'agents/changed':
        case 'tools/changed':
        case 'llm/changed':
        case 'skills/changed':
        case 'memory/changed':
        case 'session/created':
        case 'session/updated':
        case 'session/deleted':
          scheduleRefresh()
          break
        default:
          break
      }
    })
    return unsubscribe
  }, [load, scheduleRefresh])

  const createSession = useCallback(async (): Promise<string | null> => {
    try {
      const created = await api.createSession({ title: '新的设计会话', agent, model })
      setSessions((current) => [created.session, ...current])
      await openSession(created.session.id)
      return created.session.id
    } catch (cause) {
      setError((cause as Error).message)
      return null
    }
  }, [agent, model, openSession])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || phase !== 'idle') return
      setError(null)
      let sessionId = activeRef.current
      if (!sessionId) sessionId = await createSession()
      if (!sessionId) return
      setInput('')
      setPhase('thinking')
      setLive('')
      try {
        await api.send(sessionId, { text: trimmed, agent, model })
      } catch (cause) {
        setPhase('idle')
        setError((cause as Error).message)
      }
    },
    [agent, createSession, model, phase],
  )

  const togglePlugin = useCallback(
    async (entry: MarketEntry, enable: boolean) => {
      setError(null)
      try {
        if (enable) await api.enablePlugin(entry.name, entry.config)
        else await api.disablePlugin(entry.name)
        await load()
      } catch (cause) {
        setError((cause as Error).message)
      }
    },
    [load],
  )

  const configurePlugin = useCallback(
    async (entry: MarketEntry, config: Record<string, unknown>) => {
      setError(null)
      try {
        await api.configurePlugin(entry.name, config)
        await load()
      } catch (cause) {
        setError((cause as Error).message)
      }
    },
    [load],
  )

  const addMemory = useCallback(
    async (text: string) => {
      try {
        await api.addMemory({ text, kind: 'decision' })
        await load()
      } catch (cause) {
        setError((cause as Error).message)
      }
    },
    [load],
  )

  const deleteMemory = useCallback(
    async (id: string) => {
      try {
        await api.deleteMemory(id)
        await load()
      } catch (cause) {
        setError((cause as Error).message)
      }
    },
    [load],
  )

  const active = sessions.find((session) => session.id === activeId)

  return (
    <div className={`app ${panelOpen ? '' : 'panel-closed'}`}>
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        serviceCount={state?.services.length ?? 0}
        pluginCount={state?.plugins.length ?? 0}
        onSelect={(id) => void openSession(id)}
        onCreate={() => void createSession()}
        onDelete={(id) => {
          void (async () => {
            try {
              await api.deleteSession(id)
              if (id === activeId) {
                setActiveId(null)
                activeRef.current = null
                setEvents([])
                setPlan([])
              }
              await load()
            } catch (cause) {
              setError((cause as Error).message)
            }
          })()
        }}
      />

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{active?.title ?? 'DesignBuddy'}</h1>
            <span className="topbar-sub">
              {state?.models.length ?? 0} 个模型 · {state?.experts.length ?? 0} 位专家 ·{' '}
              {state?.tools.length ?? 0} 个工具
            </span>
          </div>
          <div className="topbar-controls">
            <label className="select">
              <span>角色</span>
              <select value={agent} onChange={(event) => setAgent(event.target.value)}>
                {(state?.experts ?? []).map((expert) => (
                  <option key={expert.name} value={expert.name}>
                    {expert.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="select">
              <span>模型</span>
              <select value={model} onChange={(event) => setModel(event.target.value)}>
                {(state?.models ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {phase !== 'idle' && (
              <button
                className="btn btn-ghost"
                onClick={() => activeId && void api.abort(activeId)}
              >
                中断
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setPanelOpen((value) => !value)}>
              {panelOpen ? '隐藏面板' : '显示面板'}
            </button>
          </div>
        </header>

        {error && (
          <div className="banner">
            {error}
            <button className="icon-btn" onClick={() => setError(null)}>
              ×
            </button>
          </div>
        )}

        <Timeline events={events} live={live} phase={phase} plan={plan} />

        <footer className="composer">
          <div className="hints">
            {PROMPT_HINTS.map((hint) => (
              <button key={hint} className="hint-chip" onClick={() => setInput(hint)}>
                {hint}
              </button>
            ))}
          </div>
          <div className="composer-box">
            <textarea
              value={input}
              placeholder="描述你的设计问题…（Enter 发送，Shift+Enter 换行）"
              rows={1}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send(input)
                }
              }}
            />
            <button className="btn btn-primary" disabled={!input.trim() || phase !== 'idle'} onClick={() => void send(input)}>
              {phase === 'idle' ? '发送' : '生成中'}
            </button>
          </div>
        </footer>
      </main>

      {panelOpen && (
        <Inspector
          tab={tab}
          onTab={setTab}
          market={market}
          state={state}
          plan={plan}
          logs={logs}
          error={null}
          onToggle={togglePlugin}
          onConfigure={configurePlugin}
          onMemoryAdd={(text) => void addMemory(text)}
          onMemoryDelete={(id) => void deleteMemory(id)}
        />
      )}
    </div>
  )
}
