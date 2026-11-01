/** PDF 文本抽取：解压 FlateDecode 内容流，读取 Tj/TJ 文本。 */

import { inflateSync } from 'node:zlib'

export interface PdfText {
  pages: number
  text: string
}

function decodePdfString(raw: string): string {
  let out = ''
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]!
    if (ch !== '\\') {
      out += ch
      continue
    }
    const next = raw[i + 1] ?? ''
    if (next === 'n') { out += '\n'; i += 1 }
    else if (next === 'r') { out += '\r'; i += 1 }
    else if (next === 't') { out += '\t'; i += 1 }
    else if (next === 'b') { out += '\b'; i += 1 }
    else if (next === 'f') { out += '\f'; i += 1 }
    else if (next === '(' || next === ')' || next === '\\') { out += next; i += 1 }
    else if (/[0-7]/.test(next)) {
      const octal = /^[0-7]{1,3}/.exec(raw.slice(i + 1))?.[0] ?? ''
      out += String.fromCharCode(Number.parseInt(octal, 8))
      i += octal.length
    } else { i += 1 }
  }
  return out
}

function decodeHexString(raw: string): string {
  const hex = raw.replace(/\s+/g, '')
  const bytes: number[] = []
  for (let i = 0; i + 1 < hex.length; i += 2) bytes.push(Number.parseInt(hex.slice(i, i + 2), 16))
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.from(bytes.slice(2))
    return swapped.swap16().toString('utf16le')
  }
  return Buffer.from(bytes).toString('latin1')
}

function extractText(content: string): string {
  const out: string[] = []
  const re = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>|\bT[dD]\b|\bT\*\b|\bTj\b|\bTJ\b/g
  for (const match of content.matchAll(re)) {
    const token = match[0]
    if (token.startsWith('(')) out.push(decodePdfString(token.slice(1, -1)))
    else if (token.startsWith('<')) out.push(decodeHexString(token.slice(1, -1)))
    else if (token === 'Td' || token === 'TD' || token === 'T*') out.push('\n')
  }
  return out.join('')
}

export function readPdf(buf: Buffer): PdfText {
  const latin = buf.toString('latin1')
  const pages = (latin.match(/\/Type\s*\/Page\b/g) ?? []).length
  const pieces: string[] = []

  let cursor = 0
  while (true) {
    const start = latin.indexOf('stream', cursor)
    if (start < 0) break
    const dict = latin.slice(Math.max(0, start - 400), start)
    let dataStart = start + 'stream'.length
    if (latin[dataStart] === '\r') dataStart += 1
    if (latin[dataStart] === '\n') dataStart += 1
    const end = latin.indexOf('endstream', dataStart)
    if (end < 0) break
    const raw = buf.subarray(dataStart, end)
    cursor = end + 'endstream'.length
    if (dict.includes('/Subtype') && dict.includes('/Image')) continue
    if (!dict.includes('/FlateDecode')) {
      pieces.push(extractText(raw.toString('latin1')))
      continue
    }
    try {
      pieces.push(extractText(inflateSync(raw).toString('latin1')))
    } catch {
      // 损坏或非 zlib 流：跳过
    }
  }

  const text = pieces.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return { pages, text }
}

export function formatPdf(result: PdfText): string {
  if (result.text === '') {
    return `共 ${result.pages} 页，但没有抽取到文本：可能是扫描件、图片型 PDF，或使用了自定义字体编码。`
  }
  return `共 ${result.pages} 页\n\n${result.text}`
}
