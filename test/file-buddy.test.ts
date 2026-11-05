import test from 'node:test'
import assert from 'node:assert/strict'
// @ts-ignore browser modules
import {zipSync,strToU8} from '../apps/web/public/vendor/file-buddy/fflate.js'
// @ts-ignore browser modules
import {extractOffice,indexFile,parseQuery,searchFiles} from '../apps/web/public/file-buddy-core.js'
import {readFileSync} from 'node:fs'

const zip=(entries:Record<string,string>)=>zipSync(Object.fromEntries(Object.entries(entries).map(([name,text])=>[name,strToU8(text)])))
const make=(name:string,content:string,mtime:string)=>({name,path:`部门/${name}`,ext:name.split('.').pop(),text:content,modified:new Date(mtime).getTime(),status:'已索引正文'})

test('Office extraction handles xlsx shared strings, docx text and invalid archives',()=>{
 const xlsx=zip({'xl/workbook.xml':'<workbook><sheet name="市场部"/></workbook>','xl/sharedStrings.xml':'<sst><si><t>2026年第三季度预算</t></si><si><t>费用计划</t></si></sst>','xl/worksheets/sheet1.xml':'<sheet><v>1</v></sheet>'})
 assert.match(extractOffice(xlsx,'xlsx'),/第三季度预算/);assert.match(extractOffice(xlsx,'xlsx'),/费用计划/)
 const docx=zip({'word/document.xml':'<w:document><w:p><w:t>合同 &amp; 协议</w:t></w:p></w:document>'})
 assert.match(extractOffice(docx,'docx'),/合同 & 协议/)
 assert.throws(()=>extractOffice(zip({'foo':'bar'}),'docx'))
})

test('local file indexing reports unsupported and broken content honestly',async()=>{
 const good=new File([zip({'xl/workbook.xml':'<workbook/>','xl/sharedStrings.xml':'<t>预算</t>'})],'预算.xlsx',{lastModified:100})
 const result=await indexFile(good);assert.equal(result.status,'已索引正文');assert.match(result.text,/预算/)
 const legacy=await indexFile(new File(['legacy'],'旧表.xls'));assert.match(legacy.status,/旧版格式/)
 const broken=await indexFile(new File(['not an archive'],'broken.docx'));assert.match(broken.status,/无法解析/)
})

test('natural language search uses type, budget synonyms, quarter and explicit time evidence',()=>{
 const now=new Date(2026,10,4),q='帮我找一下今年第三季度各部门提交的预算 Excel',parsed=parseQuery(q,now)
 assert.equal(parsed.year,2026);assert.equal(parsed.quarter,3);assert.deepEqual(parsed.types,['xlsx','xls','csv']);assert.equal(parsed.submissionRequested,true)
 const rows=[make('市场费用计划.xlsx','部门费用计划','2026-07-10'),make('财务预算.xlsx','2026年第三季度预算','2026-11-01'),make('无关.xlsx','采购清单','2026-08-01'),make('预算.docx','2026年第三季度预算','2026-08-01'),make('预算旧版.xlsx','预算','2026-04-01')]
 const results=searchFiles(rows,q,now).results
 assert.equal(results.length,2);assert.ok(results.some((x:any)=>x.reasons.some((r:string)=>r.includes('不是提交时间'))));assert.ok(results.some((x:any)=>x.reasons.some((r:string)=>r.includes('文件文字'))))
})

test('search does not claim metadata-only files have body matches and handles quarter rollover',()=>{
 const prev=parseQuery('上季度预算 Excel',new Date(2026,0,3));assert.equal(prev.year,2025);assert.equal(prev.quarter,4)
 const rows=[make('市场部合同.docx','签订协议','2026-09-01'),make('人事合同.docx','合同','2026-09-01')]
 const hits=searchFiles(rows,'市场部合同 Word').results;assert.equal(hits.length,1);assert.match(hits[0].row.name,/市场部/)
 assert.equal(searchFiles(rows,'完全不存在的东西').results.length,0)
})

test('file buddy runs in browser memory without network upload and is integrated into navigation',()=>{
 const script=readFileSync('apps/web/public/file-buddy.js','utf8'),core=readFileSync('apps/web/public/file-buddy-core.js','utf8'),html=readFileSync('apps/web/public/index.html','utf8')
 assert.doesNotMatch(script,/\bfetch\s*\(|XMLHttpRequest|localStorage|indexedDB/)
 assert.doesNotMatch(core,/\bfetch\s*\(|XMLHttpRequest|localStorage|indexedDB/)
 assert.match(core,/isEvalSupported:false/);assert.match(html,/id="navHome"/);assert.doesNotMatch(html,/id="navFileBuddy"/);assert.match(html,/id="viewFileBuddy"/);assert.match(html,/setView\('filebuddy'\)/)
})

test('file sources are explicit local import labels, not authenticated accounts',async()=>{
 const {FILE_SOURCES,filterSource}=await import('../apps/web/public/file-buddy-sources.js')
 assert.deepEqual(FILE_SOURCES.map((s:any)=>s.id),['computer','wechat','email','cloud'])
 assert.match(FILE_SOURCES.find((s:any)=>s.id==='wechat').hint,/不会登录微信/)
 assert.match(FILE_SOURCES.find((s:any)=>s.id==='email').hint,/不会登录邮箱/)
 assert.match(FILE_SOURCES.find((s:any)=>s.id==='cloud').hint,/不会连接网盘账号/)
 const rows=[{...make('预算.xlsx','预算','2026-08-10'),source:'wechat'},{...make('预算.xlsx','预算','2026-08-10'),source:'email'},{...make('预算.xlsx','预算','2026-08-10'),source:'cloud'},{...make('预算.xlsx','预算','2026-08-10'),source:'computer'}]
 assert.equal(filterSource(rows,'all').length,4);assert.equal(filterSource(rows,'email').length,1)
 const result=searchFiles(rows,'微信里的预算 Excel',new Date(2026,10,4))
 assert.equal(result.results.length,1);assert.equal(result.results[0].row.source,'wechat')
 assert.match(result.results[0].reasons.join(' '),/手动标记/)
 assert.equal(searchFiles(filterSource(rows,'email'),'微信里的预算 Excel').results.length,0)
 const html=readFileSync('apps/web/public/index.html','utf8')
 assert.match(html,/cnFileSources/);assert.match(html,/不连接微信、邮箱或网盘账户/)
})

test('authorized folder traversal is scoped, bounded and reports partial failures',async()=>{
 const {collectDirectory}=await import('../apps/web/public/file-buddy-directories.js')
 const file=(name:string)=>({kind:'file',async getFile(){return new File(['预算'],name)}})
 const folder=(name:string,entries:Record<string,any>)=>({name,kind:'directory',async *entries(){for(const item of Object.entries(entries))yield item}})
 const root=folder('Finance',{'budget.xlsx':file('budget.xlsx'),sub:folder('sub',{'notes.txt':file('notes.txt'),'ignore.jpg':file('ignore.jpg')})})
 const result=await collectDirectory(root,(name:string)=>/\.(xlsx|txt)$/.test(name))
 assert.deepEqual(result.records.map((x:any)=>x.path).sort(),['Finance/budget.xlsx','Finance/sub/notes.txt'])
 assert.deepEqual(result.errors,[]);assert.equal(result.truncated,false)
 assert.equal((await collectDirectory(root,()=>true,{maxFiles:1})).truncated,true)
 const broken=folder('Fail',{'bad.xlsx':{kind:'file',async getFile(){throw Error('denied')}}})
 assert.deepEqual((await collectDirectory(broken,()=>true)).errors,['Fail/bad.xlsx'])
 await assert.rejects(()=>collectDirectory(root,()=>true,{shouldStop:()=>true}),/取消/)
})

test('folder handles remain session-only and source labels name all requested providers without implying an account connection',async()=>{
 const {FILE_SOURCES}=await import('../apps/web/public/file-buddy-sources.js')
 assert.match(FILE_SOURCES.find((s:any)=>s.id==='email').description,/Gmail.*Outlook.*QQ/)
 assert.match(FILE_SOURCES.find((s:any)=>s.id==='cloud').description,/百度网盘.*Google Drive.*OneDrive/)
 const script=readFileSync('apps/web/public/file-buddy.js','utf8')
 assert.match(script,/showDirectoryPicker\(\{mode:'read'\}\)/)
 assert.match(script,/queryPermission\(\{mode:'read'\}\)/)
 assert.match(script,/保留已有索引/)
 assert.doesNotMatch(script,/localStorage|indexedDB|requestPermission\(/)
 const html=readFileSync('apps/web/public/index.html','utf8')
 assert.match(html,/文件夹授权和索引只保留在当前页面内/)
})
