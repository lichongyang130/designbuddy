import {
  ChatIcon,
  FolderIcon,
  HomeIcon,
  MemoryIcon,
  PluginIcon,
  SettingsIcon,
} from '../icons'

export type View = 'home' | 'chat' | 'files' | 'memory' | 'plugins' | 'settings'

interface Props {
  view: View
  onView: (view: View) => void
  paletteOpen: boolean
  onPalette: () => void
}

const ITEMS: Array<{ id: View; label: string; icon: typeof HomeIcon }> = [
  { id: 'home', label: '首页', icon: HomeIcon },
  { id: 'chat', label: '最近对话', icon: ChatIcon },
  { id: 'files', label: '工作区文件', icon: FolderIcon },
  { id: 'memory', label: '设计记忆', icon: MemoryIcon },
  { id: 'plugins', label: '插件', icon: PluginIcon },
  { id: 'settings', label: '设置', icon: SettingsIcon },
]

export function Rail({ view, onView, paletteOpen, onPalette }: Props) {
  return (
    <nav className="rail">
      <button className="rail-logo" onClick={() => onView('home')} title="DesignBuddy 首页">
        <span className="rail-logo-mark">DB</span>
      </button>

      <div className="rail-group">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              className={`rail-btn ${active ? 'active' : ''}`}
              onClick={() => onView(item.id)}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={19} />
            </button>
          )
        })}
      </div>

      <button
        className={`rail-btn rail-more ${paletteOpen ? 'active' : ''}`}
        onClick={onPalette}
        title="快速搜索 ⌘K"
        aria-label="快速搜索"
      >
        ···
      </button>

      <div className="rail-foot">
        <span className="rail-avatar" title="重阳 Lee">
          ZL
        </span>
      </div>
    </nav>
  )
}
