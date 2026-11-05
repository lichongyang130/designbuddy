import test from 'node:test'
import assert from 'node:assert/strict'
import {compareLines,readComparable,comparisonText} from '../apps/web/public/office-workspace/compare-core.js'
test('comparison keeps exact line edits and preserves original line numbers',()=>{
 const edits=compareLines(['第一段','数值：100','不变'],['第一段','数值：200','不变','新段'])
 assert.deepEqual(edits,[{type:'删除',line:2,text:'数值：100'},{type:'新增',line:2,text:'数值：200'},{type:'新增',line:4,text:'新段'}])
 assert.deepEqual(compareLines(['相同'],['相同']),[])
 const output=comparisonText('旧.txt','新.txt',edits);assert.match(output,/旧文件：旧.txt/);assert.match(output,/新增 第 2 行/)
})
test('TXT comparison fails closed on unsupported encodings and size limits',async()=>{
 const file=new File(['第一行\r\n第二行'],'a.txt');assert.deepEqual((await readComparable(file)).lines,['第一行','第二行'])
 await assert.rejects(readComparable(new File([new Uint8Array([0xff,0xfe])],'bad.txt')),/UTF-8/)
 await assert.rejects(readComparable(new File([''], 'x.pdf')),/仅支持/)
 await assert.rejects(readComparable({name:'huge.txt',size:11*1024*1024}),/10 MB/)
 await assert.rejects(readComparable(new File(['x\n'.repeat(501)],'long.txt')),/500 行/)
})
