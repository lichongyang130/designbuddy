import test from 'node:test'
import assert from 'node:assert/strict'
// @ts-ignore browser module
import {DEFAULT_FORMAT,draftTemplate,checkDocument,makeDocx} from '../apps/web/public/word-assistant-core.js'
import {unzip} from '../src/office/zip.ts'
import {readDocx} from '../src/office/docx.ts'
import {readFileSync} from 'node:fs'

test('local document skeletons make missing facts visible instead of inventing details',()=>{
 for(const kind of ['通知','请示','报告','会议纪要']){
  const d=draftTemplate(kind,'提交季度预算')
  assert.match(d.title,new RegExp(kind));assert.match(d.body,/［请/)
  const notes=checkDocument(d);assert.ok(notes.some((x:string)=>x.includes('待填写')))
 }
})

test('rule-based proofreading identifies a few possible mistakes without changing the original',()=>{
 const d={title:'通知',recipient:'各部门',body:'请在接再厉，既将完成。',signature:'办公室',date:'2026年2月30日'}
 const notes=checkDocument(d);assert.ok(notes.some((x:string)=>x.includes('在接再厉')));assert.ok(notes.some((x:string)=>x.includes('既将')));assert.ok(notes.some((x:string)=>x.includes('日期无效')));assert.ok(notes.some((x:string)=>x.includes('人工审核')));assert.match(d.body,/在接再厉/)
})

test('generated DOCX contains editable text, A4 margins, fonts, line spacing and page fields',()=>{
 const d={title:'关于预算的通知',recipient:'各部门',body:'一、工作要求\n请按要求提交。 & <核实>',signature:'办公室',date:'2026年11月4日'}
 const buf=Buffer.from(makeDocx(d,DEFAULT_FORMAT)),files=unzip(buf),xml=files.get('word/document.xml')!.toString(),footer=files.get('word/footer1.xml')!.toString()
 const read=readDocx(buf);assert.match(read.text,/关于预算的通知/);assert.match(read.text,/请按要求提交。 & <核实>/)
 assert.match(xml,/<w:pgSz w:w="11906" w:h="16838"\/>/);assert.match(xml,/w:top="2098"/);assert.match(xml,/w:line="560"/)
 assert.match(xml,/w:eastAsia="仿宋_GB2312"/);assert.match(xml,/w:eastAsia="黑体"/);assert.match(xml,/w:firstLineChars="200"/);assert.match(footer,/w:instr="PAGE"/)
 assert.ok(files.has('word/_rels/document.xml.rels'))
 assert.throws(()=>makeDocx({...d,title:''},DEFAULT_FORMAT),/标题和正文/)
})

test('Word assistant integrates explicit AI consent and local reference/export paths',()=>{
 const html=readFileSync('apps/web/public/index.html','utf8'),script=readFileSync('apps/web/public/word-assistant.js','utf8'),host=readFileSync('src/sdk/host.ts','utf8'),buddy=readFileSync('apps/web/public/file-buddy.js','utf8')
 assert.match(html,/id="navHome"/);assert.doesNotMatch(html,/id="navWordAssistant"/);assert.match(html,/mountWordAssistant\(rpc\)/);assert.match(html,/发送给所配置的模型服务/)
 assert.match(script,/window\.confirm/);assert.match(script,/rpc\('word\.assist'/);assert.match(script,/makeDocx\(/);assert.match(buddy,/word-assistant:reference-file/)
 assert.match(host,/case 'word\.assist'/);assert.match(host,/不得杜撰/);assert.match(host,/需要可用的语言模型/)
})
