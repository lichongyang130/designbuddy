import { useCallback, useEffect, useRef, useState } from 'react'
import { api, subscribe } from './api'
import { Rail, type View } from './components/Rail'
import { Sidebar } from './components/Sidebar'
import { Home } from './components/Home'
import { ChatView } from './components/ChatView'
import { WorkspaceView } from './components/WorkspaceView'
import { MemoryView } from './components/MemoryView'
import { SettingsView } from './components/SettingsView'
import { PluginsOverview } from './components/PluginsOverview'
import { PluginsPanel } from './components/PluginsPanel'
import { Palette } from './components/Palette'
import type { InspectorTab } from './components/Inspector'
import type { Template } from './templates'
import type {
  AppState,
  ApprovalRequest,
  LogEntry,
  MarketEntry,
  PlanItem,
  PolicyMode,
  SessionSummary,
  StoredEvent,
} from './types'

export default function App() {
  const [view, setView] = useState<View>('home')
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
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [fileCount, setFileCount] = useState(0)

  const activeRef = useRef<string | null>(null)
  const refreshTimer = useRef<number | null>(null)

  useEffect(() => {
    activeRef.current = activeId
  }, [activeId])

  const load = useCallback(async () => {
    try {
      const [next, marketResponse] = await Promise.all([api.state(), api.market()])
      void fetch('/api/workspace/files?recursive=1')
        .then((response) => response.json())
        .then((json) => {
          if (json.ok) setFileCount((json.files as unknown[]).length)
        })
        .catch(() => undefined)
      setState(next)
      setMarket([...marketResponse.entries].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)))
      setSessions(next.sessions)
      setLogs(next.logs)
      setApprovals(next.policy?.pending ?? [])
      setModel((current) => (current && next.models.some((m) => m.id === current) ? current : next.defaultModel ?? ''))
      setAgent((current) =>
        next.experts.some((expert) => expert.name === current) ? current : next.experts[0]?.name ?? 'host',
      )
    } catch (cause) {
      setError((cause as Error).message)
    }
  }, [])

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) return
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null
      void load()
    }, 300)
  }, [load])

  const openSession = useCallback(async (id: string) => {
    setActiveId(id)
    activeRef.current = id
    setLive('')
    setPhase('idle')
    setView('chat')
    try {
      const detail = await api.session(id)
      setEvents(detail.events)
      setPlan(detail.plan)
      setAgent(detail.session.agent)
      setModel(detail.session.model)
      setSessions((current) => current.map((item) => (item.id === id ? detail.session : item)))
    } catch (cause) {
      setError((cause as Error).message)
    }
  }, [])

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
                list.map((item) => (item.id === id ? { ...item, eventCount: next.length } : item)),
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
        case 'approval/request': {
          setApprovals((current) =>
            current.some((item) => item.id === data.id) ? current : [...current, data as ApprovalRequest],
          )
          break
        }
        case 'approval/resolved': {
          setApprovals((current) => current.filter((item) => item.id !== data.id))
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
        case 'mcp/connected':
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const createSession = useCallback(
    async (title?: string): Promise<string | null> => {
      try {
        const created = await api.createSession({ title: title ?? '新的设计会话', agent, model })
        setSessions((current) => [created.session, ...current])
        setActiveId(created.session.id)
        activeRef.current = created.session.id
        setEvents([])
        setPlan([])
        setLive('')
        setPhase('idle')
        setView('chat')
        return created.session.id
      } catch (cause) {
        setError((cause as Error).message)
        return null
      }
    },
    [agent, model],
  )

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
    async (text: string, kind = 'decision') => {
      try {
        await api.addMemory({ text, kind })
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

  const changeView = useCallback((next: View) => {
    setView(next)
    if (next === 'plugins') setPanelOpen(true)
  }, [])

  const openTemplate = useCallback(
    async (template: Template) => {
      await createSession(template.title)
      setInput(template.prompt)
    },
    [createSession],
  )

  const active = sessions.find((session) => session.id === activeId) ?? null

  return (
    <div className={`shell ${panelOpen ? 'with-panel' : ''}`}>
      <Rail view={view} onView={changeView} paletteOpen={paletteOpen} onPalette={() => setPaletteOpen(true)} />

      <Sidebar
        sessions={sessions}
        activeId={activeId}
        view={view}
        memoryCount={state?.memory.length ?? 0}
        fileCount={fileCount}
        onCreate={() => void createSession()}
        onSelect={(id) => void openSession(id)}
        onDelete={(id) => {
          void (async () => {
            try {
              await api.deleteSession(id)
              if (id === activeId) {
                setActiveId(null)
                activeRef.current = null
                setEvents([])
                setPlan([])
                setView('home')
              }
              await load()
            } catch (cause) {
              setError((cause as Error).message)
            }
          })()
        }}
        onView={changeView}
        onSearch={() => setPaletteOpen(true)}
      />

      <main className="main">
        {error && (
          <div className="banner">
            {error}
            <button className="icon-btn" onClick={() => setError(null)} aria-label="关闭提示">
              ×
            </button>
          </div>
        )}

        {view === 'home' && (
          <Home
            value={input}
            onChange={setInput}
            onSubmit={() => void send(input)}
            onTemplate={(template) => void openTemplate(template)}
            onCapability={(hint) => setInput(hint)}
            busy={phase !== 'idle'}
            templateCount={6}
            expertLabel={state?.experts.find((expert) => expert.name === agent)?.title ?? '主理人'}
            modelLabel={state?.models.find((item) => item.id === model)?.label.split(' · ').pop() ?? '示例模型'}
            onOpenExperts={() => changeView('settings')}
          />
        )}

        {view === 'chat' && (
          <ChatView
            session={active}
            events={events}
            live={live}
            phase={phase}
            plan={plan}
            approvals={approvals}
            input={input}
            onInput={setInput}
            onSend={() => void send(input)}
            onAbort={() => activeId && void api.abort(activeId)}
            onDecide={(id, allow) => {
              void (async () => {
                try {
                  await api.decideApproval(id, allow)
                  setApprovals((current) => current.filter((item) => item.id !== id))
                } catch (cause) {
                  setError((cause as Error).message)
                }
              })()
            }}
            experts={state?.experts ?? []}
            models={state?.models ?? []}
            agent={agent}
            model={model}
            onAgent={setAgent}
            onModel={setModel}
            policyMode={state?.policy?.mode ?? 'approve-writes'}
            onPolicyMode={(mode: PolicyMode) => {
              void (async () => {
                try {
                  await api.setPolicyMode(mode)
                  await load()
                } catch (cause) {
                  setError((cause as Error).message)
                }
              })()
            }}
            onHome={() => changeView('home')}
          />
        )}

        {view === 'files' && (
          <WorkspaceView
            root={state?.workspaceRoot ?? null}
            onRead={async (path) => {
              const response = await fetch(`/api/workspace/file?path=${encodeURIComponent(path)}`)
              const json = await response.json()
              if (!json.ok) throw new Error(json.error)
              return { path: json.path, content: json.content }
            }}
          />
        )}

        {view === 'memory' && (
          <MemoryView
            entries={state?.memory ?? []}
            onAdd={(text, kind) => void addMemory(text, kind)}
            onDelete={(id) => void deleteMemory(id)}
          />
        )}

        {view === 'settings' && (
          <SettingsView state={state} onOpenPlugins={() => setPanelOpen(true)} />
        )}

        {view === 'plugins' && <PluginsOverview state={state} market={market} />}
      </main>

      {panelOpen && (
        <PluginsPanel
          tab={tab}
          onTab={setTab}
          market={market}
          state={state}
          plan={plan}
          logs={logs}
          onToggle={togglePlugin}
          onConfigure={configurePlugin}
          onMemoryAdd={(text) => void addMemory(text)}
          onMemoryDelete={(id) => void deleteMemory(id)}
          onClose={() => setPanelOpen(false)}
        />
      )}

      {paletteOpen && (
        <Palette
          sessions={sessions}
          memory={state?.memory ?? []}
          onClose={() => setPaletteOpen(false)}
          onView={changeView}
          onSession={(id) => void openSession(id)}
          onCreate={() => void createSession()}
        />
      )}
    </div>
  )
}
