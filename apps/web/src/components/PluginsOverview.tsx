import type { AppState, MarketEntry } from '../types'

interface Props {
  state: AppState | null
  market: MarketEntry[]
}

const GROUPS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'core', label: '内核', hint: '服务总线、提示词、工具执行器、Agent 循环' },
  { key: 'agent', label: 'Agent', hint: '专家团与计划器' },
  { key: 'memory', label: '记忆', hint: '跨会话的设计决策' },
  { key: 'skill', label: '技能', hint: '按需打开的 Markdown 方法论' },
  { key: 'model', label: '模型', hint: 'provider 以插件形式注册' },
  { key: 'tool', label: '工具', hint: '模型可以调用的能力，含 MCP 外部工具' },
  { key: 'interface', label: '接口', hint: 'HTTP + SSE，前端是内核的观察者' },
]

export function PluginsOverview({ state, market }: Props) {
  const active = market.filter((entry) => entry.state === 'active').length

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>插件与运行内核</h1>
          <p className="page-sub">
            {active}/{market.length} 个插件在跑 · {state?.services.length ?? 0} 个服务 · 右侧面板可装卸、改配置、看日志。
            关掉一个插件，依赖它的插件会自动挂起，重新打开时会自己回来。
          </p>
        </div>
      </header>

      <div className="plugin-groups">
        {GROUPS.map((group) => {
          const entries = market.filter((entry) => entry.category === group.key)
          if (!entries.length) return null
          return (
            <section className="plugin-group" key={group.key}>
              <header>
                <h2>{group.label}</h2>
                <span className="muted small">{group.hint}</span>
              </header>
              <div className="plugin-cards">
                {entries.map((entry) => (
                  <article className={`plugin-card state-${entry.state}`} key={entry.name}>
                    <div className="plugin-card-head">
                      <span className={`state-dot ${entry.state}`} />
                      <span className="plugin-card-title">{entry.title}</span>
                      <code className="plugin-card-name">@{entry.name}</code>
                    </div>
                    <p>{entry.description}</p>
                    <footer>
                      <span className="state-label">{label(entry.state)}</span>
                      {entry.provides.length > 0 && (
                        <span className="muted small mono">{entry.provides.length} 个服务</span>
                      )}
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function label(state: MarketEntry['state']): string {
  switch (state) {
    case 'active':
      return '运行中'
    case 'pending':
      return '等待依赖'
    case 'error':
      return '加载失败'
    default:
      return '未装载'
  }
}
