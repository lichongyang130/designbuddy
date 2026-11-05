import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {TASKS,suggestTasks,planFor} from '../apps/web/public/office-workspace/core.js'

test('workspace suggests steps using rules without inventing unknown work',()=>{
 const suggestions=suggestTasks('收集各部门月度工作总结，核对未提交名单并生成 PPT')
 assert.ok(suggestions.includes('collection'));assert.ok(suggestions.includes('word'));assert.ok(suggestions.includes('ppt'))
 assert.deepEqual(suggestTasks('今天天气不错'),[])
 assert.ok(suggestTasks('比较两份合同的版本').includes('review'));assert.ok(suggestTasks('核对 Word 和 Excel 的数字').includes('crossreview'))
 assert.deepEqual(planFor(['word','not-a-task','search']).map(x=>x.id),['word','search'])
 assert.equal(new Set(TASKS.map(x=>x.id)).size,TASKS.length)
})
test('workspace runs supported tools directly and does not advertise planned capabilities as available',async()=>{
 const html=await readFile(new URL('../apps/web/public/office-workspace/index.html',import.meta.url),'utf8')
 const js=await readFile(new URL('../apps/web/public/office-workspace/workspace.js',import.meta.url),'utf8')
 const word=await readFile(new URL('../apps/web/public/office-workspace/word-panel.js',import.meta.url),'utf8')
 const excel=await readFile(new URL('../apps/web/public/office-workspace/excel-panel.js',import.meta.url),'utf8')
 const collection=await readFile(new URL('../apps/web/public/office-workspace/collection-panel.js',import.meta.url),'utf8')
 assert.match(html,/当前页面会话有效/);assert.match(html,/收集任务保存于本机/);assert.match(js,/关键词规则/)
 assert.match(js,/mountSearch/);assert.match(js,/mountExcel/);assert.match(js,/mountWord/);assert.match(js,/mountCollectionPanel/)
 assert.match(word,/makeDocx/);assert.match(word,/word.assist/);assert.match(excel,/makeWorkbook/);assert.match(collection,/不会覆盖旧台账/)
 assert.doesNotMatch(js,/renderExisting/);assert.match(js,/openLegacyInline/)
})

test('home smart office keeps the composer, pain points and underlying tools',async()=>{
 const html=await readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8')
 const js=await readFile(new URL('../apps/web/public/office-workspace/workspace.js',import.meta.url),'utf8')
 assert.match(html,/id="navHome"/)
 for(const id of ['navFileBuddy','navExcelAssistant','navWordAssistant','navCollection'])assert.doesNotMatch(html,new RegExp(`id="${id}"`))
 for(const id of ['viewFileBuddy','viewExcelAssistant','viewWordAssistant','viewCollection'])assert.match(html,new RegExp(`id="${id}"`))
 assert.match(html,/event\.origin !== location\.origin/);assert.match(html,/event\.source !== frame\.contentWindow/)
 assert.match(html,/app:open-excel/);assert.match(html,/app:open-filebuddy/);assert.match(html,/app:open-ppt/);assert.match(html,/<div class="prompt">[\s\S]*?id="officeUpload"[\s\S]*?id="homePrompt"[\s\S]*?<iframe id="officeWorkspaceFrame"[\s\S]*?<section class="office-pains" id="officePains"/);assert.match(html,/data-kind="智能办公"/);assert.doesNotMatch(html,/data-kind="美化"/);assert.doesNotMatch(html,/id="navOfficeWorkspace"|id="navCreative"/)
 assert.match(js,/openLegacyInline/);assert.match(js,/integrated-office/)
})

test('beautify is shared by the unified entry and format-only controls',async()=>{
 const html=await readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8')
 const workspace=await readFile(new URL('../apps/web/public/office-workspace/workspace.js',import.meta.url),'utf8')
 const word=await readFile(new URL('../apps/web/public/office-workspace/word-panel.js',import.meta.url),'utf8')
 const excel=await readFile(new URL('../apps/web/public/office-workspace/excel-panel.js',import.meta.url),'utf8')
 assert.match(html,/openSmartOffice/);assert.match(html,/office-workspace:ready/)
 assert.match(workspace,/优化 Word 草稿排版/);assert.match(workspace,/旧 DOCX/)
 assert.match(word,/优化排版/);assert.match(excel,/优化表格样式/);assert.match(excel,/headerColor:styleSelect\.value/)
})

test('visitor can start from task buttons, use clearly marked examples and select files directly',async()=>{
 const html=await readFile(new URL('../apps/web/public/office-workspace/index.html',import.meta.url),'utf8')
 const js=await readFile(new URL('../apps/web/public/office-workspace/workspace.js',import.meta.url),'utf8')
 const word=await readFile(new URL('../apps/web/public/office-workspace/word-panel.js',import.meta.url),'utf8')
 const excel=await readFile(new URL('../apps/web/public/office-workspace/excel-panel.js',import.meta.url),'utf8')
 assert.match(html,/<details class="ask-box" id="askBox">/);assert.match(html,/选一项工作，直接开始/)
 assert.match(js,/\['word','excel','search','collection','beautify','ppt','tasks','review','crossreview'\]/);assert.match(js,/pickFiles\(accept,callback\)/)
 assert.match(word,/先试试示例/);assert.match(word,/本地示例框架/);assert.match(word,/需配置模型/)
 assert.match(excel,/先试试示例/);assert.match(excel,/示例-部门预算汇总/);assert.match(excel,/选择 Excel 文件/)
})

test('smart office stays on the home composer and routes pain points inline',async()=>{
 const html=await readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8')
 const workspace=await readFile(new URL('../apps/web/public/office-workspace/workspace.js',import.meta.url),'utf8')
 const css=await readFile(new URL('../apps/web/public/office-workspace/workspace.css',import.meta.url),'utf8')
 for(const task of ['collection','excel','word','search','beautify','tasks'])assert.match(html,new RegExp(`data-office-task="${task}"`))
 assert.match(html,/id="officeModeChip"/);assert.match(html,/if \(officeActive\).*sendOffice/);assert.match(html,/action:'files',files/);assert.match(html,/action:'task-start'/);assert.match(html,/PPTX 请在演示文稿编辑器中另选/)
 assert.match(html,/embedded=1&inline=1/);assert.match(workspace,/data\.action==='task'/);assert.match(workspace,/data\.action==='start'/);assert.match(workspace,/data\.action==='files'/)
 assert.match(css,/\.inline-office \.intro,\.inline-office #quickGrid,\.inline-office #askBox/)
})
