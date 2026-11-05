import test from 'node:test'
import assert from 'node:assert/strict'
// @ts-ignore -- browser modules are plain JavaScript
import { compileDeckToScene, createSlideFromLayout, applyThemeToSlides } from '../apps/web/public/ppt-editor/compiler.js'
// @ts-ignore -- browser modules are plain JavaScript
import { renderSlideStageHtml } from '../apps/web/public/ppt-editor/canvas.js'
// @ts-ignore -- browser modules are plain JavaScript
import { WPS_THEMES } from '../apps/web/public/ppt-editor/presets.js'

test('editable scene compiles, adds pages, renders, and applies themes', () => {
  const scene = compileDeckToScene({ name: 'Test', slides: [{ k: 'cover', title: 'Hello' }] })
  assert.equal(scene.slides.length, 1)
  assert.ok(scene.slides[0].elements.some((element: { text?: string }) => element.text === 'Hello'))
  assert.match(renderSlideStageHtml(scene, scene.slides[0]), /Hello/)
  const blank = createSlideFromLayout('blank', scene, 1)
  scene.slides.push(blank)
  applyThemeToSlides(scene, WPS_THEMES[1])
  assert.equal(scene.slides.length, 2)
  assert.equal(scene.theme.paper, WPS_THEMES[1].paper)
})

test('layout switching preserves all user content and elements', async () => {
// @ts-ignore -- browser modules are plain JavaScript
  const { switchSlideLayout } = await import('../apps/web/public/ppt-editor/compiler.js')
  const scene = compileDeckToScene({ name: 'Test', slides: [{ k: 'cover', title: 'Original' }] })
  const slide = scene.slides[0]
  slide.elements.push({ id: 'custom', type: 'text', x: 30, y: 30, w: 100, h: 80, text: 'Keep my work', style: { color: '#123456' } })
  const before = slide.elements.map((e: { id: string; text?: string }) => [e.id, e.text])
  switchSlideLayout(slide, 'columns', scene, 0)
  assert.deepEqual(slide.elements.map((e: { id: string; text?: string }) => [e.id, e.text]), before)
  assert.equal(slide.elements.find((e: { id: string }) => e.id === 'custom').style.color, '#123456')
})

test('PNG archive has valid stored entries and UTF-8 file names', async () => {
// @ts-ignore -- browser modules are plain JavaScript
  const { makeStoredZip } = await import('../apps/web/public/ppt-editor/exporter.js')
  const { unzip, crc32 } = await import('../src/office/zip.ts')
  const bytes = new Uint8Array([0, 1, 2, 255])
  const archive = Buffer.from(await makeStoredZip([{ name: '幻灯片.png', bytes }]).arrayBuffer())
  const entries = unzip(archive)
  assert.deepEqual(entries.get('幻灯片.png'), Buffer.from(bytes))
  assert.equal(archive.readUInt32LE(14), crc32(Buffer.from(bytes)))
})

test('image crop settings appear in canvas and chart inspector escapes data', async () => {
// @ts-ignore -- browser modules are plain JavaScript
  const { renderElementInnerHtml } = await import('../apps/web/public/ppt-editor/canvas.js')
// @ts-ignore -- browser modules are plain JavaScript
  const { inspectorHtml } = await import('../apps/web/public/ppt-editor/inspector.js')
  const image = renderElementInnerHtml({ type: 'image', src: 'x.png', cropX: 25, cropY: 70, cropZoom: 2, style: {} }, {})
  assert.match(image, /object-position:25% 70%/)
  assert.match(image, /scale\(2\)/)
  const chart = inspectorHtml({}, {}, { type: 'chart', categories: ['<script>'], series: [{values:[5]}] })
  assert.doesNotMatch(chart, /<script>/)
  assert.match(chart, /&lt;script&gt;/)
})

test('PPTX exports safe external hyperlinks for editable shapes', async () => {
  const { writePptx } = await import('../src/office/pptx.ts')
  const { unzip } = await import('../src/office/zip.ts')
  const buf = writePptx({ slides: [{elements:[{type:'text',x:0,y:0,w:200,h:50,text:'Visit',hyperlink:'https://example.com/?a=1&b=2'}]}] })
  const files=unzip(buf), xml=files.get('ppt/slides/slide1.xml')!.toString(), rels=files.get('ppt/slides/_rels/slide1.xml.rels')!.toString()
  assert.match(xml, /<a:hlinkClick r:id="rId2"\/>/)
  assert.match(rels, /Target="https:\/\/example.com\/\?a=1&amp;b=2" TargetMode="External"/)
})

test('sparse slide arrays produce editable blank slots', () => {
  const slides = new Array(2); slides[1] = {k:'cover',title:'Second'}
  const scene = compileDeckToScene({slides})
  assert.equal(scene.slides.length, 2)
  assert.equal(scene.slides[0].layoutKind, 'blank')
  assert.ok(scene.slides[1].elements.length)
})

test('chart table round-trips multiple series and rejects malformed values', async () => {
  // @ts-ignore -- browser modules are plain JavaScript
  const { formatChartData, parseChartData } = await import('../apps/web/public/ppt-editor/chart-data.js')
  const data = { categories: ['Q1','Q2'], series: [{name:'收入',values:[2,3]}, {name:'成本',values:[1,4]}] }
  assert.deepEqual(parseChartData(formatChartData(data)), data)
  assert.throws(() => parseChartData('分类\t收入\nQ1\tnot-a-number'))
})
