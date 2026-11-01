import test from 'node:test'
import assert from 'node:assert/strict'

import { unzip, zip } from '../src/office/zip.ts'
import { readDocx, writeDocx, listFormulas, numberFormulas } from '../src/office/docx.ts'
import { readXlsx, writeXlsx } from '../src/office/xlsx.ts'
import { readPptx } from '../src/office/pptx.ts'
import { readPdf } from '../src/office/pdf.ts'

test('zip 往返保留文件名与内容', () => {
  const buffer = zip([
    { name: 'a.txt', data: Buffer.from('hello') },
    { name: 'dir/b.xml', data: Buffer.from('<x>1</x>') },
  ])
  const files = unzip(buffer)
  assert.equal(files.get('a.txt')?.toString(), 'hello')
  assert.equal(files.get('dir/b.xml')?.toString(), '<x>1</x>')
})

test('docx 写入后可读回标题、段落、列表与表格', () => {
  const buffer = writeDocx([
    { type: 'heading', level: 1, text: '季度报告' },
    { type: 'paragraph', text: '这是一段正文。' },
    { type: 'bullet', text: '第一项' },
    { type: 'table', rows: [['指标', '数值'], ['收入', '120']] },
  ])
  const result = readDocx(buffer)
  assert.match(result.text, /# 季度报告/)
  assert.match(result.text, /这是一段正文/)
  assert.match(result.text, /- 第一项/)
  assert.match(result.text, /\| 收入 \| 120 \|/)
})

test('docx 公式可提取为 LaTeX 并可编号', () => {
  const base = writeDocx([{ type: 'paragraph', text: '公式：' }])
  const files = unzip(base)
  const xml = files.get('word/document.xml')!.toString()
  const math =
    '<m:oMathPara><m:oMath><m:f><m:num><m:r><m:t>1</m:t></m:r></m:num>' +
    '<m:den><m:r><m:t>2</m:t></m:r></m:den></m:f></m:oMath></m:oMathPara>'
  files.set('word/document.xml', Buffer.from(xml.replace('</w:p>', `${math}</w:p>`)))
  const docx = zip([...files.entries()].map(([name, data]) => ({ name, data })))

  const formulas = listFormulas(docx)
  assert.equal(formulas.length, 1)
  assert.equal(formulas[0]?.latex, '\\frac{1}{2}')

  const numbered = numberFormulas(docx, 1)
  assert.equal(numbered.count, 1)
  const after = unzip(numbered.buffer).get('word/document.xml')!.toString()
  assert.match(after, /\(1\)/)
})

test('xlsx 写入后可读回工作表与单元格', () => {
  const buffer = writeXlsx([
    { name: '明细', rows: [['名称', '数量'], ['苹果', 3]] },
  ])
  const sheets = readXlsx(buffer)
  assert.equal(sheets.length, 1)
  assert.equal(sheets[0]?.name, '明细')
  assert.deepEqual(sheets[0]?.rows[0], ['名称', '数量'])
  assert.deepEqual(sheets[0]?.rows[1], ['苹果', '3'])
})

test('pptx 逐页提取标题与正文', () => {
  const slide =
    '<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>季度复盘</a:t></a:r></a:p>' +
    '<a:p><a:r><a:t>收入增长 20%</a:t></a:r></a:p></p:sld>'
  const buffer = zip([{ name: 'ppt/slides/slide1.xml', data: Buffer.from(slide) }])
  const result = readPptx(buffer)
  assert.equal(result.slides.length, 1)
  assert.equal(result.slides[0]?.title, '季度复盘')
  assert.deepEqual(result.slides[0]?.lines, ['季度复盘', '收入增长 20%'])
})

test('pdf 未压缩内容流可抽取文本', () => {
  const pdf = [
    '%PDF-1.4',
    '1 0 obj << /Type /Page /Contents 2 0 R >> endobj',
    '2 0 obj << /Length 44 >>',
    'stream',
    'BT /F1 12 Tf 72 720 Td (Hello Office) Tj ET',
    'endstream',
    'endobj',
    'trailer << /Root 1 0 R >>',
    '%%EOF',
  ].join('\n')
  const result = readPdf(Buffer.from(pdf, 'latin1'))
  assert.equal(result.pages, 1)
  assert.match(result.text, /Hello Office/)
})

test('xlsx 公式可写入并按公式读回', () => {
  const buffer = writeXlsx([{ name: '计算', rows: [['1', '2'], ['=SUM(A1:B1)']] }])
  const sheets = readXlsx(buffer)
  assert.equal(sheets[0]?.rows[1]?.[0], '=SUM(A1:B1)')
})
