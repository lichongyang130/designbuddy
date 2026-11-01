import { CloseIcon } from '../icons'
import { Inspector, type InspectorTab } from './Inspector'
import type { AppState, LogEntry, MarketEntry, PlanItem } from '../types'

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
  onClose: () => void
}

/** The docked kernel panel: the running app, not a settings dialog. */
export function PluginsPanel(props: Props) {
  const active = props.market.filter((entry) => entry.state === 'active').length
  return (
    <section className="dock-panel">
      <header className="dock-head">
        <div>
          <h2>运行内核</h2>
          <p>
            {active}/{props.market.length} 个插件在跑 · {props.state?.services.length ?? 0} 个服务
          </p>
        </div>
        <button className="icon-btn" onClick={props.onClose} title="关闭面板">
          <CloseIcon size={16} />
        </button>
      </header>
      <Inspector {...props} error={null} />
    </section>
  )
}
