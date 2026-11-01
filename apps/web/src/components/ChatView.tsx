import { useRef } from 'react'
import { ArrowUpIcon, ChevronDown, LockIcon, SparkIcon } from '../icons'
import { ApprovalBar } from './ApprovalBar'
import { Timeline } from './Timeline'
import type { ApprovalRequest, Expert, ModelInfo, PlanItem, SessionSummary, StoredEvent } from '../types'

interface Props {
  session: SessionSummary | null
  events: StoredEvent[]
  live: string
  phase: 'idle' | 'thinking' | 'tools'
  plan: PlanItem[]
  approvals: ApprovalRequest[]
  input: string
  onInput: (value: string) => void
  onSend: () => void
  onAbort: () => void
  onDecide: (id: string, allow: boolean) => void
  experts: Expert[]
  models: ModelInfo[]
  agent: string
  model: string
  onAgent: (value: string) => void
  onModel: (value: string) => void
  policyMode: string
  onPolicyMode: (mode: 'approve-writes' | 'readonly' | 'auto') => void
  onHome: () => void
}

export function ChatView(props: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const { session, events, live, phase, plan, approvals, input, onInput, onSend, onAbort } = props
  const quickReplies = [
    '看看工作区里有什么，给我一个现状判断',
    '帮我拆解这个需求的执行步骤',
    '从设计评审角度挑刺',
    '把结论写进设计记忆',
  ]

  return (
    <div className="chat">
      <header className="chat-top">
        <button className="pill pill-ghost" onClick={props.onHome}>
          首页
        </button>
        <div className="chat-title">
          <span className="chat-title-text">{session?.title ?? '新的设计会话'}</span>
          <span className="chat-sub">
            {props.experts.find((expert) => expert.name === props.agent)?.title ?? props.agent} ·{' '}
            {props.models.find((item) => item.id === props.model)?.label ?? props.model}
          </span>
        </div>
        <div className="chat-controls">
          <label className={`select-inline ${props.policyMode === 'auto' ? 'loose' : ''}`}>
            {props.policyMode === 'readonly' && <LockIcon size={13} />}
            <select
              value={props.policyMode}
              onChange={(event) =>
                props.onPolicyMode(event.target.value as 'approve-writes' | 'readonly' | 'auto')
              }
            >
              <option value="approve-writes">写操作需确认</option>
              <option value="readonly">只读</option>
              <option value="auto">自动放行</option>
            </select>
            <ChevronDown size={12} />
          </label>
          <label className="select-inline">
            <select value={props.agent} onChange={(event) => props.onAgent(event.target.value)}>
              {props.experts.map((expert) => (
                <option key={expert.name} value={expert.name}>
                  {expert.title}
                </option>
              ))}
            </select>
            <ChevronDown size={12} />
          </label>
          <label className="select-inline">
            <select
              value={props.models.some((item) => item.id === props.model) ? props.model : ''}
              onChange={(event) => props.onModel(event.target.value)}
            >
              {props.models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <ChevronDown size={12} />
          </label>
          {phase !== 'idle' && (
            <button className="pill" onClick={onAbort}>
              中断
            </button>
          )}
        </div>
      </header>

      <Timeline events={events} live={live} phase={phase} plan={plan} />

      <ApprovalBar requests={approvals} onDecide={props.onDecide} />

      <footer className="chat-composer">
        <div className="quick-replies">
          {quickReplies.map((reply) => (
            <button key={reply} className="mini-chip" onClick={() => onInput(reply)}>
              {reply}
            </button>
          ))}
        </div>
        <div className="composer-card compact">
          <textarea
            ref={textarea}
            className="composer-input"
            placeholder="继续描述你的设计问题…（Enter 发送，Shift+Enter 换行）"
            rows={1}
            value={input}
            onChange={(event) => onInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                onSend()
              }
            }}
          />
          <div className="composer-tools">
            <button className="round-btn" title="添加文件">
              <span className="plus-glyph">+</span>
            </button>
            <div className="composer-right">
              <button className="select-chip" title="策略">
                <SparkIcon size={13} />
                {phase === 'idle' ? '标准' : '生成中'}
              </button>
              <button
                className="send-btn"
                onClick={onSend}
                disabled={!input.trim() || phase !== 'idle'}
                aria-label="发送"
              >
                <ArrowUpIcon size={17} />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
