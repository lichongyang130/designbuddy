import { useEffect, useRef } from 'react'
import { renderMarkdown } from '../markdown'
import type { PlanItem, StoredEvent } from '../types'

type Item =
  | { kind: 'turn'; agent: string; model: string; at: number }
  | { kind: 'user'; text: string; at: number }
  | { kind: 'assistant'; text: string; agent: string; at: number }
  | {
      kind: 'tool'
      callId: string
      name: string
      args: Record<string, unknown>
      at: number
      result?: { ok: boolean; result?: string; error?: string; durationMs: number }
    }
  | { kind: 'note'; title: string; text: string; at: number }
  | { kind: 'handoff'; from: string; to: string; reason: string; at: number }
  | { kind: 'error'; message: string; at: number }

function fold(events: StoredEvent[]): Item[] {
  const items: Item[] = []
  for (const { at, event } of events) {
    switch (event.type) {
      case 'turn-start':
        items.push({ kind: 'turn', agent: event.agent, model: event.model, at })
        break
      case 'user':
        items.push({ kind: 'user', text: event.text, at })
        break
      case 'assistant':
        items.push({ kind: 'assistant', text: event.text, agent: event.agent, at })
        break
      case 'tool-call':
        items.push({ kind: 'tool', callId: event.callId, name: event.name, args: event.args, at })
        break
      case 'tool-result': {
        const card = items.find((item) => item.kind === 'tool' && item.callId === event.callId)
        if (card && card.kind === 'tool') {
          card.result = {
            ok: event.ok,
            result: event.result,
            error: event.error,
            durationMs: event.durationMs,
          }
        }
        break
      }
      case 'note':
        items.push({ kind: 'note', title: event.title, text: event.text, at })
        break
      case 'handoff':
        items.push({ kind: 'handoff', from: event.from, to: event.to, reason: event.reason, at })
        break
      case 'error':
        items.push({ kind: 'error', message: event.message, at })
        break
      default:
        break
    }
  }
  return items
}

interface Props {
  events: StoredEvent[]
  live: string
  phase: 'idle' | 'thinking' | 'tools'
  plan: PlanItem[]
}

export function Timeline({ events, live, phase, plan }: Props) {
  const bottom = useRef<HTMLDivElement>(null)
  const items = fold(events)

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [events.length, live, phase])

  if (!items.length && !live) {
    return (
      <div className="timeline timeline-empty">
        <Empty />
      </div>
    )
  }

  const done = plan.filter((item) => item.status === 'done').length

  return (
    <div className="timeline">
      {items.map((item, index) => {
        switch (item.kind) {
          case 'turn':
            return (
              <div className="turn-marker" key={index}>
                <span>{item.agent}</span>
                <span className="turn-model">{item.model}</span>
                <span className="turn-time">{time(item.at)}</span>
              </div>
            )
          case 'user':
            return (
              <div className="msg msg-user" key={index}>
                <div className="msg-label">你</div>
                <div className="msg-body">{item.text}</div>
              </div>
            )
          case 'assistant':
            return (
              <div className="msg msg-assistant" key={index}>
                <div className="msg-label">DesignBuddy · {item.agent}</div>
                <div className="msg-body markdown">{renderMarkdown(item.text)}</div>
              </div>
            )
          case 'tool':
            return <ToolCard key={index} item={item} />
          case 'note':
            return (
              <div className="card note-card" key={index}>
                <div className="card-title">{item.title}</div>
                <div className="markdown">{renderMarkdown(item.text)}</div>
              </div>
            )
          case 'handoff':
            return (
              <div className="handoff" key={index}>
                <span className="handoff-icon">↳</span>
                委派 <b>{item.from}</b> → <b>{item.to}</b>：{item.reason}
              </div>
            )
          case 'error':
            return (
              <div className="card error-card" key={index}>
                <div className="card-title">出错了</div>
                {item.message}
              </div>
            )
          default:
            return null
        }
      })}

      {live && (
        <div className="msg msg-assistant">
          <div className="msg-label">DesignBuddy</div>
          <div className="msg-body markdown">
            {renderMarkdown(live)}
            <span className="caret" />
          </div>
        </div>
      )}

      {phase !== 'idle' && !live && (
        <div className="thinking">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
          {phase === 'tools' ? '正在调用工具…' : '正在思考…'}
        </div>
      )}

      {plan.length > 0 && phase !== 'idle' && (
        <div className="plan-strip">
          计划进度 {done}/{plan.length}
        </div>
      )}

      <div ref={bottom} />
    </div>
  )
}

function ToolCard({ item }: { item: Extract<Item, { kind: 'tool' }> }) {
  const pending = !item.result
  return (
    <details className="tool-card" open={!pending}>
      <summary>
        <span className={`tool-dot ${item.result ? (item.result.ok ? 'ok' : 'bad') : 'run'}`} />
        <span className="tool-name">{item.name}</span>
        <span className="tool-args">{preview(item.args)}</span>
        <span className="tool-meta">
          {item.result ? `${item.result.durationMs}ms` : '运行中'}
        </span>
      </summary>
      <div className="tool-body">
        <div className="tool-section">
          <div className="tool-section-label">参数</div>
          <pre>{JSON.stringify(item.args, null, 2)}</pre>
        </div>
        {item.result && (
          <div className="tool-section">
            <div className="tool-section-label">{item.result.ok ? '结果' : '错误'}</div>
            <pre className={item.result.ok ? '' : 'bad'}>{item.result.ok ? item.result.result : item.result.error}</pre>
          </div>
        )}
      </div>
    </details>
  )
}

function preview(args: Record<string, unknown>): string {
  const first = Object.entries(args)[0]
  if (!first) return ''
  const [key, value] = first
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return `${key}=${text.length > 48 ? `${text.slice(0, 48)}…` : text}`
}

function Empty() {
  return (
    <div className="empty-state">
      <div className="empty-mark">DB</div>
      <h2>从一个真实的设计问题开始</h2>
      <p>
        DesignBuddy 会先查证项目里的材料，再给判断。
        右侧的插件面板可以随时装上或卸下能力 —— 卸下记忆，模型立刻"忘掉"它。
      </p>
      <div className="empty-hints">
        <span>
          <code>fs.list</code> · 看看项目里有什么
        </span>
        <span>
          <code>plan.write</code> · 拆解任务的执行步骤
        </span>
        <span>
          <code>agent.delegate</code> · 把子任务交给评审专家
        </span>
      </div>
    </div>
  )
}

function time(at: number): string {
  return new Date(at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
