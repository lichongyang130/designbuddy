/**
 * DOCX 读写 + OMML 公式提取。
 *
 * 读取走 document.xml 的段落/表格；写入生成最小可用包（Content_Types +
 * rels + document.xml），Word/WPS 可以正常打开。公式只做提取与编号，
 * 不改写公式本身的排版。
 */

import { unzip, zip } from './zip.ts'
import { attr, decodeXml, escapeXml } from './xml.ts'

export interface DocxBlock {
  type: 'heading' | 'paragraph' | 'bullet' | 'table'
  level?: number
  text?: string
  rows?: string[][]
}

export interface DocxReadResult {
  blocks: DocxBlock[]
  text: string
}

function paragraphText(inner: string): string {
  let text = ''
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g
  for (const match of inner.matchAll(re)) {
    if (match[1] !== undefined) text += decodeXml(match[1])
    else if (match[0].startsWith('<w:tab')) text += '\t'
    else text += '\n'
  }
  return text
}

function tableRows(inner: string): string[][] {
  const rows: string[][] = []
  for (const row of inner.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)) {
    const cells: string[] = []
    for (const cell of (row[1] ?? '').matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)) {
      cells.push(paragraphText(cell[1] ?? '').trim())
    }
    rows.push(cells)
  }
  return rows
}

export function readDocx(buf: Buffer): DocxReadResult {
  const files = unzip(buf)
  const document = files.get('word/document.xml')
  if (!document) throw new Error('不是有效的 DOCX：缺少 word/document.xml')
  const xml = document.toString('utf8')

  const bodyMatch = /<w:body\b[^>]*>([\s\S]*)<\/w:body>/.exec(xml)
  const body = bodyMatch ? bodyMatch[1] : xml

  const blocks: DocxBlock[] = []
  const blockRe = /<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g
  for (const match of body.matchAll(blockRe)) {
    const chunk = match[0]
    if (chunk.startsWith('<w:tbl')) {
      const rows = tableRows(chunk)
      if (rows.length > 0) blocks.push({ type: 'table', rows })
      continue
    }
    const text = paragraphText(chunk).trim()
    if (text === '') continue
    const heading = /<w:pStyle\b[^>]*w:val="Heading(\d)"/.exec(chunk)
    if (heading) blocks.push({ type: 'heading', level: Number(heading[1]), text })
    else if (chunk.includes('<w:numPr') || text.startsWith('• ')) {
      blocks.push({ type: 'bullet', text: text.replace(/^•\s*/, '') })
    } else blocks.push({ type: 'paragraph', text })
  }

  const lines = blocks.map((block) => {
    if (block.type === 'table') return (block.rows ?? []).map((row) => `| ${row.join(' | ')} |`).join('\n')
    if (block.type === 'heading') return `${'#'.repeat(block.level ?? 1)} ${block.text}`
    if (block.type === 'bullet') return `- ${block.text}`
    return block.text ?? ''
  })

  return { blocks, text: lines.join('\n') }
}

function paragraphXml(block: DocxBlock): string {
  const text = escapeXml(block.text ?? '')
  if (block.type === 'heading') {
    const level = Math.min(Math.max(block.level ?? 1, 1), 6)
    return `<w:p><w:pPr><w:pStyle w:val="Heading${level}"/></w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
  }
  if (block.type === 'bullet') {
    return `<w:p><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr><w:r><w:t xml:space="preserve">• ${text}</w:t></w:r></w:p>`
  }
  return `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
}

function tableXml(rows: string[][]): string {
  const body = rows
    .map((row) => {
      const cells = row
        .map((cell) => `<w:tc><w:p><w:r><w:t xml:space="preserve">${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`)
        .join('')
      return `<w:tr>${cells}</w:tr>`
    })
    .join('')
  return `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${body}</w:tbl>`
}

export function writeDocx(blocks: DocxBlock[]): Buffer {
  const body = blocks
    .map((block) => (block.type === 'table' ? tableXml(block.rows ?? []) : paragraphXml(block)))
    .join('')

  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>` +
    '</w:document>'

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>'

  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>'

  return zip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes) },
    { name: '_rels/.rels', data: Buffer.from(rels) },
    { name: 'word/document.xml', data: Buffer.from(document) },
  ])
}

/* ── OMML → LaTeX ─────────────────────────────────────── */

interface XNode {
  tag: string
  attrs: Record<string, string>
  children: Array<XNode | string>
}

function parseXml(xml: string): XNode {
  const root: XNode = { tag: '#root', attrs: {}, children: [] }
  const stack: XNode[] = [root]
  const re = /<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(xml)) !== null) {
    if (match[5] !== undefined) {
      stack[stack.length - 1]!.children.push(decodeXml(match[5]))
      continue
    }
    if (match[1] === '/') {
      if (stack.length > 1) stack.pop()
      continue
    }
    const node: XNode = { tag: match[2]!, attrs: {}, children: [] }
    for (const a of (match[3] ?? '').matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) node.attrs[a[1]!] = decodeXml(a[2] ?? '')
    stack[stack.length - 1]!.children.push(node)
    if (match[4] !== '/') stack.push(node)
  }
  return root
}

function child(node: XNode, name: string): XNode | undefined {
  return node.children.find((item): item is XNode => typeof item !== 'string' && (item.tag === name || item.tag.endsWith(`:${name}`)))
}

const GREEK: Record<string, string> = {
  'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\epsilon', 'ζ': '\\zeta',
  'η': '\\eta', 'θ': '\\theta', 'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu',
  'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon',
  'φ': '\\phi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
  'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda', 'Ξ': '\\Xi', 'Π': '\\Pi',
  'Σ': '\\Sigma', 'Φ': '\\Phi', 'Ψ': '\\Psi', 'Ω': '\\Omega',
}

function escapeLatex(text: string): string {
  let out = ''
  for (const ch of text) {
    if (GREEK[ch]) out += GREEK[ch]
    else if ('{}_^%&#$'.includes(ch)) out += `\\${ch}`
    else if (ch === '\\') out += '\\backslash '
    else out += ch
  }
  return out
}

function latexChildren(node: XNode): string {
  return node.children.map((item) => (typeof item === 'string' ? escapeLatex(item) : latexNode(item))).join('')
}

function latexNode(node: XNode): string {
  const local = node.tag.includes(':') ? node.tag.slice(node.tag.indexOf(':') + 1) : node.tag
  switch (local) {
    case 'f': {
      const num = child(node, 'num')
      const den = child(node, 'den')
      return `\\frac{${num ? latexChildren(num) : ''}}{${den ? latexChildren(den) : ''}}`
    }
    case 'sSup': {
      const base = child(node, 'e')
      const sup = child(node, 'sup')
      return `{${base ? latexChildren(base) : ''}}^{${sup ? latexChildren(sup) : ''}}`
    }
    case 'sSub': {
      const base = child(node, 'e')
      const sub = child(node, 'sub')
      return `{${base ? latexChildren(base) : ''}}_{${sub ? latexChildren(sub) : ''}}`
    }
    case 'sSubSup': {
      const base = child(node, 'e')
      const sub = child(node, 'sub')
      const sup = child(node, 'sup')
      return `{${base ? latexChildren(base) : ''}}_{${sub ? latexChildren(sub) : ''}}^{${sup ? latexChildren(sup) : ''}}`
    }
    case 'rad': {
      const deg = child(node, 'deg')
      const body = child(node, 'e')
      const degree = deg ? latexChildren(deg).trim() : ''
      return degree ? `\\sqrt[${degree}]{${body ? latexChildren(body) : ''}}` : `\\sqrt{${body ? latexChildren(body) : ''}}`
    }
    case 'nary': {
      const chr = attr(`<x ${Object.entries(node.attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}>`, 'm:val') ?? node.attrs['m:val'] ?? '∑'
      const op = chr === '∫' ? '\\int' : chr === '∏' ? '\\prod' : chr === '∮' ? '\\oint' : '\\sum'
      const sub = child(node, 'sub')
      const sup = child(node, 'sup')
      const body = child(node, 'e')
      const lower = sub ? `_{${latexChildren(sub)}}` : ''
      const upper = sup ? `^{${latexChildren(sup)}}` : ''
      return `${op}${lower}${upper}{${body ? latexChildren(body) : ''}}`
    }
    case 'd': {
      const beg = node.attrs['m:begChr'] ?? '('
      const end = node.attrs['m:endChr'] ?? ')'
      const inner = node.children
        .filter((item): item is XNode => typeof item !== 'string' && (item.tag.endsWith(':e')))
        .map((item) => latexChildren(item))
        .join(', ')
      return `\\left${beg}${inner}\\right${end}`
    }
    case 'func': {
      const name = child(node, 'fName')
      const body = child(node, 'e')
      return `${name ? latexChildren(name) : ''}${body ? `\\left(${latexChildren(body)}\\right)` : ''}`
    }
    case 'limLow': {
      const base = child(node, 'e')
      const lim = child(node, 'lim')
      return `{${base ? latexChildren(base) : ''}}_{${lim ? latexChildren(lim) : ''}}`
    }
    case 'limUpp': {
      const base = child(node, 'e')
      const lim = child(node, 'lim')
      return `{${base ? latexChildren(base) : ''}}^{${lim ? latexChildren(lim) : ''}}`
    }
    case 'acc': {
      const chr = node.attrs['m:chr'] ?? '̂'
      const mark = chr === '¯' ? '\\bar' : chr === '˜' ? '\\tilde' : chr === '˙' ? '\\dot' : chr === '¨' ? '\\ddot' : '\\hat'
      const body = child(node, 'e')
      return `${mark}{${body ? latexChildren(body) : ''}}`
    }
    case 'bar': {
      const body = child(node, 'e')
      return `\\overline{${body ? latexChildren(body) : ''}}`
    }
    case 'eqArr': {
      return node.children
        .filter((item): item is XNode => typeof item !== 'string' && item.tag.endsWith(':e'))
        .map((item) => latexChildren(item))
        .join(' \\\\ ')
    }
    case 'm': {
      return node.children
        .filter((item): item is XNode => typeof item !== 'string' && item.tag.endsWith(':mr'))
        .map((row) => row.children
          .filter((cell): cell is XNode => typeof cell !== 'string' && cell.tag.endsWith(':e'))
          .map((cell) => latexChildren(cell))
          .join(' & '))
        .join(' \\\\ ')
    }
    case 't':
      return escapeLatex(node.children.filter((item): item is string => typeof item === 'string').join(''))
    default:
      return latexChildren(node)
  }
}

export interface Formula {
  index: number
  latex: string
  display: boolean
}

export function listFormulas(buf: Buffer): Formula[] {
  const files = unzip(buf)
  const document = files.get('word/document.xml')
  if (!document) throw new Error('不是有效的 DOCX：缺少 word/document.xml')
  const xml = document.toString('utf8')
  const formulas: Formula[] = []

  for (const match of xml.matchAll(/<m:oMathPara\b[^>]*>([\s\S]*?)<\/m:oMathPara>/g)) {
    const node = parseXml(match[1] ?? '')
    formulas.push({ index: formulas.length + 1, latex: latexChildren(node).trim(), display: true })
  }
  const withoutPara = xml.replace(/<m:oMathPara\b[^>]*>[\s\S]*?<\/m:oMathPara>/g, '')
  for (const match of withoutPara.matchAll(/<m:oMath\b[^>]*>([\s\S]*?)<\/m:oMath>/g)) {
    const node = parseXml(match[1] ?? '')
    formulas.push({ index: formulas.length + 1, latex: latexChildren(node).trim(), display: false })
  }

  return formulas
}

/** 给每个显示公式末尾加 (n)，返回新的 docx。 */
export function numberFormulas(buf: Buffer, start = 1): { buffer: Buffer; count: number } {
  const files = unzip(buf)
  const document = files.get('word/document.xml')
  if (!document) throw new Error('不是有效的 DOCX：缺少 word/document.xml')
  let xml = document.toString('utf8')
  let n = start
  let count = 0
  xml = xml.replace(/(<m:oMathPara\b[^>]*>[\s\S]*?<\/m:oMathPara>)/g, (match) => {
    const tag = `<w:r><w:tab/><w:t xml:space="preserve">(${n})</w:t></w:r>`
    n += 1
    count += 1
    return `${match}${tag}`
  })

  const rest = [...files.entries()]
    .filter(([name]) => name !== 'word/document.xml')
    .map(([name, data]) => ({ name, data }))
  return {
    buffer: zip([...rest, { name: 'word/document.xml', data: Buffer.from(xml) }]),
    count,
  }
}
