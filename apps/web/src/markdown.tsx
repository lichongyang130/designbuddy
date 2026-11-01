import { Fragment, type ReactNode } from 'react'

/**
 * A deliberately small Markdown renderer: bold, inline code, headings, lists
 * and paragraphs. No HTML injection, no dependency, predictable output.
 */
export function renderMarkdown(source: string): ReactNode {
  const lines = source.split('\n')
  const blocks: ReactNode[] = []
  let list: string[] = []

  const flushList = () => {
    if (!list.length) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="md-list">
        {list.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </ul>,
    )
    list = []
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (/^[-*]\s+/.test(trimmed)) {
      list.push(trimmed.replace(/^[-*]\s+/, ''))
      return
    }
    flushList()
    if (!trimmed) return
    if (/^\d+[.)]\s+/.test(trimmed)) {
      blocks.push(
        <ol key={`ol-${index}`} className="md-list">
          <li>{inline(trimmed.replace(/^\d+[.)]\s+/, ''))}</li>
        </ol>,
      )
      return
    }
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h4 key={index} className="md-h4">
          {inline(trimmed.slice(4))}
        </h4>,
      )
      return
    }
    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h3 key={index} className="md-h3">
          {inline(trimmed.slice(3))}
        </h3>,
      )
      return
    }
    blocks.push(
      <p key={index} className="md-p">
        {inline(trimmed)}
      </p>,
    )
  })
  flushList()
  return <Fragment>{blocks}</Fragment>
}

function inline(text: string): ReactNode {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={index}>{token.slice(2, -2)}</strong>
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code key={index} className="md-code">
          {token.slice(1, -1)}
        </code>
      )
    }
    return <Fragment key={index}>{token}</Fragment>
  })
}
