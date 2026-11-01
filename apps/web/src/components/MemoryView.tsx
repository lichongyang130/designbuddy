import { useState } from 'react'
import { PlusIcon, TrashIcon } from '../icons'
import type { MemoryEntry } from '../types'

interface Props {
  entries: MemoryEntry[]
  onAdd: (text: string, kind: string) => void
  onDelete: (id: string) => void
}

const KINDS = [
  { id: 'decision', label: '决策' },
  { id: 'constraint', label: '约束' },
  { id: 'preference', label: '偏好' },
  { id: 'fact', label: '事实' },
]

export function MemoryView({ entries, onAdd, onDelete }: Props) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState('decision')

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>设计记忆</h1>
          <p className="page-sub">
            跨会话保留的决策与约束。每轮对话都会按相关性挑几条注入系统提示词 —— 卸载 memory 插件，它就真的"忘掉"。
          </p>
        </div>
      </header>

      <form
        className="memory-editor"
        onSubmit={(event) => {
          event.preventDefault()
          if (!text.trim()) return
          onAdd(text.trim(), kind)
          setText('')
        }}
      >
        <textarea
          rows={2}
          value={text}
          placeholder="例如：正文与背景的对比度不低于 7:1；移动端首屏只保留一个主行动。"
          onChange={(event) => setText(event.target.value)}
        />
        <div className="memory-editor-foot">
          <div className="kind-tabs">
            {KINDS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`kind-tab ${kind === item.id ? 'active' : ''}`}
                onClick={() => setKind(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-small" type="submit" disabled={!text.trim()}>
            <PlusIcon size={14} />
            记住
          </button>
        </div>
      </form>

      <div className="memory-grid">
        {entries.length === 0 && <div className="muted pad">还没有条目。写一条，或者让 Agent 用 memory.save 记下来。</div>}
        {[...entries].reverse().map((entry) => (
          <article className="memory-card" key={entry.id}>
            <div className="memory-card-head">
              <span className={`kind kind-${entry.kind}`}>{entry.kind}</span>
              <button className="icon-btn" onClick={() => onDelete(entry.id)} title="删除">
                <TrashIcon size={14} />
              </button>
            </div>
            <p>{entry.text}</p>
            <footer>
              {entry.tags.map((tag) => (
                <span className="tag" key={tag}>
                  #{tag}
                </span>
              ))}
              <time>{new Date(entry.at).toLocaleDateString('zh-CN')}</time>
            </footer>
          </article>
        ))}
      </div>
    </div>
  )
}
