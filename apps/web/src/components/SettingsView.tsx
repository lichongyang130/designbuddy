import type { AppState } from '../types'

interface Props {
  state: AppState | null
  onOpenPlugins: () => void
}

export function SettingsView({ state, onOpenPlugins }: Props) {
  const experts = state?.experts ?? []
  const tools = state?.tools ?? []
  const sections = state?.promptSections ?? []

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>设置</h1>
          <p className="page-sub">这些能力全部来自插件：改配置即热重载，卸载即消失。</p>
        </div>
        <button className="pill" onClick={onOpenPlugins}>
          打开插件面板
        </button>
      </header>

      <section className="settings-block">
        <h2>专家团</h2>
        <div className="settings-rows">
          {experts.map((expert) => (
            <div className="settings-row" key={expert.name}>
              <div>
                <div className="settings-row-title">{expert.title}</div>
                <div className="settings-row-desc">{expert.description}</div>
              </div>
              <span className="mono muted small">{expert.name}</span>
            </div>
          ))}
          {experts.length === 0 && <div className="muted pad">presets 插件未装载</div>}
        </div>
      </section>

      <section className="settings-block">
        <h2>提示词段落</h2>
        <p className="settings-hint">系统提示词是拼出来的：每个插件贡献一段，顺序如下。</p>
        <div className="chips">
          {sections.map((section, index) => (
            <span className="chip chip-flat" key={section}>
              <span className="chip-index">{index + 1}</span>
              {section}
            </span>
          ))}
        </div>
      </section>

      <section className="settings-block">
        <h2>工具</h2>
        <div className="settings-rows">
          {tools.map((tool) => (
            <div className="settings-row" key={tool.name}>
              <div>
                <div className="settings-row-title">
                  <code>{tool.name}</code>
                  <span className={`scope-badge ${tool.scope}`}>{tool.scope}</span>
                </div>
                <div className="settings-row-desc">{tool.description}</div>
              </div>
              <span className="mono muted small">{tool.owner}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
