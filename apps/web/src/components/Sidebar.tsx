import { useState } from 'react'
import {
  ChatIcon,
  ChevronDown,
  FolderIcon,
  HelpIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from '../icons'
import type { View } from './Rail'
import type { SessionSummary } from '../types'

interface Props {
  sessions: SessionSummary[]
  activeId: string | null
  view: View
  memoryCount: number
  fileCount: number
  onCreate: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onView: (view: View) => void
  onSearch: () => void
}

export function Sidebar({
  sessions,
  activeId,
  view,
  memoryCount,
  fileCount,
  onCreate,
  onSelect,
  onDelete,
  onView,
  onSearch,
}: Props) {
  const [expanded, setExpanded] = useState(true)

  return (
    <aside className="sidebar">
      <header className="ws">
        <span className="ws-avatar">Z</span>
        <div className="ws-text">
          <div className="ws-name">
            重阳 Lee&apos;s Workspace <ChevronDown size={13} />
          </div>
          <div className="ws-plan">Free</div>
        </div>
      </header>

      <button className="create-btn" onClick={onCreate}>
        <PlusIcon size={15} />
        创建
      </button>

      <div className="side-nav">
        <button className={`side-row ${view === 'chat' ? 'active' : ''}`} onClick={() => onView('chat')}>
          <ChatIcon size={16} />
          最近的对话
          {sessions.length > 0 && <span className="side-count">{sessions.length}</span>}
        </button>
        <button className={`side-row ${view === 'files' ? 'active' : ''}`} onClick={() => onView('files')}>
          <FolderIcon size={16} />
          最近的文件
          {fileCount > 0 && <span className="side-count">{fileCount}</span>}
        </button>
        <button className="side-row" onClick={onSearch}>
          <SearchIcon size={16} />
          搜索
          <span className="side-kbd">⌘K</span>
        </button>
        <button className={`side-row ${view === 'memory' ? 'active' : ''}`} onClick={() => onView('memory')}>
          <span className="side-dot" />
          设计记忆
          <span className="side-count">{memoryCount}</span>
        </button>
        <button className={`side-row ${view === 'plugins' ? 'active' : ''}`} onClick={() => onView('plugins')}>
          <span className="side-dot accent" />
          插件与运行内核
        </button>
      </div>

      <div className="side-section">
        <span>文件夹</span>
        <button className="side-section-add" onClick={onCreate} title="新建会话文件夹">
          <PlusIcon size={13} />
        </button>
      </div>

      <div className="folders">
        <button className="folder-card" onClick={onCreate}>
          <span className="folder-line" />
          <span className="folder-line short" />
          <span className="folder-hint">将相关会话分组，并一次性全部分享。</span>
          <span className="folder-cta">创建文件夹</span>
        </button>
      </div>

      <div className="side-section">
        <span>会话</span>
        <button className="side-section-add" onClick={() => setExpanded((value) => !value)}>
          <ChevronDown size={13} style={{ transform: expanded ? 'none' : 'rotate(-90deg)' }} />
        </button>
      </div>

      <div className="session-list">
        {sessions.length === 0 && <div className="side-empty">还没有会话，点上面的「创建」开始。</div>}
        {expanded &&
          sessions.map((session) => (
            <div
              key={session.id}
              className={`session ${session.id === activeId && view === 'chat' ? 'active' : ''}`}
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
                <TrashIcon size={14} />
              </button>
            </div>
          ))}
      </div>

      <footer className="side-foot">
        <button className="side-row" onClick={onSearch}>
          <HelpIcon size={16} />
          帮助与快捷键
        </button>
      </footer>
    </aside>
  )
}
