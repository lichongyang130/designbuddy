import type { SessionSummary } from '../types'

interface Props {
  sessions: SessionSummary[]
  activeId: string | null
  serviceCount: number
  pluginCount: number
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

export function Sidebar({ sessions, activeId, serviceCount, pluginCount, onSelect, onCreate, onDelete }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">DB</div>
        <div>
          <div className="brand-name">DesignBuddy</div>
          <div className="brand-sub">everything is a plugin</div>
        </div>
      </div>

      <button className="btn btn-primary new-session" onClick={onCreate}>
        + 新建会话
      </button>

      <div className="section-label">会话</div>
      <div className="session-list">
        {sessions.length === 0 && <div className="muted pad">还没有会话</div>}
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`session ${session.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(session.id)}
          >
            <div className="session-main">
              <div className="session-title">{session.title}</div>
              <div className="session-meta">
                {session.agent} · {session.eventCount} 事件
              </div>
            </div>
            <button
              className="icon-btn"
              title="删除会话"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(session.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="stat">
          <span className="stat-value">{pluginCount}</span>
          <span className="stat-label">插件</span>
        </div>
        <div className="stat">
          <span className="stat-value">{serviceCount}</span>
          <span className="stat-label">服务</span>
        </div>
        <a className="foot-link" href="/api/state" target="_blank" rel="noreferrer">
          内核快照 ↗
        </a>
      </div>
    </aside>
  )
}
