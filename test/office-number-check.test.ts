import test from 'node:test'
import assert from 'node:assert/strict'
import {canonicalNumber,findExactNumber,readNumberCell} from '../apps/web/public/office-workspace/number-check-core.js'
test('numeric comparison is exact and conservative about formats',()=>{
 assert.equal(canonicalNumber('1,000.00'),'1000');assert.equal(canonicalNumber('-0.00'),'0');assert.equal(canonicalNumber('0001.230'),'1.23')
 assert.throws(()=>canonicalNumber('20%'),/百分号/);assert.throws(()=>canonicalNumber('1e9'),/科学计数/);assert.throws(()=>canonicalNumber('1,00'),/普通数字/)
 assert.equal(findExactNumber('总数100，另一项1000；金额1,100。','100').count,1)
 assert.equal(findExactNumber('负数−100，科学数1e100及100e4。','100').count,0)
 assert.equal(findExactNumber('预算1,000.00元。','1,000.00').count,1)
})
test('formula cells require cache and percentage formats are not compared blindly',()=>{
 const book={getWorksheet(){return {getRow(){return {getCell(){return {value:{formula:'A1*2',result:42},numFmt:'0.00',isMerged:false}}}}}}}
 assert.equal(readNumberCell(book,'预算','B2').canonical,'42');assert.equal(readNumberCell(book,'预算','B2').formula,true)
 const missing={getWorksheet(){return {getRow(){return {getCell(){return {value:{formula:'A1'},numFmt:'0'}}}}}}}
 assert.throws(()=>readNumberCell(missing,'预算','B2'),/没有缓存/)
 const percent={getWorksheet(){return {getRow(){return {getCell(){return {value:0.1,numFmt:'0%'}}}}}}}
 assert.throws(()=>readNumberCell(percent,'预算','B2'),/百分比/);assert.throws(()=>readNumberCell(book,'预算','ZZ1'),/前 100 列/)
})
