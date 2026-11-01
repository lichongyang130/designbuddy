import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChatIcon, FolderIcon, MemoryIcon, PlusIcon, SearchIcon } from '../icons'
import type { View } from './Rail'
import type { MemoryEntry, SessionSummary } from '../types'

interface Props {
  sessions: SessionSummary[]
  memory: MemoryEntry[]
  onClose: () => void
  onView: (view: View) => void
  onSession: (id: string) => void
  onCreate: () => void
}

/** ⌘K: jump to a session, a memory, or a view. */
export function Palette({ sessions, memory, onClose, onView, onSession, onCreate }: Props) {
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const match = (text: string) => !needle || text.toLowerCase().includes(needle)
    const commands: Array<{ id: string; label: string; kind: string; run: () => void; icon: ReactNode }> = [
      { id: 'new', label: '新建会话', kind: '命令', run: onCreate, icon: <PlusIcon size={15} /> },
      { id: 'files', label: '工作区文件', kind: '前往', run: () => onView('files'), icon: <FolderIcon size={15} /> },
      { id: 'plugins', label: '插件与运行内核', kind: '前往', run: () => onView('plugins'), icon: <MemoryIcon size={15} /> },
    ]
    const sessionItems = sessions.map((session) => ({
      id: session.id,
      label: session.title,
      kind: '会话',
      run: () => onSession(session.id),
      icon: <ChatIcon size={15} />,
    }))
    const memoryItems = memory.map((entry) => ({
      id: entry.id,
      label: entry.text,
      kind: '记忆',
      run: () => onView('memory'),
      icon: <MemoryIcon size={15} />,
    }))
    return [...commands, ...sessionItems, ...memoryItems].filter((item) => match(item.label)).slice(0, 12)
  }, [query, sessions, memory, onCreate, onView, onSession])

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={(event) => event.stopPropagation()}>
        <div className="palette-input">
          <SearchIcon size={16} />
          <input
            ref={input}
            value={query}
            placeholder="搜索会话、记忆或跳转…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && items[0]) {
                items[0].run()
                onClose()
              }
            }}
          />
          <span className="side-kbd">ESC</span>
        </div>
        <div className="palette-list">
          {items.length === 0 && <div className="muted pad">没有匹配项</div>}
          {items.map((item) => (
            <button
              key={`${item.kind}-${item.id}`}
              className="palette-item"
              onClick={() => {
                item.run()
                onClose()
              }}
            >
              {item.icon}
              <span className="palette-label">{item.label}</span>
              <span className="palette-kind">{item.kind}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
