/** XLSX 读写：sharedStrings / workbook rels / worksheet 单元格。 */

import { unzip, zip } from './zip.ts'
import { decodeXml, escapeXml } from './xml.ts'

export interface SheetData {
  name: string
  rows: string[][]
}

export interface SheetInput {
  name: string
  rows: Array<Array<string | number>>
}

function columnIndex(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref)
  if (!letters) return 0
  let index = 0
  for (const ch of letters[1]!) index = index * 26 + (ch.charCodeAt(0) - 64)
  return index - 1
}

function columnName(index: number): string {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function sharedStrings(files: Map<string, Buffer>): string[] {
  const xml = files.get('xl/sharedStrings.xml')?.toString('utf8')
  if (!xml) return []
  const out: string[] = []
  for (const si of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    let text = ''
    for (const t of (si[1] ?? '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) text += decodeXml(t[1] ?? '')
    out.push(text)
  }
  return out
}

function cellValue(cell: string, shared: string[]): string {
  const type = /\bt="([^"]+)"/.exec(cell)?.[1] ?? ''
  if (type === 'inlineStr') {
    let text = ''
    for (const t of cell.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) text += decodeXml(t[1] ?? '')
    return text
  }
  const formula = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(cell)?.[1]
  if (formula !== undefined) return '=' + decodeXml(formula)
  const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cell)?.[1] ?? ''
  if (type === 's') return shared[Number(raw)] ?? ''
  if (type === 'b') return raw === '1' ? 'TRUE' : 'FALSE'
  return decodeXml(raw)
}

export function readXlsx(buf: Buffer): SheetData[] {
  const files = unzip(buf)
  const workbook = files.get('xl/workbook.xml')?.toString('utf8')
  if (!workbook) throw new Error('不是有效的 XLSX：缺少 xl/workbook.xml')
  const relsXml = files.get('xl/_rels/workbook.xml.rels')?.toString('utf8') ?? ''
  const relMap = new Map<string, string>()
  for (const rel of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(rel[0])?.[1]
    const target = /\bTarget="([^"]+)"/.exec(rel[0])?.[1]
    if (id && target) relMap.set(id, target)
  }

  const shared = sharedStrings(files)
  const sheets: SheetData[] = []
  for (const sheet of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const name = /\bname="([^"]*)"/.exec(sheet[0])?.[1] ?? 'Sheet'
    const rid = /\br:id="([^"]+)"/.exec(sheet[0])?.[1] ?? ''
    const target = relMap.get(rid) ?? ''
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
    const xml = files.get(path)?.toString('utf8')
    if (!xml) continue

    const rows: string[][] = []
    for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const values: string[] = []
      for (const cell of (row[1] ?? '').matchAll(/<c\b[^>]*>[\s\S]*?<\/c>|<c\b[^>]*\/>/g)) {
        const ref = /\br="([A-Z]+\d+)"/.exec(cell[0])?.[1] ?? 'A1'
        values[columnIndex(ref)] = cellValue(cell[0], shared)
      }
      for (let i = 0; i < values.length; i += 1) if (values[i] === undefined) values[i] = ''
      rows.push(values)
    }
    sheets.push({ name: decodeXml(name), rows })
  }

  return sheets
}

export function formatXlsx(sheets: SheetData[]): string {
  if (sheets.length === 0) return '没有找到工作表。'
  const out: string[] = []
  for (const sheet of sheets) {
    out.push(`## ${sheet.name}（${sheet.rows.length} 行）`)
    for (const row of sheet.rows.slice(0, 200)) out.push(row.join('\t'))
    if (sheet.rows.length > 200) out.push(`… 其余 ${sheet.rows.length - 200} 行未显示`)
    out.push('')
  }
  return out.join('\n').trim()
}

export function writeXlsx(sheets: SheetInput[]): Buffer {
  const list = sheets.length > 0 ? sheets : [{ name: 'Sheet1', rows: [] }]
  const sheetXml = list.map((sheet) => {
    const rows = sheet.rows
      .map((row, r) => {
        const cells = row
          .map((value, c) => {
            const ref = `${columnName(c)}${r + 1}`
            if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`
            const text = String(value ?? '')
            if (text === '') return ''
            if (text.startsWith('=') && text.length > 1) {
              return `<c r="${ref}"><f>${escapeXml(text.slice(1))}</f><v>0</v></c>`
            }
            return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`
          })
          .join('')
        return `<row r="${r + 1}">${cells}</row>`
      })
      .join('')
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`
  })

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    list.map((sheet, i) => `<sheet name="${escapeXml(sheet.name || `Sheet${i + 1}`)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    '</sheets></workbook>'

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    '</Relationships>'

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
    '</Types>'

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>'

  const entries = [
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes) },
    { name: '_rels/.rels', data: Buffer.from(rootRels) },
    { name: 'xl/workbook.xml', data: Buffer.from(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRels) },
    ...sheetXml.map((xml, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: Buffer.from(xml) })),
  ]
  return zip(entries)
}
