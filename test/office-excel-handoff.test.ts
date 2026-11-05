import test from 'node:test'
import assert from 'node:assert/strict'
import {excelCheckSummary} from '../apps/web/public/office-workspace/excel-handoff.js'
test('handoff identifies analyzed sheets, units, truncation and read failures',()=>{
 const sheets=[{filename:'综合.xlsx',name:'预算',selected:true},{filename:'未选.xlsx',name:'旧表',selected:false}]
 const result={selectedCount:1,details:[{}],options:{currency:'CNY',unit:'万元',duplicates:['department']},summaries:Array.from({length:51},(_,i)=>({department:`部门${i}`,amount:i*10000,count:1})),issues:Array.from({length:31},(_,i)=>({file:'综合.xlsx',sheet:'预算',row:i+2,note:'检查提示'}))}
 const text=excelCheckSummary(result,sheets,['坏.xlsx：格式错误'])
 assert.match(text,/综合.xlsx \/ 预算/);assert.doesNotMatch(text,/未选.xlsx/)
 assert.match(text,/输入按万元处理，汇总金额以元表示/);assert.match(text,/坏.xlsx：格式错误/)
 assert.match(text,/疑似重复只标记，不删除/);assert.match(text,/仅列出前 50 个部门，共 51 个/);assert.match(text,/仅列出前 30 条，共 31 条/)
 assert.match(text,/部门1：10000 元/);assert.doesNotMatch(text,/部门50：/)
})
