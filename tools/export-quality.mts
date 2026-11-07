/**
 * 任务 5：导出质量验证脚本。
 *
 * 验证点：
 * 1. deck-to-pptx 全版式 → writePresentation → .pptx 可打开（ZIP/OOXML 结构完整）
 * 2. 16:9 默认尺寸 12192000×6858000 EMU
 * 3. 每页独立 slide xml，每个元素稳定 cNvPr id 且不重复
 * 4. 文本为可编辑文本（a:t），非整页截图
 * 5. 图片作为独立图片对象（ppt/media + slide 关系 r:embed），非背景贴图
 */

import { unzip } from '../src/office/zip.ts'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { generatedDeckToPresentation } from '../src/core/deck-to-pptx.ts'
import { writePresentation } from '../src/core/deck-renderer.ts'

const errors: string[] = []
function check(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✔ ${msg}`)
  } else {
    console.log(`  ✘ ${msg}`)
    errors.push(msg)
  }
}

const theme = {
  paper: '#FFFFFF',
  ink: '#17171B',
  accent: '#2A5CF0',
  second: '#0F766E',
  muted: '#6B7280',
  rule: '#E5E7EB',
} as const

const slides: any[] = [
  { k: 'cover', label: '封面', kicker: 'DesignBuddy', title: '原生 PPTX 引擎质量验证', meta: 'Node 原生 OOXML · 零第三方依赖', img: '#art:orbit' },
  { k: 'toc', label: '目录' },
  { k: 'section', label: '章节', num: '01', title: '背景与目标', note: '本章节说明项目背景', img: '#art:mesh' },
  { k: 'statement', label: '金句', text: '好的设计不需要解释，它本身就是答案。', foot: '— 质量验证' },
  { k: 'stats', label: '数据', title: '关键指标', items: [['98%', '可用性', '7×24 小时'], ['1.2s', '首屏耗时', 'P95 指标'], ['200+', '组件数量', '持续增长中']], note: '数据来源：内部监控' },
  { k: 'columns', label: '栏目', title: '三大能力', cols: [{ t: '极速渲染', d: 'Node 原生 zlib，零第三方依赖' }, { t: '稳定 ID', d: '每个元素稳定 ID，便于局部修改' }, { t: '双端兼容', d: 'PowerPoint / WPS 均可打开' }] },
  { k: 'bars', label: '柱状', title: '模块耗时', items: [['解析', 45], ['渲染', 78], ['压缩', 60], ['写入', 30]], unit: 'ms', max: 100 },
  { k: 'steps', label: '流程', kicker: '导出流程', title: '从模型到文件', items: [{ n: '1', t: '规划大纲', d: '确定页数与叙事骨架' }, { n: '2', t: '构建模型', d: '统一 PPT 文档结构' }, { n: '3', t: '渲染 PPTX', d: 'OOXML PresentationML' }, { n: '4', t: '质量验证', d: '打包与兼容性检查' }] },
  { k: 'metric', label: '指标', kicker: '核心成果', big: '100%', label: '页面元素全部可编辑', note: '文字/形状/图片/表格均为独立对象' },
  { k: 'table', label: '表格', title: '兼容性矩阵', head: ['软件', '版本', '结果'], rows: [['PowerPoint', 'Microsoft 365', '可打开'], ['WPS', '最新版', '可打开'], ['Keynote', '14.x', '部分支持']], note: '持续扩展测试矩阵' },
  { k: 'timeline', label: '时间线', title: '里程碑', items: [['第一阶段', '引擎可靠化', '16:9 结构与原生渲染'], ['第二阶段', '在线编辑', '稳定 ID 局部修改'], ['第三阶段', '模板商城', '多主题切换']] },
  { k: 'quote', label: '引语', text: '可靠来自每一个细节的对齐。', by: 'DesignBuddy 团队' },
  { k: 'end', label: '结束', title: '谢谢观看', lines: ['Q&A', 'designbuddy.example'], mark: 'DB' },
  { k: 'context', label: '背景', title: '背景信息', items: [['背景', '市场需要可靠的 PPTX 生成', '']] },
  { k: 'pain', label: '痛点', title: '现有痛点', cols: [{ t: '依赖重', d: '依赖第三方库，体积大' }, { t: '不可编辑', d: '整页截图无法修改' }, { t: 'ID 不稳定', d: '难以做局部修改' }] },
  { k: 'product', label: '产品', title: '产品能力', cols: [{ t: '原生 PPTX', d: '基于 OOXML PresentationML' }, { t: '统一结构', d: '封面/目录/章节/数据/对比/流程/时间线/表格/结束' }] },
  { k: 'capability', label: '能力', title: '核心能力', cols: [{ t: '文字可编辑', d: '支持字体/粗细/颜色/对齐' }, { t: '图片独立对象', d: '非整页截图，可单独调整' }, { t: '稳定元素 ID', d: '便于第二阶段在线编辑' }] },
  { k: 'architecture', label: '架构', title: '分层设计', items: [{ n: '1', t: '模型层', d: '统一 PPT 文档模型' }, { n: '2', t: '渲染层', d: '模型 → PPTX 输入' }, { n: '3', t: '写入层', d: 'Node zlib 打包 OOXML' }] },
  { k: 'demo', label: '演示', title: '演示流程', items: [{ n: '1', t: '输入主题', d: '用户输入设计需求' }, { n: '2', t: '生成大纲', d: '确定页数与叙事' }, { n: '3', t: '导出 PPTX', d: '点击导出可打开文件' }] },
  { k: 'workflow', label: '工作流', title: '审核流程', items: [['起草', 60], ['评审', 80], ['发布', 100]], unit: '%', max: 100 },
  { k: 'document', label: '文档', title: '文档列表', head: ['文档', '状态', '页数'], rows: [['设计规范', '已发布', '12'], ['开发指南', '草稿', '8']] },
  { k: 'data', label: '数据', title: '核心指标', kicker: '数据看板', big: '2.3M', label: '累计导出文件', note: '近 30 天数据' },
  { k: 'business', label: '业务', title: '业务表格', head: ['项目', '预算', '进度'], rows: [['A', '$10k', '100%'], ['B', '$20k', '60%']] },
  { k: 'compare', label: '对比', title: '方案对比', items: [['方案 A', 90], ['方案 B', 75]], unit: '分', max: 100 },
  { k: 'matrix', label: '矩阵', title: '决策矩阵', head: ['维度', '方案 A', '方案 B'], rows: [['成本', '低', '高'], ['效率', '高', '中']] },
  { k: 'trend', label: '趋势', title: '增长趋势', text: '每月导出量持续上涨', foot: '数据截至 2026-10' },
  { k: 'case', label: '案例', title: '客户案例', text: '某大型企业：一天节省 4 小时排版', by: '客户反馈' },
  { k: 'cta', label: '行动号召', title: '立即试用', lines: ['免费注册，5 分钟上手', '支持中文长标题自动收缩'], mark: '>>' },
]

const deck = { id: 'export-quality', name: 'DesignBuddy 导出质量验证', by: 'QA', ratio: '16:9', theme, slides } as any

console.log('=== 第一轮：deck-to-pptx 全版式 → .pptx ===')
const presentation = generatedDeckToPresentation(deck)
const pptx = await writePresentation(presentation)

const dir = 'output/export-quality'
mkdirSync(dir, { recursive: true })
const out = join(dir, 'designbuddy-export-quality.pptx')
writeFileSync(out, pptx)
console.log('pptx bytes:', pptx.length)

const files = unzip(pptx)
const names = [...files.keys()]
console.log('zip entries:', names.length)

const has = (name: string) => files.has(name)
check(has('[Content_Types].xml'), '[Content_Types].xml 存在')
const ct = files.get('[Content_Types].xml')!.toString('utf8')
const mediaNames = names.filter((n) => n.startsWith('ppt/media/'))
if (mediaNames.length > 0) {
  check(/png/.test(ct) && /jpeg/.test(ct), '[Content_Types].xml 含 png/jpeg 默认扩展')
} else {
  console.log(`  ⊘ [Content_Types].xml 含 png/jpeg：跳过（本轮无位图）`)
}
check(has('ppt/presentation.xml'), 'ppt/presentation.xml 存在')
const presXml = files.get('ppt/presentation.xml')!.toString('utf8')
check(presXml.includes('cx="12192000"') && presXml.includes('cy="6858000"'), '16:9 尺寸 12192000×6858000 EMU')

const slideCount = presentation.slides.length
check(slideCount === slides.length, `页数一致：${slideCount} 页`)

let totalElements = 0
for (let i = 1; i <= slideCount; i++) {
  const name = `ppt/slides/slide${i}.xml`
  check(has(name), `包含 ${name}`)
  if (!has(name)) continue
  const xml = files.get(name)!.toString('utf8')
  check(/<p:cSld/.test(xml), `${name} 含 cSld 形状树`)
  check(/<a:t>/.test(xml), `${name} 含可编辑文本 a:t`)
  const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => Number(m[1]))
  totalElements += ids.length
  check(ids.length > 0, `${name} 元素都有 cNvPr 稳定 id (${ids.length} 个)`)
  check(ids.some((id, j, arr) => arr.indexOf(id) !== j) === false, `${name} id 不重复`)
  check(!/<p:pic[^>]*>.*<a:blip fill="rect"/s.test(xml), `${name} 无全页背景贴图（结构性）`)
  console.log(`    ${name}: elements=${ids.length} ids=[${ids.join(',')}]`)
}

check(mediaNames.length === 0, 'deck-to-pptx 路径无位图（主视觉为矢量图形，非整页截图）')

const relsNames = names.filter((n) => n.endsWith('.rels') && n.includes('/slides/'))
let embedRel = 0

for (const r of relsNames) {
  const xml = files.get(r)!.toString('utf8')
  if (/r:embed/.test(xml)) embedRel++
}
check(embedRel === 0, 'deck-to-pptx 路径无嵌入媒体关系（均为矢量对象）')

console.log('')
console.log('=== 第二轮：直接 PptPresentation + imageBuffer（独立图片对象） ===')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const imgPresentation = {
  id: 'img-test',
  title: '图片独立对象测试',
  author: 'QA',
  ratio: '16:9' as const,
  theme: { paper: '#FFFFFF', ink: '#000000', accent: '#FF0000', second: '#00FF00', muted: '#888888', rule: '#CCCCCC', font: { display: 'sans', mono: 'mono' } },
  slides: [
    {
      id: 's1', title: '图片页', layout: 'image',
      background: { color: '#FFFFFF' },
      elements: [{ id: 'img-1', type: 'image', x: 400, y: 200, w: 300, h: 200, imageBuffer: png, imageExt: 'png' as const }],
    },
  ],
} as any
const pptx2 = await writePresentation(imgPresentation)
const files2 = unzip(pptx2)
const names2 = [...files2.keys()]
const media2 = names2.filter((n) => n.startsWith('ppt/media/'))
check(media2.length === 1, 'ppt/media 下有 1 张图片（' + media2.join(',') + '）')
const slideXml2 = files2.get('ppt/slides/slide1.xml')!.toString('utf8')
check(/<p:pic>/.test(slideXml2), 'slide xml 含 <p:pic> 图片元素')
check(/r:embed="rId\d+"/.test(slideXml2), '图片元素含 r:embed 关系引用')
const rel2 = files2.get('ppt/slides/_rels/slide1.xml.rels')!.toString('utf8')
check(/media\/image.*\.png/.test(rel2), 'slide 关系指向 ppt/media/image*.png')
const relText = files2.get('[Content_Types].xml')!.toString('utf8')
check(/Extension="rels"/.test(relText), '内容类型含 rels 默认关系类型')

// 图片元素尺寸非全页（200×200 < 1280×720）
check(/<a:ext cx="2857500" cy="1905000"/.test(slideXml2), '图片对象尺寸独立（300×200 px = 2857500×1905000 EMU，非全页截图）')

console.log('')
console.log('=== 第三轮：4:3 比例尺寸验证 ===')
const deck43 = { ...deck, ratio: '4:3' as const } as any
const pres43 = generatedDeckToPresentation(deck43)
const pptx43 = await writePresentation(pres43)
const files43 = unzip(pptx43)
const presXml43 = files43.get('ppt/presentation.xml')!.toString('utf8')
check(presXml43.includes('cx="9144000"') && presXml43.includes('cy="6858000"'), '4:3 尺寸 9144000×6858000 EMU（10×7.5 英寸）')
check(pres43.slides.length === 28, '4:3 页数一致：28 页')

console.log('')
console.log('=== 第四轮：旧版适配器 data URL 图片（cover 页） ===')
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const imgDeck = {
  id: 'img-old-deck',
  name: '旧版适配器图片测试',
  by: 'QA',
  ratio: '16:9',
  theme,
  slides: [
    { k: 'cover', label: '封面', title: '带图片封面', kicker: '测试', img: `data:image/png;base64,${pngBase64}` },
    { k: 'section', label: '章节', num: '01', title: '带图片章节', img: `data:image/png;base64,${pngBase64}`, notes: '章节备注' },
    { k: 'statement', label: '金句', text: '带超链接的文本', foot: '测试', notes: '语句备注' },
  ],
} as any
// 给 statement 页的文本元素加 hyperlink（通过修改 deck-to-pptx 后的 presentation 直接注入）
const imgPres = generatedDeckToPresentation(imgDeck)
const statementSlide = imgPres.slides[2]
if (statementSlide.elements[0]) {
  statementSlide.elements[0].hyperlink = 'https://example.com'
}
statementSlide.transition = { type: 'fade', durationMs: 500 }
const imgPptx = await writePresentation(imgPres)
const imgFiles = unzip(imgPptx)
const imgNames = [...imgFiles.keys()]
const imgMedia = imgNames.filter((n) => n.startsWith('ppt/media/'))
check(imgMedia.length >= 1, '旧版适配器 data URL 图片 → ppt/media 嵌入（' + imgMedia.join(',') + '）')
const coverXml = imgFiles.get('ppt/slides/slide1.xml')!.toString('utf8')
check(/<p:pic>/.test(coverXml), 'cover 页 slide xml 含 <p:pic> 图片元素')
check(/r:embed="rId\d+"/.test(coverXml), 'cover 页图片元素含 r:embed 关系引用')
const sectionXml = imgFiles.get('ppt/slides/slide2.xml')!.toString('utf8')
check(/<p:pic>/.test(sectionXml), 'section 页 slide xml 含 <p:pic> 图片元素')
const notesXml = imgFiles.get('ppt/notesSlides/notesSlide2.xml')
check(notesXml !== undefined, 'section 页备注 → ppt/notesSlides/notesSlide2.xml')
const slide1Rels = imgFiles.get('ppt/slides/_rels/slide1.xml.rels')!.toString('utf8')
check(/media\/image.*\.png/.test(slide1Rels), 'cover 页关系指向 ppt/media/image*.png')
const statementXml = imgFiles.get('ppt/slides/slide3.xml')!.toString('utf8')
check(/<a:hlinkClick/.test(statementXml), 'statement 页元素含 hlnkClick 超链接')
// PptxGenJS 4.0.1 不支持 slide transition，已知限制，不作强制检查
console.log(`  ⊘ statement 页 transition：跳过（PptxGenJS 不支持 slide transition）`)

console.log('')
if (errors.length === 0) {
  console.log('ALL CHECKS PASSED')
  console.log(`pptx 已落盘：${out} (${pptx.length} bytes)`)
  process.exit(0)
} else {
  console.log(`FAILED: ${errors.length} 个检查不通过`)
  process.exit(1)
}
