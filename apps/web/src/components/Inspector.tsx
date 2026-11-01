import { useMemo, useState } from 'react'
import type { AppState, ConfigField, LogEntry, MarketEntry, MemoryEntry, PlanItem, PluginInfo } from '../types'

export type InspectorTab = 'plugins' | 'services' | 'memory' | 'plan' | 'logs'

interface Props {
  tab: InspectorTab
  onTab: (tab: InspectorTab) => void
  market: MarketEntry[]
  state: AppState | null
  plan: PlanItem[]
  logs: LogEntry[]
  onToggle: (entry: MarketEntry, enable: boolean) => void
  onConfigure: (entry: MarketEntry, config: Record<string, unknown>) => void
  onMemoryAdd: (text: string) => void
  onMemoryDelete: (id: string) => void
  error: string | null
}

const TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'plugins', label: '插件' },
  { id: 'services', label: '服务' },
  { id: 'memory', label: '记忆' },
  { id: 'plan', label: '计划' },
  { id: 'logs', label: '日志' },
]

export function Inspector(props: Props) {
  const { tab, onTab, market, state, plan, logs } = props
  const active = market.filter((entry) => entry.state === 'active').length

  return (
    <aside className="inspector">
      <div className="tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={`tab ${tab === item.id ? 'active' : ''}`}
            onClick={() => onTab(item.id)}
          >
            {item.label}
            {item.id === 'plugins' && <span className="tab-count">{active}/{market.length}</span>}
          </button>
        ))}
      </div>

      <div className="inspector-body">
        {props.error && <div className="inline-error">{props.error}</div>}

        {tab === 'plugins' && (
          <div className="plugin-list">
            {market.map((entry) => (
              <PluginRow
                key={entry.name}
                entry={entry}
                fork={state?.plugins.find((plugin) => plugin.name === entry.name)}
                onToggle={props.onToggle}
                onConfigure={props.onConfigure}
              />
            ))}
          </div>
        )}

        {tab === 'services' && <Services state={state} />}

        {tab === 'memory' && (
          <Memory
            entries={state?.memory ?? []}
            onAdd={props.onMemoryAdd}
            onDelete={props.onMemoryDelete}
          />
        )}

        {tab === 'plan' && <Plan plan={plan} />}

        {tab === 'logs' && (
          <div className="logs">
            {logs.length === 0 && <div className="muted pad">暂无日志</div>}
            {logs.map((entry) => (
              <div className={`log-line ${entry.level}`} key={entry.id}>
                <span className="log-time">
                  {new Date(entry.at).toLocaleTimeString('zh-CN', { hour12: false })}
                </span>
                <span className="log-source">{entry.source}</span>
                <span className="log-message">{entry.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function PluginRow({
  entry,
  fork,
  onToggle,
  onConfigure,
}: {
  entry: MarketEntry
  fork?: PluginInfo
  onToggle: Props['onToggle']
  onConfigure: Props['onConfigure']
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, unknown>>(entry.config ?? {})
  const enabled = entry.state === 'active' || entry.state === 'pending' || entry.state === 'error'
  const state = fork?.state ?? entry.state

  return (
    <div className={`plugin-row ${enabled ? 'on' : 'off'}`}>
      <div className="plugin-head">
        <div className="plugin-title-row">
          <span className={`state-dot ${state}`} />
          <span className="plugin-title">{entry.title}</span>
          <span className="plugin-cat">{entry.category}</span>
        </div>
        <button
          className={`switch ${enabled ? 'on' : ''}`}
          disabled={entry.required}
          title={entry.required ? '核心插件，不可卸载' : enabled ? '卸载' : '装载'}
          onClick={() => onToggle(entry, !enabled)}
        >
          <span />
        </button>
      </div>

      <div className="plugin-desc">{entry.description}</div>

      {fork?.provides?.length ? (
        <div className="chips">
          {fork.provides.slice(0, 4).map((service) => (
            <span className="chip chip-service" key={service}>
              {service}
            </span>
          ))}
          {fork.provides.length > 4 && <span className="chip">+{fork.provides.length - 4}</span>}
        </div>
      ) : null}

      {(fork?.missing?.length ?? 0) > 0 && (
        <div className="plugin-warn">等待依赖：{fork!.missing.join(', ')}</div>
      )}
      {entry.error && <div className="plugin-err">{entry.error}</div>}

      <div className="plugin-foot">
        <span className="plugin-name">@{entry.name}</span>
        {entry.configSchema.length > 0 && (
          <button className="link-btn" onClick={() => setOpen((value) => !value)}>
            {open ? '收起配置' : '配置'}
          </button>
        )}
      </div>

      {open && (
        <div className="config-editor">
          {entry.configSchema.map((field) => (
            <Field
              key={field.key}
              field={field}
              value={draft[field.key] ?? field.default ?? ''}
              onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
            />
          ))}
          <button className="btn btn-small" onClick={() => onConfigure(entry, draft)}>
            保存并重载
          </button>
        </div>
      )}
    </div>
  )
}

function Field({
  field,
  value,
  onChange,
}: {
  field: ConfigField
  value: unknown
  onChange: (value: unknown) => void
}) {
  if (field.type === 'boolean') {
    return (
      <label className="field field-inline">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{field.label}</span>
      </label>
    )
  }
  if (field.type === 'select') {
    return (
      <label className="field">
        <span>{field.label}</span>
        <select value={String(value)} onChange={(event) => onChange(event.target.value)}>
          {field.options?.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    )
  }
  const isMultiline = field.type === 'textarea'
  return (
    <label className="field">
      <span>{field.label}</span>
      {isMultiline ? (
        <textarea value={String(value)} onChange={(event) => onChange(event.target.value)} rows={3} />
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={String(value)}
          placeholder={field.placeholder}
          onChange={(event) =>
            onChange(field.type === 'number' ? Number(event.target.value) : event.target.value)
          }
        />
      )}
      {field.description && <small>{field.description}</small>}
    </label>
  )
}

function Services({ state }: { state: AppState | null }) {
  const owners = useMemo(() => {
    const map = new Map<string, string>()
    for (const plugin of state?.plugins ?? []) {
      for (const service of plugin.provides) map.set(service, plugin.name)
    }
    return map
  }, [state])

  if (!state) return null
  const services = state.services.filter((name) => !name.includes('~'))

  return (
    <div className="services">
      <p className="hint">
        服务总线上的 {services.length} 个 key。插件通过 <code>inject</code> 声明依赖，依赖消失时自动挂起。
      </p>
      <div className="chips">
        {services.map((name) => (
          <span className="chip chip-service" key={name} title={`由 ${owners.get(name) ?? '未知插件'} 提供`}>
            {name}
          </span>
        ))}
      </div>
      <div className="section-label">提示词段落</div>
      <div className="chips">
        {(state.promptSections ?? []).map((section) => (
          <span className="chip" key={section}>
            {section}
          </span>
        ))}
      </div>
      <div className="section-label">工具</div>
      <div className="chips">
        {state.tools.map((tool) => (
          <span className={`chip chip-${tool.scope}`} key={tool.name} title={tool.description}>
            {tool.name}
          </span>
        ))}
      </div>
      <div className="section-label">工作目录</div>
      <div className="mono muted small">{state.workspaceRoot ?? '未加载 workspace 插件'}</div>
    </div>
  )
}

function Memory({
  entries,
  onAdd,
  onDelete,
}: {
  entries: MemoryEntry[]
  onAdd: (text: string) => void
  onDelete: (id: string) => void
}) {
  const [text, setText] = useState('')
  return (
    <div className="memory">
      <form
        className="memory-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!text.trim()) return
          onAdd(text.trim())
          setText('')
        }}
      >
        <textarea
          rows={2}
          placeholder="记一条设计决策 / 约束，跨会话生效…"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button className="btn btn-small" type="submit">
          记住
        </button>
      </form>
      <div className="memory-list">
        {entries.length === 0 && <div className="muted pad">还没有记忆条目</div>}
        {entries.map((entry) => (
          <div className="memory-item" key={entry.id}>
            <span className={`kind kind-${entry.kind}`}>{entry.kind}</span>
            <span className="memory-text">{entry.text}</span>
            <button className="icon-btn" onClick={() => onDelete(entry.id)} title="删除">
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Plan({ plan }: { plan: PlanItem[] }) {
  if (!plan.length) return <div className="muted pad">当前会话还没有计划。让 Agent 先拆解任务，或直接说"帮我规划步骤"。</div>
  return (
    <div className="plan-list">
      {plan.map((item) => (
        <div className={`plan-item ${item.status}`} key={item.id}>
          <span className="plan-status">{item.status === 'done' ? '✓' : item.status === 'doing' ? '▸' : '○'}</span>
          <span className="plan-id">{item.id}</span>
          <span className="plan-text">{item.text}</span>
        </div>
      ))}
    </div>
  )
}
