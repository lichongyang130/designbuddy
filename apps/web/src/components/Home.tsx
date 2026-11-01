import { useRef } from 'react'
import { ArrowUpIcon, AttachIcon, ExpandIcon, MicIcon, SparkIcon } from '../icons'
import { capabilities, templates, type Template } from '../templates'

interface Props {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onTemplate: (template: Template) => void
  onCapability: (hint: string) => void
  busy: boolean
  templateCount: number
  expertLabel: string
  modelLabel: string
  onOpenExperts: () => void
}

export function Home({
  value,
  onChange,
  onSubmit,
  onTemplate,
  onCapability,
  busy,
  templateCount,
  expertLabel,
  modelLabel,
  onOpenExperts,
}: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const visibleTemplates = templates.slice(0, templateCount)

  return (
    <div className="home">
      <header className="home-top">
        <button className="pill pill-ghost">
          <SparkIcon size={14} />
          升级获得更多 AI 功能
        </button>
        <div className="home-top-right">
          <button className="link-plain" onClick={onOpenExperts}>
            使用经典版生成工具
          </button>
          <button className="pill" onClick={() => textarea.current?.focus()}>
            从空白新建
          </button>
          <button className="pill pill-credit" title="本次会话剩余额度">
            <SparkIcon size={13} />
            173
          </button>
        </div>
      </header>

      <div className="home-body">
        <div className="hero">
          <div className="mascot-wrap">
            <img className="mascot" src="/mascot.png" alt="" width={168} height={98} />
          </div>
          <h1 className="hero-title">带上您已有的内容</h1>

          <div className="composer-card">
            <textarea
              ref={textarea}
              className="composer-input"
              placeholder="把工作区里的设计说明变成一份评审报告：先指出致命问题，再给出三条可执行的修改建议。"
              value={value}
              rows={3}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  onSubmit()
                }
              }}
            />
            <div className="composer-tools">
              <button className="round-btn" title="添加上下文（工作区文件）" aria-label="添加上下文">
                <span className="plus-glyph">+</span>
              </button>
              <div className="composer-right">
                <button className="round-btn" title="从记忆库引用" aria-label="从记忆库引用">
                  <AttachIcon size={16} />
                </button>
                <button className="round-btn" title="展开编辑" aria-label="展开编辑">
                  <ExpandIcon size={16} />
                </button>
                <button className="select-chip" onClick={onOpenExperts} title="切换角色与模型">
                  <span className="select-dot" />
                  {expertLabel}
                  <span className="select-sep" />
                  {modelLabel}
                </button>
                <button className="round-btn" title="语音输入" aria-label="语音输入">
                  <MicIcon size={16} />
                </button>
                <button
                  className="send-btn"
                  onClick={onSubmit}
                  disabled={!value.trim() || busy}
                  title="生成（Enter）"
                  aria-label="生成"
                >
                  <ArrowUpIcon size={17} />
                </button>
              </div>
            </div>
          </div>

          <div className="chips">
            {capabilities.map((capability) => (
              <button
                key={capability.id}
                className="chip"
                onClick={() => {
                  onCapability(capability.hint)
                  textarea.current?.focus()
                }}
              >
                {capability.icon}
                {capability.label}
              </button>
            ))}
          </div>
        </div>

        <section className="templates">
          <h2 className="templates-title">推荐模板</h2>
          <div className="template-grid">
            {visibleTemplates.map((template) => (
              <button key={template.id} className="template" onClick={() => onTemplate(template)}>
                <span
                  className={`thumb ink-${template.ink} motif-${template.motif}`}
                  style={{
                    background: `linear-gradient(150deg, ${template.palette[0]}, ${template.palette[1]})`,
                  }}
                >
                  <span className="thumb-kicker">{template.kicker}</span>
                  <span className="thumb-art" aria-hidden="true" />
                </span>
                <span className="template-title">{template.title}</span>
                <span className="template-meta">{template.meta}</span>
              </button>
            ))}
          </div>
          <div className="templates-foot">
            <button className="pill">查看所有模板</button>
          </div>
        </section>
      </div>
    </div>
  )
}
